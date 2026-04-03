
import React, { useState } from 'react';
import { Lock, ChevronRight, AlertCircle } from 'lucide-react';
import { verifyAccessCode } from '../services/dbService';
import { Employee } from '../types';

interface LoginProps {
  onLogin: (user: Employee) => void;
  appVersion: string;
  appStatusColor: string;
  isOnline: boolean;
}

export const Login: React.FC<LoginProps> = ({ onLogin, appVersion, appStatusColor, isOnline }) => {
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (code.length !== 4) return;

    setLoading(true);
    setError('');

    try {
      const user = await verifyAccessCode(code);
      if (user) {
        onLogin(user);
      } else {
        setError('Código incorrecto. Intente nuevamente.');
        setCode('');
      }
    } catch (err) {
      setError('Error al conectar. Verifique su red.');
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.replace(/\D/g, '').slice(0, 4);
    setCode(val);
    if (error) setError('');
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4 relative">
      
      {/* Version Status Badge - Top Right */}
      <div className="absolute top-4 right-4 flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/80 backdrop-blur border border-gray-200 text-xs font-medium text-gray-600 shadow-sm z-10">
         <span 
           className={`w-2.5 h-2.5 rounded-full shadow-sm transition-colors ${!isOnline && 'animate-pulse'}`} 
           style={{ backgroundColor: isOnline ? appStatusColor : '#9ca3af' }}
         ></span>
         <span className="hidden sm:inline-block">v{appVersion}</span>
         {!isOnline && <span className="text-gray-400 text-[10px] ml-1 uppercase">(Offline)</span>}
      </div>

      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl overflow-hidden relative z-0">
        {/* Changed gradient to Strong Blue */}
        <div className="bg-gradient-to-r from-blue-900 to-blue-700 p-8 text-center">
          <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-4 backdrop-blur-sm">
            <Lock className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white mb-1">Mi Oficina</h1>
          <p className="text-blue-100 text-sm">Acceso Privado</p>
        </div>

        <div className="p-8">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2 text-center">
                Ingrese su Código de Acceso
              </label>
              <div className="relative">
                <input
                  type="password"
                  inputMode="numeric"
                  autoFocus
                  value={code}
                  onChange={handleInputChange}
                  className="w-full text-center text-4xl tracking-[1em] font-bold text-gray-800 border-b-2 border-gray-200 focus:border-blue-600 outline-none py-4 bg-transparent placeholder-gray-200"
                  placeholder="••••"
                  maxLength={4}
                />
              </div>
              {error && (
                <div className="flex items-center justify-center text-red-500 text-sm mt-4 animate-pulse">
                  <AlertCircle className="w-4 h-4 mr-1" />
                  {error}
                </div>
              )}
            </div>

            <button
              type="submit"
              disabled={code.length !== 4 || loading}
              className={`w-full py-4 rounded-xl flex items-center justify-center font-bold text-white transition-all ${
                code.length === 4 
                  ? 'bg-blue-700 hover:bg-blue-800 shadow-lg hover:shadow-blue-500/30' 
                  : 'bg-gray-300 cursor-not-allowed'
              }`}
            >
              {loading ? (
                <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
              ) : (
                <>
                  Entrar <ChevronRight className="w-5 h-5 ml-2" />
                </>
              )}
            </button>
          </form>
        </div>
      </div>
      <p className="mt-8 text-xs text-gray-400">
        © {new Date().getFullYear()} Mi Oficina
      </p>
    </div>
  );
};
