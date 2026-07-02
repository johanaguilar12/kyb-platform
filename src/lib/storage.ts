import { createClient } from '@supabase/supabase-js';

/**
 * Uploads a document buffer to Supabase Storage and returns its public URL.
 * Falls back to generating a public URL structure if Supabase credentials are not configured.
 *
 * @param fileId The dossier folder ID
 * @param type The document type prefix
 * @param fileName The uploaded filename
 * @param buffer Raw PDF buffer
 * @returns Public URL for PDF visualization
 */
export async function uploadFileToStorage(
  fileId: string,
  type: string,
  fileName: string,
  buffer: Buffer
): Promise<string> {
  const projectRef = process.env.SUPABASE_PROJECT_REF || 'mdhcvmdudvdpehhxhvvm';
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || `https://${projectRef}.supabase.co`;
  const supabaseKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.SUPABASE_ANON_KEY;

  let filePath = fileName.replace(/\s+/g, '_'); // sanitize spaces

  if (supabaseUrl && supabaseKey) {
    try {
      const supabase = createClient(supabaseUrl, supabaseKey);

      // 1. Upload file with original filename directly (upsert: false to detect conflict)
      let { data, error } = await supabase.storage
        .from('documents')
        .upload(filePath, buffer, {
          contentType: 'application/pdf',
          upsert: false,
        });

      // 2. Handle conflict: If it already exists, prefix with timestamp
      if (error && (error.message?.includes('already exists') || (error as any).statusCode === '409')) {
        const timestamp = Date.now();
        filePath = `${timestamp}_${fileName.replace(/\s+/g, '_')}`;
        const retryResult = await supabase.storage
          .from('documents')
          .upload(filePath, buffer, {
            contentType: 'application/pdf',
            upsert: false,
          });
        data = retryResult.data;
        error = retryResult.error;
      }

      if (error) {
        throw new Error(`Supabase storage upload error: ${error.message}`);
      } else if (data) {
        // 3. Get public URL from Supabase
        const { data: urlData } = supabase.storage
          .from('documents')
          .getPublicUrl(filePath);
        return urlData.publicUrl;
      }
    } catch (err: any) {
      console.error('Failed to upload file to Supabase storage:', err.message);
      throw err;
    }
  }

  // Fallback URL generation if keys are missing or upload fails
  try {
    const dummyClient = createClient(supabaseUrl, 'dummy-key-for-fallback');
    const { data: urlData } = dummyClient.storage
      .from('documents')
      .getPublicUrl(filePath);
    return urlData.publicUrl;
  } catch {
    return `${supabaseUrl}/storage/v1/object/public/documents/${filePath}`;
  }
}
