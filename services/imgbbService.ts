/**
 * Service to handle image uploads to imgBB
 */

export const uploadToImgBB = async (base64Data: string, customApiKey?: string): Promise<string> => {
  const apiKey = customApiKey || import.meta.env.VITE_IMGBB_API_KEY;
  
  if (!apiKey) {
    throw new Error("API Key de imgBB no configurada. Por favor, añádela en los Ajustes.");
  }

  // imgBB expects either a binary file or a base64 string (without the data:image/xxx;base64, prefix)
  const base64Content = base64Data.split(',')[1] || base64Data;

  const formData = new FormData();
  formData.append('image', base64Content);

  try {
    const response = await fetch(`https://api.imgbb.com/1/upload?key=${apiKey}`, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error?.message || 'Error al subir a imgBB');
    }

    const result = await response.json();
    return result.data.url;
  } catch (error: any) {
    console.error('imgBB Upload Error:', error);
    throw new Error(error.message || 'Error de conexión con imgBB');
  }
};
