
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
  Wand2, // Added Wand icon
  MessageSquare,
  Sliders,
  Check,
  ChevronLeft,
  ChevronRight,
  CalendarDays
} from 'lucide-react';
import { Employee, Expense, Task, TaskStatus, VacationRequest } from '../types';
import { generateMascotaImage, generateMascotaVideo } from '../services/geminiService';
import { 
  getDailyBirthdayCard, 
  saveDailyBirthdayCard, 
  saveDailyBirthdayVideo,
  subscribeToVacationRequests
} from '../services/dbService';

interface ModuleVisibility {
  weeklyPermits: boolean;
  priorityTasks: boolean;
  upcomingDeliveries: boolean;
  birthdaysMonthCard: boolean;
  kpiTotalEmployees: boolean;
  kpiMonthExpenses: boolean;
  kpiPendingTasks: boolean;
  kpiMonthBirthdays: boolean;
}

const DEFAULT_VISIBILITY: ModuleVisibility = {
  weeklyPermits: true,
  priorityTasks: true,
  upcomingDeliveries: true,
  birthdaysMonthCard: true,
  kpiTotalEmployees: true,
  kpiMonthExpenses: true,
  kpiPendingTasks: true,
  kpiMonthBirthdays: true
};

interface DashboardProps {
  currentUser: Employee; // Added currentUser to props
  employees: Employee[];
  expenses: Expense[];
  tasks: Task[];
  mascotaUrl: string;
  mascotaName: string;
  companyName: string;
  birthdayPrompt?: string;
  birthdayVideoPrompt?: string;
  birthdayWhatsAppTemplate?: string;
  selectedBdayEmployeeId?: string | null;
  setSelectedBdayEmployeeId?: (employeeId: string | null) => void;
}

export const Dashboard: React.FC<DashboardProps> = ({ 
  currentUser, 
  employees, 
  expenses, 
  tasks, 
  mascotaUrl, 
  mascotaName, 
  companyName, 
  birthdayPrompt,
  birthdayVideoPrompt,
  birthdayWhatsAppTemplate,
  selectedBdayEmployeeId,
  setSelectedBdayEmployeeId
}) => {
  
  // Birthday Logic State
  const [birthdayImage, setBirthdayImage] = useState<string | null>(null);
  const [birthdayVideo, setBirthdayVideo] = useState<string | null>(null);
  const [generatingBday, setGeneratingBday] = useState(false);
  const [generatingVideo, setGeneratingVideo] = useState(false);
  const [videoProgress, setVideoProgress] = useState<string>('');
  
  // State for manually selected person to generate card
  const [manualSelection, setManualSelection] = useState<Employee | null>(null);

  // Vacation/Permits state for Calendario Semanal de Permisos
  const [vacationRequests, setVacationRequests] = useState<VacationRequest[]>([]);
  const [currentWeekStart, setCurrentWeekStart] = useState<Date>(new Date());

  // Subscription to vacations
  useEffect(() => {
    const unsubscribe = subscribeToVacationRequests(
      (data) => setVacationRequests(data),
      (err) => console.error("Error subscribing to vacation requests in Dashboard:", err)
    );
    return () => unsubscribe();
  }, []);

  // Module visibility customization state
  const [visibleModules, setVisibleModules] = useState<ModuleVisibility>(() => {
    try {
      const saved = localStorage.getItem('mi_oficina_dashboard_modules_v2');
      if (saved) {
        return JSON.parse(saved);
      }
    } catch (e) {
      console.error("Error parsing visibleModules", e);
    }
    return DEFAULT_VISIBILITY;
  });

  const [isAdjustModalOpen, setIsAdjustModalOpen] = useState(false);
  const [tempVisibleModules, setTempVisibleModules] = useState<ModuleVisibility>(visibleModules);

  const handleSaveModulesVisibility = (newVisibility: ModuleVisibility) => {
    setVisibleModules(newVisibility);
    localStorage.setItem('mi_oficina_dashboard_modules_v2', JSON.stringify(newVisibility));
    setIsAdjustModalOpen(false);
  };

  useEffect(() => {
    if (selectedBdayEmployeeId) {
      const emp = employees.find(e => e.id === selectedBdayEmployeeId);
      if (emp) {
        setManualSelection(emp);
      }
      if (setSelectedBdayEmployeeId) {
        setSelectedBdayEmployeeId(null);
      }
    }
  }, [selectedBdayEmployeeId, employees, setSelectedBdayEmployeeId]);

  // Calculate Metrics
  const totalExpenses = useMemo(() => expenses.reduce((acc, curr) => acc + curr.amount, 0), [expenses]);
  const pendingTasks = useMemo(() => tasks.filter(t => t.status !== TaskStatus.DONE).length, [tasks]);

  // Generate 7 days of the week (Monday to Sunday)
  const weekDays = useMemo(() => {
    const current = new Date(currentWeekStart);
    const day = current.getDay();
    // Sunday is 0, Monday is 1, etc.
    const distance = day === 0 ? -6 : 1 - day;
    const monday = new Date(current);
    monday.setDate(current.getDate() + distance);
    
    const days = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      days.push(d);
    }
    return days;
  }, [currentWeekStart]);

  const changeWeek = (direction: 'prev' | 'next') => {
    setCurrentWeekStart(prev => {
      const nextDate = new Date(prev);
      nextDate.setDate(prev.getDate() + (direction === 'next' ? 7 : -7));
      return nextDate;
    });
  };

  const resetToCurrentWeek = () => {
    setCurrentWeekStart(new Date());
  };

  const formatDateISO = (d: Date) => {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const getDayName = (d: Date) => {
    const names = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
    return names[d.getDay()];
  };

  const getPermitsForDate = (date: Date) => {
    const dateStr = formatDateISO(date);
    return vacationRequests.filter(req => {
      if (req.status === 'Rechazado') return false;
      return dateStr >= req.startDate && dateStr <= req.endDate;
    });
  };

  const getPermitBadgeStyle = (type: string, status: string) => {
    const base = "text-[10px] font-bold px-1.5 py-0.5 rounded border transition-all text-center select-none ";
    const isPending = status === 'Pendiente';
    
    if (type === 'Vacaciones') {
      return base + (isPending 
        ? "bg-emerald-50/50 text-emerald-600 border-dashed border-emerald-300" 
        : "bg-emerald-50 text-emerald-700 border-emerald-200 shadow-sm");
    }
    if (type === 'Incapacidad') {
      return base + (isPending 
        ? "bg-rose-50/50 text-rose-600 border-dashed border-rose-300" 
        : "bg-rose-50 text-rose-700 border-rose-200 shadow-sm");
    }
    // Default 'Permiso'
    return base + (isPending 
      ? "bg-amber-50/50 text-amber-600 border-dashed border-amber-300" 
      : "bg-amber-50 text-amber-700 border-amber-200 shadow-sm");
  };

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

  const [activeMediaTab, setActiveMediaTab] = useState<'image' | 'video'>('image');

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

  // Function to generate the video
  const generateVideoForPerson = async (person: Employee) => {
    if (generatingVideo || !mascotaUrl) return;
    
    setGeneratingVideo(true);
    setVideoProgress("Preparando animación...");
    try {
      const base64Ref = await urlToBase64(mascotaUrl);
      if (base64Ref) {
        // Use custom prompt if available, otherwise use default
        const defaultVideoPrompt = `Genera un video en bucle de 5 segundos estilo animación 3D Pixar de ALTA CALIDAD.
La mascota es un adorable personaje que celebra felizmente con gorro de fiesta el cumpleaños de ${person.firstName} ${person.lastName}.
La mascota salta de alegría sonriendo a la cámara, rodeada de confeti brillante que cae lentamente y globos de colores flotantes en un ambiente festivo y cálido.`;

        const finalPrompt = birthdayVideoPrompt 
          ? birthdayVideoPrompt
              .replace(/\${person.firstName}/g, person.firstName)
              .replace(/\${person.lastName}/g, person.lastName)
              .replace(/\${person.position}/g, person.position || '')
              .replace(/\${person.plaza}/g, person.plaza || '')
              .replace(/\${person.groupName}/g, person.groupName || '')
          : defaultVideoPrompt;
        
        const result = await generateMascotaVideo(base64Ref, finalPrompt, (msg) => {
          setVideoProgress(msg);
        });

        if (result.videoUrl) {
          setBirthdayVideo(result.videoUrl);
          // Save to Database so everyone sees the same video
          await saveDailyBirthdayVideo(person.id, result.videoUrl);
        } else if (result.error) {
          alert(`Error generando video: ${result.error}`);
        }
      }
    } catch (error) {
      console.error("Error generating auto birthday video", error);
    } finally {
      setGeneratingVideo(false);
      setVideoProgress("");
    }
  };

  // Logic to load image and video when displayPerson changes
  useEffect(() => {
    const loadPersonMedia = async () => {
      if (displayPerson && mascotaUrl) {
        setBirthdayImage(null); // Clear previous while loading
        setBirthdayVideo(null);
        
        // 1. Check DB first
        const sharedMedia = await getDailyBirthdayCard(displayPerson.id);
        
        if (sharedMedia) {
          setBirthdayImage(sharedMedia.imageUrl);
          setBirthdayVideo(sharedMedia.videoUrl);
          
          // Auto set active tab based on what's available
          if (sharedMedia.videoUrl) {
            setActiveMediaTab('video');
          } else {
            setActiveMediaTab('image');
          }
        } else {
          setActiveMediaTab('image');
        }
      }
    };
    loadPersonMedia();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [displayPerson?.id, mascotaUrl]);

  const handleManualSelect = (emp: Employee) => {
    setManualSelection(emp);
    // Smooth scroll to top of the scroll container to see the generated card
    const scrollContainer = document.querySelector('.overflow-auto') || window;
    scrollContainer.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleRegenerate = () => {
    if (displayPerson) {
      setBirthdayImage(null); 
      generateCardForPerson(displayPerson); 
    }
  };

  const handleRegenerateVideo = () => {
    if (displayPerson) {
      setBirthdayVideo(null);
      generateVideoForPerson(displayPerson);
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
      link.download = `cumpleanos-${displayPerson?.firstName || 'tarjeta'}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  const downloadVideo = () => {
    if (birthdayVideo) {
      const link = document.createElement('a');
      link.href = birthdayVideo;
      link.download = `cumpleanos-${displayPerson?.firstName || 'video'}.mp4`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  const handleSendWhatsApp = () => {
    if (!displayPerson?.email) return;
    const cleanPhone = displayPerson.email.replace(/\D/g, '');
    const formattedPhone = cleanPhone.length === 10 ? `52${cleanPhone}` : cleanPhone;
    
    let text = '';
    if (birthdayWhatsAppTemplate) {
      text = birthdayWhatsAppTemplate
        .replace(/\${person\.firstName}/g, displayPerson.firstName || '')
        .replace(/\${person\.lastName}/g, displayPerson.lastName || '')
        .replace(/\${person\.position}/g, displayPerson.position || '')
        .replace(/\${person\.plaza}/g, displayPerson.plaza || '')
        .replace(/\${companyName}/g, companyName || '')
        .replace(/\${mascotaName}/g, mascotaName || '');
    } else {
      text = `¡Feliz Cumpleaños, ${displayPerson.firstName}! 🎉🎂 Te deseamos lo mejor en este día tan especial de parte de todo el equipo. ✨🎈`;
    }
    
    if (activeMediaTab === 'image' && birthdayImage && birthdayImage.startsWith('http')) {
      text += `\n\nAquí tienes tu tarjeta de felicitación: ${birthdayImage}`;
    } else if (activeMediaTab === 'video' && birthdayVideo && birthdayVideo.startsWith('http')) {
      text += `\n\nAquí tienes tu video de felicitación: ${birthdayVideo}`;
    }
    
    const url = `https://api.whatsapp.com/send?phone=${formattedPhone}&text=${encodeURIComponent(text)}`;
    window.open(url, '_blank');
  };

  const visibleKpisCount = [
    visibleModules.kpiTotalEmployees,
    visibleModules.kpiMonthExpenses,
    visibleModules.kpiPendingTasks,
    visibleModules.kpiMonthBirthdays
  ].filter(Boolean).length;

  const kpiGridClass = visibleKpisCount === 4 
    ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6"
    : visibleKpisCount === 3
    ? "grid grid-cols-1 md:grid-cols-3 gap-6"
    : visibleKpisCount === 2
    ? "grid grid-cols-1 md:grid-cols-2 gap-6"
    : "grid grid-cols-1 gap-6";

  const showLeftCol = visibleModules.priorityTasks || visibleModules.upcomingDeliveries;
  const showRightCol = visibleModules.birthdaysMonthCard;

  return (
    <div className="p-6 space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
        <div className="flex items-center gap-4">
          {mascotaUrl && (
            <div className="w-16 h-16 rounded-2xl overflow-hidden shadow-lg border-2 border-white ring-4 ring-indigo-50/50 shrink-0 transform -rotate-3 transition-transform hover:rotate-0">
              <img src={mascotaUrl} alt={mascotaName} className="w-full h-full object-cover" />
            </div>
          )}
          <div>
            <h2 className="text-2xl font-bold text-gray-800">Hola, {greetingName}</h2>
          </div>
        </div>
        <div className="flex items-center gap-3 self-end sm:self-auto">
          <button
            onClick={() => {
              setTempVisibleModules({...visibleModules});
              setIsAdjustModalOpen(true);
            }}
            className="flex items-center gap-2 bg-white hover:bg-gray-50 text-gray-700 px-3 py-2 rounded-xl border border-gray-200 shadow-sm transition-all text-xs font-bold"
          >
            <Sliders className="w-4 h-4 text-indigo-600" />
            Ajustar Panel
          </button>
          <span className="text-xs text-gray-500 bg-white px-3 py-2 rounded-xl border border-gray-100 shadow-sm shrink-0 font-medium">
            {new Date().toLocaleDateString('es-ES', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </span>
        </div>
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
              <h3 className="text-4xl font-extrabold mb-2 flex items-center flex-wrap justify-center md:justify-start gap-3">
                <span>{displayPerson.firstName} {displayPerson.lastName}</span>
                <span className={`text-xs font-black px-2.5 py-0.5 rounded-full border tracking-wide uppercase ${
                  (displayPerson.status || 'ACTIVO') === 'ACTIVO' 
                    ? 'bg-emerald-500/25 border-emerald-400 text-emerald-100' 
                    : (displayPerson.status || 'ACTIVO') === 'INACTIVO'
                    ? 'bg-amber-500/25 border-amber-400 text-amber-100'
                    : 'bg-rose-500/25 border-rose-400 text-rose-100'
                }`}>
                  ({displayPerson.status || 'ACTIVO'})
                </span>
              </h3>
              
              {/* Informative Save Status Badge */}
              {activeMediaTab === 'image' && birthdayImage && (
                <div className="mb-4 inline-flex items-center gap-1.5 bg-emerald-500/30 text-emerald-500 bg-white/90 border border-emerald-500/20 px-3 py-1.5 rounded-xl text-xs font-bold">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shrink-0"></span>
                  Imagen guardada!
                </div>
              )}
              {activeMediaTab === 'video' && birthdayVideo && (
                <div className="mb-4 inline-flex items-center gap-1.5 bg-indigo-500/30 text-indigo-100 bg-white/10 border border-white/20 px-3 py-1.5 rounded-xl text-xs font-bold">
                  <span className="w-2 h-2 rounded-full bg-indigo-300 animate-pulse shrink-0"></span>
                  Video guardado
                </div>
              )}

              <p className="text-blue-100 text-lg mb-4">
                Elige el formato de felicitación para {displayPerson.firstName}:
              </p>

              {/* Format Toggles */}
              <div className="flex justify-center md:justify-start gap-2 p-1 bg-white/10 rounded-xl mb-6 max-w-[280px]">
                <button
                  type="button"
                  onClick={() => setActiveMediaTab('image')}
                  className={`flex-1 py-1.5 px-3 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                    activeMediaTab === 'image' 
                      ? 'bg-white text-blue-600 shadow-md' 
                      : 'text-white/80 hover:bg-white/10'
                  }`}
                >
                  <Sparkles className="w-3.5 h-3.5" /> Imagen
                </button>
                <button
                  type="button"
                  onClick={() => setActiveMediaTab('video')}
                  className={`flex-1 py-1.5 px-3 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                    activeMediaTab === 'video' 
                      ? 'bg-white text-blue-600 shadow-md' 
                      : 'text-white/80 hover:bg-white/10'
                  }`}
                >
                  <Wand2 className="w-3.5 h-3.5" /> Video (Veo)
                </button>
              </div>

              {/* Action Buttons depending on what is active */}
              {activeMediaTab === 'image' ? (
                birthdayImage ? (
                  <div className="flex flex-col sm:flex-row gap-3 justify-center md:justify-start">
                     <button 
                      onClick={downloadImage}
                      className="bg-white text-blue-600 px-6 py-2.5 rounded-xl font-bold hover:bg-blue-50 transition-colors shadow-lg flex items-center justify-center"
                    >
                      <Download className="w-5 h-5 mr-2" /> Descargar Tarjeta
                    </button>
                    {displayPerson?.email && (
                      <button 
                        onClick={handleSendWhatsApp}
                        className="bg-emerald-500 hover:bg-emerald-600 text-white px-6 py-2.5 rounded-xl font-bold transition-colors shadow-lg flex items-center justify-center animate-pulse"
                      >
                        <MessageSquare className="w-5 h-5 mr-2" /> Enviar por WhatsApp
                      </button>
                    )}
                    <button 
                      onClick={handleRegenerate}
                      className="bg-white/20 text-white border border-white/40 px-6 py-2.5 rounded-xl font-bold hover:bg-white/30 transition-colors flex items-center justify-center backdrop-blur-md"
                    >
                      <RefreshCw className="w-5 h-5 mr-2" /> Regenerar Imagen
                    </button>
                  </div>
                ) : (
                  displayPerson?.email && (
                    <div className="flex flex-col sm:flex-row gap-3 justify-center md:justify-start">
                      <button 
                        onClick={handleSendWhatsApp}
                        className="bg-emerald-500 hover:bg-emerald-600 text-white px-6 py-2.5 rounded-xl font-bold transition-colors shadow-lg flex items-center justify-center"
                      >
                        <MessageSquare className="w-5 h-5 mr-2" /> Enviar por WhatsApp
                      </button>
                    </div>
                  )
                )
              ) : (
                birthdayVideo ? (
                  <div className="flex flex-col sm:flex-row gap-3 justify-center md:justify-start">
                     <button 
                      onClick={downloadVideo}
                      className="bg-white text-blue-600 px-6 py-2.5 rounded-xl font-bold hover:bg-blue-50 transition-colors shadow-lg flex items-center justify-center"
                    >
                      <Download className="w-5 h-5 mr-2" /> Descargar Video
                    </button>
                    {displayPerson?.email && (
                      <button 
                        onClick={handleSendWhatsApp}
                        className="bg-emerald-500 hover:bg-emerald-600 text-white px-6 py-2.5 rounded-xl font-bold transition-colors shadow-lg flex items-center justify-center animate-pulse"
                      >
                        <MessageSquare className="w-5 h-5 mr-2" /> Enviar por WhatsApp
                      </button>
                    )}
                    <button 
                      onClick={handleRegenerateVideo}
                      className="bg-white/20 text-white border border-white/40 px-6 py-2.5 rounded-xl font-bold hover:bg-white/30 transition-colors flex items-center justify-center backdrop-blur-md"
                    >
                      <RefreshCw className="w-5 h-5 mr-2" /> Regenerar Video
                    </button>
                  </div>
                ) : (
                  displayPerson?.email && (
                    <div className="flex flex-col sm:flex-row gap-3 justify-center md:justify-start">
                      <button 
                        onClick={handleSendWhatsApp}
                        className="bg-emerald-500 hover:bg-emerald-600 text-white px-6 py-2.5 rounded-xl font-bold transition-colors shadow-lg flex items-center justify-center"
                      >
                        <MessageSquare className="w-5 h-5 mr-2" /> Enviar por WhatsApp
                      </button>
                    </div>
                  )
                )
              )}
            </div>

            {/* Generated Media Box */}
            <div className="w-full md:w-96 h-72 bg-black/20 rounded-xl flex items-center justify-center overflow-hidden border-4 border-white/30 shadow-2xl relative group">
              {activeMediaTab === 'image' ? (
                birthdayImage ? (
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
                    <p className="text-white font-medium mb-4 text-sm">¿Quieres crear una tarjeta de felicitación en imagen?</p>
                    <button 
                      onClick={() => generateCardForPerson(displayPerson)}
                      className="bg-white text-blue-600 px-6 py-2 rounded-lg font-bold hover:bg-blue-50 transition-colors shadow-lg flex items-center text-sm"
                    >
                      <Sparkles className="w-4 h-4 mr-2" /> Generar Tarjeta
                    </button>
                  </div>
                )
              ) : (
                birthdayVideo ? (
                  <>
                    <video src={birthdayVideo} controls className="w-full h-full object-cover" loop autoPlay muted playsInline />
                    <div className="absolute inset-x-0 bottom-0 bg-black/60 p-2 text-center opacity-0 group-hover:opacity-100 transition-opacity">
                      <p className="text-xs font-bold text-white flex items-center justify-center"><Wand2 className="w-3.5 h-3.5 mr-1 text-indigo-400"/> Video por Google Veo</p>
                    </div>
                  </>
                ) : generatingVideo ? (
                  <div className="text-center p-6">
                    <Loader2 className="w-12 h-12 text-white animate-spin mx-auto mb-3" />
                    <p className="text-lg font-medium text-white">Google Veo está animando a {mascotaName}...</p>
                    <p className="text-xs text-blue-200 mt-2 font-mono h-8 overflow-hidden">{videoProgress}</p>
                  </div>
                ) : !mascotaUrl ? (
                  <div className="text-center p-4 text-white/70">
                     <p className="text-sm">Configura tu mascota en ajustes para generar videos.</p>
                  </div>
                ) : (
                  <div className="text-center p-6 flex flex-col items-center justify-center h-full">
                    <Wand2 className="w-12 h-12 text-white/50 mb-3 animate-pulse" />
                    <p className="text-white font-medium mb-4 text-sm">¿Quieres crear una felicitación animada con Veo 3?</p>
                    <button 
                      onClick={() => generateVideoForPerson(displayPerson)}
                      className="bg-white text-blue-600 px-6 py-2 rounded-lg font-bold hover:bg-blue-50 transition-colors shadow-lg flex items-center text-sm"
                    >
                      <Wand2 className="w-4 h-4 mr-2" /> Generar Video
                    </button>
                  </div>
                )
              )}
            </div>
          </div>
        </div>
      )}



      {/* KPI Cards */}
      {visibleKpisCount > 0 && (
        <div className={kpiGridClass}>
          {visibleModules.kpiTotalEmployees && (
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500 font-medium">Total de Empleados</p>
                <h3 className="text-3xl font-bold text-gray-800 mt-1">{employees.length}</h3>
              </div>
              <div className="p-3 bg-blue-50 rounded-full">
                <Users className="w-6 h-6 text-blue-600" />
              </div>
            </div>
          )}

          {visibleModules.kpiMonthExpenses && (
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500 font-medium">Gastos del Mes</p>
                <h3 className="text-3xl font-bold text-gray-800 mt-1">${totalExpenses.toLocaleString()}</h3>
              </div>
              <div className="p-3 bg-green-50 rounded-full">
                <DollarSign className="w-6 h-6 text-green-600" />
              </div>
            </div>
          )}

          {visibleModules.kpiPendingTasks && (
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500 font-medium">Tareas Pendientes</p>
                <h3 className="text-3xl font-bold text-gray-800 mt-1">{pendingTasks}</h3>
              </div>
              <div className="p-3 bg-orange-50 rounded-full">
                <CheckSquare className="w-6 h-6 text-orange-600" />
              </div>
            </div>
          )}

          {visibleModules.kpiMonthBirthdays && (
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
          )}
        </div>
      )}

      {/* Calendario Semanal de Permisos */}
      {visibleModules.weeklyPermits && (
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 mb-6">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-indigo-50 rounded-lg text-indigo-600">
                <CalendarDays className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-800">Calendario Semanal de Permisos</h3>
                <p className="text-xs text-gray-500">Vacaciones, permisos e incapacidades activas de la semana</p>
              </div>
            </div>
            
            <div className="flex items-center gap-2 self-center">
              <button 
                onClick={() => changeWeek('prev')}
                className="p-1.5 hover:bg-gray-100 rounded-lg border border-gray-200 text-gray-600 transition-colors"
                title="Semana anterior"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button 
                onClick={resetToCurrentWeek}
                className="px-3 py-1 text-xs font-bold hover:bg-gray-100 rounded-lg border border-gray-200 text-gray-700 transition-colors"
              >
                Esta Semana
              </button>
              <button 
                onClick={() => changeWeek('next')}
                className="p-1.5 hover:bg-gray-100 rounded-lg border border-gray-200 text-gray-600 transition-colors"
                title="Semana siguiente"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-7 gap-3">
            {weekDays.map((day, idx) => {
              const dayPermits = getPermitsForDate(day);
              const isToday = formatDateISO(day) === formatDateISO(new Date());
              
              return (
                <div 
                  key={idx} 
                  className={`p-3 rounded-xl border flex flex-col min-h-[140px] transition-all ${
                    isToday 
                      ? 'bg-indigo-50/20 border-indigo-200 ring-2 ring-indigo-500/5' 
                      : 'bg-gray-50/50 border-gray-100 hover:border-gray-200 hover:bg-gray-50'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className={`text-[10px] font-bold uppercase tracking-wider ${isToday ? 'text-indigo-600' : 'text-gray-400'}`}>
                      {getDayName(day)}
                    </span>
                    <span className={`text-xs font-bold h-6 w-6 flex items-center justify-center rounded-full ${
                      isToday ? 'bg-indigo-600 text-white shadow-sm' : 'text-gray-700'
                    }`}>
                      {day.getDate()}
                    </span>
                  </div>
                  
                  <div className="flex-1 space-y-1.5 overflow-y-auto max-h-[110px] pr-0.5 custom-scrollbar">
                    {dayPermits.length === 0 ? (
                      <div className="h-full flex items-center justify-center py-4">
                        <span className="text-[10px] text-gray-400 italic">Sin permisos</span>
                      </div>
                    ) : (
                      dayPermits.map(req => {
                        const emp = employees.find(e => e.id === req.employeeId);
                        const empName = emp ? `${emp.firstName}` : 'Empleado';
                        return (
                          <div 
                            key={req.id} 
                            className={getPermitBadgeStyle(req.type, req.status)}
                            title={`${empName} - ${req.type} (${req.status})\n${req.startDate} al ${req.endDate}${req.notes ? '\nNotas: ' + req.notes : ''}`}
                          >
                            <span className="truncate font-bold text-gray-800 leading-tight block">{empName}</span>
                            <span className="text-[8px] font-medium uppercase mt-0.5 leading-none block">{req.type}</span>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Main Content Grid */}
      {(showLeftCol || showRightCol) && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Left Col: Tasks */}
          {showLeftCol && (
            <div className={`${showRightCol ? 'lg:col-span-2' : 'lg:col-span-3'} space-y-6`}>
              {/* Priority Tasks */}
              {visibleModules.priorityTasks && (
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
              )}

              {/* Upcoming Tasks Table */}
              {visibleModules.upcomingDeliveries && (
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
              )}
            </div>
          )}

          {/* Right Col: Birthdays */}
          {showRightCol && (
            <div className={showLeftCol ? 'lg:col-span-1' : 'lg:col-span-3'}>
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
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <p className={`font-medium text-sm truncate ${isToday ? 'text-blue-700' : 'text-gray-800'}`}>
                                  {emp.firstName} {emp.lastName}
                                </p>
                                <span className={`text-[8px] font-extrabold px-1.5 py-0.2 rounded-full border uppercase shrink-0 ${
                                  (emp.status || 'ACTIVO') === 'ACTIVO' 
                                    ? 'bg-emerald-50 border-emerald-200 text-emerald-700' 
                                    : (emp.status || 'ACTIVO') === 'INACTIVO'
                                    ? 'bg-amber-50 border-amber-200 text-amber-700'
                                    : 'bg-rose-50 border-rose-200 text-rose-700'
                                }`}>
                                  ({emp.status || 'ACTIVO'})
                                </span>
                              </div>
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
          )}
        </div>
      )}

      {/* Adjust Panel Modal */}
      {isAdjustModalOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-gray-100 overflow-hidden animate-scale-up">
            <div className="bg-gradient-to-r from-indigo-600 to-blue-600 p-6 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sliders className="w-5 h-5" />
                <h3 className="text-lg font-bold">Ajustar Panel</h3>
              </div>
              <button 
                onClick={() => setIsAdjustModalOpen(false)}
                className="text-white/80 hover:text-white bg-white/10 hover:bg-white/20 p-1.5 rounded-full transition-all text-xs"
              >
                ✕
              </button>
            </div>
            
            <div className="p-6 space-y-4 max-h-[400px] overflow-y-auto">
              <p className="text-xs text-gray-500 mb-2">Activa o desactiva las secciones del panel principal para personalizar tu espacio de trabajo.</p>
              
              <div className="space-y-3">
                <div className="text-[10px] font-extrabold text-indigo-600 uppercase tracking-wider mb-1">Módulos Principales</div>
                
                {[
                  { key: 'weeklyPermits', label: 'Calendario Semanal de Permisos', desc: 'Muestra las vacaciones y permisos de la semana' },
                  { key: 'priorityTasks', label: 'Tareas Prioritarias', desc: 'Alertas de tareas con prioridad alta' },
                  { key: 'upcomingDeliveries', label: 'Próximas Entregas', desc: 'Tabla de entregas programadas más cercanas' },
                  { key: 'birthdaysMonthCard', label: 'Cumpleaños del Mes', desc: 'Tarjeta y listado interactivo de cumpleaños' },
                ].map((mod) => (
                  <div key={mod.key} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl hover:bg-gray-100/70 transition-all border border-gray-100">
                    <div>
                      <p className="text-sm font-bold text-gray-800">{mod.label}</p>
                      <p className="text-[10px] text-gray-500">{mod.desc}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setTempVisibleModules(prev => ({
                          ...prev,
                          [mod.key]: !prev[mod.key as keyof ModuleVisibility]
                        }));
                      }}
                      className={`w-10 h-6 flex items-center rounded-full p-1 transition-all ${
                        tempVisibleModules[mod.key as keyof ModuleVisibility] ? 'bg-indigo-600 justify-end' : 'bg-gray-300 justify-start'
                      }`}
                    >
                      <span className="w-4 h-4 bg-white rounded-full shadow-md transition-all"></span>
                    </button>
                  </div>
                ))}

                <div className="text-[10px] font-extrabold text-indigo-600 uppercase tracking-wider pt-2 mb-1">Indicadores KPI</div>
                
                {[
                  { key: 'kpiTotalEmployees', label: 'Total de Empleados', desc: 'Número total de colaboradores activos' },
                  { key: 'kpiMonthExpenses', label: 'Gastos del Mes', desc: 'Monto total de gastos registrados este mes' },
                  { key: 'kpiPendingTasks', label: 'Tareas Pendientes', desc: 'Contador de tareas asignadas inconclusas' },
                  { key: 'kpiMonthBirthdays', label: 'Cumpleaños (Mes)', desc: 'Cantidad de cumpleañeros en el mes en curso' },
                ].map((mod) => (
                  <div key={mod.key} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl hover:bg-gray-100/70 transition-all border border-gray-100">
                    <div>
                      <p className="text-sm font-bold text-gray-800">{mod.label}</p>
                      <p className="text-[10px] text-gray-500">{mod.desc}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setTempVisibleModules(prev => ({
                          ...prev,
                          [mod.key]: !prev[mod.key as keyof ModuleVisibility]
                        }));
                      }}
                      className={`w-10 h-6 flex items-center rounded-full p-1 transition-all ${
                        tempVisibleModules[mod.key as keyof ModuleVisibility] ? 'bg-indigo-600 justify-end' : 'bg-gray-300 justify-start'
                      }`}
                    >
                      <span className="w-4 h-4 bg-white rounded-full shadow-md transition-all"></span>
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <div className="p-6 bg-gray-50 border-t border-gray-100 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setIsAdjustModalOpen(false)}
                className="px-4 py-2 border border-gray-300 rounded-xl text-xs font-bold text-gray-700 bg-white hover:bg-gray-100 transition-all"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => handleSaveModulesVisibility(tempVisibleModules)}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5"
              >
                <Check className="w-4 h-4" /> Guardar Ajustes
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
