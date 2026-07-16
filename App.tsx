
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
  RefreshCw,
  Database,
  Trash2,
  FileDown,
  FileUp,
  Cloud,
  ExternalLink,
  Wand2,
  Printer,
  Car,
  MessageSquare
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
import { Imprenta } from './components/Imprenta';
import { Vehicles } from './components/Vehicles';
import { SettingsSection } from './components/SettingsSection';

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
  subscribeToPlazas,
  getBase64Fallos,
  deleteBase64Fallos,
  importFallos,
  subscribeToVehicles,
  subscribeToVehicleAssignments,
  subscribeToVehicleEvents
} from './services/dbService';
import { validateApiKey } from './services/geminiService';
import { Employee, Expense, Task, Fallo, Plaza, Vehicle, VehicleAssignment, VehicleEvent } from './types';


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
  const [activeTab, setActiveTab] = useState('tablero');
  const [selectedBdayEmployeeId, setSelectedBdayEmployeeId] = useState<string | null>(null);
  const navigate = useNavigate();
  const location = useLocation();

  // Sync activeTab with URL
  useEffect(() => {
    if (currentUser?.isOfficeUser) {
      setActiveTab('gastos');
      if (location.pathname !== '/gastos') {
        navigate('/gastos');
      }
      return;
    }
    const path = location.pathname.substring(1);
    if (path && navItems.some(item => item.id === path)) {
      setActiveTab(path);
    } else if (location.pathname === '/') {
      setActiveTab('tablero');
    }
  }, [location.pathname, currentUser]);

  const handleTabChange = (tabId: string) => {
    setActiveTab(tabId);
    if (tabId === 'tablero') {
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
  const [mascotaUrl, setMascotaUrl] = useState('');
  const [mascotaName, setMascotaName] = useState('Mascota');
  const [companyName, setCompanyName] = useState('');
  const [imprentaUrl, setImprentaUrl] = useState('');
  const [multiOfficeEnabled, setMultiOfficeEnabled] = useState(false);
  
  const navItems = useMemo(() => {
    const items = [
      { id: 'tablero', label: 'Panel', icon: LayoutDashboard },
      { id: 'personal', label: 'Personal', icon: Users },
      { id: 'autos', label: 'Auto', icon: Car },
      { id: 'gastos', label: 'Gastos', icon: DollarSign },
      { id: 'tareas', label: 'Tareas', icon: CheckSquare },
      { id: 'pagares', label: 'Pagarés', icon: FileSignature },
      { id: 'fallos', label: 'Fallos', icon: FileWarning },
      { id: 'mascota', label: `Mi ${mascotaName}`, icon: ImageIcon }, 
      { id: 'imprenta', label: 'Imprenta', icon: Printer },
      { id: 'ajustes', label: 'Ajustes', icon: Settings },
    ];
    if (currentUser?.isOfficeUser) {
      return items.filter(item => item.id === 'gastos');
    }
    return items;
  }, [mascotaName, currentUser?.isOfficeUser]);
  const [googleApiKey, setGoogleApiKey] = useState('');
  const [imgbbApiKey, setImgbbApiKey] = useState('');
  const [appVersion, setAppVersion] = useState('1.0.0');
  const [appStatusColor, setAppStatusColor] = useState('#10B981'); 
  const [mobileNavSections, setMobileNavSections] = useState<string[]>(['tablero', 'personal', 'autos', 'gastos', 'tareas', 'fallos', 'imprenta']);
  const [birthdayPrompt, setBirthdayPrompt] = useState<string>('');
  const [birthdayVideoPrompt, setBirthdayVideoPrompt] = useState<string>('');
  const [birthdayWhatsAppTemplate, setBirthdayWhatsAppTemplate] = useState<string>('');
  const [loadAllExpenses, setLoadAllExpenses] = useState(false);
  const [loadAllFallos, setLoadAllFallos] = useState(false);
  const [isSyncingExpenses, setIsSyncingExpenses] = useState(false);
  const [isSyncingFallos, setIsSyncingFallos] = useState(false);
  
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
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [vehicleAssignments, setVehicleAssignments] = useState<VehicleAssignment[]>([]);
  const [vehicleEvents, setVehicleEvents] = useState<VehicleEvent[]>([]);
  
  // Loading flags for lazy loading
  const [hasLoadedEmployees, setHasLoadedEmployees] = useState(false);
  const [hasLoadedExpenses, setHasLoadedExpenses] = useState(false);
  const [hasLoadedDashboard, setHasLoadedDashboard] = useState(false);
  const [hasLoadedTasks, setHasLoadedTasks] = useState(false);
  const [hasLoadedFallos, setHasLoadedFallos] = useState(false);
  const [hasLoadedVehicles, setHasLoadedVehicles] = useState(false);

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
        setImgbbApiKey(settingsData.imgbbApiKey || '');
        setAppVersion(settingsData.appVersion || '1.0.0');
        setAppStatusColor(settingsData.appStatusColor || '#10B981');
        setImprentaUrl(settingsData.imprentaUrl || '');
        setBirthdayWhatsAppTemplate(settingsData.birthdayWhatsAppTemplate || '');
        setMultiOfficeEnabled(!!settingsData.multiOfficeEnabled);
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
      if (settings.imgbbApiKey !== undefined) {
        setImgbbApiKey(settings.imgbbApiKey);
      }
      setAppVersion(settings.appVersion);
      setAppStatusColor(settings.appStatusColor);
      if (settings.mobileNavSections) {
        // Migrate old IDs if necessary
        const idMap: Record<string, string> = {
          'dashboard': 'tablero',
          'personnel': 'personal',
          'expenses': 'gastos',
          'tasks': 'tareas',
          'promissory': 'pagares'
        };
        const migrated = settings.mobileNavSections.map((id: string) => idMap[id] || id);
        setMobileNavSections(migrated);
      }
      if (settings.birthdayPrompt) {
        setBirthdayPrompt(settings.birthdayPrompt);
      }
      if (settings.birthdayVideoPrompt) {
        setBirthdayVideoPrompt(settings.birthdayVideoPrompt);
      }
      if (settings.birthdayWhatsAppTemplate !== undefined) {
        setBirthdayWhatsAppTemplate(settings.birthdayWhatsAppTemplate);
      }
      if (settings.imprentaUrl !== undefined) {
        setImprentaUrl(settings.imprentaUrl);
      }
      if (settings.multiOfficeEnabled !== undefined) {
        setMultiOfficeEnabled(settings.multiOfficeEnabled);
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
      }, 0));
      
      // All Fallos - Load last 3 months by default
      const threeMonthsAgo = new Date();
      threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
      const dateString = threeMonthsAgo.toISOString().split('T')[0];

      unsubscribers.push(subscribeToAllFallos((data) => {
        setFallos(data);
        setHasLoadedFallos(true);
        setIsSyncingFallos(false);
      }, (err) => {
        handleError(err, 'LIST', 'fallos');
        setIsSyncingFallos(false);
      }, loadAllFallos ? 0 : 0, loadAllFallos ? undefined : dateString));
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

    if (activeTab === 'tablero') {
      const now = new Date();
      const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
      const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];
      unsubscribers.push(subscribeToDashboardExpenses(firstDay, lastDay, (data) => {
        setDashboardExpenses(data);
        setHasLoadedDashboard(true);
      }, (err) => handleError(err, 'LIST', 'expenses')));
    }
    
    if (activeTab === 'autos') {
      unsubscribers.push(subscribeToVehicles((data) => {
        setVehicles(data);
        setHasLoadedVehicles(true);
      }, (err) => handleError(err, 'LIST', 'vehicles')));

      unsubscribers.push(subscribeToVehicleAssignments((data) => {
        setVehicleAssignments(data);
      }, (err) => handleError(err, 'LIST', 'vehicle_assignments')));

      unsubscribers.push(subscribeToVehicleEvents((data) => {
        setVehicleEvents(data);
      }, (err) => handleError(err, 'LIST', 'vehicle_events')));
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
    handleTabChange('ajustes');
    setUserMenuOpen(false);
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
    if (activeTab === 'tablero') isTabReady = isDashboardReady;
    else if (activeTab === 'personal') isTabReady = isPersonnelReady;
    else if (activeTab === 'tareas') isTabReady = isTasksReady;
    else if (activeTab === 'autos') isTabReady = hasLoadedVehicles && hasLoadedEmployees;
    // Gastos and Fallos handle their own loading state internally via props
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
      case 'tablero': return <Dashboard currentUser={currentUser} employees={employees} expenses={dashboardExpenses} tasks={tasks} mascotaUrl={mascotaUrl} mascotaName={mascotaName} companyName={companyName} birthdayPrompt={birthdayPrompt} birthdayVideoPrompt={birthdayVideoPrompt} birthdayWhatsAppTemplate={birthdayWhatsAppTemplate} selectedBdayEmployeeId={selectedBdayEmployeeId} setSelectedBdayEmployeeId={setSelectedBdayEmployeeId} />;
      case 'personal': return <Personnel employees={employees} plazas={plazas} isLoading={!hasLoadedEmployees} currentUser={currentUser} />;
      case 'autos': return <Vehicles employees={employees} vehicles={vehicles} assignments={vehicleAssignments} events={vehicleEvents} isLoading={!hasLoadedVehicles} companyName={companyName} />;
      case 'gastos': return <Expenses expenses={expenses} employees={employees} isLoading={!hasLoadedExpenses} loadAll={loadAllExpenses} isSyncing={isSyncingExpenses} onLoadAll={() => { setLoadAllExpenses(true); setIsSyncingExpenses(true); }} multiOfficeEnabled={multiOfficeEnabled} currentUser={currentUser} />;
      case 'tareas': return <Tasks tasks={tasks} employees={employees} isLoading={!hasLoadedTasks} />;
      case 'pagares': return <PromissoryNotes companyName={companyName} />;
      case 'fallos': return <Fallos currentUser={currentUser} employees={employees} fallos={fallos} isLoading={!hasLoadedFallos} loadAll={loadAllFallos} isSyncing={isSyncingFallos} onLoadAll={() => { setLoadAllFallos(true); setIsSyncingFallos(true); }} />;
      case 'mascota': return <Mascota mascotaUrl={mascotaUrl} mascotaName={mascotaName} onOpenSettings={handleOpenSettings} employees={employees} onSelectBdayEmployee={(empId) => { setSelectedBdayEmployeeId(empId); handleTabChange('tablero'); }} />;
      case 'imprenta': return <Imprenta imprentaUrl={imprentaUrl} onOpenSettings={handleOpenSettings} />;
      case 'ajustes':
        return (
          <SettingsSection
            companyName={companyName}
            mascotaName={mascotaName}
            mascotaUrl={mascotaUrl}
            imprentaUrl={imprentaUrl}
            googleApiKey={googleApiKey}
            imgbbApiKey={imgbbApiKey}
            appVersion={appVersion}
            appStatusColor={appStatusColor}
            mobileNavSections={mobileNavSections}
            birthdayPrompt={birthdayPrompt}
            birthdayVideoPrompt={birthdayVideoPrompt}
            birthdayWhatsAppTemplate={birthdayWhatsAppTemplate}
            multiOfficeEnabled={multiOfficeEnabled}
            onClose={() => handleTabChange('tablero')}
          />
        );
      default: return <Dashboard currentUser={currentUser} employees={employees} expenses={dashboardExpenses} tasks={tasks} mascotaUrl={mascotaUrl} mascotaName={mascotaName} companyName={companyName} birthdayPrompt={birthdayPrompt} birthdayVideoPrompt={birthdayVideoPrompt} birthdayWhatsAppTemplate={birthdayWhatsAppTemplate} selectedBdayEmployeeId={selectedBdayEmployeeId} setSelectedBdayEmployeeId={setSelectedBdayEmployeeId} />;
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
                  handleTabChange(item.id);
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

                {!currentUser?.isOfficeUser && (
                  <>
                    <button 
                      onClick={handleOpenSettings}
                      className="w-full text-left px-4 py-3 text-sm text-gray-700 hover:bg-gray-50 flex items-center transition-colors"
                    >
                       <Settings className="w-4 h-4 mr-2 text-gray-400" /> Ajustes
                    </button>
                    <div className="h-px bg-gray-100"></div>
                  </>
                )}
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
        {!currentUser?.isOfficeUser && (
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
                      onClick={() => handleTabChange(item.id)}
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
        )}
      </main>

    </div>
  );
}

export default App;
