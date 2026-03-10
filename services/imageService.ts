// Configuration for the conversion endpoint
// Uses VITE_API_BASE_URL in production (Cloud Run), falls back to localhost for development
const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080';
const CONVERT_ENDPOINT = `${API_BASE}/convert`;

/**
 * Checks if a file is likely a HEIC/HEIF image.
 */
export const isHeic = (file: File): boolean => {
  const name = file.name.toLowerCase();
  return name.endsWith('.heic') || name.endsWith('.heif') || file.type === 'image/heic' || file.type === 'image/heif';
};

/**
 * Sends a HEIC file to the backend for conversion to JPG.
 */
export const convertHeicToJpg = async (file: File): Promise<File> => {
  const formData = new FormData();
  formData.append('file', file);

  try {
    const response = await fetch(CONVERT_ENDPOINT, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      throw new Error(`Conversion failed: ${response.statusText}`);
    }

    const blob = await response.blob();
    // Create a new File object with the JPG data
    const newFileName = file.name.replace(/\.(heic|heif)$/i, '.jpg');
    return new File([blob], newFileName, { type: 'image/jpeg' });
  } catch (error) {
    console.error("HEIC Conversion error:", error);
    throw error;
  }
};