
import { GoogleGenAI } from "@google/genai";
import { Employee, Expense, Task } from "../types";
import { getAppSettings } from "./dbService";

// --- CONFIGURACIÓN DEFINITIVA ---
// Actualizada a la nueva llave terminada en ...pg
const USER_PROVIDED_KEY = "AQ.Ab8RN6KBWwPbT4jL9GDFk7CMbfhEvTyTUlnVJixCxGTp28mApg";

// Helper para obtener la instancia de IA
const getAiInstance = async (): Promise<GoogleGenAI | null> => {
  let finalKey = USER_PROVIDED_KEY;

  // 1. Intentamos leer de la base de datos por si la cambiaste en Ajustes
  try {
    const settings = await getAppSettings();
    if (settings.googleApiKey && settings.googleApiKey.trim().length > 10) {
      finalKey = settings.googleApiKey.trim();
    }
  } catch (e) {
    // Si falla la DB, usamos la constante hardcoded
    console.warn("Usando llave hardcoded por fallo en DB");
  }

  // @ts-ignore
  if (!finalKey) return null;

  return new GoogleGenAI({ apiKey: finalKey });
};

export const validateApiKey = async (apiKey: string): Promise<boolean> => {
  try {
    const ai = new GoogleGenAI({ apiKey: apiKey.trim() });
    await ai.models.generateContent({
      model: 'gemini-3-flash-preview', 
      contents: 'ping',
    });
    return true;
  } catch (e: any) {
    console.warn("Validation error details:", e);
    // Si el error es 429 (Cuota) o 503 (Servicio no disponible), la llave ES válida,
    // el problema es temporal o de saldo. Devolvemos true para permitir guardarla.
    if (e.status === 429 || e.code === 429 || e.message?.includes('429')) return true;
    if (e.status === 503 || e.code === 503) return true;
    
    // Si es 403 o 400, la llave es inválida.
    return false;
  }
};

/**
 * Genera una imagen de Mascota.
 * SIN REINTENTOS MÁGICOS: Si falla, falla y te dice por qué.
 */
export const generateMascotaImage = async (
  referenceImageBase64: string,
  userPrompt: string
): Promise<{ imageUrl: string | null; error?: string }> => {
  
  const ai = await getAiInstance();
  if (!ai) return { imageUrl: null, error: "No hay API Key configurada." };

  try {
    // Limpieza de Base64
    const cleanBase64 = referenceImageBase64.replace(/^data:image\/(png|jpeg|jpg|webp);base64,/, "");

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: {
        parts: [
          { inlineData: { mimeType: 'image/png', data: cleanBase64 } },
          { text: `Instrucción: ${userPrompt}. Genera una imagen de ALTA CALIDAD.` }
        ]
      },
      config: { imageConfig: { aspectRatio: "1:1" } }
    });

    // Extracción de imagen
    for (const candidate of response.candidates || []) {
      for (const part of candidate.content.parts) {
        if (part.inlineData && part.inlineData.data) {
          return { imageUrl: `data:image/png;base64,${part.inlineData.data}` };
        }
      }
    }

    return { imageUrl: null, error: "La IA no generó imagen. Intenta con otro prompt." };

  } catch (error: any) {
    console.error("Gemini Error:", error);
    
    // Manejo explícito de errores
    if (error.status === 429 || error.code === 429 || error.message?.includes('429')) {
      return { imageUrl: null, error: "⏳ Límite de velocidad alcanzado. Espera 1 minuto antes de generar otra imagen." };
    }
    
    if (error.message?.includes('safety')) {
      return { imageUrl: null, error: "⚠️ La imagen fue bloqueada por filtros de seguridad. Intenta un prompt más suave." };
    }

    return { imageUrl: null, error: "Error de conexión con Google Gemini. Verifica tu API Key." };
  }
};

/**
 * Genera un video de Mascota usando Veo.
 */
export const generateMascotaVideo = async (
  referenceImageBase64: string,
  userPrompt: string,
  onProgress?: (message: string) => void
): Promise<{ videoUrl: string | null; error?: string }> => {
  const ai = await getAiInstance();
  if (!ai) return { videoUrl: null, error: "No hay API Key configurada." };

  try {
    const cleanBase64 = referenceImageBase64.replace(/^data:image\/(png|jpeg|jpg|webp);base64,/, "");

    if (onProgress) onProgress("Iniciando Veo para generación de video...");

    const operation = await ai.models.generateVideos({
      model: 'veo-3.1-lite-generate-preview',
      prompt: userPrompt,
      image: {
        imageBytes: cleanBase64,
        mimeType: 'image/png',
      },
      config: {
        numberOfVideos: 1,
        resolution: '720p',
        aspectRatio: '16:9'
      }
    });

    if (onProgress) onProgress("Procesando y generando animación...");

    let completed = false;
    let attempts = 0;
    const maxAttempts = 30; // 300 segundos (5 minutos)

    while (!completed && attempts < maxAttempts) {
      attempts++;
      await new Promise((resolve) => setTimeout(resolve, 10000));

      const updated = await ai.operations.getVideosOperation({ operation });

      if (updated.done) {
        completed = true;
        const uri = updated.response?.generatedVideos?.[0]?.video?.uri;
        if (uri) {
          if (onProgress) onProgress("Descargando video de los servidores de Google...");

          let finalKey = USER_PROVIDED_KEY;
          try {
            const settings = await getAppSettings();
            if (settings.googleApiKey && settings.googleApiKey.trim().length > 10) {
              finalKey = settings.googleApiKey.trim();
            }
          } catch (e) {}

          const videoRes = await fetch(uri, {
            headers: { 'x-goog-api-key': finalKey }
          });

          if (!videoRes.ok) {
            return { videoUrl: null, error: `Error descargando el video: ${videoRes.statusText}` };
          }

          const blob = await videoRes.blob();
          const reader = new FileReader();
          const base64Promise = new Promise<string>((resolve, reject) => {
            reader.onloadend = () => resolve(reader.result as string);
            reader.onerror = reject;
          });
          
          reader.readAsDataURL(blob);
          const base64DataUrl = await base64Promise;

          return { videoUrl: base64DataUrl };
        } else {
          return { videoUrl: null, error: "No se generó el video." };
        }
      }

      if (onProgress) {
        onProgress(`Generando video con Veo... (Intento ${attempts}/${maxAttempts})`);
      }
    }

    return { videoUrl: null, error: "La generación de video tomó demasiado tiempo." };
  } catch (error: any) {
    console.error("Veo Error:", error);
    
    // Detailed permission error handling for premium models like Google Veo
    const isPermissionError = 
      error.status === 403 || 
      error.code === 403 || 
      error.message?.includes('permission') || 
      error.message?.includes('PERMISSION_DENIED');

    if (isPermissionError) {
      return { 
        videoUrl: null, 
        error: "🔒 Error de Permisos (PERMISSION_DENIED). La API de generación de videos Google Veo requiere una clave con facturación activa (Paid API Key). Por favor, pulsa el botón 'Habilitar Facturación' en el chat o configúrala en Ajustes." 
      };
    }

    if (error.status === 429 || error.code === 429 || error.message?.includes('429')) {
      return { videoUrl: null, error: "⏳ Límite de velocidad alcanzado. Espera un momento antes de generar otra vez." };
    }
    return { videoUrl: null, error: error.message || "Error al conectar con Google Veo." };
  }
};

/**
 * Genera insights de texto.
 */
export const generateOfficeInsights = async (
  employees: Employee[],
  expenses: Expense[],
  tasks: Task[],
  type: 'general' | 'financial' | 'productivity'
): Promise<string> => {
  
  const ai = await getAiInstance();
  if (!ai) return "Error: API Key no válida.";

  const empSummary = employees.map(e => `${e.firstName} ${e.lastName}`).join(', ');
  const expSummary = expenses.slice(0, 10).map(e => `${e.description}: $${e.amount}`).join(', '); 
  
  let prompt = `Analiza esto brevemente (${type}): Empleados: [${empSummary}]. Gastos: [${expSummary}].`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
    });
    return response.text || "Sin respuesta.";
  } catch (error: any) {
    if (error.status === 429) return "⚠️ Demasiadas peticiones. Intenta en un momento.";
    return "No se pudo conectar con el asistente.";
  }
};
