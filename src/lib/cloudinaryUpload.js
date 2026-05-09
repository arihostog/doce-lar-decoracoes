const CLOUDINARY_CLOUD_NAME = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME?.trim();
const CLOUDINARY_UPLOAD_PRESET = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET?.trim();
const CLOUDINARY_FOLDER = import.meta.env.VITE_CLOUDINARY_FOLDER?.trim();

export function getCloudinaryConfig() {
  return {
    cloudName: CLOUDINARY_CLOUD_NAME || '',
    uploadPreset: CLOUDINARY_UPLOAD_PRESET || '',
    folder: CLOUDINARY_FOLDER || '',
    isConfigured: isCloudinaryConfigured(),
    mode: isCloudinaryConfigured() ? 'cloudinary' : 'local',
  };
}

export function isCloudinaryConfigured() {
  return Boolean(CLOUDINARY_CLOUD_NAME && CLOUDINARY_UPLOAD_PRESET);
}

export function getCloudinaryMissingConfig() {
  return [
    !CLOUDINARY_CLOUD_NAME && 'VITE_CLOUDINARY_CLOUD_NAME',
    !CLOUDINARY_UPLOAD_PRESET && 'VITE_CLOUDINARY_UPLOAD_PRESET',
  ].filter(Boolean);
}

export async function uploadToCloudinary(file, options = {}) {
  if (!isCloudinaryConfigured()) {
    throw new Error(`Cloudinary nao configurado: ${getCloudinaryMissingConfig().join(', ')}`);
  }

  const resourceType = options.resourceType || (file.type.startsWith('video/') ? 'video' : 'image');
  const endpoint = `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/${resourceType}/upload`;
  const formData = new FormData();

  formData.append('file', file);
  formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);
  if (options.folder || CLOUDINARY_FOLDER) {
    formData.append('folder', options.folder || CLOUDINARY_FOLDER);
  }

  const response = await fetch(endpoint, {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Falha no upload para Cloudinary: ${errorBody}`);
  }

  const data = await response.json();
  return {
    url: data.secure_url,
    publicId: data.public_id,
    resourceType: data.resource_type,
    format: data.format,
    bytes: data.bytes,
  };
}
