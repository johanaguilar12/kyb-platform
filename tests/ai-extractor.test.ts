import { vi, describe, it, expect, beforeEach } from 'vitest';
import { extractDocumentData, validateExtractedData } from '@/lib/ai-extractor';
import { extractTextFromBuffer } from '@/lib/local-pdf-parser-helper';

const mockGenerateContent = vi.fn();

// Mock the Google Generative AI SDK
vi.mock('@google/generative-ai', () => {
  return {
    GoogleGenerativeAI: class {
      getGenerativeModel() {
        return {
          generateContent: mockGenerateContent,
        };
      }
    },
  };
});

// Mock the local PDF text extraction helper (used for PDF format pre-checks)
vi.mock('@/lib/local-pdf-parser-helper', () => {
  return {
    extractTextFromBuffer: vi.fn().mockImplementation(async (buffer: Buffer) => {
      if (buffer.length === 0) throw new Error('Invalid PDF structure');
      return 'Valid PDF Text Content';
    }),
  };
});

describe('Gemini Vision AI Extractor & Validation Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.GOOGLE_GEMINI_API_KEY = 'mock-api-key';
  });

  // 1. Tax Status Certificate
  it('should extract and validate Tax Status Certificate (CSF) correctly', async () => {
    mockGenerateContent.mockResolvedValueOnce({
      response: {
        text: () => JSON.stringify({
          rfc: 'AAA010101AAA',
          legalName: 'COMPANIA DE PRUEBA SA DE CV',
          issueDate: '2026-07-01',
          taxRegime: 'Regimen General de Ley Personas Morales',
          address: 'C.P. 06000',
        }),
      },
    });

    const result = await extractDocumentData('tax_status_certificate', Buffer.from('Valid PDF Header'));

    expect(result.type).toBe('tax_status_certificate');
    expect(result.data.rfc).toBe('AAA010101AAA');
    expect(result.data.legalName).toBe('COMPANIA DE PRUEBA SA DE CV');

    // Strict validation should pass
    expect(() => validateExtractedData('tax_status_certificate', result.data)).not.toThrow();
  });

  // 2. Validation Failures
  it('should throw validation error if RFC format is invalid', () => {
    const invalidData = {
      rfc: 'INVALID-RFC',
      legalName: 'COMPANIA DE PRUEBA SA DE CV',
      issueDate: '2026-07-01',
      taxRegime: 'Regimen General de Ley Personas Morales',
      address: 'C.P. 06000',
    };

    expect(() => validateExtractedData('tax_status_certificate', invalidData)).toThrow(
      'Document validation failed. Required data could not be extracted. Please upload a clearer document.'
    );
  });

  it('should throw validation error if required document-specific fields are missing', () => {
    const missingRegime = {
      rfc: 'AAA010101AAA',
      legalName: 'COMPANIA DE PRUEBA SA DE CV',
      issueDate: '2026-07-01',
      address: 'C.P. 06000',
    };

    expect(() => validateExtractedData('tax_status_certificate', missingRegime)).toThrow(
      'Document validation failed. Required data could not be extracted. Please upload a clearer document.'
    );
  });

  // 3. Expiration date checks for representative ID
  it('should validate representative ID fields', () => {
    const validID = {
      name: 'MARIA GOMEZ REYES',
      curp: 'GORM800101HDFLRS09',
      issueDate: '2022-10-10',
      expirationDate: '2032-10-10',
    };

    expect(() => validateExtractedData('legal_representative_id', validID)).not.toThrow();

    const invalidID = {
      name: 'MARIA GOMEZ REYES',
      curp: 'GORM800101HDFLRS09',
      issueDate: '2022-10-10',
      // Missing expirationDate
    };

    expect(() => validateExtractedData('legal_representative_id', invalidID)).toThrow(
      'Document validation failed. Required data could not be extracted. Please upload a clearer document.'
    );
  });

  // 4. Invalid PDF Format error
  it('should reject document if PDF precheck fails', async () => {
    vi.mocked(extractTextFromBuffer).mockRejectedValueOnce(new Error('Invalid PDF'));

    await expect(
      extractDocumentData('tax_status_certificate', Buffer.from(''))
    ).rejects.toThrow("Unable to read this document. Please ensure it's a valid PDF.");
  });

  // 5. 429 AI unavailable error
  it('should throw standardized error if Gemini API throws exception', async () => {
    mockGenerateContent.mockRejectedValueOnce(new Error('Quota exceeded'));

    await expect(
      extractDocumentData('tax_status_certificate', Buffer.from('Valid PDF Header'))
    ).rejects.toThrow('AI service temporarily unavailable. Please try again in a few moments.');
  });
});
