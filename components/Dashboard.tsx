
import React, { useMemo, useState, useEffect } from 'react';
import { 
  Users, 
  DollarSign, 
  CheckSquare, 
  Calendar,
  AlertCircle,
  Clock,
  Gift,
  Cake,
  Download,
  Loader2,
  Sparkles,
  RefreshCw,
  Wand2 // Added Wand icon
} from 'lucide-react';
import { Employee, Expense, Task, TaskStatus } from '../types';
import { generateMascotaImage } from '../services/geminiService';
import { getDailyBirthdayCard, saveDailyBirthdayCard } from '../services/dbService';

interface DashboardProps {
  currentUser: Employee; // Added currentUser to props
  employees: Employee[];
  expenses: Expense[];
  tasks: Task[];
  mascotaUrl: string;
  mascotaName: string;
  companyName: string;
  birthdayPrompt?: string;
}

export const Dashboard: React.FC<DashboardProps> = ({ currentUser, employees, expenses, tasks, mascotaUrl, mascotaName, companyName, birthdayPrompt }) => {
  
  // Birthday Logic State
  const [birthdayImage, setBirthdayImage] = useState<string | null>(null);
  const [generatingBday, setGeneratingBday] = useState(false);
  
  // State for manually selected person to generate card
  const [manualSelection, setManualSelection] = useState<Employee | null>(null);

  // Calculate Metrics
  const totalExpenses = useMemo(() => expenses.reduce((acc, curr) => acc + curr.amount, 0), [expenses]);
  const pendingTasks = useMemo(() => tasks.filter(t => t.status !== TaskStatus.DONE).length, [tasks]);

  // Helper to get greeting name (First Name + First Last Name)
  const greetingName = useMemo(() => {
    const first = currentUser.firstName.split(' ')[0];
    const last = currentUser.lastName.split(' ')[0];
    return `${first} ${last}`;
  }, [currentUser]);

  const { monthBirthdays, todayBirthdays } = useMemo(() => {
    const today = new Date();
    const currentMonth = today.getMonth(); // 0-11
    const currentDay = today.getDate(); // 1-31

    const month = employees.filter(e => {
      // Robust date parsing for YYYY-MM-DD strings
      if (!e.birthDate) return false;
      const [y, m, d] = e.birthDate.split('-').map(Number);
      return (m - 1) === currentMonth;
    }).sort((a, b) => {
      const dayA = parseInt(a.birthDate.split('-')[2]);
      const dayB = parseInt(b.birthDate.split('-')[2]);
      return dayA - dayB;
    });

    const todayList = month.filter(e => {
       const day = parseInt(e.birthDate.split('-')[2]);
       return day === currentDay;
    });

    return { monthBirthdays: month, todayBirthdays: todayList };
  }, [employees]);

  // Determine who is currently being displayed in the Hero Section
  const displayPerson = useMemo(() => {
    return manualSelection || (todayBirthdays.length > 0 ? todayBirthdays[0] : null);
  }, [manualSelection, todayBirthdays]);

  // Upcoming tasks logic
  const upcomingTasks = useMemo(() => {
    return tasks
      .filter(t => t.status !== TaskStatus.DONE)
      .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime())
      .slice(0, 5);
  }, [tasks]);

  // Helper to fetch and convert image to Base64
  const urlToBase64 = async (url: string): Promise<string> => {
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
      console.error("Error fetching base64", e);
      return "";
    }
  };

  // Function to generate the card
  const generateCardForPerson = async (person: Employee) => {
    if (generatingBday || !mascotaUrl) return;
    
    setGeneratingBday(true);
    try {
      const base64Ref = await urlToBase64(mascotaUrl);
      if (base64Ref) {
        // Use custom prompt if available, otherwise use default
        const defaultPrompt = `Genera una tarjeta de felicitación de cumpleaños estilo Render 3D Pixar de ALTA CALIDAD.
        
        ELEMENTOS:
        1. TEXTO: En la parte superior, grande, 3D y brillante: "Feliz Cumpleaños ${person.firstName} ${person.lastName}". El texto debe ser el protagonista.
        2. PERSONAJE: La mascota debe estar feliz, celebrando con brazos abiertos, gorro de fiesta.
        3. AMBIENTE: Fondo festivo con desenfoque (bokeh), confeti cayendo, globos de colores vivos (Predominantemente AZULES, dorados y blancos). Iluminación de estudio cálida y mágica.
        
        Composición centrada, estilo profesional y alegre. Evita el color rosa.`;

        const finalPrompt = birthdayPrompt 
          ? birthdayPrompt
              .replace(/\${person.firstName}/g, person.firstName)
              .replace(/\${person.lastName}/g, person.lastName)
              .replace(/\${person.position}/g, person.position || '')
              .replace(/\${person.plaza}/g, person.plaza || '')
              .replace(/\${person.groupName}/g, person.groupName || '')
          : defaultPrompt;
        
        const result = await generateMascotaImage(base64Ref, finalPrompt);
        if (result.imageUrl) {
          setBirthdayImage(result.imageUrl);
          // Save to Database so everyone sees the same image
          await saveDailyBirthdayCard(person.id, result.imageUrl);
        }
      }
    } catch (error) {
      console.error("Error generating auto birthday image", error);
    } finally {
      setGeneratingBday(false);
    }
  };

  // Logic to load image when displayPerson changes
  useEffect(() => {
    const loadPersonImage = async () => {
      if (displayPerson && mascotaUrl) {
        setBirthdayImage(null); // Clear previous while loading
        
        // 1. Check DB first
        const sharedImage = await getDailyBirthdayCard(displayPerson.id);
        
        if (sharedImage) {
          setBirthdayImage(sharedImage);
        } 
        // AUTOMATIC GENERATION DISABLED TO SAVE COSTS
        // else {
        //    generateCardForPerson(displayPerson);
        // }
      }
    };
    loadPersonImage();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [displayPerson?.id, mascotaUrl]);

  const handleManualSelect = (emp: Employee) => {
    setManualSelection(emp);
    // Smooth scroll to top to see the generated card
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleRegenerate = () => {
    if (displayPerson) {
      setBirthdayImage(null); 
      generateCardForPerson(displayPerson); 
    }
  };

  const getPriorityStyle = (priority: string) => {
    switch(priority) {
      case 'Alta': return 'text-red-600 bg-red-50 border-red-200';
      case 'Media': return 'text-orange-600 bg-orange-50 border-orange-200';
      default: return 'text-green-600 bg-green-50 border-green-200';
    }
  };

  const downloadImage = () => {
    if (birthdayImage) {
      const link = document.createElement('a');
      link.href = birthdayImage;
      link.download = `cumpleanos-${new Date().toISOString()}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  return (
    <div className="p-6 space-y-6 animate-fade-in">
      <div className="flex justify-between items-center gap-4">
        <div className="flex items-center gap-4">
          {mascotaUrl && (
            <div className="w-16 h-16 rounded-2xl overflow-hidden shadow-lg border-2 border-white ring-4 ring-indigo-50/50 shrink-0 transform -rotate-3 transition-transform hover:rotate-0">
              <img src={mascotaUrl} alt={mascotaName} className="w-full h-full object-cover" />
            </div>
          )}
          <div>
            <h2 className="text-2xl font-bold text-gray-800">Hola, {greetingName}</h2>
            <p className="text-sm text-gray-500 hidden sm:block">Bienvenido a {companyName || 'tu oficina'}</p>
          </div>
        </div>
        <span className="text-sm text-gray-500 bg-white px-3 py-1.5 rounded-xl border border-gray-100 shadow-sm shrink-0">
          {new Date().toLocaleDateString('es-ES', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
        </span>
      </div>
      
      {/* Birthday Special Section - Shows if Today OR Manual Selection */}
      {displayPerson && (
        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-2xl shadow-lg p-1 text-white overflow-hidden relative transition-all duration-500">
          <div className="absolute top-0 left-0 w-full h-full opacity-20 bg-[url('https://www.transparenttextures.com/patterns/confetti.png')]"></div>
          
          {/* Close button for manual selection */}
          {manualSelection && (
            <button 
              onClick={() => setManualSelection(null)}
              className="absolute top-2 right-2 z-20 bg-white/20 hover:bg-white/30 text-white rounded-full p-1"
              title="Cerrar vista previa"
            >
              <RefreshCw className="w-4 h-4 rotate-45" />
            </button>
          )}

          <div className="bg-white/10 backdrop-blur-sm p-6 rounded-xl flex flex-col md:flex-row items-center gap-8 relative z-10">
            
            <div className="flex-1 text-center md:text-left">
              <div className="inline-flex items-center bg-white/20 px-3 py-1 rounded-full text-xs font-bold mb-3 uppercase tracking-wider">
                <Cake className="w-4 h-4 mr-2" /> 
                {todayBirthdays.some(t => t.id === displayPerson.id) ? "¡Hoy Cumple!" : "Celebración Especial"}
              </div>
              <h3 className="text-4xl font-extrabold mb-2">
                {displayPerson.firstName} {displayPerson.lastName}
              </h3>
              <p className="text-blue-100 text-lg mb-6">
                Tarjeta de felicitación oficial de {companyName || 'la oficina'}.
              </p>
              
              {birthdayImage && (
                <div className="flex flex-col sm:flex-row gap-3 justify-center md:justify-start">
                   <button 
                    onClick={downloadImage}
                    className="bg-white text-blue-600 px-6 py-2.5 rounded-xl font-bold hover:bg-blue-50 transition-colors shadow-lg flex items-center justify-center"
                  >
                    <Download className="w-5 h-5 mr-2" /> Descargar
                  </button>
                  <button 
                    onClick={handleRegenerate}
                    className="bg-white/20 text-white border border-white/40 px-6 py-2.5 rounded-xl font-bold hover:bg-white/30 transition-colors flex items-center justify-center backdrop-blur-md"
                  >
                    <RefreshCw className="w-5 h-5 mr-2" /> Regenerar
                  </button>
                </div>
              )}
            </div>

            {/* Generated Image or Loader */}
            <div className="w-full md:w-96 h-72 bg-black/20 rounded-xl flex items-center justify-center overflow-hidden border-4 border-white/30 shadow-2xl relative group">
              {birthdayImage ? (
                <>
                  <img src={birthdayImage} alt="Tarjeta Cumpleaños" className="w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <p className="font-bold text-white flex items-center"><Sparkles className="w-4 h-4 mr-2"/> Creado por {mascotaName}</p>
                  </div>
                </>
              ) : generatingBday ? (
                <div className="text-center p-6">
                  <Loader2 className="w-12 h-12 text-white animate-spin mx-auto mb-3" />
                  <p className="text-lg font-medium text-white">{mascotaName} está diseñando la tarjeta...</p>
                  <p className="text-xs text-blue-200 mt-2">Espere un momento</p>
                </div>
              ) : !mascotaUrl ? (
                <div className="text-center p-4 text-white/70">
                   <p className="text-sm">Configura tu mascota en ajustes para generar tarjetas.</p>
                </div>
              ) : (
                <div className="text-center p-6 flex flex-col items-center justify-center h-full">
                  <Gift className="w-12 h-12 text-white/50 mb-3" />
                  <p className="text-white font-medium mb-4 text-sm">¿Quieres crear una tarjeta personalizada?</p>
                  <button 
                    onClick={() => generateCardForPerson(displayPerson)}
                    className="bg-white text-blue-600 px-6 py-2 rounded-lg font-bold hover:bg-blue-50 transition-colors shadow-lg flex items-center text-sm"
                  >
                    <Sparkles className="w-4 h-4 mr-2" /> Generar Tarjeta
                  </button>
                  <p className="text-[10px] text-blue-200 mt-2 opacity-70">Generar imágenes consume recursos.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-500 font-medium">Total de Empleados</p>
            <h3 className="text-3xl font-bold text-gray-800 mt-1">{employees.length}</h3>
          </div>
          <div className="p-3 bg-blue-50 rounded-full">
            <Users className="w-6 h-6 text-blue-600" />
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-500 font-medium">Gastos del Mes</p>
            <h3 className="text-3xl font-bold text-gray-800 mt-1">${totalExpenses.toLocaleString()}</h3>
          </div>
          <div className="p-3 bg-green-50 rounded-full">
            <DollarSign className="w-6 h-6 text-green-600" />
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-500 font-medium">Tareas Pendientes</p>
            <h3 className="text-3xl font-bold text-gray-800 mt-1">{pendingTasks}</h3>
          </div>
          <div className="p-3 bg-orange-50 rounded-full">
            <CheckSquare className="w-6 h-6 text-orange-600" />
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex items-center justify-between relative overflow-hidden">
          <div className="absolute right-0 top-0 w-16 h-full bg-gradient-to-l from-blue-50 to-transparent"></div>
          <div>
            <p className="text-sm text-gray-500 font-medium">Cumpleaños (Mes)</p>
            <h3 className="text-3xl font-bold text-gray-800 mt-1">{monthBirthdays.length}</h3>
          </div>
          <div className="p-3 bg-blue-50 rounded-full z-10">
            <Calendar className="w-6 h-6 text-blue-600" />
          </div>
        </div>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Col: Tasks */}
        <div className="lg:col-span-2 space-y-6">
           {/* Priority Tasks */}
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex flex-col">
            <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center">
              <AlertCircle className="w-5 h-5 mr-2 text-gray-500" /> Tareas Prioritarias
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {tasks.filter(t => t.priority === 'Alta' && t.status !== TaskStatus.DONE).length === 0 ? (
                <div className="col-span-full p-6 text-center bg-gray-50 rounded-lg border border-dashed border-gray-200">
                  <p className="text-gray-400">¡Todo bajo control! No hay tareas urgentes.</p>
                </div>
              ) : (
                tasks
                .filter(t => t.priority === 'Alta' && t.status !== TaskStatus.DONE)
                .map(task => (
                  <div key={task.id} className="p-4 border-l-4 border-red-500 bg-red-50 rounded-r-md shadow-sm">
                    <div className="flex justify-between items-start mb-2">
                      <h4 className="font-bold text-red-900 line-clamp-1">{task.title}</h4>
                      <span className="text-[10px] font-semibold text-red-600 bg-white px-2 py-0.5 rounded border border-red-200 whitespace-nowrap">{task.dueDate}</span>
                    </div>
                    <p className="text-sm text-red-700 mb-2">{employees.find(e => e.id === task.assignedTo)?.firstName || 'Sin asignar'}</p>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Upcoming Tasks Table */}
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
            <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center">
              <Clock className="w-5 h-5 mr-2 text-gray-500" /> Próximas Entregas
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="text-xs text-gray-400 uppercase tracking-wider border-b border-gray-100">
                    <th className="pb-3 pl-2 font-medium">Tarea</th>
                    <th className="pb-3 font-medium">Responsable</th>
                    <th className="pb-3 font-medium">Fecha</th>
                    <th className="pb-3 font-medium">Prioridad</th>
                    <th className="pb-3 font-medium text-right pr-2">Estado</th>
                  </tr>
                </thead>
                <tbody className="text-sm">
                  {upcomingTasks.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-6 text-center text-gray-400 italic">
                        No hay tareas pendientes próximas.
                      </td>
                    </tr>
                  ) : (
                    upcomingTasks.map(task => (
                      <tr key={task.id} className="border-b last:border-0 border-gray-50 hover:bg-gray-50/50 transition-colors">
                        <td className="py-3 pl-2 font-medium text-gray-700">{task.title}</td>
                        <td className="py-3 text-gray-500">
                          <div className="flex items-center">
                            <div className="w-6 h-6 rounded-full bg-gray-200 flex items-center justify-center text-xs font-bold text-gray-500 mr-2">
                              {(employees.find(e => e.id === task.assignedTo)?.firstName?.charAt(0) || '?')}
                            </div>
                            {employees.find(e => e.id === task.assignedTo)?.firstName || 'Sin asignar'}
                          </div>
                        </td>
                        <td className="py-3 text-gray-500 font-mono text-xs">
                          {task.dueDate}
                        </td>
                        <td className="py-3">
                          <span className={`text-[10px] px-2 py-0.5 rounded border uppercase font-bold tracking-wide ${getPriorityStyle(task.priority)}`}>
                            {task.priority}
                          </span>
                        </td>
                        <td className="py-3 text-right pr-2">
                          <span className={`text-xs px-2 py-1 rounded-full ${
                            task.status === TaskStatus.IN_PROGRESS ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'
                          }`}>
                            {task.status}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Right Col: Birthdays */}
        <div className="lg:col-span-1">
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 h-full flex flex-col">
            <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center">
              <Gift className="w-5 h-5 mr-2 text-blue-500" /> Cumpleaños del Mes
            </h3>
            
            <div className="flex-1 overflow-y-auto pr-1 custom-scrollbar space-y-3">
              {monthBirthdays.length === 0 ? (
                <div className="text-center py-10 text-gray-400 text-sm">
                  No hay cumpleaños este mes.
                </div>
              ) : (
                monthBirthdays.map(emp => {
                  const day = parseInt(emp.birthDate.split('-')[2]);
                  const isToday = todayBirthdays.some(t => t.id === emp.id);

                  return (
                    <div key={emp.id} className={`flex items-center justify-between p-3 rounded-lg transition-all ${isToday ? 'bg-blue-50 border border-blue-200 shadow-sm' : 'hover:bg-gray-50 border border-transparent'}`}>
                      <div className="flex items-center flex-1 min-w-0">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs mr-3 shrink-0 ${isToday ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-500'}`}>
                          {day}
                        </div>
                        <div className="truncate pr-2">
                          <p className={`font-medium text-sm truncate ${isToday ? 'text-blue-700' : 'text-gray-800'}`}>
                            {emp.firstName} {emp.lastName}
                          </p>
                          <p className="text-[10px] text-gray-500 truncate">{emp.position}</p>
                        </div>
                      </div>
                      
                      {/* Generar Evaristo Button */}
                      <button 
                        onClick={() => handleManualSelect(emp)}
                        className="p-2 text-blue-500 hover:text-blue-700 hover:bg-blue-100 rounded-full transition-colors flex items-center text-[10px] font-bold shrink-0"
                        title={`Generar Evaristo para ${emp.firstName}`}
                      >
                         <Wand2 className="w-4 h-4" />
                      </button>
                    </div>
                  );
                })
              )}
            </div>
            
            {/* Decoration */}
            <div className="mt-6 pt-6 border-t border-gray-100 text-center">
               <p className="text-xs text-gray-400 italic">"Los pequeños detalles construyen grandes equipos"</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
