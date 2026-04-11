
import React, { useState, useEffect, useRef } from 'react';
import { 
  LayoutDashboard, 
  Users, 
  DollarSign, 
  CheckSquare, 
  Image as ImageIcon, // Icon changed for Mascota
  Menu,
  X,
  Bell,
  LogOut,
  Settings,
  ChevronUp,
  Building2, // Added icon for Company Name
  Key, // Added icon for API Key
  CheckCircle,
  AlertCircle,
  Loader2,
  Tag,
  Activity,
  Download, // Icon for install
  Smartphone,
  Upload, // Added Upload icon
  FileSignature, // Added FileSignature for Promissory Notes
  FileWarning // Added FileWarning for Fallos
} from 'lucide-react';

import { Dashboard } from './components/Dashboard';
import { Personnel } from './components/Personnel';
import { Expenses } from './components/Expenses';
import { Tasks } from './components/Tasks';
import { PromissoryNotes } from './components/PromissoryNotes'; // Import new component
import { Mascota } from './components/Mascota'; 
import { Login } from './components/Login';
import { Assistant } from './components/Assistant'; 
import { Fallos } from './components/Fallos';

import { 
  getEmployees, 
  getExpenses, 
  getExpensesByDateRange, 
  getTasks, 
  getAppSettings, 
  updateAppSettings, 
  getFallos,
  subscribeToEmployees,
  subscribeToTasks,
  subscribeToAppSettings,
  subscribeToDashboardExpenses,
  subscribeToAllExpenses,
  subscribeToAllFallos,
  subscribeToPlazas
} from './services/dbService';
import { validateApiKey } from './services/geminiService';
import { Employee, Expense, Task, Fallo, Plaza } from './types';

function App() {
  // Auth State - Initialize from LocalStorage to persist session
  const [currentUser, setCurrentUser] = useState<Employee | null>(() => {
    try {
      const savedUser = localStorage.getItem('office_user_session');
      return savedUser ? JSON.parse(savedUser) : null;
    } catch (e) {
      console.error("Error parsing session", e);
      return null;
    }
  });

  // App State
  const [activeTab, setActiveTab] = useState('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  
  // Connection Status State
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  
  // Settings State
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  
  const [mascotaUrl, setMascotaUrl] = useState('');
  const [mascotaName, setMascotaName] = useState('Mascota');
  const [companyName, setCompanyName] = useState('');
  const [googleApiKey, setGoogleApiKey] = useState('');
  const [appVersion, setAppVersion] = useState('1.0.0');
  const [appStatusColor, setAppStatusColor] = useState('#10B981'); 
  
  // Temp states for modal
  const [tempMascotaUrl, setTempMascotaUrl] = useState('');
  const [tempMascotaName, setTempMascotaName] = useState('');
  const [tempCompanyName, setTempCompanyName] = useState('');
  const [tempGoogleApiKey, setTempGoogleApiKey] = useState('');
  const [tempAppVersion, setTempAppVersion] = useState('');
  const [tempAppStatusColor, setTempAppStatusColor] = useState('');
  
  // API Key Testing State
  const [testingKey, setTestingKey] = useState(false);
  const [keyStatus, setKeyStatus] = useState<'idle' | 'success' | 'error'>('idle');
  
  // PWA Install Prompt State
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);

  // User Menu State
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);

  // Global Data State
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [dashboardExpenses, setDashboardExpenses] = useState<Expense[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [fallos, setFallos] = useState<Fallo[]>([]);
  const [plazas, setPlazas] = useState<Plaza[]>([]);
  
  // Loading flags for lazy loading
  const [hasLoadedEmployees, setHasLoadedEmployees] = useState(false);
  const [hasLoadedExpenses, setHasLoadedExpenses] = useState(false);
  const [hasLoadedDashboard, setHasLoadedDashboard] = useState(false);
  const [hasLoadedTasks, setHasLoadedTasks] = useState(false);
  const [hasLoadedFallos, setHasLoadedFallos] = useState(false);

  const handleFirestoreError = (error: any, operation: string, path: string) => {
    const errInfo = {
      error: error?.message || String(error),
      operationType: operation,
      path: path,
      authInfo: {
        userId: currentUser?.id,
        email: currentUser?.email,
      }
    };
    console.error('Firestore Error:', JSON.stringify(errInfo));
  };

  // PWA: Listen for install prompt
  useEffect(() => {
    const handler = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  // PWA & UI: Dynamic Manifest and Favicon Update
  useEffect(() => {
    const updateAppIdentity = () => {
        const dynamicName = companyName ? `Mi Oficina ${companyName}` : "Mi Oficina";
        
        // 1. Update Document Title
        document.title = dynamicName;

        // 2. Update Favicon (Tab Icon)
        const favicon = document.getElementById('app-favicon') as HTMLLinkElement;
        if (favicon && mascotaUrl) {
            favicon.href = mascotaUrl;
        }

        // 3. Update Manifest (PWA Icon & Name)
        // Only update if we have specific settings to avoid overriding default with empty values initially
        if (companyName || mascotaUrl) {
            const manifest = {
                name: dynamicName,
                short_name: companyName || "Mi Oficina",
                start_url: "/",
                display: "standalone",
                background_color: "#ffffff",
                theme_color: appStatusColor || "#4f46e5",
                icons: [
                    {
                        src: mascotaUrl || "/vite.svg",
                        sizes: "192x192",
                        type: "image/png",
                        purpose: "any maskable" 
                    },
                    {
                        src: mascotaUrl || "/vite.svg",
                        sizes: "512x512",
                        type: "image/png",
                        purpose: "any maskable"
                    }
                ]
            };

            const stringManifest = JSON.stringify(manifest);
            const blob = new Blob([stringManifest], {type: 'application/json'});
            const manifestURL = URL.createObjectURL(blob);
            
            const link = document.querySelector('#app-manifest');
            if (link) {
                link.setAttribute('href', manifestURL);
            }
        }
    };
    
    updateAppIdentity();
  }, [companyName, mascotaUrl, appStatusColor]);

  // Click outside listener for user menu
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setUserMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Network Status Listener
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Load Initial Settings
  useEffect(() => {
    const initSettings = async () => {
      try {
        const settingsData = await getAppSettings();
        setCompanyName(settingsData.companyName || '');
        setMascotaName(settingsData.mascotaName || 'Mascota');
        setMascotaUrl(settingsData.mascotaUrl || '');
        setGoogleApiKey(settingsData.googleApiKey || '');
        setAppVersion(settingsData.appVersion || '1.0.0');
        setAppStatusColor(settingsData.appStatusColor || '#10B981');
      } catch (e) {
        console.error("Error fetching settings on init:", e);
      }
    };
    initSettings();
  }, []);

  const fetchEmployees = async () => {
    if (hasLoadedEmployees) return;
    setLoading(true);
    try {
      const data = await getEmployees();
      setEmployees(data);
      setHasLoadedEmployees(true);
    } catch (e) {
      console.error("Error fetching employees", e);
    } finally {
      setLoading(false);
    }
  };

  const fetchExpenses = async () => {
    if (hasLoadedExpenses) return;
    setLoading(true);
    try {
      const data = await getExpenses();
      setExpenses(data);
      setHasLoadedExpenses(true);
    } catch (e) {
      console.error("Error fetching expenses", e);
    } finally {
      setLoading(false);
    }
  };

  const fetchTasks = async () => {
    if (hasLoadedTasks) return;
    setLoading(true);
    try {
      const data = await getTasks();
      setTasks(data);
      setHasLoadedTasks(true);
    } catch (e) {
      console.error("Error fetching tasks", e);
    } finally {
      setLoading(false);
    }
  };

  const fetchFallos = async () => {
    if (hasLoadedFallos) return;
    setLoading(true);
    try {
      const data = await getFallos();
      setFallos(data);
      setHasLoadedFallos(true);
    } catch (e) {
      console.error("Error fetching fallos", e);
    } finally {
      setLoading(false);
    }
  };

  const fetchDashboardExpenses = async () => {
    if (hasLoadedDashboard) return;
    setLoading(true);
    try {
      const now = new Date();
      const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
      const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];
      
      const data = await getExpensesByDateRange(firstDay, lastDay);
      setDashboardExpenses(data);
      setHasLoadedDashboard(true);
    } catch (e) {
      console.error("Error fetching dashboard expenses", e);
    } finally {
      setLoading(false);
    }
  };

  // Real-time data subscriptions based on active tab
  useEffect(() => {
    if (!currentUser) return;

    const unsubscribers: (() => void)[] = [];

    const handleError = (error: any, op: string, path: string) => {
      handleFirestoreError(error, op, path);
    };

    // Always subscribe to settings for real-time updates of company name, etc.
    unsubscribers.push(subscribeToAppSettings((settings) => {
      setCompanyName(settings.companyName);
      setMascotaName(settings.mascotaName);
      setMascotaUrl(settings.mascotaUrl);
      setGoogleApiKey(settings.googleApiKey);
      setAppVersion(settings.appVersion);
      setAppStatusColor(settings.appStatusColor);
    }, (err) => handleError(err, 'GET', 'settings/global_config')));

    if (activeTab === 'dashboard') {
      unsubscribers.push(subscribeToEmployees(setEmployees, (err) => handleError(err, 'LIST', 'employees')));
      unsubscribers.push(subscribeToTasks(setTasks, (err) => handleError(err, 'LIST', 'tasks')));
      
      const now = new Date();
      const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
      const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];
      unsubscribers.push(subscribeToDashboardExpenses(firstDay, lastDay, setDashboardExpenses, (err) => handleError(err, 'LIST', 'expenses')));
    } else if (activeTab === 'personnel') {
      unsubscribers.push(subscribeToEmployees(setEmployees, (err) => handleError(err, 'LIST', 'employees')));
      unsubscribers.push(subscribeToPlazas(setPlazas, (err) => handleError(err, 'LIST', 'plazas')));
    } else if (activeTab === 'expenses') {
      // For the main list, we listen to all records
      unsubscribers.push(subscribeToAllExpenses((data) => {
        setExpenses(data);
        setHasLoadedExpenses(true);
      }, (err) => handleError(err, 'LIST', 'expenses')));
    } else if (activeTab === 'tasks') {
      unsubscribers.push(subscribeToTasks(setTasks, (err) => handleError(err, 'LIST', 'tasks')));
      unsubscribers.push(subscribeToEmployees(setEmployees, (err) => handleError(err, 'LIST', 'employees')));
    } else if (activeTab === 'fallos') {
      unsubscribers.push(subscribeToAllFallos((data) => {
        setFallos(data);
        setHasLoadedFallos(true);
      }, (err) => handleError(err, 'LIST', 'fallos')));
      unsubscribers.push(subscribeToEmployees(setEmployees, (err) => handleError(err, 'LIST', 'employees')));
    }

    return () => {
      unsubscribers.forEach(unsub => unsub());
    };
  }, [activeTab, currentUser?.id]);

  const handleLogin = (user: Employee) => {
    localStorage.setItem('office_user_session', JSON.stringify(user));
    setCurrentUser(user);
    // Data will be loaded by the useEffect above
  };

  const handleLogout = () => {
    localStorage.removeItem('office_user_session');
    setCurrentUser(null);
    setEmployees([]);
    setExpenses([]);
    setTasks([]);
    setFallos([]);
    setHasLoadedEmployees(false);
    setHasLoadedExpenses(false);
    setHasLoadedTasks(false);
    setHasLoadedFallos(false);
    setActiveTab('dashboard');
    setUserMenuOpen(false);
  };

  const refreshData = () => {
    // Force reload current tab data
    if (activeTab === 'personnel') { setHasLoadedEmployees(false); fetchEmployees(); }
    else if (activeTab === 'expenses') { setHasLoadedExpenses(false); fetchExpenses(); }
    else if (activeTab === 'tasks') { setHasLoadedTasks(false); fetchTasks(); }
    else if (activeTab === 'fallos') { setHasLoadedFallos(false); fetchFallos(); }
    else if (activeTab === 'dashboard') {
      setHasLoadedEmployees(false);
      setHasLoadedExpenses(false);
      setHasLoadedTasks(false);
      fetchEmployees();
      fetchExpenses();
      fetchTasks();
    }
  };

  const handleInstallApp = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setDeferredPrompt(null);
    }
    setUserMenuOpen(false);
  };

  const handleOpenSettings = () => {
    setTempMascotaUrl(mascotaUrl);
    setTempMascotaName(mascotaName);
    setTempCompanyName(companyName);
    setTempGoogleApiKey(googleApiKey);
    setTempAppVersion(appVersion);
    setTempAppStatusColor(appStatusColor);
    setKeyStatus('idle');
    setIsSettingsOpen(true);
    setUserMenuOpen(false);
  };

  const handleTestApiKey = async () => {
    if (!tempGoogleApiKey) return;
    setTestingKey(true);
    setKeyStatus('idle');
    const isValid = await validateApiKey(tempGoogleApiKey.trim());
    setTestingKey(false);
    setKeyStatus(isValid ? 'success' : 'error');
  };

  // --- NEW: Handle Image Upload with Compression ---
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = () => {
      const base64String = reader.result as string;
      
      // Compress Image to avoid Firestore limits (1MB)
      const img = new Image();
      img.src = base64String;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        const MAX_WIDTH = 800; // Sufficient for reference
        
        let width = img.width;
        let height = img.height;
        
        if (width > MAX_WIDTH) {
          height = (height * MAX_WIDTH) / width;
          width = MAX_WIDTH;
        }
        
        canvas.width = width;
        canvas.height = height;
        
        ctx?.drawImage(img, 0, 0, width, height);
        
        // Compress to JPEG 0.7 quality
        const compressedBase64 = canvas.toDataURL('image/jpeg', 0.7);
        setTempMascotaUrl(compressedBase64);
      };
    };
    reader.readAsDataURL(file);
  };

  // Handle Drive OAuth Callback removed

  const handleSaveSettings = async () => {
    setIsSavingSettings(true);
    const finalMascotaName = tempMascotaName || 'Mascota';
    const finalApiKey = tempGoogleApiKey.trim(); 
    const finalVersion = tempAppVersion || '1.0.0';
    const finalColor = tempAppStatusColor || '#10B981';
    
    try {
      await updateAppSettings({
        companyName: tempCompanyName,
        mascotaName: finalMascotaName,
        mascotaUrl: tempMascotaUrl,
        googleApiKey: finalApiKey,
        appVersion: finalVersion,
        appStatusColor: finalColor
      });

      setMascotaUrl(tempMascotaUrl);
      setMascotaName(finalMascotaName);
      setCompanyName(tempCompanyName);
      setGoogleApiKey(finalApiKey);
      setAppVersion(finalVersion);
      setAppStatusColor(finalColor);
      
      setIsSettingsOpen(false);
    } catch (e) {
      console.error("Error saving settings to DB", e);
      alert("Error al guardar la configuración. Verifique su conexión.");
    } finally {
      setIsSavingSettings(false);
    }
  };

  if (!currentUser) {
    return <Login 
      onLogin={handleLogin} 
      appVersion={appVersion}
      appStatusColor={appStatusColor}
      isOnline={isOnline}
    />;
  }

  const navItems = [
    { id: 'dashboard', label: 'Panel Principal', icon: LayoutDashboard },
    { id: 'personnel', label: 'Personal', icon: Users },
    { id: 'expenses', label: 'Gastos', icon: DollarSign },
    { id: 'tasks', label: 'Tareas', icon: CheckSquare },
    { id: 'promissory', label: 'Entrega Pagarés', icon: FileSignature },
    { id: 'fallos', label: 'Fallos', icon: FileWarning },
    { id: 'mascota', label: `Mi ${mascotaName}`, icon: ImageIcon }, 
  ];

  const renderContent = () => {
    if (loading) {
      return (
        <div className="flex items-center justify-center h-full">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
        </div>
      );
    }

    switch (activeTab) {
      case 'dashboard': return <Dashboard currentUser={currentUser} employees={employees} expenses={dashboardExpenses} tasks={tasks} mascotaUrl={mascotaUrl} mascotaName={mascotaName} companyName={companyName} />;
      case 'personnel': return <Personnel employees={employees} plazas={plazas} refreshData={refreshData} />;
      case 'expenses': return <Expenses expenses={expenses} refreshData={refreshData} />;
      case 'tasks': return <Tasks tasks={tasks} employees={employees} refreshData={refreshData} />;
      case 'promissory': return <PromissoryNotes companyName={companyName} />;
      case 'fallos': return <Fallos employees={employees} fallos={fallos} refreshData={refreshData} />;
      case 'mascota': return <Mascota mascotaUrl={mascotaUrl} mascotaName={mascotaName} onOpenSettings={handleOpenSettings} />;
      default: return <Dashboard currentUser={currentUser} employees={employees} expenses={expenses} tasks={tasks} mascotaUrl={mascotaUrl} mascotaName={mascotaName} companyName={companyName} />;
    }
  };

  return (
    <div className="flex h-screen h-[100dvh] bg-gray-50 overflow-hidden relative">
      
      {/* Mobile Sidebar Overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/50 z-20 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Sidebar */}
      <aside className={`
        fixed inset-y-0 left-0 z-30 w-64 bg-white shadow-xl transform transition-transform duration-300 ease-in-out lg:relative lg:translate-x-0
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        <div className="flex items-center justify-between p-6 border-b border-gray-100">
          <h1 className="text-xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-blue-600 leading-tight">
            Mi Oficina<br/>
            <span className="text-base text-gray-600 font-medium">{companyName}</span>
          </h1>
          <button onClick={() => setSidebarOpen(false)} className="lg:hidden text-gray-500 hover:text-gray-800">
            <X className="w-6 h-6" />
          </button>
        </div>
        
        <nav className="p-4 space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => {
                  setActiveTab(item.id);
                  setSidebarOpen(false);
                }}
                className={`flex items-center w-full px-4 py-3 rounded-xl transition-all duration-200 group ${
                  isActive 
                    ? 'bg-indigo-50 text-indigo-700 font-semibold shadow-sm' 
                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                }`}
              >
                <Icon className={`w-5 h-5 mr-3 transition-colors ${isActive ? 'text-indigo-600' : 'text-gray-400 group-hover:text-gray-600'}`} />
                {item.label}
              </button>
            );
          })}
        </nav>

        {/* User Menu Area */}
        <div className="absolute bottom-0 w-full p-6 border-t border-gray-100" ref={userMenuRef}>
          
          {userMenuOpen && (
             <div className="absolute bottom-24 left-4 right-4 bg-white rounded-xl shadow-xl border border-gray-100 overflow-hidden animate-fade-in z-40">
                {/* Install App Button - Only shows if deferredPrompt exists */}
                {deferredPrompt && (
                  <>
                    <button 
                      onClick={handleInstallApp}
                      className="w-full text-left px-4 py-3 text-sm text-indigo-600 hover:bg-indigo-50 flex items-center transition-colors font-semibold"
                    >
                      <Smartphone className="w-4 h-4 mr-2" /> Instalar App
                    </button>
                    <div className="h-px bg-gray-100"></div>
                  </>
                )}

                <button 
                  onClick={handleOpenSettings}
                  className="w-full text-left px-4 py-3 text-sm text-gray-700 hover:bg-gray-50 flex items-center transition-colors"
                >
                   <Settings className="w-4 h-4 mr-2 text-gray-400" /> Ajustes
                </button>
                <div className="h-px bg-gray-100"></div>
                <button 
                  onClick={handleLogout}
                  className="w-full text-left px-4 py-3 text-sm text-red-600 hover:bg-red-50 flex items-center transition-colors"
                >
                   <LogOut className="w-4 h-4 mr-2" /> Cerrar Sesión
                </button>
             </div>
          )}

          <button 
            onClick={() => setUserMenuOpen(!userMenuOpen)}
            className="flex items-center w-full p-2 rounded-lg hover:bg-gray-50 transition-colors group relative"
          >
            <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-bold shrink-0">
              {currentUser.firstName.charAt(0)}{currentUser.lastName.charAt(0)}
            </div>
            <div className="ml-3 overflow-hidden text-left flex-1">
              <p className="text-sm font-medium text-gray-700 truncate">{currentUser.firstName}</p>
              <p className="text-xs text-gray-400 truncate">{currentUser.position}</p>
            </div>
            <ChevronUp className={`w-4 h-4 text-gray-400 transition-transform ${userMenuOpen ? 'rotate-180' : ''}`} />
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col h-full overflow-hidden">
        {/* Header */}
        <header className="bg-white border-b border-gray-100 h-16 flex items-center justify-between px-6 shrink-0 z-10">
          <button 
            onClick={() => setSidebarOpen(true)} 
            className="lg:hidden p-2 -ml-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
            title="Abrir Menú"
          >
            <Menu className="w-6 h-6" />
          </button>
          
          <div className="ml-auto flex items-center space-x-4">
            
            {/* Status & Version Indicator */}
            <div 
              className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-gray-50 border border-gray-200 text-xs font-medium text-gray-600 transition-all hover:bg-gray-100 cursor-default"
              title={isOnline ? "Conectado a la Base de Datos" : "Sin conexión a Internet"}
            >
               <span 
                 className={`w-2.5 h-2.5 rounded-full shadow-sm transition-colors ${!isOnline && 'animate-pulse'}`} 
                 style={{ backgroundColor: isOnline ? appStatusColor : '#9ca3af' }}
               ></span>
               <span className="hidden sm:inline-block">v{appVersion}</span>
               {!isOnline && <span className="text-gray-400 text-[10px] ml-1 uppercase">(Offline)</span>}
            </div>

            <button className="relative p-2 text-gray-400 hover:text-indigo-600 transition-colors">
              <Bell className="w-6 h-6" />
              <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-white"></span>
            </button>
          </div>
        </header>

        {/* Page Content */}
        <div className="flex-1 overflow-auto bg-gray-50/50">
          {renderContent()}
        </div>
      </main>

      {/* Settings Modal */}
      {isSettingsOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold text-gray-800 flex items-center">
                <Settings className="w-6 h-6 mr-2 text-indigo-600" /> Ajustes
              </h3>
              <button onClick={() => setIsSettingsOpen(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-6 h-6" />
              </button>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2 flex items-center">
                   <Building2 className="w-4 h-4 mr-2 text-gray-400" /> Nombre de la Financiera
                </label>
                <input 
                  type="text" 
                  className="w-full border-2 border-gray-200 rounded-xl p-3 text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none transition-all"
                  placeholder="Ej: Everest"
                  value={tempCompanyName}
                  onChange={(e) => setTempCompanyName(e.target.value)}
                />
                <p className="text-xs text-gray-500 mt-1">Se usará como nombre de la App: "Mi Oficina {tempCompanyName}"</p>
              </div>

              {/* Version & Status Color Control */}
              <div className="bg-gray-50 p-4 rounded-xl border border-gray-200 grid grid-cols-2 gap-4">
                 <div>
                    <label className="block text-xs font-bold text-gray-500 mb-2 flex items-center">
                       <Tag className="w-3 h-3 mr-1" /> Versión App
                    </label>
                    <input 
                      type="text" 
                      className="w-full border border-gray-300 rounded-lg p-2 text-sm focus:ring-2 focus:ring-indigo-200 outline-none"
                      placeholder="1.0.0"
                      value={tempAppVersion}
                      onChange={(e) => setTempAppVersion(e.target.value)}
                    />
                 </div>
                 <div>
                    <label className="block text-xs font-bold text-gray-500 mb-2 flex items-center">
                       <Activity className="w-3 h-3 mr-1" /> Color Estado
                    </label>
                    <div className="flex items-center gap-2">
                      <input 
                        type="color" 
                        className="w-10 h-10 border border-gray-300 rounded cursor-pointer"
                        value={tempAppStatusColor}
                        onChange={(e) => setTempAppStatusColor(e.target.value)}
                      />
                      <span className="text-xs text-gray-400 font-mono">{tempAppStatusColor}</span>
                    </div>
                 </div>
              </div>

              {/* API KEY SECTION */}
              <div className="bg-blue-50 p-4 rounded-xl border border-blue-100 space-y-4">
                <div>
                  <label className="block text-sm font-bold text-blue-800 mb-2 flex items-center">
                     <Key className="w-4 h-4 mr-2 text-blue-600" /> Google Gemini API Key
                  </label>
                  <p className="text-xs text-blue-600 mb-2">
                    Requerido para generar imágenes y usar el asistente de IA.
                  </p>
                  <div className="flex gap-2">
                    <input 
                      type="password" 
                      className={`w-full border-2 rounded-xl p-3 text-sm outline-none transition-all bg-white ${
                        keyStatus === 'error' ? 'border-red-300 focus:border-red-500' : 
                        keyStatus === 'success' ? 'border-green-300 focus:border-green-500' :
                        'border-blue-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-200'
                      }`}
                      placeholder="AIzaSy..."
                      value={tempGoogleApiKey}
                      onChange={(e) => {
                        setTempGoogleApiKey(e.target.value.replace(/\s/g, ''));
                        setKeyStatus('idle');
                      }}
                    />
                    <button 
                      onClick={handleTestApiKey}
                      disabled={testingKey || !tempGoogleApiKey}
                      className={`px-3 rounded-xl flex items-center justify-center transition-colors min-w-[50px] ${
                        keyStatus === 'success' ? 'bg-green-100 text-green-600 border border-green-200' :
                        keyStatus === 'error' ? 'bg-red-100 text-red-600 border border-red-200' :
                        'bg-white border border-blue-200 text-blue-600 hover:bg-blue-50'
                      }`}
                    >
                      {testingKey ? <Loader2 className="w-5 h-5 animate-spin"/> : 
                       keyStatus === 'success' ? <CheckCircle className="w-5 h-5" /> :
                       keyStatus === 'error' ? <AlertCircle className="w-5 h-5" /> :
                       <span className="text-xs font-bold">PROBAR</span>}
                    </button>
                  </div>
                </div>
              </div>

              <div className="border-t border-gray-100 my-4 pt-4"></div>

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">Nombre de la Mascota</label>
                <input 
                  type="text" 
                  className="w-full border-2 border-gray-200 rounded-xl p-3 text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none transition-all"
                  value={tempMascotaName}
                  onChange={(e) => setTempMascotaName(e.target.value)}
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">Imagen de Mascota de Oficina</label>
                <p className="text-xs text-gray-500 mb-3">
                   Sube una imagen directamente para evitar errores de carga en la versión pública.
                </p>
                
                {/* Upload Button Area */}
                <div className="flex gap-2 mb-3">
                   <label className="flex-1 cursor-pointer bg-white border-2 border-dashed border-indigo-300 hover:border-indigo-500 hover:bg-indigo-50 rounded-xl p-3 flex items-center justify-center transition-all group">
                      <Upload className="w-5 h-5 text-indigo-400 group-hover:text-indigo-600 mr-2" />
                      <span className="text-sm text-gray-600 group-hover:text-indigo-700 font-medium">Subir Imagen</span>
                      <input 
                        type="file" 
                        accept="image/*" 
                        className="hidden" 
                        onChange={handleFileUpload}
                      />
                   </label>
                </div>

                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                     <ImageIcon className="h-4 w-4 text-gray-400" />
                  </div>
                  <input 
                    type="text"
                    readOnly 
                    className="w-full pl-10 border-2 border-gray-200 rounded-xl p-3 text-sm text-gray-400 bg-gray-50 focus:outline-none"
                    placeholder="O pega una URL..."
                    value={tempMascotaUrl ? (tempMascotaUrl.startsWith('data:') ? 'Imagen Cargada (Base64)' : tempMascotaUrl) : ''}
                  />
                  {/* Fallback to clear if needed */}
                  {tempMascotaUrl && (
                    <button 
                      onClick={() => setTempMascotaUrl('')}
                      className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-red-500"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>

                {tempMascotaUrl && (
                  <div className="mt-4 flex justify-center">
                    <div className="relative w-24 h-24 rounded-full border-4 border-indigo-50 overflow-hidden bg-gray-100 shadow-md">
                      <img src={tempMascotaUrl} alt="Preview" className="w-full h-full object-cover" 
                           onError={(e) => (e.currentTarget.style.display = 'none')} />
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-6 border-t border-gray-100 mt-6">
              <button onClick={() => setIsSettingsOpen(false)} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg">Cancelar</button>
              <button 
                onClick={handleSaveSettings} 
                disabled={isSavingSettings}
                className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-medium shadow-md disabled:opacity-50 flex items-center"
              >
                {isSavingSettings ? 'Guardando...' : 'Guardar Cambios'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
