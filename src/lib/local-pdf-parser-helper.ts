import { Buffer } from 'buffer';

/**
 * Extract raw text content from a binary PDF Buffer locally.
 * Bypasses Next.js Turbopack worker path routing errors dynamically.
 *
 * @param buffer Raw PDF buffer
 * @returns Concatenated text pages or empty string on error
 */
export async function extractTextFromBuffer(buffer: Buffer): Promise<string> {
  try {
    const pdfParseModule = (await import('pdf-parse')) as any;
    
    // Configure worker source to avoid bundling/chunk errors in Next.js Server side
    try {
      const path = require('path');
      const fs = require('fs');
      let workerUrl = '';
      
      const localPath = path.resolve('node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs');
      if (fs.existsSync(localPath)) {
        workerUrl = 'file://' + localPath;
      } else {
        const fallbackPath = path.join(process.cwd(), 'node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs');
        if (fs.existsSync(fallbackPath)) {
          workerUrl = 'file://' + fallbackPath;
        } else {
          workerUrl = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/5.4.296/pdf.worker.min.mjs';
        }
      }
      
      pdfParseModule.PDFParse.setWorker(workerUrl);
    } catch (workerErr) {
      console.error('Failed to configure pdf.worker.mjs path:', workerErr);
    }

    if (pdfParseModule.PDFParse) {
      const parser = new pdfParseModule.PDFParse({ data: buffer });
      const parsedPdf = await parser.getText();
      const text = parsedPdf.text || '';
      await parser.destroy();
      return text;
    } else {
      const pdfParse = typeof pdfParseModule === 'function' 
        ? pdfParseModule 
        : (pdfParseModule.default || pdfParseModule);
      const parsedPdf = await pdfParse(buffer);
      return parsedPdf.text || '';
    }
  } catch (error) {
    console.error('[Local Parser] PDF extraction failed:', error);
    return '';
  }
}
