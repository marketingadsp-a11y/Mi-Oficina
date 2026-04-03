
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
