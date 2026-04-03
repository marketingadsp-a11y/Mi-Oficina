import React, { useState } from 'react';
import { Bot, Sparkles, Send, Loader2 } from 'lucide-react';
import { Employee, Expense, Task } from '../types';
import { generateOfficeInsights } from '../services/geminiService';

interface AssistantProps {
  employees: Employee[];
  expenses: Expense[];
  tasks: Task[];
}

export const Assistant: React.FC<AssistantProps> = ({ employees, expenses, tasks }) => {
  const [response, setResponse] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [activePrompt, setActivePrompt] = useState<string | null>(null);

  const handleAsk = async (type: 'general' | 'financial' | 'productivity') => {
    setLoading(true);
    setActivePrompt(type);
    setResponse(null);
    const result = await generateOfficeInsights(employees, expenses, tasks, type);
    setResponse(result);
    setLoading(false);
  };

  return (
    <div className="p-6 h-full flex flex-col items-center justify-center max-w-4xl mx-auto">
      <div className="text-center mb-10">
        <div className="w-20 h-20 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-xl shadow-indigo-200">
          <Bot className="w-10 h-10 text-white" />
        </div>
        <h2 className="text-3xl font-bold text-gray-800 mb-2">Asistente Inteligente de Oficina</h2>
        <p className="text-gray-500 max-w-md mx-auto">
          Utiliza la inteligencia artificial de Gemini para analizar tus datos y obtener recomendaciones instantáneas.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 w-full mb-8">
        <button 
          onClick={() => handleAsk('financial')}
          disabled={loading}
          className={`p-6 rounded-xl border-2 text-left transition-all ${activePrompt === 'financial' ? 'border-green-500 bg-green-50 ring-2 ring-green-200' : 'border-gray-100 bg-white hover:border-green-300 hover:shadow-md'}`}
        >
          <div className="bg-green-100 w-10 h-10 rounded-full flex items-center justify-center mb-3 text-green-600">
            <DollarSignIcon />
          </div>
          <h3 className="font-bold text-gray-800">Análisis Financiero</h3>
          <p className="text-sm text-gray-500 mt-1">Resumen de gastos y consejos de ahorro.</p>
        </button>

        <button 
          onClick={() => handleAsk('productivity')}
          disabled={loading}
          className={`p-6 rounded-xl border-2 text-left transition-all ${activePrompt === 'productivity' ? 'border-orange-500 bg-orange-50 ring-2 ring-orange-200' : 'border-gray-100 bg-white hover:border-orange-300 hover:shadow-md'}`}
        >
          <div className="bg-orange-100 w-10 h-10 rounded-full flex items-center justify-center mb-3 text-orange-600">
            <Sparkles className="w-5 h-5" />
          </div>
          <h3 className="font-bold text-gray-800">Productividad</h3>
          <p className="text-sm text-gray-500 mt-1">Estado de tareas y cuellos de botella.</p>
        </button>

        <button 
          onClick={() => handleAsk('general')}
          disabled={loading}
          className={`p-6 rounded-xl border-2 text-left transition-all ${activePrompt === 'general' ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-200' : 'border-gray-100 bg-white hover:border-blue-300 hover:shadow-md'}`}
        >
          <div className="bg-blue-100 w-10 h-10 rounded-full flex items-center justify-center mb-3 text-blue-600">
            <Bot className="w-5 h-5" />
          </div>
          <h3 className="font-bold text-gray-800">Resumen General</h3>
          <p className="text-sm text-gray-500 mt-1">Visión global de empleados y oficina.</p>
        </button>
      </div>

      <div className="w-full bg-white rounded-2xl shadow-lg border border-gray-100 min-h-[200px] p-8 relative overflow-hidden">
        {loading ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/80 z-10">
            <Loader2 className="w-10 h-10 text-indigo-600 animate-spin mb-4" />
            <p className="text-indigo-800 font-medium animate-pulse">OfficeBot está analizando los datos...</p>
          </div>
        ) : response ? (
           <div className="prose prose-indigo max-w-none">
             <div className="flex items-center gap-3 mb-4 pb-4 border-b">
                <Bot className="w-6 h-6 text-indigo-600" />
                <span className="font-semibold text-gray-800">Respuesta de OfficeBot</span>
             </div>
             <div className="whitespace-pre-wrap text-gray-700 leading-relaxed">
               {response}
             </div>
           </div>
        ) : (
          <div className="h-full flex flex-col items-center justify-center text-gray-400">
             <Send className="w-12 h-12 mb-4 opacity-20" />
             <p>Selecciona una opción arriba para comenzar el análisis.</p>
          </div>
        )}
      </div>
    </div>
  );
};

// Helper icon
const DollarSignIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="1" x2="12" y2="23"></line><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path></svg>
)
