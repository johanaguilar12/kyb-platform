import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { logAuditAction } from '@/lib/audit';
import { createDocumentSchema } from '@/lib/validators';
import { extractDocumentData, validateExtractedData } from '@/lib/ai-extractor';
import { ZodError } from 'zod';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const fileId = searchParams.get('fileId');

    if (!fileId) {
      return NextResponse.json(
        { success: false, error: 'Missing required query parameter: fileId' },
        { status: 400 }
      );
    }

    const documents = await prisma.document.findMany({
      where: { fileId },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ success: true, data: documents });
  } catch (error: any) {
    console.error('Failed to get documents:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Database error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    let fileId: string;
    let type: string;
    let name: string;
    let url: string | undefined = undefined;
    let manualIssueDate: string | null = null;
    let manualExpirationDate: string | null = null;
    let bufferOrText: Buffer | string = '';

    const contentType = request.headers.get('content-type') || '';
    if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData();
      const file = formData.get('file') as File | null;
      const t = formData.get('type') as string | null;
      const fId = formData.get('fileId') as string | null;
      const n = formData.get('name') as string | null;

      if (!file || !t || !fId) {
        return NextResponse.json(
          { success: false, error: 'Missing required fields in form data: file, type, fileId' },
          { status: 400 }
        );
      }

      fileId = fId;
      type = t;
      name = n || file.name;

      const arrayBuffer = await file.arrayBuffer();
      bufferOrText = Buffer.from(arrayBuffer);
    } else {
      const body = await request.json();
      const validated = createDocumentSchema.parse(body);
      fileId = validated.fileId;
      type = validated.type;
      name = validated.name;
      url = validated.url ?? undefined;
      manualIssueDate = validated.issueDate ?? null;
      manualExpirationDate = validated.expirationDate ?? null;
      bufferOrText = validated.textContent ?? '';
    }

    const allowedTypes = [
      'articles_of_incorporation',
      'legal_representative_id',
      'power_of_attorney',
      'proof_of_address',
      'rfc',
      'tax_status_certificate',
      'manifestation_under_protest',
      'controlling_party',
    ];
    if (!allowedTypes.includes(type)) {
      return NextResponse.json(
        { success: false, error: `Invalid document type: ${type}` },
        { status: 400 }
      );
    }

    // Verify file exists
    const file = await prisma.file.findUnique({
      where: { id: fileId },
    });
    if (!file) {
      return NextResponse.json(
        { success: false, error: `File not found with id ${fileId}` },
        { status: 404 }
      );
    }

    // Resolve raw input as buffer
    const buffer = typeof bufferOrText === 'string' ? Buffer.from(bufferOrText) : bufferOrText;

    // Validate file size (maximum 2MB)
    const MAX_SIZE = 2 * 1024 * 1024;
    if (buffer && buffer.length > MAX_SIZE) {
      const sizeInMB = (buffer.length / (1024 * 1024)).toFixed(2);
      return NextResponse.json(
        { success: false, error: `File size is too large (${sizeInMB}MB). Maximum allowed size is 2MB.` },
        { status: 400 }
      );
    }

    // Calculate SHA256 hash if input is a buffer
    let pdfHash: string | null = null;
    if (buffer && buffer.length > 0) {
      const { createHash } = require('crypto');
      pdfHash = createHash('sha256').update(buffer).digest('hex');
    }

    // Call strict PDF/Gemini extraction
    let aiExtractedData: any = null;
    try {
      console.log(`Running strict PDF/Gemini extraction for document type: ${type}...`);
      const result = await extractDocumentData(type, buffer);
      
      // Perform strict validation checks
      validateExtractedData(type, result.data);
      
      aiExtractedData = result.data;
    } catch (parseOrValidationError: any) {
      console.error('Strict validation/parsing failed:', parseOrValidationError.message);
      return NextResponse.json(
        { success: false, error: parseOrValidationError.message },
        { status: 400 }
      );
    }

    // Compress PDF before upload if it's a buffer
    let finalUploadBuffer = buffer;
    let compressedSize: number | null = null;
    if (Buffer.isBuffer(bufferOrText)) {
      const { compressPdf } = await import('@/lib/pdf-compressor');
      const originalSize = buffer.length;
      finalUploadBuffer = await compressPdf(buffer);
      compressedSize = finalUploadBuffer.length;
      console.log(
        `PDF Upload Compression Log: Original size = ${originalSize} bytes, Compressed size = ${compressedSize} bytes`
      );
    }

    // Upload PDF to Supabase Storage if input is a buffer
    let storageUrl = url;
    if (Buffer.isBuffer(bufferOrText)) {
      const { uploadFileToStorage } = await import('@/lib/storage');
      storageUrl = await uploadFileToStorage(fileId, type, name, finalUploadBuffer);
    }

    // Set other active documents of the same type to inactive (version control)
    await prisma.document.updateMany({
      where: {
        fileId: fileId,
        type: type,
        isActive: true,
      },
      data: {
        isActive: false,
      },
    });

    // Find the latest version of this document type
    const latestDoc = await prisma.document.findFirst({
      where: {
        fileId: fileId,
        type: type,
      },
      orderBy: {
        version: 'desc',
      },
    });
    const nextVersion = latestDoc ? latestDoc.version + 1 : 1;

    // Resolve dates from extracted data
    const resolvedIssueDate = aiExtractedData.issueDate || aiExtractedData.incorporationDate;

    // Create the new document with automatic confirmation
    const document = await prisma.document.create({
      data: {
        fileId: fileId,
        type: type,
        name: name,
        url: storageUrl,
        issueDate: resolvedIssueDate ? new Date(resolvedIssueDate) : undefined,
        expirationDate: aiExtractedData.expirationDate ? new Date(aiExtractedData.expirationDate) : undefined,
        aiExtractedData: aiExtractedData,
        pdfHash: pdfHash,
        fileSize: compressedSize,
        confirmationStatus: 'confirmed',
        confirmedAt: new Date(),
        isActive: true,
        version: nextVersion,
      },
    });

    // Log the upload in Audit Log
    await logAuditAction({
      action: 'document_uploaded',
      actor: 'SYSTEM_USER',
      fileId: fileId,
      afterState: document as any,
      reason: `Uploaded new version (v${nextVersion}) of document type ${type} with strict local/Gemini validation status confirmed`,
    });

    return NextResponse.json({ success: true, data: document });
  } catch (error: any) {
    console.error('Failed to upload document metadata:', error);
    if (error instanceof ZodError) {
      return NextResponse.json(
        { success: false, error: 'Validation error', details: error.issues },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { success: false, error: error.message || 'Database error' },
      { status: 500 }
    );
  }
}
