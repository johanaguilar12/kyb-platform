import { describe, it, expect } from 'vitest';
import { PDFDocument } from 'pdf-lib';
import { compressPdf } from '@/lib/pdf-compressor';

// Helper to dynamically build a valid multi-page PDF for test assertions
async function createDummyPdf(pagesCount: number = 3): Promise<Buffer> {
  const pdfDoc = await PDFDocument.create();
  for (let i = 0; i < pagesCount; i++) {
    const page = pdfDoc.addPage([600, 400]);
    page.drawText(`Page ${i + 1} Content for Testing PDF Compression`, { x: 50, y: 300 });
  }
  // Add metadata to be stripped
  pdfDoc.setTitle('Compression Test Title');
  pdfDoc.setAuthor('Test Author');
  pdfDoc.setSubject('Testing PDF metadata stripping');
  pdfDoc.setKeywords(['test', 'compression']);
  pdfDoc.setProducer('Test Producer');
  pdfDoc.setCreator('Test Creator');

  const bytes = await pdfDoc.save();
  return Buffer.from(bytes);
}

describe('PDF Compressor Unit Tests', () => {
  it('should reduce file size by stripping metadata and using object streams', async () => {
    const originalBuffer = await createDummyPdf(3);
    const originalSize = originalBuffer.length;

    const compressedBuffer = await compressPdf(originalBuffer);
    const compressedSize = compressedBuffer.length;

    console.log(`Original: ${originalSize} bytes, Compressed: ${compressedSize} bytes`);
    
    // Size should be smaller
    expect(compressedSize).toBeLessThan(originalSize);
  });

  it('should preserve ALL pages after compression', async () => {
    const originalPageCount = 4;
    const originalBuffer = await createDummyPdf(originalPageCount);

    const compressedBuffer = await compressPdf(originalBuffer);
    
    // Load both and compare page count
    const origPdf = await PDFDocument.load(originalBuffer);
    const compPdf = await PDFDocument.load(compressedBuffer);

    expect(origPdf.getPageCount()).toBe(originalPageCount);
    expect(compPdf.getPageCount()).toBe(originalPageCount);
    expect(compPdf.getPageCount()).toBe(origPdf.getPageCount());
  });

  it('should strip all metadata fields', async () => {
    const originalBuffer = await createDummyPdf(2);
    const compressedBuffer = await compressPdf(originalBuffer);

    const compPdf = await PDFDocument.load(compressedBuffer);

    expect(compPdf.getTitle()).toBeFalsy();
    expect(compPdf.getAuthor()).toBeFalsy();
    expect(compPdf.getSubject()).toBeFalsy();
    expect(compPdf.getCreator()).toBeFalsy();
    expect(compPdf.getProducer()).toContain('pdf-lib');
  });

  it('should return the original buffer untouched if compression throws an error', async () => {
    const corruptBuffer = Buffer.from('NOT A PDF FILE BUFFER');
    const resultBuffer = await compressPdf(corruptBuffer);

    // Should gracefully return original input on parsing error
    expect(resultBuffer).toEqual(corruptBuffer);
  });
});
