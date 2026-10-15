import { encode } from 'blurhash';

/**
 * Generate a thumbnail from an image file
 * @param {File} file - The image file
 * @param {number} maxWidth - Maximum width of the thumbnail
 * @returns {Promise<{blob: Blob, dataUrl: string}>}
 */
export async function generateThumbnail(file, maxWidth = 400) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    img.onload = () => {
      // Calculate new dimensions maintaining aspect ratio
      let width = img.width;
      let height = img.height;

      if (width > maxWidth) {
        height = (height * maxWidth) / width;
        width = maxWidth;
      }

      canvas.width = width;
      canvas.height = height;

      // Draw and compress
      ctx.drawImage(img, 0, 0, width, height);

      canvas.toBlob(
        (blob) => {
          if (blob) {
            const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
            resolve({ blob, dataUrl });
          } else {
            reject(new Error('Failed to generate thumbnail'));
          }
        },
        'image/jpeg',
        0.85
      );

      // Clean up
      URL.revokeObjectURL(img.src);
    };

    img.onerror = () => {
      URL.revokeObjectURL(img.src);
      reject(new Error('Failed to load image'));
    };

    img.src = URL.createObjectURL(file);
  });
}

/**
 * Generate a blurhash from an image file
 * @param {File} file - The image file
 * @param {number} componentX - Number of components in X direction (1-9)
 * @param {number} componentY - Number of components in Y direction (1-9)
 * @returns {Promise<string>} - The blurhash string
 */
export async function generateBlurhash(file, componentX = 4, componentY = 3) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    img.onload = () => {
      // Use a small size for blurhash calculation (faster)
      const size = 64;
      const aspectRatio = img.width / img.height;
      
      let width, height;
      if (aspectRatio > 1) {
        width = size;
        height = Math.round(size / aspectRatio);
      } else {
        height = size;
        width = Math.round(size * aspectRatio);
      }

      canvas.width = width;
      canvas.height = height;
      ctx.drawImage(img, 0, 0, width, height);

      const imageData = ctx.getImageData(0, 0, width, height);
      
      try {
        const hash = encode(imageData.data, width, height, componentX, componentY);
        resolve(hash);
      } catch (error) {
        reject(new Error('Failed to generate blurhash: ' + error.message));
      }

      // Clean up
      URL.revokeObjectURL(img.src);
    };

    img.onerror = () => {
      URL.revokeObjectURL(img.src);
      reject(new Error('Failed to load image for blurhash'));
    };

    img.src = URL.createObjectURL(file);
  });
}

/**
 * Generate slug from title
 * @param {string} title - The pack title
 * @returns {string} - URL-friendly slug
 */
export function generateSlug(title) {
  return title
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '') // Remove special characters
    .replace(/\s+/g, '-') // Replace spaces with hyphens
    .replace(/-+/g, '-') // Replace multiple hyphens with single
    .substring(0, 50); // Limit length
}

/**
 * Get the first image from the uploaded files to use as preview
 * @param {Array} files - Array of uploaded file objects
 * @returns {File|null} - The first image file or null
 */
export function getPreviewImage(files) {
  const imageFile = files.find(f => f.type?.startsWith('image/'));
  return imageFile?.file || null;
}

