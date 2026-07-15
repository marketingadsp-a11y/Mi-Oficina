
import React, { useState, useMemo, useEffect } from 'react';
import { Plus, Trash2, Phone, Mail, User, MapPin, Filter, Layers, Pencil, Lock, Search, X, Building, Link as LinkIcon, FileSpreadsheet, UploadCloud, AlertTriangle, Download, CheckCircle, RefreshCcw, Users, Clipboard, LayoutGrid, Table, Cake, Loader2, FileText, Calendar, Umbrella, Coins, Clock, Check, AlertCircle } from 'lucide-react';
import { Employee, PersonnelCategory, Plaza, VacationRequest } from '../types';
import { addEmployee, deleteEmployee, updateEmployee, addPlaza, deletePlaza, deleteAllEmployees, saveEmployeesBatch, subscribeToVacationRequests, addVacationRequest, updateVacationRequest, deleteVacationRequest } from '../services/dbService';
import { VacationsControl } from './VacationsControl';
import { VacationsBalancesTable } from './VacationsBalancesTable';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface PersonnelProps {
  employees: Employee[];
  plazas: Plaza[];
  isLoading?: boolean;
  currentUser?: Employee | null;
}

const CATEGORIES: PersonnelCategory[] = ['Oficina', 'Ejecutivos', 'Supervisoras', 'Promotoras'];

const INITIAL_FORM_STATE = {
  firstName: '', 
  lastName: '', 
  email: '', 
  position: '', 
  plaza: '', 
  phone: '', 
  birthDate: '', 
  hireDate: '',
  category: 'Oficina' as PersonnelCategory,
  accessCode: '',
  linkedExecutiveId: '',
  linkedSupervisorId: '',
  groupName: '',
  status: 'ACTIVO' as 'ACTIVO' | 'INACTIVO' | 'BAJA'
};

import { getLocalDateString } from '../lib/dateUtils';

export const Personnel: React.FC<PersonnelProps> = ({ employees, plazas, isLoading, currentUser }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isPlazaModalOpen, setIsPlazaModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [activeCategory, setActiveCategory] = useState<PersonnelCategory | 'Todos'>('Todos');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [viewMode, setViewMode] = useState<'table' | 'grid'>('table');
  
  // Filters State
  const [selectedPlazaFilter, setSelectedPlazaFilter] = useState('');
  const [selectedSupervisorFilter, setSelectedSupervisorFilter] = useState('');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState('');
  
  const [newPlazaName, setNewPlazaName] = useState('');
  
  const [formData, setFormData] = useState<Partial<Employee>>(INITIAL_FORM_STATE);
  const [loading, setLoading] = useState(false);

  // Vacations Section State
  const [activeSubSection, setActiveSubSection] = useState<'directory' | 'vacations' | 'balances'>('directory');
  const [vacationRequests, setVacationRequests] = useState<VacationRequest[]>([]);
  const [isVacationModalOpen, setIsVacationModalOpen] = useState(false);

  useEffect(() => {
    const unsubscribe = subscribeToVacationRequests(
      (data) => setVacationRequests(data),
      (err) => console.error("Error subscribing to vacation requests:", err)
    );
    return () => unsubscribe();
  }, []);

  // Import State
  const [importStep, setImportStep] = useState<'upload' | 'review' | 'processing' | 'success'>('upload');
  const [importedData, setImportedData] = useState<Partial<Employee>[]>([]);
  const [duplicateCount, setDuplicateCount] = useState(0);
  const [importMode, setImportMode] = useState<'file' | 'paste'>('file');
  const [pasteContent, setPasteContent] = useState('');
  const [importSupervisorId, setImportSupervisorId] = useState('');

  // Derived Lists for Hierarchy
  const availableExecutives = useMemo(() => {
    return employees
      .filter(e => e.category === 'Ejecutivos')
      .sort((a, b) => {
        const nameA = `${a.firstName} ${a.lastName}`.toLowerCase();
        const nameB = `${b.firstName} ${b.lastName}`.toLowerCase();
        return nameA.localeCompare(nameB);
      });
  }, [employees]);

  const availableSupervisors = useMemo(() => {
    return employees
      .filter(e => e.category === 'Supervisoras')
      .sort((a, b) => {
        const nameA = (a.supervisionName || `${a.firstName} ${a.lastName}`).toLowerCase();
        const nameB = (b.supervisionName || `${b.firstName} ${b.lastName}`).toLowerCase();
        return nameA.localeCompare(nameB);
      });
  }, [employees]);

  const handlePasteAnalysis = () => {
    if (!importSupervisorId) {
      alert("Por favor selecciona una supervisora primero.");
      return;
    }
    if (!pasteContent.trim()) {
      alert("Por favor pega el contenido de la tabla.");
      return;
    }

    const rows = pasteContent.trim().split('\n');
    const parsed: Partial<Employee>[] = [];
    
    const supervisor = availableSupervisors.find(s => s.id === importSupervisorId);
    const linkedExecutiveId = supervisor?.linkedExecutiveId;
    const executive = availableExecutives.find(e => e.id === linkedExecutiveId);
    const plaza = executive?.plaza || '';

    rows.forEach(row => {
       // Split by tab first (Excel copy usually is tab)
       let cols = row.split('\t');
       if (cols.length < 2) cols = row.split(','); // Fallback
       
       // Remove empty cols and trim
       cols = cols.map(c => c.trim());
       
       if (cols.length === 0 || !cols[0]) return;

       // Skip header if detected
       if (cols[0].toUpperCase().includes('PROMOTORA') || cols[0].toUpperCase().includes('NOMBRE')) return;

       const fullName = cols[0];
       const dateStr = cols[1]; // 17/03/1986
       const group = cols[2] || '';

       // Name Parsing: Assume last 2 words are surnames if > 2 words, else split half
       const nameParts = fullName.split(' ').filter(n => n);
       let firstName = '';
       let lastName = '';
       
       if (nameParts.length > 2) {
          lastName = nameParts.slice(-2).join(' ');
          firstName = nameParts.slice(0, -2).join(' ');
       } else if (nameParts.length === 2) {
          firstName = nameParts[0];
          lastName = nameParts[1];
       } else {
          firstName = nameParts[0] || '';
       }

       // Date Parsing (DD/MM/YYYY -> YYYY-MM-DD)
       let birthDate = '';
       if (dateStr) {
          const parts = dateStr.split('/');
          if (parts.length === 3) {
             const day = parts[0].padStart(2, '0');
             const month = parts[1].padStart(2, '0');
             const year = parts[2];
             birthDate = `${year}-${month}-${day}`;
          } else {
             birthDate = dateStr; 
          }
       }

       parsed.push({
          firstName,
          lastName,
          category: 'Promotoras',
          linkedSupervisorId: importSupervisorId,
          linkedExecutiveId: linkedExecutiveId,
          plaza: plaza,
          birthDate,
          groupName: group,
          email: '', 
          phone: '',
          position: 'Promotora',
          hireDate: getLocalDateString() 
       });
    });

    setImportedData(parsed);
    
    // Check duplicates logic
    const dbNames = new Set(employees.map(e => `${e.firstName.toLowerCase().trim()} ${e.lastName.toLowerCase().trim()}`));
    const dups = parsed.filter(e => {
        const fullName = `${(e.firstName || '').toLowerCase().trim()} ${(e.lastName || '').toLowerCase().trim()}`;
        return dbNames.has(fullName);
    }).length;

    setDuplicateCount(dups);
    setImportStep('review');
  };

  const filteredEmployees = useMemo(() => {
    return employees.filter(e => {
      // 1. Filter by Category
      const matchesCategory = activeCategory === 'Todos' || e.category === activeCategory;
      
      // 2. Filter by Search Term
      const searchLower = searchTerm.toLowerCase();
      const matchesSearch = searchTerm === '' || 
        (e.firstName || '').toLowerCase().includes(searchLower) ||
        (e.lastName || '').toLowerCase().includes(searchLower) ||
        (e.position || '').toLowerCase().includes(searchLower) ||
        (e.groupName || '').toLowerCase().includes(searchLower) ||
        (e.plaza && e.plaza.toLowerCase().includes(searchLower));

      // 3. Filter by Plaza Dropdown
      const matchesPlaza = selectedPlazaFilter ? e.plaza === selectedPlazaFilter : true;

      // 4. Filter by Supervisor Dropdown
      const matchesSupervisor = selectedSupervisorFilter ? e.linkedSupervisorId === selectedSupervisorFilter : true;

      // 5. Filter by Status Dropdown
      const matchesStatus = selectedStatusFilter ? (e.status || 'ACTIVO') === selectedStatusFilter : true;

      return matchesCategory && matchesSearch && matchesPlaza && matchesSupervisor && matchesStatus;
    });
  }, [employees, activeCategory, searchTerm, selectedPlazaFilter, selectedSupervisorFilter, selectedStatusFilter]);

  const handleOpenModal = (employee?: Employee) => {
    if (employee) {
      // Edit Mode
      setEditingId(employee.id);
      setFormData(employee);
    } else {
      // Create Mode
      setEditingId(null);
      setFormData(INITIAL_FORM_STATE);
    }
    setIsModalOpen(true);
  };

  // Helper para generar email automático
  const generateAutoEmail = (first: string, last: string) => {
    const clean = (str: string) => str
      .toLowerCase()
      .trim()
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "") 
      .replace(/[^a-z0-9\s]/g, "") 
      .split(/\s+/)[0]; 

    const cleanFirst = clean(first);
    const cleanLast = clean(last);

    if (cleanFirst && cleanLast) {
      return `${cleanFirst}.${cleanLast}@everestfinanciera.com`;
    }
    return '';
  };

  // Handle Supervisor Selection Change for Promoters
  const handleSupervisorChange = (supervisorId: string) => {
    const supervisor = availableSupervisors.find(s => s.id === supervisorId);
    const autoExecutiveId = supervisor?.linkedExecutiveId || '';
    
    // Auto-set plaza from the linked executive if available
    const executive = availableExecutives.find(e => e.id === autoExecutiveId);
    const autoPlaza = executive?.plaza || '';

    setFormData(prev => ({
      ...prev,
      linkedSupervisorId: supervisorId,
      linkedExecutiveId: autoExecutiveId,
      plaza: autoPlaza || prev.plaza // Set plaza automatically
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (formData.accessCode && (!/^\d{4}$/.test(formData.accessCode))) {
          alert("El código de acceso debe ser de 4 dígitos numéricos.");
          setLoading(false);
          return;
      }

      const employeeData = {
        ...formData,
        category: formData.category || 'Oficina',
        firstName: formData.firstName || '',
        lastName: formData.lastName || '',
        email: formData.email || '',
        position: formData.position || '',
        plaza: formData.plaza || '',
        phone: formData.phone || '',
        birthDate: formData.birthDate || '',
        hireDate: formData.hireDate || '',
        groupName: formData.groupName || '',
        status: formData.status || 'ACTIVO'
      };

      if (editingId) {
        await updateEmployee(editingId, employeeData);
      } else {
        await addEmployee(employeeData as Omit<Employee, 'id'>);
      }

      setIsModalOpen(false);
      setFormData(INITIAL_FORM_STATE);
      setEditingId(null);
    } catch (error) {
      console.error(error);
      alert('Error al guardar empleado');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm('¿Estás seguro de eliminar este empleado?')) {
      await deleteEmployee(id);
    }
  };

  // --- IMPORT EXCEL LOGIC ---
  
  const handleDownloadTemplate = () => {
    const headers = [
      ['Nombre', 'Apellido', 'Email', 'Puesto', 'Plaza', 'Categoría', 'Teléfono', 'Fecha Nacimiento (YYYY-MM-DD)', 'Fecha Contratación (YYYY-MM-DD)']
    ];
    const exampleData = [
      ['Juan', 'Perez', 'juan.perez@ejemplo.com', 'Gerente', 'CDMX', 'Oficina', '5551234567', '1990-05-15', '2023-01-10'],
      ['Maria', 'Lopez', 'maria.lopez@ejemplo.com', 'Vendedora', 'GDL', 'Promotoras', '3339876543', '1995-10-20', '2023-03-01']
    ];

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet([...headers, ...exampleData]);
    XLSX.utils.book_append_sheet(wb, ws, "Plantilla Empleados");
    XLSX.writeFile(wb, "Plantilla_Importacion_Empleados.xlsx");
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data = XLSX.utils.sheet_to_json(ws, { header: 1 });

        // Transform Data
        // Headers are row 0. We assume the order matches the template or we check columns.
        // For simplicity, we assume fixed order: First Name, Last Name, Email, Position, Plaza, Category, Phone, Birth, Hire
        
        const parsedEmployees: Partial<Employee>[] = [];
        
        // Skip header row
        for (let i = 1; i < data.length; i++) {
          const row: any = data[i];
          if (!row[0]) continue; // Skip empty rows

          parsedEmployees.push({
            firstName: row[0]?.toString() || '',
            lastName: row[1]?.toString() || '',
            email: row[2]?.toString() || '',
            position: row[3]?.toString() || '',
            plaza: row[4]?.toString() || '',
            category: (row[5] as PersonnelCategory) || 'Oficina',
            phone: row[6]?.toString() || '',
            birthDate: row[7]?.toString() || '',
            hireDate: row[8]?.toString() || ''
          });
        }

        // Check for duplicates within the IMPORTED file
        // (Optional: simple check for now)
        
        setImportedData(parsedEmployees);
        
        // Check duplicates against EXISTING DB
        const dbNames = new Set(employees.map(e => `${e.firstName.toLowerCase().trim()} ${e.lastName.toLowerCase().trim()}`));
        const dups = parsedEmployees.filter(e => {
            const fullName = `${(e.firstName || '').toLowerCase().trim()} ${(e.lastName || '').toLowerCase().trim()}`;
            return dbNames.has(fullName);
        }).length;

        setDuplicateCount(dups);
        setImportStep('review');

      } catch (err) {
        console.error("Error parsing excel", err);
        alert("Error al leer el archivo. Asegúrate de usar la plantilla.");
      }
    };
    reader.readAsBinaryString(file);
  };

  const processImport = async (mode: 'replace' | 'append') => {
    setImportStep('processing');
    try {
      if (mode === 'replace') {
        // 1. Delete all current data
        await deleteAllEmployees();
        // 2. Add all new data
        await saveEmployeesBatch(importedData as any[]);
      } else {
        // Append mode: Filter duplicates to avoid double entries
        const dbNames = new Set(employees.map(e => `${e.firstName.toLowerCase().trim()} ${e.lastName.toLowerCase().trim()}`));
        
        const uniqueToImport = importedData.filter(e => {
            const fullName = `${(e.firstName || '').toLowerCase().trim()} ${(e.lastName || '').toLowerCase().trim()}`;
            return !dbNames.has(fullName);
        });

        if (uniqueToImport.length > 0) {
            await saveEmployeesBatch(uniqueToImport as any[]);
        }
      }
      
      // Success
      setImportStep('success');
    } catch (e) {
      console.error(e);
      alert("Error durante la importación masiva.");
      setImportStep('review');
    }
  };

  const closeImportModal = () => {
    setIsImportModalOpen(false);
    setImportStep('upload');
    setImportedData([]);
    setDuplicateCount(0);
    setImportMode('file');
    setPasteContent('');
    setImportSupervisorId('');
  };


  // --- Plaza Management ---
  const handleAddPlaza = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPlazaName.trim()) return;
    try {
      await addPlaza(newPlazaName.trim());
      setNewPlazaName('');
    } catch (e) {
      alert("Error al agregar plaza");
    }
  };

  const handleDeletePlaza = async (id: string) => {
    if (confirm("¿Borrar esta plaza? Los empleados asignados mantendrán el nombre de la plaza pero ya no estará en la lista.")) {
      try {
        await deletePlaza(id);
      } catch (e) {
        alert("Error al borrar plaza");
      }
    }
  };

  // --- Export Logic ---
  const handleExportExcel = () => {
    const dataToExport = filteredEmployees.map(emp => ({
      'Categoría': emp.category,
      'Nombre': emp.firstName || '',
      'Apellido': emp.lastName || '',
      'Puesto': emp.position || '',
      'Plaza': emp.plaza || '',
      'Ejecutivo': getLinkedName(emp.linkedExecutiveId) || 'N/A',
      'Supervisora': emp.category === 'Promotoras' 
        ? getLinkedName(emp.linkedSupervisorId) || 'N/A' 
        : (emp.category === 'Supervisoras' ? emp.supervisionName || 'N/A' : 'N/A'),
      'Grupo': emp.groupName || 'N/A',
      'Correo': emp.email || '',
      'Teléfono': emp.phone || '',
      'Fecha Nacimiento': emp.birthDate || '',
      'Fecha Ingreso': emp.hireDate || ''
    }));

    const ws = XLSX.utils.json_to_sheet(dataToExport);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Personal");
    XLSX.writeFile(wb, `Reporte_Personal_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const handleExportPDF = () => {
    const doc = new jsPDF('l', 'mm', 'a4'); // Landscape orientation
    
    // Header Banner
    doc.setFillColor(79, 70, 229); // Indigo 600
    doc.rect(0, 0, 297, 30, 'F'); 

    doc.setTextColor(255, 255, 255);
    doc.setFontSize(22);
    doc.setFont("helvetica", "bold");
    doc.text('Directorio de Personal - Reporte', 14, 20);

    doc.setTextColor(80, 80, 80);
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text(`Fecha de generación: ${new Date().toLocaleDateString('es-ES')}`, 14, 40);
    doc.text(`Categoría filtrada: ${activeCategory}`, 14, 46);
    doc.text(`Resultados encontrados: ${filteredEmployees.length}`, 14, 52);
    
    const tableColumn = ["Nombre / Apellido", "Categoría / Puesto", "Plaza", "Vinculación / Grupo", "Ingreso"];
    const tableRows = filteredEmployees.map(emp => [
      `${emp.firstName} ${emp.lastName}`,
      `${emp.category}${emp.position ? ' - ' + emp.position : ''}`,
      emp.plaza || '-',
      `${emp.category === 'Promotoras' 
        ? 'Sup: ' + (getLinkedName(emp.linkedSupervisorId) || 'N/A') + (emp.groupName ? ' | G: ' + emp.groupName : '')
        : (emp.category === 'Supervisoras' ? 'Ejecutivo: ' + (getLinkedName(emp.linkedExecutiveId) || 'N/A') : '-')}`,
      emp.hireDate || '-'
    ]);

    autoTable(doc, {
      head: [tableColumn],
      body: tableRows,
      startY: 58,
      theme: 'striped',
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [79, 70, 229], textColor: 255, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [243, 244, 246] }
    });

    doc.save(`Reporte_Personal_${new Date().toISOString().split('T')[0]}.pdf`);
  };

  const getCategoryColor = (cat: string) => {
    switch(cat) {
      case 'Oficina': return 'bg-purple-100 text-purple-700 border-purple-200';
      case 'Ejecutivos': return 'bg-blue-100 text-blue-700 border-blue-200';
      case 'Supervisoras': return 'bg-amber-100 text-amber-700 border-amber-200';
      case 'Promotoras': return 'bg-cyan-100 text-cyan-700 border-cyan-200'; 
      default: return 'bg-gray-100 text-gray-700 border-gray-200';
    }
  };

  const getLinkedName = (id?: string) => {
    if (!id) return null;
    const emp = employees.find(e => e.id === id);
    if (!emp) return 'Desconocido';
    if (emp.category === 'Supervisoras' && emp.supervisionName) {
      return emp.supervisionName;
    }
    return `${emp.firstName} ${emp.lastName}`;
  };

  return (
    <div className="p-6">
      {/* Sub-section Switcher */}
      <div className="flex border-b border-gray-200 mb-6 gap-6">
        <button
          onClick={() => setActiveSubSection('directory')}
          className={`pb-3 text-sm font-bold border-b-2 transition-all flex items-center gap-2 ${
            activeSubSection === 'directory'
              ? 'border-indigo-600 text-indigo-600'
              : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
          }`}
        >
          <Users className="w-4 h-4" />
          Directorio de Personal
        </button>
        <button
          onClick={() => setActiveSubSection('vacations')}
          className={`pb-3 text-sm font-bold border-b-2 transition-all flex items-center gap-2 ${
            activeSubSection === 'vacations'
              ? 'border-indigo-600 text-indigo-600'
              : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
          }`}
        >
          <Umbrella className="w-4 h-4" />
          Control de Vacaciones
        </button>
        <button
          onClick={() => setActiveSubSection('balances')}
          className={`pb-3 text-sm font-bold border-b-2 transition-all flex items-center gap-2 ${
            activeSubSection === 'balances'
              ? 'border-indigo-600 text-indigo-600'
              : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
          }`}
        >
          <Coins className="w-4 h-4" />
          Saldos de Vacaciones
        </button>
      </div>

      {activeSubSection === 'vacations' ? (
        <VacationsControl employees={employees} vacationRequests={vacationRequests} currentUser={currentUser} />
      ) : activeSubSection === 'balances' ? (
        <VacationsBalancesTable employees={employees} vacationRequests={vacationRequests} />
      ) : (
        <>
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">Directorio de Personal</h2>
          <p className="text-sm text-gray-500 mt-1">Gestión de {activeCategory === 'Todos' ? 'todo el personal' : activeCategory}</p>
        </div>
        
        <div className="flex gap-2 flex-wrap">
           <div className="flex bg-white rounded-lg border border-gray-200 p-0.5 shadow-sm">
             <button 
              onClick={handleExportExcel}
              className="text-green-600 hover:bg-green-50 p-2 rounded-l-lg flex items-center transition-colors border-r"
              title="Exportar a Excel"
            >
              <FileSpreadsheet className="w-5 h-5" />
            </button>
            <button 
              onClick={handleExportPDF}
              className="text-red-500 hover:bg-red-50 p-2 rounded-r-lg flex items-center transition-colors"
              title="Exportar a PDF"
            >
              <FileText className="w-5 h-5" />
            </button>
          </div>
           <button 
            onClick={() => setIsImportModalOpen(true)}
            className="bg-green-600 hover:bg-green-700 text-white border border-transparent px-4 py-2 rounded-lg flex items-center transition-colors shadow-sm whitespace-nowrap"
            title="Importar desde Excel"
          >
            <FileSpreadsheet className="w-5 h-5 mr-2" /> Importar
          </button>
           <button 
            onClick={() => setIsPlazaModalOpen(true)}
            className="bg-white text-gray-700 border border-gray-200 hover:bg-gray-50 px-4 py-2 rounded-lg flex items-center transition-colors shadow-sm whitespace-nowrap"
          >
            <Building className="w-5 h-5 mr-2 text-gray-500" /> Gestionar Plazas
          </button>
          <button 
            onClick={() => handleOpenModal()}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center transition-colors shadow-sm whitespace-nowrap"
          >
            <Plus className="w-5 h-5 mr-2" /> Agregar Empleado
          </button>
        </div>
      </div>

      {/* Control Panel: Search & Filters */}
      <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 mb-6 flex flex-col md:flex-row gap-4 items-center">
        {/* Search Input */}
        <div className="relative flex-1 w-full">
          <Search className="w-5 h-5 text-gray-400 absolute left-3 top-1/2 transform -translate-y-1/2" />
          <input 
            type="text" 
            placeholder="Buscar por nombre, plaza, puesto o grupo..." 
            className="w-full pl-10 pr-4 py-2.5 border rounded-lg text-sm bg-gray-50 focus:bg-white focus:ring-2 focus:ring-blue-200 focus:border-blue-400 outline-none transition-all"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          {searchTerm && (
            <button 
              onClick={() => setSearchTerm('')}
              className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Filters Container */}
        <div className="flex flex-wrap gap-2 w-full md:w-auto">
          {/* Plaza Filter */}
          <select 
            className="flex-1 md:w-48 p-2.5 border rounded-lg text-sm bg-white text-gray-700 focus:ring-2 focus:ring-blue-200 outline-none cursor-pointer"
            value={selectedPlazaFilter}
            onChange={(e) => setSelectedPlazaFilter(e.target.value)}
          >
            <option value="">Todas las Plazas</option>
            {plazas.map(plaza => (
              <option key={plaza.id} value={plaza.name}>{plaza.name}</option>
            ))}
          </select>

          {/* Supervisor Filter */}
          <select 
            className="flex-1 md:w-48 p-2.5 border rounded-lg text-sm bg-white text-gray-700 focus:ring-2 focus:ring-blue-200 outline-none cursor-pointer"
            value={selectedSupervisorFilter}
            onChange={(e) => setSelectedSupervisorFilter(e.target.value)}
          >
            <option value="">Todas las Supervisoras</option>
            {availableSupervisors.map(sup => (
              <option key={sup.id} value={sup.id}>{sup.supervisionName || `${sup.firstName} ${sup.lastName}`}</option>
            ))}
          </select>

          {/* Status Filter */}
          <select 
            className="flex-1 md:w-40 p-2.5 border rounded-lg text-sm bg-white text-gray-700 focus:ring-2 focus:ring-blue-200 outline-none cursor-pointer font-medium"
            value={selectedStatusFilter}
            onChange={(e) => setSelectedStatusFilter(e.target.value)}
          >
            <option value="">Todos los Estados</option>
            <option value="ACTIVO">🟢 ACTIVO</option>
            <option value="INACTIVO">🟡 INACTIVO</option>
            <option value="BAJA">🔴 BAJA</option>
          </select>
          
          {/* Clear Filters Button */}
          {(selectedPlazaFilter || selectedSupervisorFilter || selectedStatusFilter) && (
             <button 
               onClick={() => { setSelectedPlazaFilter(''); setSelectedSupervisorFilter(''); setSelectedStatusFilter(''); }}
               className="p-2.5 text-red-500 hover:bg-red-50 rounded-lg border border-transparent hover:border-red-100 transition-all"
               title="Limpiar filtros"
             >
               <Filter className="w-5 h-5" />
             </button>
          )}
        </div>
      </div>

      {/* Category Tabs & View Toggle */}
      <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
        <div className="flex overflow-x-auto pb-2 gap-2 no-scrollbar w-full md:w-auto">
          <button
            onClick={() => setActiveCategory('Todos')}
            className={`px-4 py-2 rounded-full text-sm font-medium transition-all whitespace-nowrap ${
              activeCategory === 'Todos' 
                ? 'bg-gray-800 text-white shadow-md' 
                : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'
            }`}
          >
            Todos ({employees.length})
          </button>
          {CATEGORIES.map(cat => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-all whitespace-nowrap flex items-center ${
                activeCategory === cat 
                  ? 'bg-indigo-600 text-white shadow-md' 
                  : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'
              }`}
            >
              {cat} 
              <span className={`ml-2 text-xs py-0.5 px-1.5 rounded-full ${activeCategory === cat ? 'bg-white/20' : 'bg-gray-100'}`}>
                {employees.filter(e => e.category === cat).length}
              </span>
            </button>
          ))}
        </div>

        <div className="flex bg-gray-100 p-1 rounded-lg border border-gray-200">
          <button
            onClick={() => setViewMode('table')}
            className={`p-2 rounded-md transition-all ${viewMode === 'table' ? 'bg-white shadow text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
            title="Vista de Tabla"
          >
            <Table className="w-5 h-5" />
          </button>
          <button
            onClick={() => setViewMode('grid')}
            className={`p-2 rounded-md transition-all ${viewMode === 'grid' ? 'bg-white shadow text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
            title="Vista de Tarjetas"
          >
            <LayoutGrid className="w-5 h-5" />
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="py-20 text-center bg-white rounded-xl border border-gray-100 shadow-sm">
          <Loader2 className="w-10 h-10 text-indigo-600 animate-spin mx-auto mb-4" />
          <p className="text-gray-500 font-medium">Cargando personal...</p>
        </div>
      ) : filteredEmployees.length === 0 ? (
        <div className="py-12 text-center text-gray-400 bg-white rounded-xl border border-dashed border-gray-300">
          <User className="w-12 h-12 mx-auto mb-3 opacity-20" />
          <p>No se encontraron resultados{(searchTerm || selectedPlazaFilter || selectedSupervisorFilter) ? ' con los filtros actuales' : ''}.</p>
        </div>
      ) : (
        <>
          {viewMode === 'grid' ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredEmployees.map(employee => (
                <div key={employee.id} className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 flex flex-col hover:shadow-md transition-shadow relative overflow-hidden">
                  {/* Category Badge */}
                  <div className={`absolute top-0 right-0 px-3 py-1 text-[10px] font-bold uppercase tracking-wider border-b border-l rounded-bl-xl ${getCategoryColor(employee.category || 'Oficina')}`}>
                    {employee.category || 'Oficina'}
                  </div>

                  <div className="flex items-start justify-between mb-4 mt-2">
                    <div className="flex items-center">
                      <div className="w-12 h-12 bg-gradient-to-br from-gray-100 to-gray-200 rounded-full flex items-center justify-center text-xl font-bold text-gray-500 shadow-inner">
                        {(employee.firstName || '?').charAt(0)}{(employee.lastName || '?').charAt(0)}
                      </div>
                      <div className="ml-3">
                        <h3 className="font-bold text-gray-800 text-lg leading-tight flex items-center flex-wrap gap-1.5">
                          <span>
                            {employee.firstName || employee.lastName ? `${employee.firstName} ${employee.lastName}` : <span className="text-gray-400 italic">Sin Nombre</span>}
                          </span>
                          <span className={`text-[10px] font-extrabold px-1.5 py-0.5 rounded-full border ${
                            (employee.status || 'ACTIVO') === 'ACTIVO' 
                              ? 'bg-emerald-50 border-emerald-200 text-emerald-700' 
                              : (employee.status || 'ACTIVO') === 'INACTIVO'
                              ? 'bg-amber-50 border-amber-200 text-amber-700'
                              : 'bg-rose-50 border-rose-200 text-rose-700'
                          }`}>
                            ({employee.status || 'ACTIVO'})
                          </span>
                        </h3>
                        <span className="text-sm text-gray-500 font-medium">{employee.position || 'Sin Cargo'}</span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="space-y-2.5 text-sm text-gray-600 flex-1 mt-2">
                    <div className="flex items-center p-2 bg-gray-50 rounded-lg">
                      <MapPin className="w-4 h-4 mr-3 text-gray-400" /> 
                      <span className="font-medium text-gray-700">{employee.plaza || 'Sin Plaza Asignada'}</span>
                    </div>
                    
                    {/* Linked Info */}
                    {(employee.category === 'Supervisoras' || employee.category === 'Promotoras') && employee.linkedExecutiveId && (
                       <div className="flex items-center p-2 bg-blue-50 rounded-lg border border-blue-100 text-blue-800">
                        <LinkIcon className="w-3 h-3 mr-2" />
                        <span className="text-xs">Ejecutivo: <strong>{getLinkedName(employee.linkedExecutiveId)}</strong></span>
                      </div>
                    )}
                    {employee.category === 'Supervisoras' && employee.supervisionName && (
                       <div className="flex items-center p-2 bg-indigo-50 rounded-lg border border-indigo-100 text-indigo-800">
                        <Users className="w-3 h-3 mr-2" />
                        <span className="text-xs">Supervisión: <strong>{employee.supervisionName}</strong></span>
                      </div>
                    )}
                    {employee.category === 'Promotoras' && employee.linkedSupervisorId && (
                       <div className="flex items-center p-2 bg-amber-50 rounded-lg border border-amber-100 text-amber-800">
                        <LinkIcon className="w-3 h-3 mr-2" />
                        <span className="text-xs">Sup: <strong>{getLinkedName(employee.linkedSupervisorId)}</strong></span>
                      </div>
                    )}
                    {employee.category === 'Promotoras' && employee.groupName && (
                       <div className="flex items-center p-2 bg-cyan-50 rounded-lg border border-cyan-100 text-cyan-800">
                        <Users className="w-3 h-3 mr-2" />
                        <span className="text-xs">Grupo: <strong>{employee.groupName}</strong></span>
                      </div>
                    )}

                    <div className="flex items-center p-2 bg-gray-50 rounded-lg">
                      <Mail className="w-4 h-4 mr-3 text-gray-400" /> 
                      <a href={`mailto:${employee.email}`} className="hover:text-blue-600 truncate">{employee.email || 'Sin correo'}</a>
                    </div>
                    <div className="flex items-center p-2 bg-gray-50 rounded-lg">
                      <Phone className="w-4 h-4 mr-3 text-gray-400" /> 
                      <span>{employee.phone || 'N/A'}</span>
                    </div>
                  </div>
                  
                  <div className="mt-5 pt-4 border-t border-gray-100 flex justify-between items-center">
                    <div className="text-xs text-gray-400 flex flex-col">
                      <span>Ingreso: {employee.hireDate || '--/--/----'}</span>
                    </div>
                    <div className="flex gap-2">
                      <button 
                        onClick={() => handleOpenModal(employee)} 
                        className="text-gray-300 hover:text-blue-500 transition-colors p-2 hover:bg-blue-50 rounded-full"
                        title="Editar"
                      >
                        <Pencil className="w-5 h-5" />
                      </button>
                      <button 
                        onClick={() => handleDelete(employee.id)} 
                        className="text-gray-300 hover:text-red-500 transition-colors p-2 hover:bg-red-50 rounded-full"
                        title="Eliminar"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200 text-xs uppercase text-gray-500 font-semibold tracking-wider">
                      <th className="p-4">Nombre</th>
                      <th className="p-4">Puesto / Categoría</th>
                      <th className="p-4">Plaza</th>
                      <th className="p-4">
                        {(activeCategory === 'Promotoras' || activeCategory === 'Supervisoras') ? 'Cumpleaños' : 'Contacto'}
                      </th>
                      <th className="p-4">Vinculación</th>
                      <th className="p-4">Fecha Ingreso</th>
                      <th className="p-4 text-right">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {filteredEmployees.map(employee => (
                      <tr key={employee.id} className="hover:bg-blue-50/50 transition-colors group">
                        <td className="p-4">
                          <div className="flex items-center">
                            <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center text-xs font-bold text-gray-500 mr-3">
                              {(employee.firstName || '?').charAt(0)}{(employee.lastName || '?').charAt(0)}
                            </div>
                            <div>
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <p className="font-bold text-gray-800 text-sm">{employee.firstName} {employee.lastName}</p>
                                <span className={`text-[9px] font-extrabold px-1.5 py-0.2 rounded-full border ${
                                  (employee.status || 'ACTIVO') === 'ACTIVO' 
                                    ? 'bg-emerald-50 border-emerald-200 text-emerald-700' 
                                    : (employee.status || 'ACTIVO') === 'INACTIVO'
                                    ? 'bg-amber-50 border-amber-200 text-amber-700'
                                    : 'bg-rose-50 border-rose-200 text-rose-700'
                                }`}>
                                  ({employee.status || 'ACTIVO'})
                                </span>
                              </div>
                              {employee.groupName && <span className="text-[10px] bg-cyan-100 text-cyan-700 px-1.5 py-0.5 rounded-full">{employee.groupName}</span>}
                            </div>
                          </div>
                        </td>
                        <td className="p-4">
                          <div className="flex flex-col">
                            <span className="text-sm font-medium text-gray-700">{employee.position || 'Sin Cargo'}</span>
                            <span className={`text-[10px] px-2 py-0.5 rounded-full w-fit mt-1 ${getCategoryColor(employee.category || 'Oficina')}`}>
                              {employee.category}
                            </span>
                          </div>
                        </td>
                        <td className="p-4">
                          <span className="text-sm text-gray-600 flex items-center">
                            <MapPin className="w-3 h-3 mr-1 text-gray-400" />
                            {employee.plaza || '-'}
                          </span>
                        </td>
                        <td className="p-4">
                          {(activeCategory === 'Promotoras' || activeCategory === 'Supervisoras') ? (
                            <div className="flex items-center text-sm text-gray-600">
                              <Cake className="w-4 h-4 mr-2 text-pink-500" />
                              {employee.birthDate ? (
                                <span>{employee.birthDate.split('-').reverse().join('/')}</span>
                              ) : (
                                <span className="text-gray-400 text-xs">N/A</span>
                              )}
                            </div>
                          ) : (
                            <div className="flex flex-col text-xs text-gray-500 space-y-1">
                              {employee.email && (
                                <a href={`mailto:${employee.email}`} className="flex items-center hover:text-blue-600">
                                  <Mail className="w-3 h-3 mr-1" /> {employee.email}
                                </a>
                              )}
                              {employee.phone && (
                                <span className="flex items-center">
                                  <Phone className="w-3 h-3 mr-1" /> {employee.phone}
                                </span>
                              )}
                            </div>
                          )}
                        </td>
                        <td className="p-4 text-xs">
                          <div className="space-y-1">
                            {employee.linkedExecutiveId && (
                              <div className="text-blue-600 flex items-center" title="Ejecutivo Vinculado">
                                <LinkIcon className="w-3 h-3 mr-1" /> {getLinkedName(employee.linkedExecutiveId)}
                              </div>
                            )}
                            {employee.linkedSupervisorId && (
                              <div className="text-amber-600 flex items-center" title="Supervisora Vinculada">
                                <Users className="w-3 h-3 mr-1" /> {getLinkedName(employee.linkedSupervisorId)}
                              </div>
                            )}
                            {employee.supervisionName && (
                              <div className="text-indigo-600 flex items-center" title="Nombre Supervisión">
                                <Users className="w-3 h-3 mr-1" /> {employee.supervisionName}
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="p-4 text-sm text-gray-500">
                          {employee.hireDate || '-'}
                        </td>
                        <td className="p-4 text-right">
                          <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button 
                              onClick={() => handleOpenModal(employee)} 
                              className="text-gray-400 hover:text-blue-600 p-1 hover:bg-blue-50 rounded"
                              title="Editar"
                            >
                              <Pencil className="w-4 h-4" />
                            </button>
                            <button 
                              onClick={() => handleDelete(employee.id)} 
                              className="text-gray-400 hover:text-red-600 p-1 hover:bg-red-50 rounded"
                              title="Eliminar"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
        </>
      )}

      {/* PLAZAS MANAGEMENT MODAL */}
      {isPlazaModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-2xl">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold text-gray-800">Gestionar Plazas</h3>
              <button onClick={() => setIsPlazaModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            {/* Add Plaza Form */}
            <form onSubmit={handleAddPlaza} className="flex gap-2 mb-6">
              <input 
                type="text" 
                placeholder="Nombre de nueva plaza..." 
                className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-200 outline-none"
                value={newPlazaName}
                onChange={(e) => setNewPlazaName(e.target.value)}
                autoFocus
              />
              <button 
                type="submit" 
                disabled={!newPlazaName.trim()}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Agregar
              </button>
            </form>

            {/* List Plazas */}
            <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
              {plazas.length === 0 ? (
                <p className="text-center text-gray-400 text-sm py-4">No hay plazas registradas.</p>
              ) : (
                plazas.map(plaza => (
                  <div key={plaza.id} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg border border-gray-100 group">
                    <span className="font-medium text-gray-700">{plaza.name}</span>
                    <button 
                      onClick={() => handleDeletePlaza(plaza.id)}
                      className="text-gray-300 hover:text-red-500 p-1 opacity-0 group-hover:opacity-100 transition-all"
                      title="Eliminar plaza"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* IMPORT MODAL */}
      {isImportModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg p-6 shadow-2xl">
            <div className="flex justify-between items-center mb-6 border-b pb-4">
              <h3 className="text-xl font-bold text-gray-800 flex items-center">
                 <FileSpreadsheet className="w-6 h-6 mr-2 text-green-600" /> 
                 Importar Personal
              </h3>
              <button onClick={closeImportModal} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            {importStep === 'upload' && (
              <div className="space-y-6">
                 {/* Mode Switcher */}
                 <div className="flex border-b border-gray-200 mb-4">
                   <button 
                     onClick={() => setImportMode('file')}
                     className={`flex-1 py-2 text-sm font-medium border-b-2 transition-colors ${importMode === 'file' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
                   >
                     <UploadCloud className="w-4 h-4 inline-block mr-2" /> Subir Archivo
                   </button>
                   <button 
                     onClick={() => setImportMode('paste')}
                     className={`flex-1 py-2 text-sm font-medium border-b-2 transition-colors ${importMode === 'paste' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
                   >
                     <Clipboard className="w-4 h-4 inline-block mr-2" /> Pegar Tabla
                   </button>
                 </div>

                 {importMode === 'file' ? (
                   <>
                     <div className="bg-blue-50 border border-blue-100 p-4 rounded-xl flex items-start">
                        <AlertTriangle className="w-5 h-5 text-blue-600 mr-3 mt-0.5 flex-shrink-0" />
                        <div className="text-sm text-blue-800">
                           <p className="font-bold mb-1">Instrucciones:</p>
                           <ul className="list-disc ml-4 space-y-1">
                              <li>Descarga la plantilla para asegurar el formato correcto.</li>
                              <li>Llena los datos sin cambiar el orden de las columnas.</li>
                              <li>Guarda el archivo y súbelo aquí.</li>
                           </ul>
                        </div>
                     </div>

                     <div className="flex justify-center">
                        <button 
                          onClick={handleDownloadTemplate}
                          className="text-green-600 font-semibold flex items-center hover:underline"
                        >
                           <Download className="w-4 h-4 mr-2" /> Descargar Plantilla Excel
                        </button>
                     </div>

                     <div className="border-2 border-dashed border-gray-300 rounded-xl p-8 flex flex-col items-center justify-center text-center hover:border-blue-400 hover:bg-gray-50 transition-all cursor-pointer relative">
                        <UploadCloud className="w-12 h-12 text-gray-400 mb-3" />
                        <p className="text-gray-600 font-medium">Click para seleccionar archivo</p>
                        <p className="text-xs text-gray-400 mt-1">Formatos: .xlsx, .csv</p>
                        <input 
                           type="file" 
                           accept=".xlsx, .xls, .csv" 
                           className="absolute inset-0 opacity-0 cursor-pointer"
                           onChange={handleFileUpload}
                        />
                     </div>
                   </>
                 ) : (
                   <div className="space-y-4">
                     <div className="bg-amber-50 border border-amber-100 p-4 rounded-xl">
                        <p className="text-sm text-amber-800 font-medium mb-2">
                          1. Selecciona la Supervisora a la que pertenecen:
                        </p>
                        <select 
                          className="w-full border border-amber-200 p-2 rounded bg-white text-gray-900 focus:ring-2 focus:ring-amber-500 outline-none text-sm"
                          value={importSupervisorId}
                          onChange={e => setImportSupervisorId(e.target.value)}
                        >
                          <option value="">-- Seleccionar Supervisora --</option>
                          {availableSupervisors.map(sv => (
                            <option key={sv.id} value={sv.id}>{sv.supervisionName || `${sv.firstName} ${sv.lastName}`}</option>
                          ))}
                        </select>
                     </div>

                     <div>
                       <p className="text-sm text-gray-700 font-medium mb-2">
                         2. Pega los datos (Columnas: Nombre Completo | Fecha Nacimiento | Grupo):
                       </p>
                       <textarea 
                         className="w-full h-48 border border-gray-300 rounded-lg p-3 text-xs font-mono focus:ring-2 focus:ring-blue-500 outline-none"
                         placeholder={`Ejemplo:\nYESENIA ALCALA SEGOVIANO\t17/03/1986\tYESY LA CURVA\nESMERALDA GONZALEZ\t09/06/1990\tMERA COFRADIA`}
                         value={pasteContent}
                         onChange={e => setPasteContent(e.target.value)}
                       />
                     </div>

                     <button 
                       onClick={handlePasteAnalysis}
                       disabled={!importSupervisorId || !pasteContent.trim()}
                       className="w-full bg-blue-600 text-white py-2 rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                     >
                       Analizar y Previsualizar
                     </button>
                   </div>
                 )}
              </div>
            )}

            {importStep === 'review' && (
               <div className="space-y-6 animate-fade-in">
                  <div className="text-center">
                     <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
                     <h4 className="text-xl font-bold text-gray-800">Archivo Analizado</h4>
                     <p className="text-gray-500 mt-2">
                        Se encontraron <strong className="text-gray-800">{importedData.length}</strong> empleados en el archivo.
                     </p>
                     
                     {duplicateCount > 0 && (
                        <div className="mt-4 inline-flex items-center px-4 py-2 bg-amber-50 text-amber-700 rounded-full text-sm font-medium border border-amber-200">
                           <AlertTriangle className="w-4 h-4 mr-2" />
                           {duplicateCount} nombres ya existen en la base de datos.
                        </div>
                     )}
                  </div>

                  <div className="bg-gray-50 p-4 rounded-xl border border-gray-200">
                     <h5 className="font-bold text-gray-700 mb-3 text-sm">¿Cómo deseas proceder?</h5>
                     
                     <div className="grid gap-3">
                        <button 
                           onClick={() => processImport('append')}
                           className="flex items-center justify-between p-3 bg-white border border-gray-200 rounded-lg hover:border-blue-400 hover:shadow-md transition-all group text-left"
                        >
                           <div>
                              <p className="font-bold text-gray-800 group-hover:text-blue-600">Agregar a los existentes</p>
                              <p className="text-xs text-gray-500">
                                 {duplicateCount > 0 
                                   ? `Se omitirán los ${duplicateCount} duplicados y se agregarán los nuevos.` 
                                   : 'Se conservan los empleados actuales y se suman los nuevos.'}
                              </p>
                           </div>
                           <Plus className="w-5 h-5 text-gray-300 group-hover:text-blue-500" />
                        </button>

                        <button 
                           onClick={() => {
                              if(confirm("¡CUIDADO! Esto borrará permanentemente todos los empleados actuales y los reemplazará con los del archivo. ¿Estás seguro?")) {
                                 processImport('replace');
                              }
                           }}
                           className="flex items-center justify-between p-3 bg-white border border-gray-200 rounded-lg hover:border-red-400 hover:shadow-md transition-all group text-left"
                        >
                           <div>
                              <p className="font-bold text-gray-800 group-hover:text-red-600">Sustituir TODO</p>
                              <p className="text-xs text-gray-500">Borra la base de datos actual y carga solo el archivo.</p>
                           </div>
                           <RefreshCcw className="w-5 h-5 text-gray-300 group-hover:text-red-500" />
                        </button>
                     </div>
                  </div>
               </div>
            )}

            {importStep === 'processing' && (
               <div className="py-12 text-center">
                  <div className="w-12 h-12 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mx-auto mb-4"></div>
                  <h4 className="text-lg font-bold text-gray-800">Procesando datos...</h4>
                  <p className="text-sm text-gray-500">Por favor no cierres esta ventana.</p>
               </div>
            )}

            {importStep === 'success' && (
               <div className="py-8 text-center animate-fade-in">
                  <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                     <CheckCircle className="w-8 h-8 text-green-600" />
                  </div>
                  <h4 className="text-xl font-bold text-gray-800 mb-2">¡Importación Exitosa!</h4>
                  <p className="text-gray-500 mb-6">Los datos han sido actualizados correctamente.</p>
                  <button 
                     onClick={closeImportModal}
                     className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors font-medium"
                  >
                     Entendido
                  </button>
               </div>
            )}

          </div>
        </div>
      )}

      {/* EMPLOYEE MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
            <h3 className="text-xl font-bold mb-4 text-gray-800 border-b pb-2">
              {editingId ? 'Editar Empleado' : 'Nuevo Empleado'}
            </h3>
            <form onSubmit={handleSubmit} className="space-y-4">
              
              {/* Category Selector */}
              <div>
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-1 block">Categoría de Personal</label>
                <div className="grid grid-cols-2 gap-2">
                  {CATEGORIES.map(cat => (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setFormData({...formData, category: cat})}
                      className={`py-2 px-3 rounded-lg text-sm border-2 transition-all ${
                        formData.category === cat 
                          ? 'border-indigo-600 bg-indigo-50 text-indigo-700 font-bold' 
                          : 'border-gray-200 hover:border-gray-300 text-gray-600'
                      }`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              </div>

              {/* DYNAMIC HIERARCHY FIELDS */}
              {formData.category === 'Supervisoras' && (
                <div className="space-y-3 bg-blue-50 p-3 rounded-lg border border-blue-100">
                  <div>
                    <label className="text-xs font-bold text-blue-700 mb-1 block flex items-center">
                      <LinkIcon className="w-3 h-3 mr-1" /> Ejecutivo Vinculado
                    </label>
                    <select 
                      className="w-full border border-blue-200 p-2 rounded bg-white text-gray-900 focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                      value={formData.linkedExecutiveId || ''}
                      onChange={e => {
                        const execId = e.target.value;
                        const executive = availableExecutives.find(ex => ex.id === execId);
                        setFormData({
                          ...formData, 
                          linkedExecutiveId: execId,
                          plaza: executive?.plaza || formData.plaza // Auto-set plaza
                        });
                      }}
                    >
                      <option value="">-- Seleccionar Ejecutivo --</option>
                      {availableExecutives.map(ex => (
                        <option key={ex.id} value={ex.id}>{ex.firstName} {ex.lastName}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-bold text-blue-700 mb-1 block flex items-center">
                      <Users className="w-3 h-3 mr-1" /> Nombre Supervisión
                    </label>
                    <input 
                      type="text"
                      placeholder="Ej. Supervisión Norte"
                      className="w-full border border-blue-200 p-2 rounded bg-white text-gray-900 focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                      value={formData.supervisionName || ''}
                      onChange={e => setFormData({...formData, supervisionName: e.target.value})}
                    />
                  </div>
                </div>
              )}

              {formData.category === 'Promotoras' && (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3 bg-amber-50 p-3 rounded-lg border border-amber-100">
                    <div>
                      <label className="text-xs font-bold text-amber-700 mb-1 block flex items-center">
                        <LinkIcon className="w-3 h-3 mr-1" /> Supervisora
                      </label>
                      <select 
                        className="w-full border border-amber-200 p-2 rounded bg-white text-gray-900 focus:ring-2 focus:ring-amber-500 outline-none text-sm"
                        value={formData.linkedSupervisorId || ''}
                        onChange={e => handleSupervisorChange(e.target.value)}
                      >
                        <option value="">-- Seleccionar --</option>
                        {availableSupervisors.map(sv => (
                          <option key={sv.id} value={sv.id}>{sv.supervisionName || `${sv.firstName} ${sv.lastName}`}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="text-xs font-bold text-gray-500 mb-1 block flex items-center">
                        <Lock className="w-3 h-3 mr-1" /> Ejecutivo (Auto)
                      </label>
                      <select 
                        disabled
                        className="w-full border border-gray-200 p-2 rounded bg-gray-100 text-gray-500 outline-none text-sm cursor-not-allowed"
                        value={formData.linkedExecutiveId || ''}
                      >
                        <option value="">-- Automático --</option>
                        {availableExecutives.map(ex => (
                          <option key={ex.id} value={ex.id}>{ex.firstName} {ex.lastName}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="bg-cyan-50 p-3 rounded-lg border border-cyan-100">
                    <label className="text-xs font-bold text-cyan-700 mb-1 block flex items-center">
                      <Users className="w-3 h-3 mr-1" /> Nombre del Grupo
                    </label>
                    <input 
                      type="text"
                      placeholder="Ej. Rosy Colima"
                      className="w-full border border-cyan-200 p-2 rounded bg-white text-gray-900 focus:ring-2 focus:ring-cyan-500 outline-none text-sm"
                      value={formData.groupName || ''}
                      onChange={e => setFormData({...formData, groupName: e.target.value})}
                    />
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                   <label className="text-xs text-gray-500 mb-1 block">Nombre</label>
                   <input 
                     placeholder="Nombre" 
                     className="w-full border p-2 rounded bg-white text-gray-900 placeholder-gray-500 focus:ring-2 focus:ring-blue-500 outline-none" 
                     value={formData.firstName} 
                     onChange={e => {
                       const val = e.target.value;
                       const autoEmail = generateAutoEmail(val, formData.lastName || '');
                       setFormData(prev => ({...prev, firstName: val, email: autoEmail || prev.email}));
                     }} 
                   />
                </div>
                <div>
                   <label className="text-xs text-gray-500 mb-1 block">Apellido</label>
                   <input 
                     placeholder="Apellido" 
                     className="w-full border p-2 rounded bg-white text-gray-900 placeholder-gray-500 focus:ring-2 focus:ring-blue-500 outline-none" 
                     value={formData.lastName} 
                     onChange={e => {
                       const val = e.target.value;
                       const autoEmail = generateAutoEmail(formData.firstName || '', val);
                       setFormData(prev => ({...prev, lastName: val, email: autoEmail || prev.email}));
                     }} 
                   />
                </div>
              </div>
              
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Correo Electrónico</label>
                <input type="email" placeholder="ejemplo@empresa.com" className="w-full border p-2 rounded bg-white text-gray-900 placeholder-gray-500 focus:ring-2 focus:ring-blue-500 outline-none" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} />
              </div>

              <div className="grid grid-cols-2 gap-4">
                {!['Supervisoras', 'Promotoras'].includes(formData.category || '') && (
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">Puesto / Cargo</label>
                    <input placeholder="Ej. Gerente de Ventas" className="w-full border p-2 rounded bg-white text-gray-900 placeholder-gray-500 focus:ring-2 focus:ring-blue-500 outline-none" value={formData.position} onChange={e => setFormData({...formData, position: e.target.value})} />
                  </div>
                )}
                <div className={['Supervisoras', 'Promotoras'].includes(formData.category || '') ? "col-span-2" : ""}>
                  <label className="text-xs text-gray-500 mb-1 block">Plaza</label>
                  {plazas.length > 0 ? (
                    <select 
                      className="w-full border p-2 rounded bg-white text-gray-900 focus:ring-2 focus:ring-blue-500 outline-none"
                      value={formData.plaza} 
                      onChange={e => setFormData({...formData, plaza: e.target.value})}
                    >
                      <option value="">-- Seleccionar Plaza --</option>
                      {plazas.map(p => (
                        <option key={p.id} value={p.name}>{p.name}</option>
                      ))}
                    </select>
                  ) : (
                    <div className="text-sm text-red-500 border border-red-200 bg-red-50 p-2 rounded">
                      ¡Primero registra Plazas en el botón "Gestionar Plazas"!
                    </div>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Teléfono</label>
                  <input placeholder="+52 555 555 5555" className="w-full border p-2 rounded bg-white text-gray-900 placeholder-gray-500 focus:ring-2 focus:ring-blue-500 outline-none" value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} />
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block font-bold text-indigo-600 flex items-center"><Lock className="w-3 h-3 mr-1" /> Código Acceso</label>
                  <input maxLength={4} placeholder="4 dígitos (Ej: 1234)" className="w-full border-2 border-indigo-100 p-2 rounded bg-white text-gray-900 placeholder-gray-400 focus:ring-2 focus:ring-indigo-500 outline-none" value={formData.accessCode || ''} onChange={e => setFormData({...formData, accessCode: e.target.value.replace(/\D/g,'')})} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Fecha Nacimiento</label>
                  <input type="date" className="w-full border p-2 rounded bg-white text-gray-900 focus:ring-2 focus:ring-blue-500 outline-none" value={formData.birthDate} onChange={e => setFormData({...formData, birthDate: e.target.value})} />
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Fecha Contratación</label>
                  <input type="date" className="w-full border p-2 rounded bg-white text-gray-900 focus:ring-2 focus:ring-blue-500 outline-none" value={formData.hireDate} onChange={e => setFormData({...formData, hireDate: e.target.value})} />
                </div>
              </div>

              <div>
                <label className="text-xs text-gray-500 mb-1 block font-bold text-gray-700">Estado del Empleado</label>
                <select 
                  className="w-full border p-2 rounded bg-white text-gray-900 focus:ring-2 focus:ring-blue-500 outline-none text-sm font-semibold"
                  value={formData.status || 'ACTIVO'}
                  onChange={e => setFormData({...formData, status: e.target.value as any})}
                >
                  <option value="ACTIVO">🟢 ACTIVO</option>
                  <option value="INACTIVO">🟡 INACTIVO</option>
                  <option value="BAJA">🔴 BAJA</option>
                </select>
              </div>
              
              <div className="flex justify-end gap-3 pt-6 border-t mt-4">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">Cancelar</button>
                <button type="submit" disabled={loading} className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 shadow-md transition-colors font-medium">
                  {loading ? 'Guardando...' : (editingId ? 'Actualizar' : 'Guardar Empleado')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
