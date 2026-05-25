import React, { useState, useMemo, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Search, Upload, Trash2, X, FileWarning, User, Users, Eye, ChevronDown, ChevronRight, Calendar, Download, Share2, CheckCircle, Loader2, AlertCircle, RefreshCw, ExternalLink } from 'lucide-react';
import { Employee, Fallo } from '../types';
import { addFallo, deleteFallo } from '../services/dbService';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';

interface FallosProps {
  employees: Employee[];
  fallos: Fallo[];
  isLoading?: boolean;
  loadAll?: boolean;
  isSyncing?: boolean;
  onLoadAll?: () => void;
}

import { getLocalDateString } from '../lib/dateUtils';

export const Fallos: React.FC<FallosProps> = ({ employees, fallos, isLoading, loadAll, isSyncing, onLoadAll }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [isDownloadModalOpen, setIsDownloadModalOpen] = useState(false);
  const [downloadDate, setDownloadDate] = useState('');
  const [viewImage, setViewImage] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [groupSearch, setGroupSearch] = useState('');
  const [showGroupDropdown, setShowGroupDropdown] = useState(false);
  const [isCompressing, setIsCompressing] = useState(false);
  
  // Expanded states for dates and groups
  const [expandedDates, setExpandedDates] = useState<Record<string, boolean>>({});
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [lastUsedGroup, setLastUsedGroup] = useState<{name: string, id: string} | null>(null);
  const [autoTriggerCamera, setAutoTriggerCamera] = useState(false);

  // Share Functionality
  const handleShare = async (imageUrl: string, description: string) => {
    if (navigator.share) {
      try {
        // Convert base64 to blob for sharing if possible, or just share text/url
        // Sharing base64 directly is tricky. Usually we share a file.
        // Let's try to convert base64 to file
        const response = await fetch(imageUrl);
        const blob = await response.blob();
        const file = new File([blob], "fallo.png", { type: "image/png" });

        await navigator.share({
          title: 'Fallo',
          text: description || 'Imagen de fallo',
          files: [file]
        });
      } catch (error) {
        console.error('Error sharing:', error);
        // Fallback or just ignore abort errors
      }
    } else {
      alert("Tu navegador no soporta la función de compartir nativa.");
    }
  };

  const handleDownloadZip = async () => {
    setDownloading(true);
    try {
      const zip = new JSZip();
      
      // Build folder name based on filters
      let folderName = 'Fallos';
      if (selectedExecutive) folderName += `_Ejecutivo_${selectedExecutive.replace(/\s+/g, '_')}`;
      if (selectedSupervisor) folderName += `_Sup_${selectedSupervisor.replace(/\s+/g, '_')}`;
      if (downloadDate) folderName += `_${downloadDate}`;
      
      const folder = zip.folder(folderName);

      // Filter fallos based on modal selection AND current filters
      const fallosToDownload = fallos.filter(f => {
        // 1. Date filter (if selected in modal)
        if (downloadDate && f.date !== downloadDate) return false;
        
        // 2. Resolve details
        const { supervisor, executive } = getGroupDetails(f.groupName || '');
        
        // 3. Executive filter (from main view)
        if (selectedExecutive && executive !== selectedExecutive) return false;
        
        // 4. Supervisor filter (from main view)
        if (selectedSupervisor && supervisor !== selectedSupervisor) return false;
        
        return true;
      });

      if (fallosToDownload.length === 0) {
        alert("No se encontraron fallos para los filtros seleccionados.");
        setDownloading(false);
        return;
      }

      // Add images to zip
      await Promise.all(fallosToDownload.map(async (f, index) => {
        try {
          const response = await fetch(f.imageUrl);
          const blob = await response.blob();
          
          // Organize in subfolders: DATE / GROUP
          const dateStr = f.date || 'Sin_Fecha';
          const groupStr = (f.groupName || 'Sin_Grupo').trim().replace(/[\/\\?%*:|"<>]/g, '-'); // Sanitize folder name
          
          // Create the nested structure inside the main folder
          const subFolder = folder?.folder(dateStr)?.folder(groupStr);
          
          // Use a simple name inside the group folder
          const fileName = `fallo_${index + 1}.png`;
          subFolder?.file(fileName, blob);
        } catch (e) {
          console.error("Error fetching image for zip", e);
        }
      }));

      // Generate zip
      const content = await zip.generateAsync({ type: "blob" });
      saveAs(content, `${folderName}.zip`);
      setIsDownloadModalOpen(false);
    } catch (error) {
      console.error("Error creating zip:", error);
      alert("Error al crear el archivo ZIP.");
    } finally {
      setDownloading(false);
    }
  };

  // Toggle Date Expansion
  const toggleDate = (date: string) => {
    setExpandedDates(prev => ({ ...prev, [date]: !prev[date] }));
  };

  useEffect(() => {
    if (isModalOpen && autoTriggerCamera && fileInputRef.current) {
      fileInputRef.current.click();
      setAutoTriggerCamera(false);
    }
  }, [isModalOpen, autoTriggerCamera]);
  const toggleGroup = (date: string, group: string) => {
    const key = `${date}-${group}`;
    setExpandedGroups(prev => ({ ...prev, [key]: !prev[key] }));
  };

  // Calculate the previous Saturday
  const getPreviousSaturday = () => {
    const d = new Date();
    // Go back until we hit a Saturday (6)
    while (d.getDay() !== 6) {
      d.setDate(d.getDate() - 1);
    }
    return getLocalDateString(d);
  };

  // Form State
  const [formData, setFormData] = useState<Partial<Fallo>>({
    description: '',
    date: getPreviousSaturday(),
    promotoraId: '',
    groupName: '',
    imageUrl: ''
  });

  // Filter unique groups from promotoras for the select dropdown
  const availableGroups = useMemo(() => {
    const uniqueGroups = new Set<string>();
    employees.forEach(e => {
      if (e.category === 'Promotoras' && e.groupName) {
        uniqueGroups.add(e.groupName);
      }
    });
    return Array.from(uniqueGroups).sort();
  }, [employees]);

  const filteredGroups = useMemo(() => {
    if (!groupSearch) return availableGroups;
    return availableGroups.filter(g => g.toLowerCase().includes(groupSearch.toLowerCase()));
  }, [availableGroups, groupSearch]);

  // Handle Group Selection in Form
  const handleGroupChange = (groupName: string) => {
    setFormData(prev => ({
      ...prev,
      groupName,
      promotoraId: employees.find(e => e.groupName === groupName)?.id || ''
    }));
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsCompressing(true);
    const reader = new FileReader();
    reader.onloadend = () => {
      const img = new Image();
      img.src = reader.result as string;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        const MAX_WIDTH = 1024; // Standardize to 1024px max width for super clear text but 95%+ size savings
        
        let width = img.width;
        let height = img.height;
        
        if (width > MAX_WIDTH) {
          height = (height * MAX_WIDTH) / width;
          width = MAX_WIDTH;
        }
        
        canvas.width = width;
        canvas.height = height;
        
        if (ctx) {
          // Set solid white background to avoid black patches from transparent PNGs
          ctx.fillStyle = '#FFFFFF';
          ctx.fillRect(0, 0, width, height);
          ctx.drawImage(img, 0, 0, width, height);
          
          // Output high-efficiency lightweight JPEG 0.7 which yields ultra fast uploads & loads
          const compressedBase64 = canvas.toDataURL('image/jpeg', 0.75);
          setFormData(prev => ({ ...prev, imageUrl: compressedBase64 }));
        } else {
          setFormData(prev => ({ ...prev, imageUrl: reader.result as string }));
        }
        setIsCompressing(false);
      };
      img.onerror = () => {
        setFormData(prev => ({ ...prev, imageUrl: reader.result as string }));
        setIsCompressing(false);
      };
    };
    reader.onerror = () => {
      setIsCompressing(false);
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.imageUrl) {
      alert("Por favor sube una foto del documento.");
      return;
    }
    
    setLoading(true);
    try {
      const groupName = formData.groupName || 'Sin Grupo';
      const promotoraId = formData.promotoraId || '';
      
      await addFallo({
        description: 'Fallo / Documento',
        imageUrl: formData.imageUrl,
        date: formData.date || getLocalDateString(),
        promotoraId: promotoraId,
        promotoraName: formData.promotoraName || '',
        groupName: groupName,
        createdAt: new Date().toISOString()
      } as Omit<Fallo, 'id'>);

      setLastUsedGroup({ name: groupName, id: promotoraId });
      setIsModalOpen(false);
      setShowSuccessModal(true);
    } catch (error) {
      console.error("Error saving fallo:", error);
      alert("Error al guardar el documento. " + (error as any).message);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm("¿Estás seguro de eliminar este documento?")) {
      await deleteFallo(id);
    }
  };

  // Helper to format date as DD-MM-YYYY
  const formatDate = (dateString: string) => {
    if (!dateString) return '';
    const [year, month, day] = dateString.split('-');
    return `${day}-${month}-${year}`;
  };

  // Helper to get Supervisor and Executive for a group
  const getGroupDetails = (groupName: string) => {
    if (!groupName || groupName === 'Sin Grupo') return { supervisor: 'N/A', executive: 'N/A' };
    
    const normalizedGroupName = groupName.trim().toLowerCase();

    // Find a promotora in this group to get the IDs
    const promotora = employees.find(e => 
      e.category === 'Promotoras' && 
      (e.groupName || '').trim().toLowerCase() === normalizedGroupName
    );
    
    if (!promotora) return { supervisor: 'No asignado', executive: 'No asignado' };

    const supervisor = employees.find(e => e.id === promotora.linkedSupervisorId);
    const executive = employees.find(e => e.id === promotora.linkedExecutiveId);

    const supervisorName = supervisor ? (supervisor.supervisionName || `${supervisor.firstName} ${supervisor.lastName}`) : 'No asignado';
    const executiveName = executive ? `${executive.firstName} ${executive.lastName}` : 'No asignado';

    return { supervisor: supervisorName, executive: executiveName };
  };

  const [selectedExecutive, setSelectedExecutive] = useState('');
  const [selectedSupervisor, setSelectedSupervisor] = useState('');

  // Get unique lists of Executives and Supervisors
  const executives = useMemo(() => {
    return employees.filter(e => e.category === 'Ejecutivos').sort((a, b) => a.firstName.localeCompare(b.firstName));
  }, [employees]);

  const supervisors = useMemo(() => {
    return employees
      .filter(e => e.category === 'Supervisoras')
      .sort((a, b) => {
        const nameA = (a.supervisionName || `${a.firstName} ${a.lastName}`).toLowerCase();
        const nameB = (b.supervisionName || `${b.firstName} ${b.lastName}`).toLowerCase();
        return nameA.localeCompare(nameB);
      });
  }, [employees]);

  // --- ORGANIZED DATA STRUCTURE ---
  // 1. Filter
  // 2. Group by Date
  // 3. Group by GroupName
  const organizedFallos = useMemo(() => {
    const lowerSearch = searchTerm.toLowerCase();
    
    const filtered = fallos.filter(f => {
      // Text Search
      const matchesSearch = (f.description || '').toLowerCase().includes(lowerSearch) ||
                            (f.promotoraName || '').toLowerCase().includes(lowerSearch) ||
                            (f.groupName || '').toLowerCase().includes(lowerSearch);
      
      if (!matchesSearch) return false;

      // Filter by Executive/Supervisor
      // We need to resolve the group's executive/supervisor to filter correctly
      const { supervisor, executive } = getGroupDetails(f.groupName || '');
      
      // Check Executive Filter
      if (selectedExecutive && executive !== selectedExecutive) {
         // Compare names directly since getGroupDetails returns full names
         // But selectedExecutive is an ID usually? Let's make the dropdown values match what getGroupDetails returns or use IDs.
         // getGroupDetails returns NAMES. The dropdowns should probably use NAMES to match easily, 
         // or we need to look up the ID from the name returned by getGroupDetails (which is hard).
         // Better approach: Update getGroupDetails to return IDs as well, or just compare names if unique enough.
         // Let's compare names for simplicity as getGroupDetails constructs names.
         // Wait, the dropdowns will likely have IDs as values.
         // Let's make getGroupDetails return IDs too.
         return false;
      }
      
      // Check Supervisor Filter
      if (selectedSupervisor && supervisor !== selectedSupervisor) {
         return false;
      }

      return true;
    });

    const grouped: Record<string, Record<string, Fallo[]>> = {};

    filtered.forEach(f => {
      const fDate = f.date;
      const gName = f.groupName || 'Sin Grupo';

      if (!grouped[fDate]) {
        grouped[fDate] = {};
      }
      if (!grouped[fDate][gName]) {
        grouped[fDate][gName] = [];
      }
      grouped[fDate][gName].push(f);
    });

    return grouped;
  }, [fallos, searchTerm, selectedExecutive, selectedSupervisor, employees]); // Added dependencies

  // Get sorted dates (descending)
  const sortedDates = useMemo(() => {
    return Object.keys(organizedFallos).sort((a, b) => new Date(b).getTime() - new Date(a).getTime());
  }, [organizedFallos]);

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-800 flex items-center">
            <FileWarning className="w-8 h-8 mr-2 text-orange-500" />
            Fallos
          </h2>
        </div>
        
        <div className="flex gap-2">
          <button 
            onClick={() => setIsDownloadModalOpen(true)}
            className="hidden md:flex bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg items-center shadow-sm transition-colors"
          >
            <Download className="w-5 h-5 mr-2" /> Descargar Masivo
          </button>
          <button 
            onClick={() => setIsModalOpen(true)}
            className="bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 rounded-lg flex items-center shadow-sm transition-colors"
          >
            <Upload className="w-5 h-5 mr-2" /> Subir Fallo
          </button>
        </div>
      </div>

      <div className="bg-amber-50 border border-amber-100 p-3 rounded-xl flex items-center gap-3">
        <AlertCircle className="w-5 h-5 text-amber-600 shrink-0" />
        <div className="flex-1">
          <p className="text-xs text-amber-800">
            {loadAll 
              ? "Se están mostrando todos los fallos registrados." 
              : "Para mantener la velocidad, solo se muestran los fallos de los últimos 3 meses."}
          </p>
          {!loadAll && onLoadAll && (
            <button 
              onClick={onLoadAll}
              disabled={isSyncing}
              className="mt-1 flex items-center gap-2 bg-amber-600 hover:bg-amber-700 text-white px-3 py-1 rounded-lg text-[10px] font-bold transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSyncing ? (
                <>
                  <Loader2 className="w-3 h-3 animate-spin" />
                  Cargando...
                </>
              ) : (
                <>
                  <RefreshCw className="w-3 h-3" />
                  Cargar Todo
                </>
              )}
            </button>
          )}
        </div>
      </div>

      {/* Syncing Progress Bar */}
      <AnimatePresence>
        {isSyncing && (
          <motion.div 
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="bg-indigo-50 border border-indigo-100 p-4 rounded-xl flex flex-col gap-3 shadow-sm"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-indigo-700 font-bold text-sm">
                <Loader2 className="w-4 h-4 animate-spin" />
                Sincronizando historial completo...
              </div>
              <span className="text-[10px] text-indigo-500 font-medium">Esto puede tardar unos segundos</span>
            </div>
            <div className="w-full bg-indigo-100 rounded-full h-1.5 overflow-hidden">
              <motion.div 
                className="bg-indigo-600 h-full"
                initial={{ width: "0%" }}
                animate={{ width: "100%" }}
                transition={{ duration: 15, ease: "linear" }}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Search Bar & Filters */}
      <div className="flex flex-col md:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="w-5 h-5 text-gray-400 absolute left-3 top-1/2 transform -translate-y-1/2" />
          <input 
            type="text" 
            placeholder="Buscar..." 
            className="w-full pl-10 pr-4 py-3 border rounded-xl text-sm bg-white shadow-sm focus:ring-2 focus:ring-orange-200 focus:border-orange-400 outline-none"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        {/* Executive Filter */}
        <div className="relative w-full md:w-48">
          <select
            className="w-full pl-3 pr-8 py-3 border rounded-xl text-sm bg-white shadow-sm focus:ring-2 focus:ring-orange-200 focus:border-orange-400 outline-none appearance-none"
            value={selectedExecutive}
            onChange={(e) => setSelectedExecutive(e.target.value)}
          >
            <option value="">Todos los Ejecutivos</option>
            {executives.map(exec => (
              <option key={exec.id} value={`${exec.firstName} ${exec.lastName}`}>
                {exec.firstName} {exec.lastName}
              </option>
            ))}
          </select>
          <ChevronDown className="w-4 h-4 text-gray-400 absolute right-3 top-1/2 transform -translate-y-1/2 pointer-events-none" />
        </div>

        {/* Supervisor Filter */}
        <div className="relative w-full md:w-48">
          <select
            className="w-full pl-3 pr-8 py-3 border rounded-xl text-sm bg-white shadow-sm focus:ring-2 focus:ring-orange-200 focus:border-orange-400 outline-none appearance-none"
            value={selectedSupervisor}
            onChange={(e) => setSelectedSupervisor(e.target.value)}
          >
            <option value="">Todas las Supervisoras</option>
            {supervisors.map(sup => (
              <option key={sup.id} value={sup.supervisionName || `${sup.firstName} ${sup.lastName}`}>
                {sup.supervisionName || `${sup.firstName} ${sup.lastName}`}
              </option>
            ))}
          </select>
          <ChevronDown className="w-4 h-4 text-gray-400 absolute right-3 top-1/2 transform -translate-y-1/2 pointer-events-none" />
        </div>
      </div>

      {/* ORGANIZED LIST VIEW */}
      <div className="space-y-4">
        {isLoading ? (
          <div className="py-20 text-center">
            <Loader2 className="w-10 h-10 text-indigo-600 animate-spin mx-auto mb-4" />
            <p className="text-gray-500 font-medium">Cargando documentos...</p>
          </div>
        ) : sortedDates.length === 0 ? (
          <div className="py-12 text-center text-gray-400 bg-white rounded-xl border border-dashed border-gray-300">
            <FileWarning className="w-12 h-12 mx-auto mb-3 opacity-20" />
            <p>No hay documentos registrados.</p>
          </div>
        ) : (
          sortedDates.map(date => {
            const groups = Object.keys(organizedFallos[date]).sort();
            const isDateExpanded = expandedDates[date];
            const totalDocsInDate = groups.reduce((acc, g) => acc + organizedFallos[date][g].length, 0);

            return (
              <div key={date} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                {/* Date Header */}
                <div 
                  className="p-4 bg-gray-50 flex items-center justify-between cursor-pointer hover:bg-gray-100 transition-colors"
                  onClick={() => toggleDate(date)}
                >
                  <div className="flex items-center gap-3">
                    {isDateExpanded ? <ChevronDown className="w-5 h-5 text-gray-500" /> : <ChevronRight className="w-5 h-5 text-gray-500" />}
                    <div className="flex items-center gap-2">
                      <Calendar className="w-5 h-5 text-blue-500" />
                      <h3 className="font-bold text-gray-800 text-lg">{formatDate(date)}</h3>
                      <span className="text-xs bg-gray-200 text-gray-600 px-2 py-0.5 rounded-full">
                        {totalDocsInDate} fallos
                      </span>
                    </div>
                  </div>
                </div>

                {/* Groups List (Accordion Body) */}
                {isDateExpanded && (
                  <div className="border-t border-gray-100">
                    {groups.map(groupName => {
                      const groupKey = `${date}-${groupName}`;
                      const isGroupExpanded = expandedGroups[groupKey];
                      const fallosInGroup = organizedFallos[date][groupName];
                      const { supervisor, executive } = getGroupDetails(groupName);

                      return (
                        <div key={groupKey} className="border-b border-gray-100 last:border-0">
                          {/* Group Header */}
                          <div 
                            className="px-6 py-3 flex flex-col sm:flex-row sm:items-center justify-between cursor-pointer hover:bg-orange-50/50 transition-colors gap-2"
                            onClick={() => toggleGroup(date, groupName)}
                          >
                            <div className="flex items-center gap-3">
                              {isGroupExpanded ? <ChevronDown className="w-4 h-4 text-gray-400" /> : <ChevronRight className="w-4 h-4 text-gray-400" />}
                              <Users className="w-4 h-4 text-orange-500" />
                              <span className="font-medium text-gray-700 text-sm">{groupName}</span>
                              <span className="text-xs text-gray-400">({fallosInGroup.length})</span>
                            </div>
                            
                            {/* Supervisor & Executive Info */}
                            <div className="flex flex-col sm:flex-row gap-1 sm:gap-4 text-xs text-gray-500 ml-9 sm:ml-0">
                              <span className="flex items-center gap-1">
                                <User className="w-3 h-3 text-blue-400" />
                                <span className="font-medium">Sup:</span> {supervisor}
                              </span>
                              <span className="flex items-center gap-1">
                                <User className="w-3 h-3 text-green-400" />
                                <span className="font-medium">Ejec:</span> {executive}
                              </span>
                            </div>
                          </div>

                          {/* Thumbnails Grid */}
                          {isGroupExpanded && (
                            <div className="px-10 py-4 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4 bg-gray-50/30">
                              {fallosInGroup.map(fallo => (
                                <div key={fallo.id} className="relative group aspect-[3/4] bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
                                  <img 
                                    src={fallo.imageUrl} 
                                    alt="Documento" 
                                    loading="lazy"
                                    className="w-full h-full object-cover cursor-pointer hover:scale-105 transition-transform duration-300"
                                    onClick={() => setViewImage(fallo.imageUrl)}
                                  />
                                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors pointer-events-none" />
                                  <button 
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleDelete(fallo.id);
                                    }}
                                    className="absolute top-1 right-1 bg-white/90 p-1 rounded-full text-red-500 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-white z-10"
                                    title="Eliminar"
                                  >
                                    <Trash2 className="w-3 h-3" />
                                  </button>
                                  
                                    <button 
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleShare(fallo.imageUrl, fallo.description);
                                      }}
                                      className="absolute bottom-1 right-1 bg-white/90 p-1 rounded-full text-blue-500 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-white z-10"
                                      title="Compartir"
                                    >
                                      <Share2 className="w-3 h-3" />
                                    </button>

                                    {fallo.imageUrl.includes('google.com') && (
                                      <a 
                                        href={fallo.imageUrl} 
                                        target="_blank" 
                                        rel="noopener noreferrer"
                                        onClick={(e) => e.stopPropagation()}
                                        className="absolute bottom-1 left-1 bg-white/90 p-1 rounded-full text-green-600 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-white z-10"
                                        title="Abrir en Drive"
                                      >
                                        <ExternalLink className="w-3 h-3" />
                                      </a>
                                    )}
                                  </div>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* SUCCESS MODAL */}
      {showSuccessModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm p-6 shadow-2xl text-center">
            <div className="mx-auto w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4">
              <CheckCircle className="w-8 h-8 text-green-600" />
            </div>
            <h3 className="text-xl font-bold text-gray-800 mb-2">¡Registro Exitoso!</h3>
            <p className="text-gray-500 mb-6">El fallo se ha guardado correctamente.</p>
            
            <div className="space-y-3">
              {lastUsedGroup && (
                <button 
                  onClick={() => {
                    setShowSuccessModal(false);
                    setFormData({
                      description: '',
                      date: getPreviousSaturday(),
                      promotoraId: lastUsedGroup.id,
                      groupName: lastUsedGroup.name,
                      imageUrl: ''
                    });
                    setGroupSearch(lastUsedGroup.name);
                    setAutoTriggerCamera(true);
                    setIsModalOpen(true);
                  }}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2.5 rounded-lg font-medium shadow-md transition-colors"
                >
                  Subir otro al mismo grupo
                </button>
              )}
              
              <button 
                onClick={() => {
                  setShowSuccessModal(false);
                  setIsModalOpen(true);
                  setFormData({
                    description: '',
                    date: getPreviousSaturday(),
                    promotoraId: '',
                    groupName: '',
                    imageUrl: ''
                  });
                  setGroupSearch('');
                }}
                className="w-full bg-orange-500 hover:bg-orange-600 text-white py-2.5 rounded-lg font-medium shadow-md transition-colors"
              >
                Subir Otro Fallo
              </button>
              
              <button 
                onClick={() => {
                  setShowSuccessModal(false);
                  setIsModalOpen(false);
                  setFormData({
                    description: '',
                    date: getPreviousSaturday(),
                    promotoraId: '',
                    groupName: '',
                    imageUrl: ''
                  });
                  setGroupSearch('');
                }}
                className="w-full bg-gray-100 hover:bg-gray-200 text-gray-700 py-2.5 rounded-lg font-medium transition-colors"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DOWNLOAD MODAL */}
      {isDownloadModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm p-6 shadow-2xl">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold text-gray-800">Descargar Masivo</h3>
              <button onClick={() => setIsDownloadModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="space-y-4 mb-6">
              <p className="text-sm text-gray-600">
                Se descargarán los fallos que coincidan con los filtros actuales de la pantalla principal.
              </p>
              
              <div className="p-3 bg-gray-50 rounded-lg border border-gray-100 space-y-2">
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Filtros Activos:</p>
                <div className="text-sm space-y-1">
                  <p><span className="font-medium">Ejecutivo:</span> {selectedExecutive || 'Todos'}</p>
                  <p><span className="font-medium">Supervisora:</span> {selectedSupervisor || 'Todas'}</p>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1">Filtrar por Fecha (Opcional)</label>
                <div className="relative">
                  <input 
                    type="date" 
                    className="w-full border p-2.5 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                    value={downloadDate}
                    onChange={e => setDownloadDate(e.target.value)}
                  />
                  {downloadDate && (
                    <button 
                      onClick={() => setDownloadDate('')}
                      className="absolute right-10 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
                <p className="text-[10px] text-gray-400 mt-1">Si dejas la fecha vacía, se descargarán todos los fallos de los filtros seleccionados.</p>
              </div>
            </div>

            <button 
              onClick={handleDownloadZip}
              disabled={downloading}
              className="w-full bg-blue-500 hover:bg-blue-600 text-white py-3 rounded-xl font-bold shadow-lg transition-all disabled:opacity-50 flex justify-center items-center active:scale-95"
            >
              {downloading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin mr-2" />
                  Procesando...
                </>
              ) : (
                <>
                  <Download className="w-5 h-5 mr-2" /> Descargar ZIP
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* UPLOAD MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold text-gray-800">Subir Fallo</h3>
              <button onClick={() => {
                setIsModalOpen(false);
                setGroupSearch('');
              }} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Group Search - NOW AT THE TOP */}
              <div className="bg-gray-50 p-3 rounded-lg border border-gray-200 space-y-3">
                <div className="relative">
                  <label className="block text-xs font-bold text-gray-500 mb-1 flex items-center">
                    <Users className="w-3 h-3 mr-1" /> Grupo
                  </label>
                  <div className="relative">
                    <input 
                      type="text"
                      placeholder="Escribe para buscar grupo..."
                      className="w-full border p-2.5 rounded-lg focus:ring-2 focus:ring-orange-500 outline-none text-sm pr-10"
                      value={groupSearch || formData.groupName || ''}
                      onChange={e => {
                        setGroupSearch(e.target.value);
                        setShowGroupDropdown(true);
                      }}
                      onFocus={() => setShowGroupDropdown(true)}
                    />
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
                      <Search className="w-4 h-4" />
                    </div>
                  </div>

                  {showGroupDropdown && (
                    <div className="absolute z-[70] left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-xl max-h-48 overflow-y-auto animate-in fade-in slide-in-from-top-2 duration-200">
                      {filteredGroups.length > 0 ? (
                        filteredGroups.map(g => (
                          <button
                            key={g}
                            type="button"
                            className="w-full text-left px-4 py-2.5 text-sm hover:bg-orange-50 transition-colors border-b border-gray-50 last:border-0 flex items-center justify-between group"
                            onClick={() => {
                              handleGroupChange(g);
                              setGroupSearch(g);
                              setShowGroupDropdown(false);
                            }}
                          >
                            <span className="font-medium text-gray-700">{g}</span>
                            <ChevronRight className="w-3 h-3 text-gray-300 group-hover:text-orange-400" />
                          </button>
                        ))
                      ) : (
                        <div className="p-4 text-center text-gray-400 text-xs italic">
                          No se encontraron grupos
                        </div>
                      )}
                    </div>
                  )}
                  {/* Backdrop to close dropdown */}
                  {showGroupDropdown && (
                    <div 
                      className="fixed inset-0 z-[65]" 
                      onClick={() => setShowGroupDropdown(false)}
                    />
                  )}
                </div>
              </div>

              {/* Image Upload */}
              <div className="border-2 border-dashed border-gray-200 rounded-xl p-4 text-center bg-gray-50/20 hover:bg-gray-50 transition-colors relative min-h-48 flex items-center justify-center">
                {isCompressing ? (
                  <div className="flex flex-col items-center justify-center space-y-3 py-6">
                    <Loader2 className="w-8 h-8 text-orange-500 animate-spin" />
                    <div className="space-y-1">
                      <p className="text-sm font-bold text-gray-700">Procesando y optimizando imagen...</p>
                      <p className="text-xs text-gray-400">Reduciendo dimensiones para carga súper veloz</p>
                    </div>
                  </div>
                ) : formData.imageUrl ? (
                  <div className="relative h-44 w-full">
                    <img src={formData.imageUrl} alt="Preview" className="h-full w-full object-contain rounded-lg" />
                    <button 
                      type="button"
                      onClick={() => {
                        setFormData({...formData, imageUrl: ''});
                      }}
                      className="absolute top-2 right-2 bg-white/90 backdrop-blur hover:bg-white hover:text-red-600 rounded-full p-1.5 shadow-md text-gray-500 transition-all active:scale-90"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <label className="cursor-pointer block p-4 w-full h-full">
                    <Upload className="w-10 h-10 text-orange-400 mx-auto mb-3" />
                    <span className="text-sm text-gray-700 font-bold">Tomar foto o seleccionar archivo</span>
                    <p className="text-xs text-gray-400 mt-1">Soporta cámara directa o galería</p>
                    <p className="text-[10px] text-orange-600 mt-2 font-black italic bg-orange-50 py-1 px-2.5 rounded-full inline-block">Favor de tomar la foto en HORIZONTAL</p>
                    <input 
                      ref={fileInputRef}
                      type="file" 
                      accept="image/*" 
                      capture="environment"
                      className="hidden" 
                      onChange={handleImageUpload} 
                    />
                  </label>
                )}
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1">Fecha del Prestamo</label>
                <input 
                  type="date" 
                  required
                  className="w-full border p-2 rounded-lg focus:ring-2 focus:ring-orange-500 outline-none text-sm"
                  value={formData.date}
                  onChange={e => setFormData({...formData, date: e.target.value})}
                />
              </div>

              <button 
                type="submit" 
                disabled={loading || isCompressing}
                className="w-full bg-orange-500 hover:bg-orange-600 text-white py-3 rounded-xl font-bold shadow-lg transition-all disabled:opacity-50 flex items-center justify-center gap-2 active:scale-95 mt-4"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span>Subiendo Documento...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle className="w-5 h-5" />
                    <span>Guardar Documento</span>
                  </>
                )}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* FULL SCREEN IMAGE MODAL */}
      {viewImage && (
        <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-50 p-4" onClick={() => setViewImage(null)}>
          <button className="absolute top-4 right-4 text-white hover:text-gray-300 z-50">
            <X className="w-8 h-8" />
          </button>
          
          <button 
            onClick={(e) => {
              e.stopPropagation();
              const link = document.createElement('a');
              link.href = viewImage;
              link.download = `fallo-${new Date().getTime()}.png`;
              document.body.appendChild(link);
              link.click();
              document.body.removeChild(link);
            }}
            className="absolute top-4 right-16 text-white hover:text-gray-300 z-50 bg-white/10 p-2 rounded-full backdrop-blur-sm transition-colors"
            title="Descargar Imagen"
          >
            <Download className="w-6 h-6" />
          </button>

          <img src={viewImage} alt="Full View" className="max-w-full max-h-[90vh] object-contain rounded-lg shadow-2xl" />
        </div>
      )}
    </div>
  );
};
