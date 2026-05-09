import { getCloudinaryConfig, isCloudinaryConfigured, uploadToCloudinary } from './cloudinaryUpload.js';

export const PLACEHOLDER_IMAGE =
  'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="900" height="700" viewBox="0 0 900 700"><rect width="900" height="700" fill="%23f8f0e5"/><rect x="90" y="90" width="720" height="520" rx="28" fill="%23fffaf4" stroke="%23d8c6ad" stroke-width="6"/><circle cx="332" cy="278" r="58" fill="%23efd7d2"/><path d="M185 520l165-175 113 118 73-76 179 133H185z" fill="%23c9a45b" opacity=".78"/><text x="450" y="622" text-anchor="middle" font-family="Arial, sans-serif" font-size="34" font-weight="700" fill="%235a3f32">Imagem indisponivel</text></svg>';

export function isValidImageSource(value) {
  const source = value?.trim();
  if (!source) {
    return false;
  }

  if (source.startsWith('data:image/')) {
    return true;
  }

  if (source.startsWith('/')) {
    return /\.(apng|avif|gif|jpe?g|png|svg|webp)(\?.*)?$/i.test(source);
  }

  try {
    const url = new URL(source);
    return ['http:', 'https:'].includes(url.protocol);
  } catch {
    return false;
  }
}

export function isValidVideoSource(value) {
  const source = value?.trim();
  if (!source) {
    return true;
  }

  if (source.startsWith('data:video/')) {
    return true;
  }

  if (source.startsWith('/')) {
    return /\.(mp4|mov|ogg|webm)(\?.*)?$/i.test(source);
  }

  try {
    const url = new URL(source);
    return ['http:', 'https:'].includes(url.protocol);
  } catch {
    return false;
  }
}

export function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

export function getVideoType(url) {
  if (!url) {
    return 'link';
  }

  return url.startsWith('data:video/') || /\.(mp4|mov|ogg|webm)(\?.*)?$/i.test(url)
    ? 'file'
    : 'link';
}

export function getMediaStorageMode() {
  return isCloudinaryConfigured() ? 'cloudinary' : 'local';
}

export function getMediaStorageDiagnostics() {
  return getCloudinaryConfig();
}

export async function uploadMediaForStorage(file, options = {}) {
  const returnDetails = Boolean(options.returnDetails);

  if (isCloudinaryConfigured()) {
    try {
      const uploaded = await uploadToCloudinary(file);
      return returnDetails
        ? { url: uploaded.url, storage: 'cloudinary', error: null }
        : uploaded.url;
    } catch (error) {
      if (!options.fallbackOnError) {
        throw error;
      }

      const fallbackUrl = await fileToBase64(file);
      return returnDetails
        ? { url: fallbackUrl, storage: 'local', error }
        : fallbackUrl;
    }
  }

  const fallbackUrl = await fileToBase64(file);
  return returnDetails
    ? { url: fallbackUrl, storage: 'local', error: null }
    : fallbackUrl;
}
