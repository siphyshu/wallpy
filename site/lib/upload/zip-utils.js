import JSZip from 'jszip';

/**
 * Create a ZIP file containing wallpack images and schedule.toml
 * @param {Array} files - Array of file objects with { file: File, name: string }
 * @param {string} scheduleToml - The schedule.toml content as a string
 * @param {string} slug - The pack slug for naming
 * @returns {Promise<Blob>} - The ZIP file as a Blob
 */
export async function createPackZip(files, scheduleToml, slug) {
  const zip = new JSZip();

  // Add images to the ZIP in images/ folder
  for (const fileObj of files) {
    const file = fileObj.file;
    if (file && file.type?.startsWith('image/')) {
      const arrayBuffer = await file.arrayBuffer();
      zip.file(`images/${fileObj.name}`, arrayBuffer);
    }
  }

  // Add schedule.toml
  zip.file('schedule.toml', scheduleToml);

  // Generate the ZIP
  const zipBlob = await zip.generateAsync({
    type: 'blob',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 }
  });

  return zipBlob;
}

/**
 * Convert a File to ArrayBuffer
 * @param {File} file - The file to convert
 * @returns {Promise<ArrayBuffer>}
 */
export async function fileToArrayBuffer(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsArrayBuffer(file);
  });
}

/**
 * Get the file extension from a filename
 * @param {string} filename - The filename
 * @returns {string} - The extension (e.g., 'jpg', 'png')
 */
export function getFileExtension(filename) {
  return filename.split('.').pop()?.toLowerCase() || '';
}

/**
 * Generate a safe filename from the original
 * @param {string} filename - The original filename
 * @returns {string} - A sanitized filename
 */
export function sanitizeFilename(filename) {
  return filename
    .replace(/[^a-zA-Z0-9.-]/g, '_')
    .replace(/_+/g, '_')
    .toLowerCase();
}

