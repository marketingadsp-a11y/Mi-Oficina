
import { getAccessToken } from './authService';

/**
 * Helper for fetch with timeout
 */
const fetchWithTimeout = async (url: string, options: any = {}, timeout = 10000) => {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);
  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal
    });
    clearTimeout(id);
    return response;
  } catch (e) {
    clearTimeout(id);
    throw e;
  }
};

/**
 * Ensures a folder exists in Google Drive. Returns the folder ID.
 */
export const ensureFolder = async (folderName: string): Promise<string> => {
  const token = await getAccessToken();
  if (!token) throw new Error("No access token available.");

  // Search for folder
  const query = `name = '${folderName}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`;
  const listResponse = await fetchWithTimeout(`https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=files(id)`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  
  if (!listResponse.ok) {
    let errorDetail = "";
    try {
      const err = await listResponse.json();
      errorDetail = err.error?.message || JSON.stringify(err);
    } catch (e) {
      errorDetail = listResponse.statusText || `Status ${listResponse.status}`;
    }
    throw new Error(`Error searching folder: ${errorDetail}`);
  }

  const listData = await listResponse.json();
  if (listData.files && listData.files.length > 0) {
    return listData.files[0].id;
  }

  // Create folder if not found
  const createResponse = await fetchWithTimeout('https://www.googleapis.com/drive/v3/files', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name: folderName,
      mimeType: 'application/vnd.google-apps.folder',
    }),
  });

  if (!createResponse.ok) {
    let errorDetail = "";
    try {
      const err = await createResponse.json();
      errorDetail = err.error?.message || JSON.stringify(err);
    } catch (e) {
      errorDetail = createResponse.statusText || `Status ${createResponse.status}`;
    }
    throw new Error(`Error creating folder: ${errorDetail}`);
  }

  const createData = await createResponse.json();
  return createData.id;
};

/**
 * Uploads a base64 image to a specific folder in Google Drive.
 */
export const uploadImageToDrive = async (base64Data: string, fileName: string, folderId?: string) => {
  const token = await getAccessToken();
  if (!token) throw new Error("No access token available.");

  // Extract content type and base64 string
  const matches = base64Data.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
  if (!matches || matches.length !== 3) throw new Error("Invalid base64 format");
  
  const contentType = matches[1];
  const b64 = matches[2];
  
  // Convert base64 to Blob
  const byteCharacters = atob(b64);
  const byteNumbers = new Array(byteCharacters.length);
  for (let i = 0; i < byteCharacters.length; i++) {
    byteNumbers[i] = byteCharacters.charCodeAt(i);
  }
  const byteArray = new Uint8Array(byteNumbers);
  const imageBlob = new Blob([byteArray], { type: contentType });

  const metadata = {
    name: fileName,
    parents: folderId ? [folderId] : [],
  };

  const form = new FormData();
  form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
  form.append('file', imageBlob);

  const response = await fetchWithTimeout('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink,webContentLink', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  }, 25000); // 25s for large images

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error?.message || 'Error uploading image to Drive');
  }

  return response.json();
};

/**
 * Uploads a JSON object to Google Drive.
 */
export const uploadFileToDrive = async (fileName: string, data: any, mimeType: string = 'application/json') => {
  const token = await getAccessToken();
  if (!token) throw new Error("No access token available. Please sign in with Google.");

  const metadata = {
    name: fileName,
    mimeType: mimeType,
  };

  const form = new FormData();
  form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
  form.append('file', new Blob([typeof data === 'string' ? data : JSON.stringify(data, null, 2)], { type: mimeType }));

  const response = await fetchWithTimeout('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: form,
  }, 30000);

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error?.message || 'Error uploading file to Drive');
  }

  return response.json();
};

/**
 * Lists files from Google Drive.
 */
export const listDriveFiles = async (q: string = "mimeType = 'application/json'") => {
  const token = await getAccessToken();
  if (!token) throw new Error("No access token available. Please sign in with Google.");

  const response = await fetchWithTimeout(`https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&fields=files(id,name,mimeType,createdTime)`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error?.message || 'Error listing files from Drive');
  }

  return response.json();
};

/**
 * Downloads a file from Google Drive.
 */
export const downloadFileFromDrive = async (fileId: string) => {
  const token = await getAccessToken();
  if (!token) throw new Error("No access token available. Please sign in with Google.");

  const response = await fetchWithTimeout(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  }, 30000);

  if (!response.ok) {
    throw new Error('Error downloading file from Drive');
  }

  return response.json();
};
