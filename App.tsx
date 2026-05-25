
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
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
  FileWarning, // Added FileWarning for Fallos
  LayoutGrid,
  Sparkles,
  RefreshCw
} from 'lucide-react';
import { motion } from 'motion/react';

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
  const navigate = useNavigate();
  const location = useLocation();

  // Sync activeTab with URL
  useEffect(() => {
    const path = location.pathname.substring(1);
    if (path && navItems.some(item => item.id === path)) {
      setActiveTab(path);
    } else if (location.pathname === '/') {
      setActiveTab('dashboard');
    }
  }, [location.pathname]);

  const handleTabChange = (tabId: string) => {
    setActiveTab(tabId);
    if (tabId === 'dashboard') {
      navigate('/');
    } else {
      navigate(`/${tabId}`);
    }
  };
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
  
  const navItems = useMemo(() => [
    { id: 'dashboard', label: 'Panel Principal', icon: LayoutDashboard },
    { id: 'personnel', label: 'Personal', icon: Users },
    { id: 'expenses', label: 'Gastos', icon: DollarSign },
    { id: 'tasks', label: 'Tareas', icon: CheckSquare },
    { id: 'promissory', label: 'Entrega Pagarés', icon: FileSignature },
    { id: 'fallos', label: 'Fallos', icon: FileWarning },
    { id: 'mascota', label: `Mi ${mascotaName}`, icon: ImageIcon }, 
  ], [mascotaName]);
  const [googleApiKey, setGoogleApiKey] = useState('');
  const [appVersion, setAppVersion] = useState('1.0.0');
  const [appStatusColor, setAppStatusColor] = useState('#10B981'); 
  const [mobileNavSections, setMobileNavSections] = useState<string[]>(['dashboard', 'personnel', 'expenses', 'tasks', 'fallos']);
  const [birthdayPrompt, setBirthdayPrompt] = useState<string>('');
  const [loadAllExpenses, setLoadAllExpenses] = useState(false);
  const [loadAllFallos, setLoadAllFallos] = useState(false);
  const [isSyncingExpenses, setIsSyncingExpenses] = useState(false);
  const [isSyncingFallos, setIsSyncingFallos] = useState(false);
  
  // Temp states for modal
  const [tempMascotaUrl, setTempMascotaUrl] = useState('');
  const [tempMascotaName, setTempMascotaName] = useState('');
  const [tempCompanyName, setTempCompanyName] = useState('');
  const [tempGoogleApiKey, setTempGoogleApiKey] = useState('');
  const [tempAppVersion, setTempAppVersion] = useState('');
  const [tempAppStatusColor, setTempAppStatusColor] = useState('');
  const [tempMobileNavSections, setTempMobileNavSections] = useState<string[]>([]);
  const [tempBirthdayPrompt, setTempBirthdayPrompt] = useState('');
  
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

  // Global data subscriptions (once per login)
  useEffect(() => {
    if (!currentUser) return;

    const unsubscribers: (() => void)[] = [];
    const handleError = (error: any, op: string, path: string) => {
      handleFirestoreError(error, op, path);
    };

    // Settings
    unsubscribers.push(subscribeToAppSettings((settings) => {
      setCompanyName(settings.companyName);
      setMascotaName(settings.mascotaName);
      setMascotaUrl(settings.mascotaUrl);
      setGoogleApiKey(settings.googleApiKey);
      setAppVersion(settings.appVersion);
      setAppStatusColor(settings.appStatusColor);
      if (settings.mobileNavSections) {
        setMobileNavSections(settings.mobileNavSections);
      }
      if (settings.birthdayPrompt) {
        setBirthdayPrompt(settings.birthdayPrompt);
      }
    }, (err) => handleError(err, 'GET', 'settings/global_config')));

    // Employees
    unsubscribers.push(subscribeToEmployees((data) => {
      setEmployees(data);
      setHasLoadedEmployees(true);
    }, (err) => handleError(err, 'LIST', 'employees')));
    
    // Plazas
    unsubscribers.push(subscribeToPlazas(setPlazas, (err) => handleError(err, 'LIST', 'plazas')));
    
    // Tasks
    unsubscribers.push(subscribeToTasks((data) => {
      setTasks(data);
      setHasLoadedTasks(true);
    }, (err) => handleError(err, 'LIST', 'tasks')));

    return () => {
      unsubscribers.forEach(unsub => unsub());
    };
  }, [currentUser?.id]);

  // Background loading for Expenses and Fallos (with limit or full)
  useEffect(() => {
    if (!currentUser) return;
    
    const unsubscribers: (() => void)[] = [];
    const handleError = (error: any, op: string, path: string) => {
      handleFirestoreError(error, op, path);
    };

    // If we are loading ALL, we don't want the 1.5s delay if we're already in the tab
    // but for the initial background load, a small delay is good for dashboard performance
    const delay = (loadAllExpenses || loadAllFallos) ? 0 : 1500;

    const backgroundTimeout = setTimeout(() => {
      // All Expenses
      unsubscribers.push(subscribeToAllExpenses((data) => {
        setExpenses(data);
        setHasLoadedExpenses(true);
        setIsSyncingExpenses(false);
      }, (err) => {
        handleError(err, 'LIST', 'expenses');
        setIsSyncingExpenses(false);
      }, loadAllExpenses ? 0 : 300));
      
      // All Fallos
      unsubscribers.push(subscribeToAllFallos((data) => {
        setFallos(data);
        setHasLoadedFallos(true);
        setIsSyncingFallos(false);
      }, (err) => {
        handleError(err, 'LIST', 'fallos');
        setIsSyncingFallos(false);
      }, loadAllFallos ? 0 : 300));
    }, delay);

    return () => {
      unsubscribers.forEach(unsub => unsub());
      clearTimeout(backgroundTimeout);
    };
  }, [currentUser?.id, loadAllExpenses, loadAllFallos]);

  // Tab-specific data subscriptions
  useEffect(() => {
    if (!currentUser) return;

    const unsubscribers: (() => void)[] = [];
    const handleError = (error: any, op: string, path: string) => {
      handleFirestoreError(error, op, path);
    };

    if (activeTab === 'dashboard') {
      const now = new Date();
      const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
      const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];
      unsubscribers.push(subscribeToDashboardExpenses(firstDay, lastDay, (data) => {
        setDashboardExpenses(data);
        setHasLoadedDashboard(true);
      }, (err) => handleError(err, 'LIST', 'expenses')));
    }
    // Note: All Expenses and All Fallos are now handled by the dedicated background useEffect
    // which also handles the "Load All" toggle.

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
    setTempMobileNavSections([...mobileNavSections]);
    setTempBirthdayPrompt(birthdayPrompt);
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
        appStatusColor: finalColor,
        mobileNavSections: tempMobileNavSections,
        birthdayPrompt: tempBirthdayPrompt
      });

      setMascotaUrl(tempMascotaUrl);
      setMascotaName(finalMascotaName);
      setCompanyName(tempCompanyName);
      setGoogleApiKey(finalApiKey);
      setAppVersion(finalVersion);
      setAppStatusColor(finalColor);
      setMobileNavSections(tempMobileNavSections);
      setBirthdayPrompt(tempBirthdayPrompt);
      
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

  const renderContent = () => {
    // Check if data for the current tab is ready
    const isDashboardReady = hasLoadedEmployees && hasLoadedTasks && hasLoadedDashboard;
    const isPersonnelReady = hasLoadedEmployees;
    const isExpensesReady = hasLoadedExpenses;
    const isTasksReady = hasLoadedTasks && hasLoadedEmployees;
    const isFallosReady = hasLoadedFallos && hasLoadedEmployees;

    let isTabReady = true;
    if (activeTab === 'dashboard') isTabReady = isDashboardReady;
    else if (activeTab === 'personnel') isTabReady = isPersonnelReady;
    else if (activeTab === 'tasks') isTabReady = isTasksReady;
    // Expenses and Fallos handle their own loading state internally via props
    // so we don't block the whole app while they sync heavy image data

    if (loading || !isTabReady) {
      return (
        <div className="flex flex-col items-center justify-center h-full bg-gray-50/30">
          <div className="relative">
            <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-indigo-600"></div>
            <div className="absolute inset-0 flex items-center justify-center">
               <div className="w-8 h-8 bg-indigo-100 rounded-full animate-pulse"></div>
            </div>
          </div>
          <p className="mt-4 text-gray-500 font-medium animate-pulse">Cargando datos de la oficina...</p>
          {!isOnline && (
            <div className="mt-2 flex items-center text-amber-600 bg-amber-50 px-3 py-1 rounded-full border border-amber-100 text-xs font-bold animate-bounce">
              <AlertCircle className="w-3 h-3 mr-1" /> Sin conexión a Internet
            </div>
          )}
          <p className="text-[10px] text-gray-400 mt-2">Sincronizando con la base de datos en tiempo real</p>
          <p className="text-[10px] text-gray-400 mt-4 opacity-50 italic">Si no carga, es culpa de Vick</p>
        </div>
      );
    }

    switch (activeTab) {
      case 'dashboard': return <Dashboard currentUser={currentUser} employees={employees} expenses={dashboardExpenses} tasks={tasks} mascotaUrl={mascotaUrl} mascotaName={mascotaName} companyName={companyName} birthdayPrompt={birthdayPrompt} />;
      case 'personnel': return <Personnel employees={employees} plazas={plazas} isLoading={!hasLoadedEmployees} />;
      case 'expenses': return <Expenses expenses={expenses} isLoading={!hasLoadedExpenses} loadAll={loadAllExpenses} isSyncing={isSyncingExpenses} onLoadAll={() => { setLoadAllExpenses(true); setIsSyncingExpenses(true); }} />;
      case 'tasks': return <Tasks tasks={tasks} employees={employees} isLoading={!hasLoadedTasks} />;
      case 'promissory': return <PromissoryNotes companyName={companyName} />;
      case 'fallos': return <Fallos employees={employees} fallos={fallos} isLoading={!hasLoadedFallos} loadAll={loadAllFallos} isSyncing={isSyncingFallos} onLoadAll={() => { setLoadAllFallos(true); setIsSyncingFallos(true); }} />;
      case 'mascota': return <Mascota mascotaUrl={mascotaUrl} mascotaName={mascotaName} onOpenSettings={handleOpenSettings} />;
      default: return <Dashboard currentUser={currentUser} employees={employees} expenses={dashboardExpenses} tasks={tasks} mascotaUrl={mascotaUrl} mascotaName={mascotaName} companyName={companyName} birthdayPrompt={birthdayPrompt} />;
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
        
        <nav className="p-4 space-y-2 relative">
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
                className={`relative flex items-center w-full px-4 py-3 rounded-xl transition-all duration-300 group z-10 ${
                  isActive 
                    ? 'text-indigo-700 font-bold shadow-[0_4px_20px_rgba(99,102,241,0.1)]' 
                    : 'text-gray-600 hover:bg-gray-50/50 hover:text-gray-900'
                }`}
              >
                {isActive && (
                  <motion.div
                    layoutId="sidebarActivePill"
                    className="absolute inset-0 -z-10 bg-gradient-to-r from-indigo-500/10 via-indigo-500/5 to-transparent rounded-xl border-l-[3px] border-indigo-600"
                    style={{
                      boxShadow: 'inset 1px 1px 2px rgba(255,255,255,0.8), 0 4px 12px rgba(99,102,241,0.04)',
                    }}
                    transition={{ type: "spring", stiffness: 350, damping: 30 }}
                  />
                )}
                <Icon className={`w-5 h-5 mr-3 transition-colors duration-300 ${isActive ? 'text-indigo-600' : 'text-gray-400 group-hover:text-gray-600'}`} />
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
        <div className="flex-1 overflow-auto bg-gray-50/50 pb-20 lg:pb-0">
          {renderContent()}
        </div>

        {/* Mobile Navigation Bar */}
        <motion.nav 
          animate={{ 
            boxShadow: [
              "0 15px 35px -5px rgba(79, 70, 229, 0.22), inset 0 1px 2px rgba(255,255,255,0.5)", 
              "0 20px 45px -5px rgba(79, 70, 229, 0.38), inset 0 1px 2px rgba(255,255,255,0.5)", 
              "0 15px 35px -5px rgba(79, 70, 229, 0.22), inset 0 1px 2px rgba(255,255,255,0.5)"
            ] 
          }}
          transition={{ repeat: Infinity, duration: 4, ease: "easeInOut" }}
          className="lg:hidden fixed bottom-6 left-1/2 -translate-x-1/2 w-[92%] max-w-md bg-white/20 backdrop-blur-2xl border border-white/50 border-t-white/70 border-b-white/20 rounded-2xl z-40 px-2 py-2"
          style={{
            background: "linear-gradient(135deg, rgba(255, 255, 255, 0.3) 0%, rgba(255, 255, 255, 0.1) 100%)"
          }}
        >
          {/* Subtle glossy reflection effect inside the glass bar */}
          <div className="absolute inset-0 rounded-2xl bg-gradient-to-b from-white/10 to-transparent pointer-events-none -z-10 bg-opacity-20" />
          
          <div className="flex items-center justify-around relative">
            {navItems
              .filter(item => mobileNavSections.includes(item.id))
              .map((item) => {
                const Icon = item.icon;
                const isActive = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => setActiveTab(item.id)}
                    className={`relative flex flex-col items-center justify-center py-2 px-3.5 rounded-xl transition-all duration-300 z-10 ${
                      isActive 
                        ? 'text-indigo-600' 
                        : 'text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    {isActive && (
                      <motion.div
                        layoutId="activeTabPill"
                        className="absolute inset-0 -z-10 bg-gradient-to-tr from-indigo-500/15 via-blue-500/5 to-transparent rounded-xl border border-white/40"
                        style={{
                          boxShadow: "inset 0 1px 2px rgba(255,255,255,0.4), 0 8px 16px -2px rgba(99,102,241,0.2)"
                        }}
                        transition={{ type: "spring", stiffness: 350, damping: 30 }}
                      />
                    )}
                    <Icon className={`w-6 h-6 ${isActive ? 'scale-110 text-indigo-600 drop-shadow-[0_2px_8px_rgba(99,102,241,0.3)]' : 'scale-100 text-gray-500'} transition-transform duration-300`} />
                    <span className={`text-[9.5px] font-bold mt-1 tracking-tight ${isActive ? 'opacity-100 max-h-4' : 'opacity-0 max-h-0'} overflow-hidden transition-all duration-300`}>
                      {item.label.split(' ')[0]}
                    </span>
                    {isActive && (
                      <motion.div
                        layoutId="activeTabIndicator"
                        className="absolute -bottom-1 w-1.5 h-1.5 bg-gradient-to-tr from-indigo-500 to-indigo-600 rounded-full shadow-[0_0_8px_rgba(99,102,241,0.8)]"
                        transition={{ type: "spring", stiffness: 350, damping: 30 }}
                      />
                    )}
                  </button>
                );
              })}
          </div>
        </motion.nav>
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
                <label className="block text-sm font-bold text-gray-700 mb-3 flex items-center">
                  <LayoutGrid className="w-4 h-4 mr-2 text-indigo-600" /> Barra de Navegación Móvil
                </label>
                <p className="text-xs text-gray-500 mb-3">Selecciona las secciones que aparecerán en el menú inferior del celular.</p>
                <div className="grid grid-cols-2 gap-2">
                  {navItems.map(item => (
                    <button
                      key={item.id}
                      onClick={() => {
                        if (tempMobileNavSections.includes(item.id)) {
                          setTempMobileNavSections(tempMobileNavSections.filter(id => id !== item.id));
                        } else {
                          setTempMobileNavSections([...tempMobileNavSections, item.id]);
                        }
                      }}
                      className={`flex items-center p-2 rounded-lg border-2 transition-all text-left ${
                        tempMobileNavSections.includes(item.id)
                          ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                          : 'border-gray-100 bg-gray-50 text-gray-400 hover:border-gray-200'
                      }`}
                    >
                      <item.icon className="w-4 h-4 mr-2" />
                      <span className="text-xs font-medium truncate">{item.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="border-t border-gray-100 my-4 pt-4"></div>

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2 flex items-center">
                  <Sparkles className="w-4 h-4 mr-2 text-indigo-600" /> Prompt de Tarjetas de Cumpleaños
                </label>
                <div className="bg-gray-50 p-3 rounded-lg border border-gray-100 mb-3">
                  <p className="text-[10px] font-bold text-gray-400 uppercase mb-2">Parámetros disponibles:</p>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                    <code className="text-[10px] text-indigo-600">{"${person.firstName}"}</code>
                    <code className="text-[10px] text-indigo-600">{"${person.lastName}"}</code>
                    <code className="text-[10px] text-indigo-600">{"${person.position}"}</code>
                    <code className="text-[10px] text-indigo-600">{"${person.plaza}"}</code>
                    <code className="text-[10px] text-indigo-600">{"${person.groupName}"}</code>
                  </div>
                </div>
                <textarea 
                  className="w-full border-2 border-gray-200 rounded-xl p-3 text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none transition-all min-h-[120px]"
                  placeholder={`Ejemplo:\nGenera una tarjeta Pixar 3D para \${person.firstName} de la plaza \${person.plaza}...`}
                  value={tempBirthdayPrompt}
                  onChange={(e) => setTempBirthdayPrompt(e.target.value)}
                />
                <button 
                  type="button"
                  onClick={() => setTempBirthdayPrompt(`Genera una tarjeta de felicitación de cumpleaños estilo Render 3D Pixar de ALTA CALIDAD.

ELEMENTOS:
1. TEXTO: En la parte superior, grande, 3D y brillante: "Feliz Cumpleaños \${person.firstName} \${person.lastName}". El texto debe ser el protagonista.
2. PERSONAJE: La mascota debe estar feliz, celebrando con brazos abiertos, gorro de fiesta.
3. AMBIENTE: Fondo festivo con desenfoque (bokeh), confeti cayendo, globos de colores vivos (Predominantemente AZULES, dorados y blancos). Iluminación de estudio cálida y mágica.

Composición centrada, estilo profesional y alegre. Evita el color rosa.`)}
                  className="mt-2 text-[10px] font-bold text-indigo-600 hover:text-indigo-800 flex items-center"
                >
                  <RefreshCw className="w-3 h-3 mr-1" /> Cargar prompt por defecto como ejemplo
                </button>
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
