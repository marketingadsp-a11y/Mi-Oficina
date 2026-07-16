import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'motion/react';
import { 
  Building2, 
  Tag, 
  Activity, 
  Key, 
  CheckCircle, 
  AlertCircle, 
  Loader2, 
  LayoutGrid, 
  Sparkles, 
  RefreshCw, 
  Database, 
  Trash2, 
  FileDown, 
  FileUp, 
  MessageSquare, 
  Wand2, 
  Printer, 
  Upload, 
  Image as ImageIcon,
  Check,
  X,
  ArrowLeft,
  Save,
  Globe,
  Smartphone
} from 'lucide-react';
import { 
  updateAppSettings, 
  getBase64Fallos, 
  deleteBase64Fallos, 
  importFallos 
} from '../services/dbService';
import { validateApiKey } from '../services/geminiService';
import { Fallo } from '../types';

interface SettingsSectionProps {
  companyName: string;
  mascotaName: string;
  mascotaUrl: string;
  imprentaUrl: string;
  googleApiKey: string;
  imgbbApiKey: string;
  appVersion: string;
  appStatusColor: string;
  mobileNavSections: string[];
  birthdayPrompt: string;
  birthdayVideoPrompt: string;
  birthdayWhatsAppTemplate: string;
  multiOfficeEnabled: boolean;
  onClose: () => void;
}

type CategoryType = 'general' | 'mascota' | 'apis' | 'mensajeria' | 'navegacion' | 'mantenimiento';

export function SettingsSection({
  companyName,
  mascotaName,
  mascotaUrl,
  imprentaUrl,
  googleApiKey,
  imgbbApiKey,
  appVersion,
  appStatusColor,
  mobileNavSections,
  birthdayPrompt,
  birthdayVideoPrompt,
  birthdayWhatsAppTemplate,
  multiOfficeEnabled,
  onClose
}: SettingsSectionProps) {
  // Local active tab for categories
  const [activeCategory, setActiveCategory] = useState<CategoryType>('general');

  // Form states
  const [tempCompanyName, setTempCompanyName] = useState(companyName);
  const [tempMascotaName, setTempMascotaName] = useState(mascotaName);
  const [tempMascotaUrl, setTempMascotaUrl] = useState(mascotaUrl);
  const [tempImprentaUrl, setTempImprentaUrl] = useState(imprentaUrl);
  const [tempGoogleApiKey, setTempGoogleApiKey] = useState(googleApiKey);
  const [tempImgbbApiKey, setTempImgbbApiKey] = useState(imgbbApiKey);
  const [tempAppVersion, setTempAppVersion] = useState(appVersion);
  const [tempAppStatusColor, setTempAppStatusColor] = useState(appStatusColor);
  const [tempMobileNavSections, setTempMobileNavSections] = useState<string[]>(mobileNavSections);
  const [tempBirthdayPrompt, setTempBirthdayPrompt] = useState(birthdayPrompt);
  const [tempBirthdayVideoPrompt, setTempBirthdayVideoPrompt] = useState(birthdayVideoPrompt);
  const [tempBirthdayWhatsAppTemplate, setTempBirthdayWhatsAppTemplate] = useState(birthdayWhatsAppTemplate);
  const [tempMultiOfficeEnabled, setTempMultiOfficeEnabled] = useState(multiOfficeEnabled);

  // Maintenance and Key states
  const [testingKey, setTestingKey] = useState(false);
  const [keyStatus, setKeyStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [isSaving, setIsSaving] = useState(false);
  const [deleteBase64Auth, setDeleteBase64Auth] = useState('');
  const [isDeletingBase64, setIsDeletingBase64] = useState(false);
  const [isBackingUpBase64, setIsBackingUpBase64] = useState(false);
  const [isImportingFallos, setIsImportingFallos] = useState(false);
  const importFileInputRef = useRef<HTMLInputElement>(null);

  // Sync inputs if props change (e.g. real-time updates)
  useEffect(() => {
    setTempCompanyName(companyName);
    setTempMascotaName(mascotaName);
    setTempMascotaUrl(mascotaUrl);
    setTempImprentaUrl(imprentaUrl);
    setTempGoogleApiKey(googleApiKey);
    setTempImgbbApiKey(imgbbApiKey);
    setTempAppVersion(appVersion);
    setTempAppStatusColor(appStatusColor);
    setTempMobileNavSections(mobileNavSections);
    setTempBirthdayPrompt(birthdayPrompt);
    setTempBirthdayVideoPrompt(birthdayVideoPrompt);
    setTempBirthdayWhatsAppTemplate(birthdayWhatsAppTemplate);
    setTempMultiOfficeEnabled(multiOfficeEnabled);
  }, [
    companyName, mascotaName, mascotaUrl, imprentaUrl, googleApiKey, 
    imgbbApiKey, appVersion, appStatusColor, mobileNavSections, 
    birthdayPrompt, birthdayVideoPrompt, birthdayWhatsAppTemplate,
    multiOfficeEnabled
  ]);

  const handleTestApiKey = async () => {
    if (!tempGoogleApiKey) return;
    setTestingKey(true);
    setKeyStatus('idle');
    const isValid = await validateApiKey(tempGoogleApiKey.trim());
    setTestingKey(false);
    setKeyStatus(isValid ? 'success' : 'error');
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = () => {
      const base64String = reader.result as string;
      const img = new Image();
      img.src = base64String;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        const MAX_WIDTH = 800;
        
        let width = img.width;
        let height = img.height;
        
        if (width > MAX_WIDTH) {
          height = (height * MAX_WIDTH) / width;
          width = MAX_WIDTH;
        }
        
        canvas.width = width;
        canvas.height = height;
        ctx?.drawImage(img, 0, 0, width, height);
        const compressedBase64 = canvas.toDataURL('image/jpeg', 0.7);
        setTempMascotaUrl(compressedBase64);
      };
    };
    reader.readAsDataURL(file);
  };

  const handleBackupBase64Fallos = async () => {
    setIsBackingUpBase64(true);
    try {
      const data = await getBase64Fallos();
      if (data.length === 0) {
        alert("No se encontraron fallos en formato Base64 para respaldar.");
        return;
      }
      
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `respaldo_fallos_base64_${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      alert(`${data.length} fallos respaldados con éxito.`);
    } catch (e) {
      console.error("Backup error", e);
      alert("Error al realizar el respaldo.");
    } finally {
      setIsBackingUpBase64(false);
    }
  };

  const handleImportFallos = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsImportingFallos(true);
    try {
      const text = await file.text();
      const data = JSON.parse(text) as Omit<Fallo, 'id'>[];
      
      if (!Array.isArray(data)) {
        throw new Error("Formato inválido");
      }

      await importFallos(data);
      alert(`Importación completada. Se importaron ${data.length} fallos.`);
    } catch (e) {
      console.error("Import error", e);
      alert("Error al importar fallos. Asegúrate de que el archivo sea un JSON válido.");
    } finally {
      setIsImportingFallos(false);
      if (importFileInputRef.current) importFileInputRef.current.value = '';
    }
  };

  const handleDeleteBase64Fallos = async () => {
    if (deleteBase64Auth !== '012004') {
      alert("Código de autorización incorrecto.");
      return;
    }

    if (!confirm("¿Estás seguro de que deseas eliminar permanentemente los fallos en formato Base64? Esta acción no se puede deshacer (asegúrate de tener un respaldo).")) {
      return;
    }

    setIsDeletingBase64(true);
    try {
      await deleteBase64Fallos();
      alert("Fallos Base64 eliminados con éxito.");
      setDeleteBase64Auth('');
    } catch (e) {
      console.error("Delete base64 error", e);
      alert("Error al eliminar los fallos.");
    } finally {
      setIsDeletingBase64(false);
    }
  };

  const handleSaveSettings = async () => {
    setIsSaving(true);
    const finalMascotaName = tempMascotaName || 'Mascota';
    const finalApiKey = tempGoogleApiKey.trim(); 
    const finalImgbbApiKey = tempImgbbApiKey.trim();
    const finalVersion = tempAppVersion || '1.0.0';
    const finalColor = tempAppStatusColor || '#10B981';
    
    try {
      await updateAppSettings({
        companyName: tempCompanyName,
        mascotaName: finalMascotaName,
        mascotaUrl: tempMascotaUrl,
        googleApiKey: finalApiKey,
        imgbbApiKey: finalImgbbApiKey,
        appVersion: finalVersion,
        appStatusColor: finalColor,
        mobileNavSections: tempMobileNavSections,
        birthdayPrompt: tempBirthdayPrompt,
        birthdayVideoPrompt: tempBirthdayVideoPrompt,
        birthdayWhatsAppTemplate: tempBirthdayWhatsAppTemplate,
        imprentaUrl: tempImprentaUrl,
        multiOfficeEnabled: tempMultiOfficeEnabled
      });
      alert("Configuración guardada exitosamente.");
      onClose();
    } catch (e) {
      console.error("Error saving settings to DB", e);
      alert("Error al guardar la configuración. Verifique su conexión.");
    } finally {
      setIsSaving(false);
    }
  };

  const navAllItems = [
    { id: 'tablero', label: 'Panel', icon: LayoutGrid },
    { id: 'personal', label: 'Personal', icon: LayoutGrid },
    { id: 'autos', label: 'Auto', icon: LayoutGrid },
    { id: 'gastos', label: 'Gastos', icon: LayoutGrid },
    { id: 'tareas', label: 'Tareas', icon: LayoutGrid },
    { id: 'pagares', label: 'Pagarés', icon: LayoutGrid },
    { id: 'fallos', label: 'Fallos', icon: LayoutGrid },
    { id: 'mascota', label: `Mi ${tempMascotaName}`, icon: LayoutGrid }, 
    { id: 'imprenta', label: 'Imprenta', icon: LayoutGrid },
  ];

  const categories = [
    { id: 'general', label: 'General / Oficina', icon: Building2, desc: 'Identidad, versión y colores de la app.' },
    { id: 'mascota', label: `Mascota (${tempMascotaName})`, icon: Sparkles, desc: 'Nombre, avatar e imagen de la mascota.' },
    { id: 'apis', label: 'APIs y Llaves', icon: Key, desc: 'Configuración de Gemini e imgBB.' },
    { id: 'mensajeria', label: 'IA y Mensajería', icon: MessageSquare, desc: 'Prompts y plantillas de cumpleaños.' },
    { id: 'navegacion', label: 'Barra Móvil', icon: LayoutGrid, desc: 'Secciones activas en celular.' },
    { id: 'mantenimiento', label: 'Mantenimiento', icon: Database, desc: 'Respaldos y limpieza de datos.' },
  ];

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-gray-50/50">
      {/* Dynamic Sub-header */}
      <div className="bg-white border-b border-gray-100 py-3.5 px-6 flex items-center justify-between shadow-sm shrink-0">
        <div className="flex items-center gap-3">
          <button 
            onClick={onClose}
            className="p-1.5 hover:bg-gray-100 rounded-xl text-gray-500 hover:text-gray-900 transition-colors"
            title="Volver"
            id="settings-back-btn"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h2 className="text-base font-bold text-gray-900 tracking-tight flex items-center gap-2">
              Ajustes del Sistema
            </h2>
            <p className="text-[10px] text-gray-400 font-medium">Configura la identidad, APIs y comportamiento global de la oficina</p>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <button
            onClick={onClose}
            className="px-3.5 py-2 text-xs font-bold text-gray-500 hover:bg-gray-100 rounded-xl transition-all"
            id="settings-cancel-btn"
          >
            Cancelar
          </button>
          <button
            onClick={handleSaveSettings}
            disabled={isSaving}
            className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-xl font-bold text-xs shadow-sm flex items-center gap-1.5 transition-all disabled:opacity-50"
            id="settings-save-btn"
          >
            {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
            {isSaving ? 'Guardando...' : 'Guardar Cambios'}
          </button>
        </div>
      </div>

      {/* Main Layout Area */}
      <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
        {/* Category Navigation Bar */}
        <div className="w-full md:w-64 bg-white border-b md:border-b-0 md:border-r border-gray-150 shrink-0 overflow-x-auto md:overflow-y-auto flex md:flex-col py-2 md:py-4 px-3 gap-1 scrollbar-none">
          <div className="hidden md:block text-[10px] font-bold text-gray-400 uppercase tracking-wider px-3 mb-3">
            Categorías
          </div>
          {categories.map((cat) => {
            const CatIcon = cat.icon;
            const isSelected = activeCategory === cat.id;
            return (
              <button
                key={cat.id}
                onClick={() => setActiveCategory(cat.id as CategoryType)}
                className={`flex items-center gap-3 w-auto md:w-full px-3 py-2.5 rounded-xl text-left transition-all shrink-0 border md:border-0 ${
                  isSelected 
                    ? 'bg-indigo-50 border-indigo-200 text-indigo-700 font-bold shadow-[0_2px_8px_rgba(99,102,241,0.05)]' 
                    : 'bg-transparent border-gray-100 hover:bg-gray-50 text-gray-600 hover:text-gray-900'
                }`}
                id={`settings-cat-${cat.id}`}
              >
                <div className={`p-1.5 rounded-lg transition-colors ${isSelected ? 'bg-indigo-100 text-indigo-700' : 'bg-gray-100 text-gray-500'}`}>
                  <CatIcon className="w-4 h-4" />
                </div>
                <div className="flex flex-col">
                  <span className="text-xs font-semibold leading-tight">{cat.label}</span>
                  <span className="hidden md:inline text-[9px] text-gray-400 font-normal truncate max-w-[150px] leading-tight mt-0.5">{cat.desc}</span>
                </div>
              </button>
            );
          })}
        </div>

        {/* Content Details Form */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-gray-50/50">
          <motion.div
            key={activeCategory}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2 }}
            className="max-w-2xl mx-auto space-y-6"
          >
            {/* 1. GENERAL / OFICINA CATEGORY */}
            {activeCategory === 'general' && (
              <div className="bg-white p-6 rounded-2xl border border-gray-150 shadow-sm space-y-5">
                <div className="flex items-center gap-2 border-b border-gray-100 pb-3">
                  <Building2 className="w-5 h-5 text-indigo-500" />
                  <h3 className="text-sm font-bold text-gray-800">General y Identidad de Oficina</h3>
                </div>
                
                <div className="space-y-4">
                  <div>
                    <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1.5">Nombre de la Financiera</label>
                    <div className="relative">
                      <Building2 className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
                      <input 
                        type="text" 
                        className="w-full border border-gray-200 rounded-xl pl-9 pr-3 py-2 text-xs font-semibold text-gray-700 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 transition-all"
                        placeholder="Ej: Everest"
                        value={tempCompanyName}
                        onChange={(e) => setTempCompanyName(e.target.value)}
                        id="setting-company-name"
                      />
                    </div>
                    <p className="text-[10px] text-gray-400 mt-1">Se usará como nombre de la App en el panel superior: "Mi Oficina {tempCompanyName}"</p>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1.5">Versión App</label>
                      <div className="relative">
                        <Tag className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
                        <input 
                          type="text" 
                          className="w-full border border-gray-200 rounded-xl pl-9 pr-3 py-2 text-xs font-semibold text-gray-700 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 transition-all"
                          placeholder="1.0.0"
                          value={tempAppVersion}
                          onChange={(e) => setTempAppVersion(e.target.value)}
                          id="setting-app-version"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1.5">Color del Estado</label>
                      <div className="flex items-center gap-2">
                        <input 
                          type="color" 
                          className="w-10 h-9 border border-gray-200 rounded-xl cursor-pointer p-0.5 bg-white shadow-sm"
                          value={tempAppStatusColor}
                          onChange={(e) => setTempAppStatusColor(e.target.value)}
                          id="setting-app-status-color"
                        />
                        <span className="text-xs text-gray-500 font-mono font-semibold uppercase">{tempAppStatusColor}</span>
                      </div>
                    </div>
                  </div>

                  <div className="border-t border-gray-100 pt-4">
                    <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1.5">Link de la Imprenta</label>
                    <div className="relative">
                      <Globe className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
                      <input 
                        type="text" 
                        placeholder="https://ejemplo.com/recursos-impresion"
                        className="w-full border border-gray-200 rounded-xl pl-9 pr-3 py-2 text-xs font-semibold text-gray-700 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 transition-all"
                        value={tempImprentaUrl}
                        onChange={(e) => setTempImprentaUrl(e.target.value)}
                        id="setting-imprenta-url"
                      />
                    </div>
                    <p className="text-[10px] text-gray-400 mt-1">Enlace externo (URL) del sistema o portal de imprenta para incrustarlo en la pestaña de Imprenta.</p>
                  </div>

                  <div className="border-t border-gray-100 pt-4 flex items-center justify-between">
                    <div>
                      <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-0.5">Modo Multi-Oficina</label>
                      <p className="text-[10px] text-gray-400">Habilita la administración de múltiples sucursales con códigos de acceso independientes para control de gastos.</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setTempMultiOfficeEnabled(!tempMultiOfficeEnabled)}
                      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                        tempMultiOfficeEnabled ? 'bg-indigo-600' : 'bg-gray-200'
                      }`}
                    >
                      <span
                        className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                          tempMultiOfficeEnabled ? 'translate-x-5' : 'translate-x-0'
                        }`}
                      />
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* 2. MASCOTA CATEGORY */}
            {activeCategory === 'mascota' && (
              <div className="bg-white p-6 rounded-2xl border border-gray-150 shadow-sm space-y-5">
                <div className="flex items-center gap-2 border-b border-gray-100 pb-3">
                  <Sparkles className="w-5 h-5 text-indigo-500" />
                  <h3 className="text-sm font-bold text-gray-800">Mascota de la Oficina</h3>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1.5">Nombre de la Mascota</label>
                    <input 
                      type="text" 
                      className="w-full border border-gray-200 rounded-xl px-3.5 py-2 text-xs font-semibold text-gray-700 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 transition-all"
                      placeholder="Ej: Mapache"
                      value={tempMascotaName}
                      onChange={(e) => setTempMascotaName(e.target.value)}
                      id="setting-mascota-name"
                    />
                    <p className="text-[10px] text-gray-400 mt-1">Se reflejará en el menú lateral: "Mi {tempMascotaName || 'Mascota'}"</p>
                  </div>

                  <div className="border-t border-gray-100 pt-4">
                    <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1.5">Avatar / Imagen de la Mascota</label>
                    <p className="text-[10px] text-gray-400 mb-3">Sube una imagen directamente para evitar caídas de links externos. Se comprimirá para optimizar espacio.</p>
                    
                    <div className="flex flex-col sm:flex-row gap-4 items-center">
                      <div className="flex-1 w-full">
                        <label className="cursor-pointer bg-white border border-dashed border-gray-300 hover:border-indigo-500 hover:bg-indigo-50/20 rounded-xl p-4 flex flex-col items-center justify-center transition-all group">
                          <Upload className="w-6 h-6 text-gray-400 group-hover:text-indigo-600 mb-1.5" />
                          <span className="text-xs text-gray-700 font-bold group-hover:text-indigo-700">Subir Imagen</span>
                          <span className="text-[9px] text-gray-400 mt-0.5">JPEG o PNG comprimido</span>
                          <input 
                            type="file" 
                            accept="image/*" 
                            className="hidden" 
                            onChange={handleFileUpload}
                            id="setting-mascota-file"
                          />
                        </label>
                      </div>

                      <div className="w-full flex flex-col justify-center items-center p-3 bg-gray-50 border border-gray-150 rounded-xl shrink-0 sm:w-40 h-32 relative">
                        {tempMascotaUrl ? (
                          <div className="relative w-20 h-20 rounded-full border-2 border-indigo-200 overflow-hidden bg-white shadow-sm">
                            <img src={tempMascotaUrl} alt="Mascota" className="w-full h-full object-cover" />
                            <button
                              onClick={() => setTempMascotaUrl('')}
                              className="absolute top-0 right-0 bg-red-500 text-white p-0.5 rounded-full hover:bg-red-600 transition-all shadow"
                              title="Eliminar imagen"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </div>
                        ) : (
                          <div className="flex flex-col items-center text-gray-400">
                            <ImageIcon className="w-8 h-8 mb-1" />
                            <span className="text-[9px] font-bold">Sin Imagen</span>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="relative mt-3">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <Globe className="h-4 w-4 text-gray-400" />
                      </div>
                      <input 
                        type="text"
                        className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-xl text-xs font-semibold text-gray-700 outline-none focus:border-indigo-500 transition-all"
                        placeholder="O pega una URL de imagen..."
                        value={tempMascotaUrl ? (tempMascotaUrl.startsWith('data:') ? 'Imagen en Base64 cargada localmente' : tempMascotaUrl) : ''}
                        onChange={(e) => {
                          if (!e.target.value.startsWith('Imagen en Base64')) {
                            setTempMascotaUrl(e.target.value);
                          }
                        }}
                        id="setting-mascota-url"
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* 3. APIS Y LLAVES CATEGORY */}
            {activeCategory === 'apis' && (
              <div className="bg-white p-6 rounded-2xl border border-gray-150 shadow-sm space-y-5">
                <div className="flex items-center gap-2 border-b border-gray-100 pb-3">
                  <Key className="w-5 h-5 text-indigo-500" />
                  <h3 className="text-sm font-bold text-gray-800">Conectividad y APIs</h3>
                </div>

                <div className="space-y-5">
                  <div className="bg-blue-50/40 p-4 border border-blue-100 rounded-2xl space-y-3">
                    <label className="block text-xs font-bold text-blue-800 flex items-center">
                      <Key className="w-4 h-4 mr-1.5 text-blue-600" /> Google Gemini API Key
                    </label>
                    <p className="text-[10px] text-blue-600 leading-relaxed">
                      Requerido para generar tarjetas de felicitación personalizadas e interacciones inteligentes con la mascota de oficina.
                    </p>
                    <div className="flex gap-2">
                      <input 
                        type="password" 
                        className={`w-full border rounded-xl px-3.5 py-2 text-xs font-bold font-mono outline-none transition-all bg-white ${
                          keyStatus === 'error' ? 'border-red-300 focus:border-red-500' : 
                          keyStatus === 'success' ? 'border-green-300 focus:border-green-500' :
                          'border-blue-200 focus:border-blue-500'
                        }`}
                        placeholder="AIzaSy..."
                        value={tempGoogleApiKey}
                        onChange={(e) => {
                          setTempGoogleApiKey(e.target.value.replace(/\s/g, ''));
                          setKeyStatus('idle');
                        }}
                        id="setting-gemini-key"
                      />
                      <button 
                        onClick={handleTestApiKey}
                        disabled={testingKey || !tempGoogleApiKey}
                        className={`px-4 rounded-xl flex items-center justify-center transition-colors text-[10px] font-extrabold min-w-[70px] ${
                          keyStatus === 'success' ? 'bg-green-100 text-green-700 border border-green-200' :
                          keyStatus === 'error' ? 'bg-red-100 text-red-700 border border-red-200' :
                          'bg-indigo-600 text-white hover:bg-indigo-700 shadow-sm'
                        }`}
                        id="test-gemini-key-btn"
                      >
                        {testingKey ? <Loader2 className="w-4 h-4 animate-spin"/> : 
                         keyStatus === 'success' ? 'VÁLIDA' :
                         keyStatus === 'error' ? 'INVÁLIDA' :
                         'PROBAR'}
                      </button>
                    </div>
                  </div>

                  <div className="bg-indigo-50/30 p-4 border border-indigo-100 rounded-2xl space-y-3">
                    <label className="block text-xs font-bold text-indigo-800 flex items-center">
                      <Key className="w-4 h-4 mr-1.5 text-indigo-600" /> API Key de imgBB (Servidor de Imágenes)
                    </label>
                    <p className="text-[10px] text-indigo-600 leading-relaxed">
                      Requerido para almacenar de forma persistente fotos tomadas en "Fallos", gastos y documentos en la nube.
                    </p>
                    <input 
                      type="password" 
                      className="w-full border border-indigo-100 focus:border-indigo-500 rounded-xl px-3.5 py-2 text-xs font-bold font-mono outline-none transition-all bg-white"
                      placeholder="Pega tu API Key de imgBB..."
                      value={tempImgbbApiKey}
                      onChange={(e) => setTempImgbbApiKey(e.target.value.replace(/\s/g, ''))}
                      id="setting-imgbb-key"
                    />
                    <p className="text-[9px] text-gray-400">Si se deja vacío, se usará la cuenta genérica de la aplicación.</p>
                  </div>
                </div>
              </div>
            )}

            {/* 4. IA Y MENSAJERIA */}
            {activeCategory === 'mensajeria' && (
              <div className="bg-white p-6 rounded-2xl border border-gray-150 shadow-sm space-y-5">
                <div className="flex items-center gap-2 border-b border-gray-100 pb-3">
                  <Wand2 className="w-5 h-5 text-indigo-500" />
                  <h3 className="text-sm font-bold text-gray-800">IA y Prompts de Cumpleaños</h3>
                </div>

                <div className="space-y-5">
                  <div>
                    <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1.5 flex items-center justify-between">
                      <span>Prompt Generación de Tarjeta</span>
                      <button 
                        type="button"
                        onClick={() => setTempBirthdayPrompt(`Genera una tarjeta de felicitación de cumpleaños estilo Render 3D Pixar de ALTA CALIDAD.

ELEMENTOS:
1. TEXTO: En la parte superior, grande, 3D y brillante: "Feliz Cumpleaños \${person.firstName} \${person.lastName}". El texto debe ser el protagonista.
2. PERSONAJE: La mascota debe estar feliz, celebrando con brazos abiertos, gorro de fiesta.
3. AMBIENTE: Fondo festivo con desenfoque (bokeh), confeti cayendo, globos de colores vivos (Predominantemente AZULES, dorados y blancos). Iluminación de estudio cálida y mágica.

Composición centrada, estilo profesional y alegre. Evita el color rosa.`)}
                        className="text-[9px] font-extrabold text-indigo-600 hover:text-indigo-800 flex items-center"
                        id="load-default-card-prompt-btn"
                      >
                        <RefreshCw className="w-2.5 h-2.5 mr-0.5" /> Por defecto
                      </button>
                    </label>
                    <textarea 
                      className="w-full border border-gray-200 rounded-xl p-3 text-xs font-semibold text-gray-700 outline-none focus:border-indigo-500 transition-all min-h-[100px]"
                      placeholder={`Ejemplo:\nGenera una tarjeta Pixar 3D para \${person.firstName}...`}
                      value={tempBirthdayPrompt}
                      onChange={(e) => setTempBirthdayPrompt(e.target.value)}
                      id="setting-birthday-card-prompt"
                    />
                  </div>

                  <div className="border-t border-gray-100 pt-4">
                    <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1.5 flex items-center justify-between">
                      <span>Prompt Generación de Video (Google Veo)</span>
                      <button 
                        type="button"
                        onClick={() => setTempBirthdayVideoPrompt(`Genera un video en bucle de 5 segundos estilo animación 3D Pixar de ALTA CALIDAD.
La mascota es un adorable personaje que celebra felizmente con gorro de fiesta el cumpleaños de \${person.firstName} \${person.lastName}.
La mascota salta de alegría sonriendo a la cámara, rodeada de confeti brillante que cae lentamente y globos de colores flotantes en un ambiente festivo y cálido.`)}
                        className="text-[9px] font-extrabold text-indigo-600 hover:text-indigo-800 flex items-center"
                        id="load-default-video-prompt-btn"
                      >
                        <RefreshCw className="w-2.5 h-2.5 mr-0.5" /> Por defecto
                      </button>
                    </label>
                    <textarea 
                      className="w-full border border-gray-200 rounded-xl p-3 text-xs font-semibold text-gray-700 outline-none focus:border-indigo-500 transition-all min-h-[100px]"
                      placeholder={`Ejemplo:\nGenera un video en bucle de 5 segundos de animación 3D...`}
                      value={tempBirthdayVideoPrompt}
                      onChange={(e) => setTempBirthdayVideoPrompt(e.target.value)}
                      id="setting-birthday-video-prompt"
                    />
                  </div>

                  <div className="border-t border-gray-100 pt-4">
                    <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1.5 flex items-center justify-between">
                      <span>Mensaje de WhatsApp</span>
                      <button 
                        type="button"
                        onClick={() => setTempBirthdayWhatsAppTemplate(`¡Feliz Cumpleaños, \${person.firstName}! 🎉🎂 Te deseamos lo mejor en este día tan especial de parte de todo el equipo de \${companyName}. ✨🎈`)}
                        className="text-[9px] font-extrabold text-indigo-600 hover:text-indigo-800 flex items-center"
                        id="load-default-wa-prompt-btn"
                      >
                        <RefreshCw className="w-2.5 h-2.5 mr-0.5" /> Por defecto
                      </button>
                    </label>
                    <textarea 
                      className="w-full border border-gray-200 rounded-xl p-3 text-xs font-semibold text-gray-700 outline-none focus:border-indigo-500 transition-all min-h-[80px]"
                      placeholder={`Ejemplo:\n¡Feliz Cumpleaños, \${person.firstName}! 🎉🎂...`}
                      value={tempBirthdayWhatsAppTemplate}
                      onChange={(e) => setTempBirthdayWhatsAppTemplate(e.target.value)}
                      id="setting-birthday-wa-prompt"
                    />
                  </div>

                  <div className="bg-gray-50 p-3 rounded-xl border border-gray-150">
                    <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1.5">Variables Disponibles:</p>
                    <div className="grid grid-cols-3 gap-2 text-center">
                      <code className="text-[10px] bg-white border border-gray-200 rounded px-1.5 py-0.5 text-indigo-600 font-bold">{"${person.firstName}"}</code>
                      <code className="text-[10px] bg-white border border-gray-200 rounded px-1.5 py-0.5 text-indigo-600 font-bold">{"${person.lastName}"}</code>
                      <code className="text-[10px] bg-white border border-gray-200 rounded px-1.5 py-0.5 text-indigo-600 font-bold">{"${person.plaza}"}</code>
                      <code className="text-[10px] bg-white border border-gray-200 rounded px-1.5 py-0.5 text-indigo-600 font-bold">{"${person.position}"}</code>
                      <code className="text-[10px] bg-white border border-gray-200 rounded px-1.5 py-0.5 text-indigo-600 font-bold">{"${companyName}"}</code>
                      <code className="text-[10px] bg-white border border-gray-200 rounded px-1.5 py-0.5 text-indigo-600 font-bold">{"${mascotaName}"}</code>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* 5. NAV ITEMS */}
            {activeCategory === 'navegacion' && (
              <div className="bg-white p-6 rounded-2xl border border-gray-150 shadow-sm space-y-5">
                <div className="flex items-center gap-2 border-b border-gray-100 pb-3">
                  <LayoutGrid className="w-5 h-5 text-indigo-500" />
                  <h3 className="text-sm font-bold text-gray-800">Menú de Navegación Móvil</h3>
                </div>

                <div>
                  <p className="text-[10px] text-gray-400 mb-4">
                    Selecciona qué pestañas aparecerán visibles en la barra de navegación inferior en dispositivos móviles (máximo 5 sugerido para un mejor rendimiento visual).
                  </p>

                  <div className="grid grid-cols-2 gap-3.5">
                    {navAllItems.map(item => {
                      const isSelected = tempMobileNavSections.includes(item.id);
                      return (
                        <button
                          key={item.id}
                          onClick={() => {
                            if (isSelected) {
                              setTempMobileNavSections(tempMobileNavSections.filter(id => id !== item.id));
                            } else {
                              setTempMobileNavSections([...tempMobileNavSections, item.id]);
                            }
                          }}
                          className={`flex items-center justify-between p-3 rounded-xl border-2 transition-all text-left ${
                            isSelected
                              ? 'border-indigo-500 bg-indigo-50/50 text-indigo-700'
                              : 'border-gray-100 bg-gray-50/50 text-gray-400 hover:border-gray-200'
                          }`}
                          id={`setting-nav-${item.id}`}
                        >
                          <span className="text-xs font-bold">{item.label}</span>
                          <div className={`w-5 h-5 rounded-lg flex items-center justify-center transition-colors ${isSelected ? 'bg-indigo-600 text-white' : 'bg-gray-200 text-gray-400'}`}>
                            {isSelected && <Check className="w-3.5 h-3.5" />}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* 6. BASE DE DATOS Y LIMPIEZA */}
            {activeCategory === 'mantenimiento' && (
              <div className="bg-white p-6 rounded-2xl border border-gray-150 shadow-sm space-y-5">
                <div className="flex items-center gap-2 border-b border-gray-100 pb-3">
                  <Database className="w-5 h-5 text-indigo-500" />
                  <h3 className="text-sm font-bold text-gray-800">Datos y Mantenimiento</h3>
                </div>

                <div className="space-y-5">
                  <div className="bg-orange-50/30 p-4 border border-orange-100 rounded-2xl space-y-3">
                    <label className="block text-xs font-bold text-orange-800 flex items-center">
                      <Database className="w-4 h-4 mr-1.5 text-orange-600" /> Respaldo y Migración de Fallos (Base64)
                    </label>
                    <p className="text-[10px] text-orange-700 leading-relaxed">
                      Si tienes fallos guardados con imágenes Base64 pesadas que desees archivar o limpiar de la base de datos para ahorrar espacio.
                    </p>
                    
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        onClick={handleBackupBase64Fallos}
                        disabled={isBackingUpBase64}
                        className="flex items-center justify-center gap-2 bg-white border border-orange-200 text-orange-700 px-3 py-2 rounded-xl text-[10px] font-extrabold hover:bg-orange-50 transition-colors disabled:opacity-50 shadow-sm"
                        id="backup-json-btn"
                      >
                        {isBackingUpBase64 ? <Loader2 className="w-3.5 h-3.5 animate-spin"/> : <FileDown className="w-3.5 h-3.5"/>}
                        RESPALDO JSON
                      </button>
                      
                      <button
                        onClick={() => importFileInputRef.current?.click()}
                        disabled={isImportingFallos}
                        className="flex items-center justify-center gap-2 bg-white border border-orange-200 text-orange-700 px-3 py-2 rounded-xl text-[10px] font-extrabold hover:bg-orange-50 transition-colors disabled:opacity-50 shadow-sm"
                        id="import-json-btn"
                      >
                        {isImportingFallos ? <Loader2 className="w-3.5 h-3.5 animate-spin"/> : <FileUp className="w-3.5 h-3.5"/>}
                        IMPORTAR JSON
                      </button>
                      <input 
                        type="file" 
                        ref={importFileInputRef} 
                        className="hidden" 
                        accept=".json" 
                        onChange={handleImportFallos} 
                      />
                    </div>
                  </div>

                  <div className="bg-red-50/30 p-4 border border-red-100 rounded-2xl space-y-3">
                    <label className="block text-xs font-bold text-red-800 flex items-center">
                      <Trash2 className="w-4 h-4 mr-1.5 text-red-600" /> Eliminación Definitiva de Datos
                    </label>
                    <p className="text-[10px] text-red-700 leading-relaxed">
                      Precaución: Esta acción eliminará permanentemente todos los registros pesados de imágenes Base64 de la base de datos.
                    </p>
                    <div className="flex gap-2">
                      <input 
                        type="password" 
                        placeholder="Código: 012004"
                        className="flex-1 border border-red-100 rounded-xl px-3 py-2 text-xs font-mono outline-none focus:ring-2 focus:ring-red-100 bg-white text-center"
                        value={deleteBase64Auth}
                        onChange={(e) => setDeleteBase64Auth(e.target.value)}
                        id="delete-base64-auth-code"
                      />
                      <button
                        onClick={handleDeleteBase64Fallos}
                        disabled={isDeletingBase64 || !deleteBase64Auth}
                        className="bg-red-600 text-white px-4 py-2 rounded-xl text-[10px] font-extrabold hover:bg-red-700 transition-colors disabled:opacity-50 flex items-center gap-1.5 shadow-sm"
                        id="delete-base64-btn"
                      >
                        {isDeletingBase64 ? <Loader2 className="w-3.5 h-3.5 animate-spin"/> : <Trash2 className="w-3.5 h-3.5"/>}
                        BORRAR
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </motion.div>
        </div>
      </div>
    </div>
  );
}
