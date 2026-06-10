import React, { useState, useEffect, useRef } from 'react';
import { Sparkles, Download, Image as ImageIcon, Settings, Loader2, Trash2, Calendar, AlertTriangle, Clock, Cake, Wand2 } from 'lucide-react';
import { generateMascotaImage } from '../services/geminiService';
import { 
  getGalleryImages, 
  saveGalleryImage, 
  deleteGalleryImage, 
  getAllDailyBirthdayEvents, 
  DailyBirthdayEvent 
} from '../services/dbService';
import { GeneratedImage, Employee } from '../types';

interface MascotaProps {
  mascotaUrl: string;
  mascotaName: string;
  onOpenSettings: () => void;
  employees: Employee[];
  onSelectBdayEmployee?: (employeeId: string) => void;
}

export const Mascota: React.FC<MascotaProps> = ({ 
  mascotaUrl, 
  mascotaName, 
  onOpenSettings, 
  employees,
  onSelectBdayEmployee
}) => {
  const [activeTab, setActiveTab] = useState<'creativo' | 'cumpleanos'>('creativo');
  const [prompt, setPrompt] = useState('');
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Cooldown State (Anti-Spam)
  const [cooldown, setCooldown] = useState(0);
  const cooldownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // History State
  const [history, setHistory] = useState<GeneratedImage[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // Birthday Events History State
  const [bdayEventsHistory, setBdayEventsHistory] = useState<DailyBirthdayEvent[]>([]);
  const [loadingBdayHistory, setLoadingBdayHistory] = useState(false);

  const loadBdayHistory = async () => {
    setLoadingBdayHistory(true);
    try {
      const events = await getAllDailyBirthdayEvents();
      setBdayEventsHistory(events);
    } catch (e) {
      console.error("Error loading birthday events history:", e);
    } finally {
      setLoadingBdayHistory(false);
    }
  };

  useEffect(() => {
    loadHistory();
    return () => {
      if (cooldownRef.current) clearInterval(cooldownRef.current);
    };
  }, []);

  useEffect(() => {
    if (activeTab === 'cumpleanos') {
      loadBdayHistory();
    }
  }, [activeTab]);

  const startCooldown = (seconds: number) => {
    setCooldown(seconds);
    if (cooldownRef.current) clearInterval(cooldownRef.current);
    
    cooldownRef.current = setInterval(() => {
      setCooldown(prev => {
        if (prev <= 1) {
          if (cooldownRef.current) clearInterval(cooldownRef.current);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const loadHistory = async () => {
    setLoadingHistory(true);
    try {
      const images = await getGalleryImages();
      setHistory(images);
    } catch (e) {
      console.error("Error loading gallery:", e);
    } finally {
      setLoadingHistory(false);
    }
  };

  const urlToBase64 = async (url: string): Promise<string> => {
    if (url.startsWith('data:')) {
        return url;
    }

    try {
      const response = await fetch(url);
      const blob = await response.blob();
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
    } catch (e) {
      throw new Error("No se pudo cargar la imagen de referencia. Si usas un enlace externo, intenta usar la opción 'Subir Imagen' en Ajustes.");
    }
  };

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!mascotaUrl) {
      setError("Primero debes configurar la URL de tu Mascota en Ajustes.");
      return;
    }
    if (!prompt) return;

    setLoading(true);
    setError(null);
    setGeneratedImage(null);

    try {
      const base64Reference = await urlToBase64(mascotaUrl);
      const result = await generateMascotaImage(base64Reference, prompt);
      
      if (result.error) {
        setError(result.error);
        if (result.error.includes('Límite') || result.error.includes('429')) {
          startCooldown(60); 
        } else {
          startCooldown(5);
        }
      } else if (result.imageUrl) {
        setGeneratedImage(result.imageUrl);
        startCooldown(15);
        
        try {
          await saveGalleryImage({
            imageUrl: result.imageUrl,
            prompt: prompt,
            createdAt: new Date().toISOString()
          });
          loadHistory();
        } catch (saveError) {
          console.error("Error saving to gallery:", saveError);
        }
      }
    } catch (err: any) {
      setError(err.message || "Error desconocido al procesar la imagen.");
      startCooldown(5);
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = (imgUrl: string, namePrefix: string = 'mascota') => {
    if (imgUrl) {
      const link = document.createElement('a');
      link.href = imgUrl;
      link.download = `${namePrefix}-${Date.now()}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  const handleDeleteHistoryItem = async (id: string) => {
    if (confirm('¿Eliminar esta imagen del historial?')) {
      try {
        await deleteGalleryImage(id);
        setHistory(prev => prev.filter(img => img.id !== id));
      } catch (e) {
        alert("Error al eliminar imagen.");
      }
    }
  };

  if (!mascotaUrl) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-8 text-center animate-fade-in">
        <div className="bg-blue-100 p-6 rounded-full mb-6">
          <ImageIcon className="w-16 h-16 text-blue-500" />
        </div>
        <h2 className="text-2xl font-bold text-gray-800 mb-2">Configura tu Mascota</h2>
        <p className="text-gray-500 max-w-md mb-6">
          Para comenzar a crear imágenes, necesitas definir el personaje de tu oficina (URL de la imagen) en los ajustes.
        </p>
        <button 
          onClick={onOpenSettings}
          className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-3 rounded-xl font-medium flex items-center shadow-lg hover:shadow-indigo-500/30 transition-all"
        >
          <Settings className="w-5 h-5 mr-2" /> Ir a Ajustes
        </button>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-6xl mx-auto h-full flex flex-col overflow-y-auto custom-scrollbar">
      
      <div className="flex items-center justify-between mb-8 flex-shrink-0">
        <div>
          <h2 className="text-3xl font-bold text-gray-800 flex items-center">
            <Sparkles className="w-8 h-8 text-blue-500 mr-3" />
            Mi {mascotaName}
          </h2>
          <p className="text-gray-500 mt-1">Genera contenido creativo para tu oficina.</p>
        </div>
        <div className="hidden md:block">
           <img src={mascotaUrl} alt="Ref" className="w-12 h-12 rounded-full border-2 border-white shadow-md object-cover" title="Imagen de referencia actual" />
        </div>
      </div>

      {/* Tabs Menu inside Mi Mascota */}
      <div className="flex border-b border-gray-100 mb-8 flex-shrink-0">
        <button
          type="button"
          onClick={() => setActiveTab('creativo')}
          className={`py-3 px-6 font-bold text-sm border-b-2 flex items-center gap-2 transition-all ${
            activeTab === 'creativo'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-gray-400 hover:text-gray-600 hover:border-gray-200'
          }`}
        >
          <Sparkles className="w-4 h-4" /> Generador Creativo
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('cumpleanos')}
          className={`py-3 px-6 font-bold text-sm border-b-2 flex items-center gap-2 transition-all ${
            activeTab === 'cumpleanos'
              ? 'border-indigo-600 text-indigo-600'
              : 'border-transparent text-gray-400 hover:text-gray-600 hover:border-gray-200'
          }`}
        >
          <Cake className="w-4 h-4 text-indigo-500" /> Galería de Cumpleaños
        </button>
      </div>

      {activeTab === 'creativo' ? (
        <>
          <div className="flex flex-col lg:flex-row gap-8 mb-12 flex-shrink-0">
            <div className="w-full lg:w-1/3 flex flex-col gap-4">
              <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex-1 flex flex-col">
                <label className="text-sm font-bold text-gray-700 mb-2 block">¿Qué quieres que haga {mascotaName}?</label>
                <form onSubmit={handleGenerate} className="flex-1 flex flex-col">
                  <textarea 
                    className="w-full flex-1 border border-gray-200 rounded-xl p-4 text-gray-700 focus:ring-2 focus:ring-blue-200 focus:border-blue-400 outline-none resize-none bg-gray-50 mb-4 min-h-[120px]"
                    placeholder="Ej: Un anuncio que diga '¡Bienvenidos!', sosteniendo una taza de café, celebrando un cumpleaños..."
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                  />
                  
                  {error && (
                    <div className="bg-red-50 text-red-700 text-sm p-4 rounded-lg mb-4 border border-red-200 flex items-start animate-pulse">
                      <AlertTriangle className="w-5 h-5 mr-2 flex-shrink-0" />
                      <div>
                        <span className="font-bold block">¡Atención!</span>
                        {error}
                      </div>
                    </div>
                  )}

                  <button 
                    type="submit" 
                    disabled={loading || !prompt || cooldown > 0}
                    className={`w-full font-bold py-4 rounded-xl shadow-lg transform transition-all flex items-center justify-center
                      ${cooldown > 0 
                        ? 'bg-gray-400 cursor-not-allowed text-white' 
                        : 'bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white active:scale-95'
                      }
                      ${(loading || !prompt) && 'opacity-50 cursor-not-allowed'}
                    `}
                  >
                    {loading ? (
                      <>
                        <Loader2 className="w-5 h-5 mr-2 animate-spin" /> Creando...
                      </>
                    ) : cooldown > 0 ? (
                      <>
                        <Clock className="w-5 h-5 mr-2" /> Espera {cooldown}s
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-5 h-5 mr-2" /> Generar Imagen
                      </>
                    )}
                  </button>
                  <div className="mt-3 text-center space-y-1">
                    {cooldown > 0 && (
                      <p className="text-xs text-gray-400">
                        Esperando enfriamiento para proteger tu llave API.
                      </p>
                    )}
                    <p className="text-[10px] text-gray-400 flex items-center justify-center">
                      <AlertTriangle className="w-3 h-3 mr-1" />
                      Cada imagen generada tiene un costo asociado. Úsalo con moderación.
                    </p>
                  </div>
                </form>
              </div>
            </div>

            <div className="w-full lg:w-2/3 bg-gray-100 rounded-2xl border border-gray-200 min-h-[300px] flex items-center justify-center relative overflow-hidden group">
              {loading ? (
                <div className="text-center">
                  <div className="w-20 h-20 border-4 border-blue-200 border-t-blue-500 rounded-full animate-spin mx-auto mb-4"></div>
                  <p className="text-gray-500 font-medium animate-pulse">{mascotaName} se está preparando...</p>
                </div>
              ) : generatedImage ? (
                <>
                  <img 
                    src={generatedImage} 
                    alt="Generado por IA" 
                    className="w-full h-full object-contain p-4 animate-fade-in max-h-[400px]"
                  />
                  <div className="absolute bottom-6 right-6 flex gap-3">
                    <button 
                      onClick={() => handleDownload(generatedImage, 'mascota-actual')}
                      className="bg-white text-gray-800 px-6 py-3 rounded-xl font-bold shadow-xl hover:bg-gray-50 transition-colors flex items-center"
                    >
                      <Download className="w-5 h-5 mr-2 text-indigo-600" /> Descargar
                    </button>
                  </div>
                </>
              ) : (
                <div className="text-center text-gray-400 p-8">
                  <div className="w-24 h-24 bg-gray-200 rounded-full flex items-center justify-center mx-auto mb-4">
                    <ImageIcon className="w-10 h-10 opacity-30" />
                  </div>
                  <p className="text-lg font-medium">Tu creación aparecerá aquí</p>
                </div>
              )}
            </div>
          </div>

          <div className="flex-1">
            <h3 className="text-xl font-bold text-gray-800 mb-4 flex items-center">
               <Calendar className="w-5 h-5 mr-2 text-gray-500" /> Historial Creativo
            </h3>
            
            {loadingHistory ? (
              <div className="flex justify-center py-10">
                <Loader2 className="w-8 h-8 text-gray-300 animate-spin" />
              </div>
            ) : history.length === 0 ? (
              <div className="bg-gray-50 border border-dashed border-gray-200 rounded-xl p-8 text-center text-gray-400">
                <p>Aún no hay imágenes guardadas en el historial.</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {history.map((item) => (
                  <div key={item.id} className="group relative bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-md transition-all">
                    <div className="aspect-square bg-gray-100 relative overflow-hidden">
                      <img src={item.imageUrl} alt={item.prompt} className="w-full h-full object-cover transition-transform group-hover:scale-105" />
                      <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                        <button 
                          onClick={() => handleDownload(item.imageUrl, 'historial')}
                          className="p-2 bg-white rounded-full text-indigo-600 hover:bg-gray-100"
                          title="Descargar"
                        >
                          <Download className="w-5 h-5" />
                        </button>
                        <button 
                          onClick={() => handleDeleteHistoryItem(item.id)}
                          className="p-2 bg-white rounded-full text-red-500 hover:bg-red-50"
                          title="Eliminar"
                        >
                          <Trash2 className="w-5 h-5" />
                        </button>
                      </div>
                    </div>
                    <div className="p-3">
                      <p className="text-xs text-gray-500 mb-1">{new Date(item.createdAt).toLocaleDateString()}</p>
                      <p className="text-sm font-medium text-gray-800 line-clamp-2" title={item.prompt}>
                        {item.prompt}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      ) : (
        <div className="flex-1 animate-fade-in space-y-6">
          {loadingBdayHistory ? (
            <div className="flex flex-col items-center justify-center py-12">
              <Loader2 className="w-12 h-12 text-indigo-500 animate-spin mb-3" />
              <p className="text-gray-500 font-medium">Cargando felicitaciones generadas...</p>
            </div>
          ) : bdayEventsHistory.length === 0 ? (
            <div className="bg-gray-50 border border-dashed border-gray-200 rounded-2xl p-12 text-center text-gray-400 max-w-xl mx-auto mt-6">
              <Cake className="w-12 h-12 text-indigo-400 opacity-60 mx-auto mb-4" />
              <h4 className="font-bold text-gray-700 text-lg mb-2">Sin felicitaciones guardadas</h4>
              <p className="text-sm">
                Cuando alguien de la oficina cumpla años y generes una tarjeta o video en el <b>Panel Principal</b>, se guardará aquí automáticamente para que todos puedan verla y descargarla sin costo extra.
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="bg-gradient-to-r from-indigo-50 to-purple-50 rounded-2xl p-6 border border-indigo-100/40">
                <h3 className="font-bold text-gray-800 text-lg flex items-center gap-2 mb-2">
                  <Cake className="w-5 h-5 text-indigo-600 animate-bounce" />
                  Galería de Cumpleaños (Ahorro Inteligente Activo)
                </h3>
                <p className="text-sm text-gray-600">
                  Estas felicitaciones están guardadas en la base de datos de la oficina de manera segura. Puedes visualizarlas y descargarlas libremente sin consumir saldo ni cuotas de API.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                {bdayEventsHistory.map(event => {
                  const emp = employees?.find(e => e.id === event.employeeId);
                  if (!emp) return null;

                  return (
                    <div 
                      key={event.id}
                      className="bg-white border border-gray-100 rounded-2xl p-4 flex flex-col justify-between hover:border-indigo-200 hover:shadow-xl transition-all group duration-300 relative overflow-hidden"
                    >
                      <div className="flex flex-col gap-3">
                        <div className="aspect-video w-full rounded-xl bg-gray-50 flex items-center justify-center border border-gray-100 overflow-hidden relative group/media">
                          {event.videoUrl ? (
                            <>
                              <video src={event.videoUrl} className="w-full h-full object-cover" controls muted playsInline />
                              <div className="absolute inset-x-0 bottom-0 bg-black/60 p-2 text-center opacity-0 group-hover/media:opacity-100 transition-opacity">
                                <p className="text-[10px] font-bold text-white flex items-center justify-center">
                                  <Wand2 className="w-3 h-3 mr-1 text-indigo-400"/> Video por Google Veo
                                </p>
                              </div>
                            </>
                          ) : event.imageUrl ? (
                            <img src={event.imageUrl} alt="Tarjeta" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                          ) : (
                            <Cake className="w-10 h-10 text-indigo-400" />
                          )}
                        </div>

                        <div className="min-w-0 pt-1">
                          <h4 className="font-bold text-gray-800 text-base truncate">
                            {emp.firstName} {emp.lastName}
                          </h4>
                          <p className="text-xs text-gray-400 truncate">{emp.position || 'Colaborador'}</p>
                          
                          <span className={`inline-flex items-center gap-1 text-[10px] font-bold mt-2 px-2 py-0.5 rounded-full ${
                            event.videoUrl 
                              ? 'bg-purple-100 text-purple-700' 
                              : 'bg-indigo-100 text-indigo-700'
                          }`}>
                            {event.videoUrl ? (
                              <>
                                <Wand2 className="w-3 h-3" /> Video Generado
                              </>
                            ) : (
                              <>
                                <Sparkles className="w-3 h-3" /> Imagen 3D
                              </>
                            )}
                          </span>
                        </div>
                      </div>

                      <div className="mt-4 pt-3 border-t border-gray-50 flex items-center justify-between text-xs">
                        <span className="text-gray-400 font-mono font-semibold">
                          {event.date}
                        </span>
                        
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              const mediaUrl = event.videoUrl || event.imageUrl;
                              if (mediaUrl) {
                                handleDownload(mediaUrl, event.videoUrl ? 'cumple-video' : 'cumple-tarjeta');
                              }
                            }}
                            className="p-1.5 text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                            title="Descargar felicitación"
                          >
                            <Download className="w-4 h-4" />
                          </button>
                          {onSelectBdayEmployee && (
                            <button
                              type="button"
                              onClick={() => onSelectBdayEmployee(emp.id)}
                              className="text-indigo-600 hover:text-indigo-800 font-bold transition-colors"
                            >
                              Ver en Tablero &rarr;
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
