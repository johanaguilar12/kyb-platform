import { GoogleGenerativeAI } from '@google/generative-ai';
import { extractTextFromBuffer } from './local-pdf-parser-helper';

export interface ExtractedDocumentData {
  type: string;
  data: {
    rfc?: string;
    legalName?: string;
    issueDate?: string;
    expirationDate?: string;
    taxRegime?: string;
    incorporationDate?: string;
    legalRepresentative?: string;
    name?: string;
    curp?: string;
    address?: string;
    legalRepresentativeComplete?: boolean;
    shareholdersComplete?: boolean;
    controllingPartyComplete?: boolean;
  };
  error?: string;
}

/**
 * Validates the extracted document fields according to strict business rules.
 * Throws validation error if any required fields are missing or malformed.
 */
export function validateExtractedData(type: string, data: Record<string, any>): void {
  const errMsg = 'Document validation failed. Required data could not be extracted. Please upload a clearer document.';

  // 1. Validate RFC if expected
  if (type === 'tax_status_certificate' || type === 'articles_of_incorporation') {
    if (!data.rfc) {
      throw new Error(errMsg);
    }
    const rfcRegex = /^[A-ZÑ&]{3,4}\d{6}[A-Z0-9]{3}$/i;
    if (!rfcRegex.test(data.rfc)) {
      throw new Error(errMsg);
    }
  }

  // 2. Validate Legal Name
  if (type === 'tax_status_certificate' || type === 'articles_of_incorporation') {
    if (!data.legalName || !data.legalName.trim()) {
      throw new Error(errMsg);
    }
  }

  // 3. Validate Issue Date
  if (type === 'tax_status_certificate' || type === 'legal_representative_id' || type === 'proof_of_address') {
    if (!data.issueDate) {
      throw new Error(errMsg);
    }
    const date = new Date(data.issueDate);
    if (isNaN(date.getTime())) {
      throw new Error(errMsg);
    }
  }

  // 4. Validate Document-Specific Required Fields
  if (type === 'tax_status_certificate') {
    if (!data.taxRegime || !data.address) {
      throw new Error(errMsg);
    }
  } else if (type === 'articles_of_incorporation') {
    if (!data.incorporationDate || !data.legalRepresentative) {
      throw new Error(errMsg);
    }
    const date = new Date(data.incorporationDate);
    if (isNaN(date.getTime())) {
      throw new Error(errMsg);
    }
  } else if (type === 'legal_representative_id') {
    if (!data.name || !data.curp || !data.expirationDate) {
      throw new Error(errMsg);
    }
    const curpRegex = /^[A-Z]{4}\d{6}[HM][A-Z]{5}[A-Z0-9]\d$/i;
    if (!curpRegex.test(data.curp)) {
      throw new Error(errMsg);
    }
    const expDate = new Date(data.expirationDate);
    if (isNaN(expDate.getTime())) {
      throw new Error(errMsg);
    }
  } else if (type === 'proof_of_address') {
    if (!data.address) {
      throw new Error(errMsg);
    }
  }
}

function getSchemaPromptForType(documentType: string): string {
  switch (documentType) {
    case 'tax_status_certificate':
      return `{
  "rfc": "RFC of the entity (12 or 13 characters)",
  "legalName": "Denominación o Razón Social",
  "issueDate": "Fecha de emisión in YYYY-MM-DD format",
  "taxRegime": "Régimen fiscal",
  "address": "Address or C.P. (Zip Code)"
}`;
    case 'articles_of_incorporation':
      return `{
  "rfc": "RFC of the company (12 characters)",
  "legalName": "Denominación o Razón Social",
  "incorporationDate": "Fecha de constitución in YYYY-MM-DD format",
  "legalRepresentative": "Name of legal representative",
  "legalRepresentativeComplete": true/false indicator,
  "shareholdersComplete": true/false indicator,
  "controllingPartyComplete": true/false indicator,
  "shareholdersCount": number of shareholders/partners,
  "hasComplexOwnership": true/false indicator if structure is complex (uses trusts/fideicomisos, holdings, investment funds, SAPIs, subsidiaries, or corporate shareholders),
  "ownershipReason": "Brief reason explaining the complexity level of the ownership structure"
}`;
    case 'legal_representative_id':
      return `{
  "name": "Full name of legal representative",
  "curp": "CURP (18 characters)",
  "issueDate": "Fecha de expedición/emisión in YYYY-MM-DD format",
  "expirationDate": "Vigencia/Expiración in YYYY-MM-DD format"
}`;
    case 'proof_of_address':
      return `{
  "address": "Full address or C.P. (Zip code)",
  "issueDate": "Fecha de emisión/corte in YYYY-MM-DD format"
}`;
    default:
      return `{}`;
  }
}

/**
 * Extract structured information from document PDF Buffer using Google Gemini Vision API.
 * Validates PDF structure beforehand using pdf-parse.
 *
 * @param documentType The type of document being analyzed
 * @param buffer The PDF raw file buffer
 * @returns Extracted compliance parameters
 */
export async function extractDocumentData(
  documentType: string,
  buffer: Buffer
): Promise<ExtractedDocumentData> {
  // First, verify the PDF is valid by trying to extract its text
  try {
    const text = await extractTextFromBuffer(buffer);
    if (!text && buffer.length < 10) {
      throw new Error('Empty PDF');
    }
  } catch (error) {
    throw new Error("Unable to read this document. Please ensure it's a valid PDF.");
  }

  const apiKey = process.env.GOOGLE_GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GOOGLE_GEMINI_API_KEY environment variable is not defined.');
  }

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: 'gemini-2.5-flash',
      generationConfig: { responseMimeType: 'application/json' },
    });

    const prompt = `You are a compliance assistant extracting data from Mexican tax and legal documents.
Analyze this PDF document of type "${documentType}" and extract the following fields into a JSON object:
${getSchemaPromptForType(documentType)}

Do not include any extra fields, markdown formatting, or explanations. Ensure the output is a valid JSON object.`;

    const response = await model.generateContent([
      {
        inlineData: {
          data: buffer.toString('base64'),
          mimeType: 'application/pdf',
        },
      },
      prompt,
    ]);

    const text = response.response.text();
    const parsedData = JSON.parse(text);
    return {
      type: documentType,
      data: parsedData,
    };
  } catch (error: any) {
    console.error('Gemini extraction failed:', error);
    // Standardize Gemini SDK failure messages as requested
    throw new Error('AI service temporarily unavailable. Please try again in a few moments.');
  }
}
