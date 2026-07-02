import { PDFDocument } from 'pdf-lib';

/**
 * Compresses a PDF buffer by stripping metadata and saving with object streams enabled.
 * Keeps ALL pages intact.
 *
 * @param buffer The input PDF Buffer
 * @returns The compressed PDF Buffer, or the original buffer if compression fails
 */
export async function compressPdf(buffer: Buffer): Promise<Buffer> {
  const originalSize = buffer.length;
  try {
    // 1. Load the PDF
    const pdfDoc = await PDFDocument.load(buffer);

    // 2. Strip all metadata (title, author, subject, keywords, producer, creator)
    pdfDoc.setTitle('');
    pdfDoc.setAuthor('');
    pdfDoc.setSubject('');
    pdfDoc.setKeywords([]);
    pdfDoc.setProducer('');
    pdfDoc.setCreator('');

    // 3. Save with object streams enabled for maximum compression
    const compressedBytes = await pdfDoc.save({
      useObjectStreams: true,
    });

    const compressedBuffer = Buffer.from(compressedBytes);
    const compressedSize = compressedBuffer.length;
    const reductionPercent = originalSize > 0 
      ? ((originalSize - compressedSize) / originalSize) * 100 
      : 0;

    console.log(
      `PDF Compression Success: Original = ${originalSize} bytes, Compressed = ${compressedSize} bytes, Reduction = ${reductionPercent.toFixed(2)}%`
    );

    return compressedBuffer;
  } catch (error: any) {
    console.error('PDF compression failed, returning original buffer:', error.message);
    return buffer;
  }
}
