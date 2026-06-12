import React, { useState } from 'react';
import { Printer, Settings, ExternalLink, RefreshCw, AlertCircle, Loader2 } from 'lucide-react';

interface ImprentaProps {
  imprentaUrl: string;
  onOpenSettings: () => void;
}

export const Imprenta: React.FC<ImprentaProps> = ({ imprentaUrl, onOpenSettings }) => {
  const [iframeKey, setIframeKey] = useState(0);
  const [loading, setLoading] = useState(true);

  const handleRefresh = () => {
    setIframeKey(prev => prev + 1);
    setLoading(true);
  };

  if (!imprentaUrl) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-8 text-center animate-fade-in my-auto min-h-[400px]">
        <div className="bg-indigo-100 p-6 rounded-full mb-6">
          <Printer className="w-16 h-16 text-indigo-500 animate-pulse" />
        </div>
        <h2 className="text-2xl font-bold text-gray-800 mb-2">Configurar Imprenta</h2>
        <p className="text-gray-500 max-w-md mb-6">
          Para ver el contenido de tu Imprenta, ingresa un enlace válido (URL) en el panel de Ajustes de la Oficina.
        </p>
        <button 
          onClick={onOpenSettings}
          className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-3 rounded-xl font-medium flex items-center shadow-lg hover:shadow-indigo-500/30 transition-all font-bold"
        >
          <Settings className="w-5 h-5 mr-2" /> Abrir Ajustes de Oficina
        </button>
      </div>
    );
  }

  // Ensure url starts with http:// or https:// if valid
  let formattedUrl = imprentaUrl;
  if (!formattedUrl.startsWith('http://') && !formattedUrl.startsWith('https://')) {
    formattedUrl = 'https://' + formattedUrl;
  }

  return (
    <div className="w-full h-full flex flex-col p-0 overflow-hidden">
      {/* Frame Container */}
      <div className="flex-1 bg-white relative overflow-hidden h-full w-full">
        {loading && (
          <div className="absolute inset-x-0 inset-y-0 bg-gray-50/80 flex flex-col items-center justify-center z-10">
            <Loader2 className="w-10 h-10 text-indigo-600 animate-spin mb-3" />
            <p className="text-sm font-semibold text-gray-600">Conectando con la Imprenta...</p>
          </div>
        )}
        <iframe 
          key={iframeKey}
          id="imprenta-frame"
          src={formattedUrl}
          className="w-full h-full border-0"
          onLoad={() => setLoading(false)}
          title="Imprenta Embed"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          referrerPolicy="no-referrer"
        />
      </div>
    </div>
  );
};
