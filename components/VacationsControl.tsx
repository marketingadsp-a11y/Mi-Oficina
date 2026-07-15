import React, { useState, useMemo, useEffect } from 'react';
import { 
  Umbrella, 
  Plus, 
  Trash2, 
  Check, 
  X, 
  Calendar, 
  Coins, 
  Clock, 
  User, 
  Search, 
  FileText, 
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  ChevronsUpDown,
  Wallet
} from 'lucide-react';
import { Employee, VacationRequest } from '../types';
import { addVacationRequest, updateVacationRequest, deleteVacationRequest } from '../services/dbService';

const calculateReturnDate = (endDateStr: string): string => {
  try {
    const date = new Date(endDateStr + 'T00:00:00');
    if (isNaN(date.getTime())) return 'N/R';
    date.setDate(date.getDate() + 1);
    if (date.getDay() === 0) {
      date.setDate(date.getDate() + 1);
    }
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const dd = String(date.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  } catch (error) {
    return 'N/R';
  }
};

const isReturnDateInPast = (endDateStr: string): boolean => {
  const returnDateStr = calculateReturnDate(endDateStr);
  if (returnDateStr === 'N/R') return false;
  
  const today = new Date();
  const yyyy = today.getFullYear();
  const mm = String(today.getMonth() + 1).padStart(2, '0');
  const dd = String(today.getDate()).padStart(2, '0');
  const todayStr = `${yyyy}-${mm}-${dd}`;
  
  return returnDateStr < todayStr;
};

interface VacationsControlProps {
  employees: Employee[];
  vacationRequests: VacationRequest[];
  currentUser?: Employee | null;
}

export const VacationsControl: React.FC<VacationsControlProps> = ({ employees, vacationRequests, currentUser }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Form State
  const [selectedEmpId, setSelectedEmpId] = useState('');
  const [empSearchQuery, setEmpSearchQuery] = useState('');
  const [isEmpDropdownOpen, setIsEmpDropdownOpen] = useState(false);
  const [startDate, setStartDate] = useState('');
  const [requestedDays, setRequestedDays] = useState<number>(1);
  const [requestType, setRequestType] = useState<'disponibles' | 'descuento'>('disponibles');
  const [notes, setNotes] = useState('');
  const [authorizedBy, setAuthorizedBy] = useState('Admin');

  // Requests List Filters
  const [statusFilter, setStatusFilter] = useState<'TODOS' | 'PENDIENTE' | 'APROBADA' | 'RECHAZADA'>('TODOS');
  const [typeFilter, setTypeFilter] = useState<'TODOS' | 'disponibles' | 'descuento'>('TODOS');
  const [isPastRequestsOpen, setIsPastRequestsOpen] = useState(false);
  const [daysPerYear, setDaysPerYear] = useState<number>(() => {
    const saved = localStorage.getItem('vacationDaysPerYear');
    return saved ? parseInt(saved, 10) : 12;
  });
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
    confirmText?: string;
    confirmBg?: string;
  }>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {},
    confirmText: 'Aceptar',
    confirmBg: 'bg-indigo-600 hover:bg-indigo-700'
  });

  useEffect(() => {
    const handleChanged = () => {
      const saved = localStorage.getItem('vacationDaysPerYear');
      if (saved) {
        setDaysPerYear(parseInt(saved, 10));
      }
    };
    window.addEventListener('vacationDaysPerYearChanged', handleChanged);
    return () => {
      window.removeEventListener('vacationDaysPerYearChanged', handleChanged);
    };
  }, []);

  useEffect(() => {
    if (isModalOpen) {
      setSelectedEmpId('');
      setEmpSearchQuery('');
      setStartDate('');
      setRequestedDays(3); // In the picture it has 3
      setRequestType('disponibles');
      setNotes('');
      setAuthorizedBy(currentUser ? `${currentUser.firstName} ${currentUser.lastName}` : 'Admin');
      setError('');
      setSuccess('');
    }
  }, [isModalOpen, currentUser]);

  // Weekly Calendar States & Handlers
  const DAY_NAMES = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];

  const getMonday = (d: Date) => {
    const date = new Date(d);
    const day = date.getDay();
    const diff = date.getDate() - day + (day === 0 ? -6 : 1); // Adjust to Monday
    const monday = new Date(date.setDate(diff));
    monday.setHours(0, 0, 0, 0);
    return monday;
  };

  const [currentWeekMonday, setCurrentWeekMonday] = useState<Date>(() => {
    const today = new Date();
    return getMonday(today);
  });

  const weekDays = useMemo(() => {
    const days = [];
    for (let i = 0; i < 7; i++) {
      const day = new Date(currentWeekMonday);
      day.setDate(day.getDate() + i);
      days.push(day);
    }
    return days;
  }, [currentWeekMonday]);

  const formatDateLocal = (date: Date) => {
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const dd = String(date.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  };

  const formatWeekRange = (monday: Date) => {
    const sunday = new Date(monday);
    sunday.setDate(sunday.getDate() + 6);
    
    const options: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short' };
    const mondayStr = monday.toLocaleDateString('es-ES', options);
    const sundayStr = sunday.toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' });
    
    return `Semana del ${mondayStr} al ${sundayStr}`;
  };

  const handlePrevWeek = () => {
    setCurrentWeekMonday(prev => {
      const next = new Date(prev);
      next.setDate(next.getDate() - 7);
      return next;
    });
  };

  const handleNextWeek = () => {
    setCurrentWeekMonday(prev => {
      const next = new Date(prev);
      next.setDate(next.getDate() + 7);
      return next;
    });
  };

  const handleCurrentWeek = () => {
    const today = new Date();
    setCurrentWeekMonday(getMonday(today));
  };

  // Sync search query when employee is selected or changed
  useEffect(() => {
    if (selectedEmpId) {
      const emp = employees.find(e => e.id === selectedEmpId);
      if (emp) {
        setEmpSearchQuery(`${emp.firstName} ${emp.lastName}`);
      }
    } else {
      setEmpSearchQuery('');
    }
  }, [selectedEmpId, employees]);

  // Calculates Vacation Balance for an Employee
  const getEmployeeBalance = (emp: Employee) => {
    if (!emp.hireDate) return { yearsOfService: 0, totalEarned: 0, used: 0, balance: 0, text: 'Sin Fecha Ingreso' };
    
    try {
      const hire = new Date(emp.hireDate + 'T00:00:00');
      if (isNaN(hire.getTime())) return { yearsOfService: 0, totalEarned: 0, used: 0, balance: 0, text: 'Fecha Inválida' };
      
      const today = new Date();
      const diffTime = today.getTime() - hire.getTime();
      const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
      
      // Calculate completed years
      const yearsOfService = diffDays >= 0 ? Math.floor(diffDays / 365.25) : 0;
      
      // 1 year complete = daysPerYear days automatically, 2 years = daysPerYear * 2 etc.
      const totalEarned = yearsOfService >= 1 ? yearsOfService * daysPerYear : 0;
      
      // Filter approved requests of type 'disponibles' (subtracted days)
      const empRequests = vacationRequests.filter(
        r => r.employeeId === emp.id && r.status === 'APROBADA' && r.type === 'disponibles'
      );
      const used = empRequests.reduce((sum, r) => sum + r.totalDays, 0);
      const balance = totalEarned - used;
      
      return {
        yearsOfService,
        totalEarned,
        used,
        balance,
        text: `${yearsOfService} ${yearsOfService === 1 ? 'año' : 'años'} de servicio`
      };
    } catch (e) {
      return { yearsOfService: 0, totalEarned: 0, used: 0, balance: 0, text: 'Error' };
    }
  };

  // Find currently selected employee info
  const activeEmployee = useMemo(() => {
    return employees.find(e => e.id === selectedEmpId);
  }, [selectedEmpId, employees]);

  // Compute stats for current employee balance
  const activeEmpBalance = useMemo(() => {
    if (!activeEmployee) return null;
    return getEmployeeBalance(activeEmployee);
  }, [activeEmployee, vacationRequests]);

  // Date calculation based on startDate and requestedDays (excluding Sundays)
  const computedResults = useMemo(() => {
    if (!startDate || requestedDays <= 0) {
      return { endDateStr: '', returnDateStr: '', endDateSpanish: '', returnDateSpanish: '', datesList: [] };
    }
    
    let activeDaysAdded = 0;
    let current = new Date(startDate + 'T00:00:00');
    let lastVacationDay = new Date(current);
    const datesList: string[] = [];

    let maxIterations = 1000;
    while (activeDaysAdded < requestedDays && maxIterations > 0) {
      maxIterations--;
      const dayOfWeek = current.getDay(); // 0 is Sunday, 6 is Saturday
      const dateString = current.toISOString().split('T')[0];
      
      if (dayOfWeek !== 0) {
        activeDaysAdded++;
        lastVacationDay = new Date(current);
        datesList.push(dateString);
      }
      
      current.setDate(current.getDate() + 1);
    }

    // Return date is the day after the last vacation day
    const returnDate = new Date(lastVacationDay);
    returnDate.setDate(returnDate.getDate() + 1);
    
    // If return date falls on Sunday, move to Monday
    if (returnDate.getDay() === 0) {
      returnDate.setDate(returnDate.getDate() + 1);
    }

    const formatDate = (d: Date) => {
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    };

    const options: Intl.DateTimeFormatOptions = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    const returnDateSpanish = returnDate.toLocaleDateString('es-ES', options);
    const endDateSpanish = lastVacationDay.toLocaleDateString('es-ES', options);

    return {
      endDateStr: formatDate(lastVacationDay),
      returnDateStr: formatDate(returnDate),
      endDateSpanish,
      returnDateSpanish,
      datesList
    };
  }, [startDate, requestedDays]);

  // List of employees with details & balance
  const employeeBalances = useMemo(() => {
    return employees
      .filter(e => e.status !== 'BAJA')
      .map(emp => {
        const stats = getEmployeeBalance(emp);
        return {
          emp,
          ...stats
        };
      })
      .filter(item => {
        const searchLower = searchTerm.toLowerCase();
        const fullName = `${item.emp.firstName} ${item.emp.lastName}`.toLowerCase();
        const plaza = (item.emp.plaza || '').toLowerCase();
        const position = (item.emp.position || '').toLowerCase();
        return fullName.includes(searchLower) || plaza.includes(searchLower) || position.includes(searchLower);
      });
  }, [employees, vacationRequests, searchTerm]);

  // Filtered requests for the history table
  const filteredRequests = useMemo(() => {
    return vacationRequests.filter(req => {
      const matchStatus = statusFilter === 'TODOS' || req.status === statusFilter;
      const matchType = typeFilter === 'TODOS' || req.type === typeFilter;
      return matchStatus && matchType;
    });
  }, [vacationRequests, statusFilter, typeFilter]);

  // Split filtered requests into active (current/future) and past based on returnDate
  const { activeRequests, pastRequests } = useMemo(() => {
    const active: VacationRequest[] = [];
    const past: VacationRequest[] = [];
    
    filteredRequests.forEach(req => {
      if (isReturnDateInPast(req.endDate)) {
        past.push(req);
      } else {
        active.push(req);
      }
    });
    
    return { activeRequests: active, pastRequests: past };
  }, [filteredRequests]);

  // generalStats removed as weekly calendar replaces the stats row

  // Submit Request Action
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!selectedEmpId) {
      setError('Por favor selecciona un colaborador.');
      return;
    }
    if (!startDate) {
      setError('Por favor define la fecha de inicio.');
      return;
    }
    if (requestedDays <= 0) {
      setError('Por favor indica una cantidad válida de días solicitados.');
      return;
    }

    // Verify balance if 'disponibles' is chosen
    if (requestType === 'disponibles' && activeEmpBalance) {
      if (requestedDays > activeEmpBalance.balance) {
        setError(`El colaborador solo tiene ${activeEmpBalance.balance} días de vacaciones disponibles. Selecciona "Descuento de Nómina" o reduce los días.`);
        return;
      }
    }

    try {
      setLoading(true);
      const emp = employees.find(e => e.id === selectedEmpId)!;
      await addVacationRequest({
        employeeId: emp.id,
        employeeName: `${emp.firstName} ${emp.lastName}`,
        employeeCategory: emp.category,
        startDate,
        endDate: computedResults.endDateStr,
        totalDays: requestedDays,
        type: requestType,
        status: 'PENDIENTE',
        notes: notes.trim() || "",
        registeredBy: authorizedBy.trim() || 'Admin'
      });

      setSuccess('Solicitud registrada con éxito como PENDIENTE.');
      
      // Reset form
      setSelectedEmpId('');
      setEmpSearchQuery('');
      setStartDate('');
      setRequestedDays(3);
      setRequestType('disponibles');
      setNotes('');
      setAuthorizedBy(currentUser ? `${currentUser.firstName} ${currentUser.lastName}` : 'Admin');
      setTimeout(() => {
        setIsModalOpen(false);
        setSuccess('');
      }, 2000);
    } catch (err: any) {
      console.error(err);
      setError('Error al registrar la solicitud: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  // Change request status action
  const handleUpdateStatus = (id: string, newStatus: 'APROBADA' | 'RECHAZADA') => {
    const isApprove = newStatus === 'APROBADA';
    setConfirmModal({
      isOpen: true,
      title: isApprove ? 'Aprobar Solicitud' : 'Rechazar Solicitud',
      message: `¿Estás seguro de cambiar el estado de la solicitud a ${newStatus}?`,
      confirmText: isApprove ? 'Sí, Aprobar' : 'Sí, Rechazar',
      confirmBg: isApprove ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-red-600 hover:bg-red-700',
      onConfirm: async () => {
        try {
          await updateVacationRequest(id, { status: newStatus });
        } catch (err) {
          console.error(err);
        }
        setConfirmModal(prev => ({ ...prev, isOpen: false }));
      }
    });
  };

  // Delete request action
  const handleDeleteRequest = (id: string) => {
    setConfirmModal({
      isOpen: true,
      title: 'Eliminar Registro',
      message: '¿Estás seguro de eliminar de forma permanente esta solicitud? Esta acción no se puede deshacer.',
      confirmText: 'Sí, Eliminar',
      confirmBg: 'bg-red-600 hover:bg-red-700',
      onConfirm: async () => {
        try {
          await deleteVacationRequest(id);
        } catch (err) {
          console.error(err);
        }
        setConfirmModal(prev => ({ ...prev, isOpen: false }));
      }
    });
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'PENDIENTE':
        return <span className="px-2.5 py-1 text-xs font-bold rounded-full bg-amber-100 text-amber-800 border border-amber-200">PENDIENTE</span>;
      case 'APROBADA':
        return <span className="px-2.5 py-1 text-xs font-bold rounded-full bg-green-100 text-green-800 border border-green-200">APROBADA</span>;
      case 'RECHAZADA':
        return <span className="px-2.5 py-1 text-xs font-bold rounded-full bg-red-100 text-red-800 border border-red-200">RECHAZADA</span>;
      default:
        return <span className="px-2.5 py-1 text-xs font-bold rounded-full bg-gray-100 text-gray-800 border border-gray-200">{status}</span>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Calendario Semanal de Permisos */}
      <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-5">
          <div>
            <h4 className="font-extrabold text-gray-800 text-lg">Calendario Semanal de Permisos</h4>
            <p className="text-xs text-gray-500">{formatWeekRange(currentWeekMonday)}</p>
          </div>
          
          <div className="flex items-center gap-2 bg-gray-50 p-1.5 rounded-xl border border-gray-100 w-full md:w-auto justify-between md:justify-start">
            <button
              onClick={handlePrevWeek}
              className="p-1.5 hover:bg-white rounded-lg text-gray-600 hover:text-indigo-600 transition-all hover:shadow-sm"
              title="Semana Anterior"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <button
              onClick={handleCurrentWeek}
              className="px-4 py-1.5 bg-white hover:bg-gray-50 text-indigo-600 font-extrabold text-xs rounded-lg transition-all shadow-sm border border-gray-100"
            >
              Actual
            </button>
            <button
              onClick={handleNextWeek}
              className="p-1.5 hover:bg-white rounded-lg text-gray-600 hover:text-indigo-600 transition-all hover:shadow-sm"
              title="Siguiente Semana"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* 7 Days Grid */}
        <div className="grid grid-cols-1 md:grid-cols-7 gap-3">
          {weekDays.map((day, idx) => {
            const dateStr = formatDateLocal(day);
            // Filter requests that overlap with this date
            const dayRequests = vacationRequests.filter(req => {
              if (req.status === 'RECHAZADA') return false;
              return req.startDate <= dateStr && dateStr <= req.endDate;
            });

            const isToday = formatDateLocal(new Date()) === dateStr;

            return (
              <div
                key={dateStr}
                className={`p-3.5 rounded-xl border transition-all flex flex-col min-h-[140px] ${
                  isToday 
                    ? 'bg-indigo-50/30 border-indigo-200 ring-2 ring-indigo-600/10' 
                    : 'bg-gray-50/30 border-gray-100 hover:border-gray-200'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className={`text-[11px] font-extrabold uppercase ${isToday ? 'text-indigo-600' : 'text-gray-400'}`}>
                    {DAY_NAMES[idx]}
                  </span>
                  <span className={`text-xs px-2 py-0.5 rounded-md font-black ${
                    isToday ? 'bg-indigo-600 text-white shadow-sm' : 'text-gray-700 bg-gray-100/60'
                  }`}>
                    {day.getDate()}
                  </span>
                </div>

                <div className="flex-1 space-y-1.5 overflow-y-auto no-scrollbar max-h-[120px]">
                  {dayRequests.length > 0 ? (
                    dayRequests.map(req => (
                      <div
                        key={req.id}
                        className={`p-2 rounded-lg border text-[10px] flex flex-col gap-0.5 transition-all shadow-sm ${
                          req.status === 'APROBADA'
                            ? req.type === 'disponibles'
                              ? 'bg-indigo-50/50 border-indigo-100 text-indigo-900'
                              : 'bg-emerald-50/50 border-emerald-100 text-emerald-900'
                            : 'bg-amber-50/50 border-amber-100 text-amber-900'
                        }`}
                        title={`${req.employeeName} (${req.employeeCategory})\nPeriodo: ${req.startDate} al ${req.endDate}\nModo: ${req.type === 'disponibles' ? 'Días Disponibles' : 'Descuento'}`}
                      >
                        <span className="font-extrabold truncate block">
                          {req.employeeName}
                        </span>
                        <div className="flex items-center justify-between mt-0.5 text-[8px] font-medium opacity-80">
                          <span>{req.type === 'disponibles' ? 'Vacaciones' : 'Descuento'}</span>
                          <span>{req.status === 'PENDIENTE' ? 'Pend.' : 'Aprob.'}</span>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="h-full flex items-center justify-center py-4">
                      <span className="text-[9px] text-gray-300 font-bold tracking-wider uppercase">Sin Permisos</span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Main Section: History List (Full-Width) */}
      <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex flex-col min-h-[600px]">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 gap-3">
          <div>
            <h3 className="font-extrabold text-gray-800 text-lg">Historial de Solicitudes</h3>
            <p className="text-xs text-gray-500">Revisión y autorización de periodos solicitados</p>
          </div>

          {/* Filters & Actions */}
          <div className="flex flex-wrap gap-2 w-full sm:w-auto items-center">
            <select
              className="p-1.5 border border-gray-200 rounded-lg text-xs bg-white cursor-pointer focus:ring-1 focus:ring-indigo-500 outline-none"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
            >
              <option value="TODOS">Todos los Estados</option>
              <option value="PENDIENTE">Pendientes</option>
              <option value="APROBADA">Aprobadas</option>
              <option value="RECHAZADA">Rechazadas</option>
            </select>

            <select
              className="p-1.5 border border-gray-200 rounded-lg text-xs bg-white cursor-pointer focus:ring-1 focus:ring-indigo-500 outline-none"
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value as any)}
            >
              <option value="TODOS">Todos los Modos</option>
              <option value="disponibles">Por Días Disponibles</option>
              <option value="descuento">Descuento de Nómina</option>
            </select>

            <button 
              onClick={() => {
                setSelectedEmpId('');
                setIsModalOpen(true);
              }}
              className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold px-4 py-2 rounded-lg transition-all shadow-sm"
            >
              Registrar Solicitud
            </button>
          </div>
        </div>

        {/* History Table */}
        <div className="flex-1 overflow-auto border border-gray-100 rounded-xl">
          {activeRequests.length > 0 ? (
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-gray-50 text-gray-500 font-bold uppercase tracking-wider border-b border-gray-100">
                  <th className="p-3">Empleado</th>
                  <th className="p-3">Fecha Permiso</th>
                  <th className="p-3">Fecha de Regreso</th>
                  <th className="p-3 text-center">Días</th>
                  <th className="p-3">Autorizado por:</th>
                  <th className="p-3 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-gray-700">
                {activeRequests.map((req) => (
                  <tr key={req.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="p-3">
                      <div>
                        <p className="font-extrabold text-gray-900">{req.employeeName}</p>
                        <p className="text-[10px] text-gray-400">{req.employeeCategory}</p>
                      </div>
                    </td>
                    <td className="p-3">
                      <div className="flex flex-col">
                        <span className="font-medium text-gray-700">{req.startDate} al {req.endDate}</span>
                        <span className={`text-[10px] font-bold ${
                          req.type === 'disponibles' ? 'text-indigo-600' : 'text-emerald-600'
                        }`}>
                          {req.type === 'disponibles' ? 'Días Disponibles' : 'Descuento Nómina'}
                        </span>
                      </div>
                    </td>
                    <td className="p-3">
                      <span className="font-semibold text-gray-800">{calculateReturnDate(req.endDate)}</span>
                    </td>
                    <td className="p-3 text-center font-black text-gray-800">
                      {req.totalDays}
                    </td>
                    <td className="p-3">
                      <div className="flex flex-col items-start gap-1">
                        {getStatusBadge(req.status)}
                        <span className="text-[10px] text-gray-400 font-bold">Por: {req.registeredBy || 'Admin'}</span>
                      </div>
                    </td>
                    <td className="p-3 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {req.status === 'PENDIENTE' && (
                          <>
                            <button
                              onClick={() => handleUpdateStatus(req.id, 'APROBADA')}
                              className="p-1.5 bg-green-50 text-green-600 hover:bg-green-100 rounded-lg transition-colors border border-green-200"
                              title="Aprobar Solicitud"
                            >
                              <Check className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleUpdateStatus(req.id, 'RECHAZADA')}
                              className="p-1.5 bg-red-50 text-red-600 hover:bg-red-100 rounded-lg transition-colors border border-red-200"
                              title="Rechazar Solicitud"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </>
                        )}
                        <button
                          onClick={() => handleDeleteRequest(req.id)}
                          className="p-1.5 bg-gray-50 text-gray-500 hover:bg-red-50 hover:text-red-600 rounded-lg transition-colors border border-gray-200 hover:border-red-200"
                          title="Eliminar Registro"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="text-center py-20 text-gray-400 flex flex-col items-center justify-center gap-2">
              No se encontraron solicitudes activas registradas.
            </div>
          )}
        </div>
      </div>

      {/* Historial de Solicitudes Anteriores */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <button
          onClick={() => setIsPastRequestsOpen(!isPastRequestsOpen)}
          className="w-full p-5 flex items-center justify-between text-left hover:bg-gray-50/50 transition-colors focus:outline-none"
        >
          <div>
            <h3 className="font-extrabold text-gray-800 text-base">Historial de Solicitudes Anteriores</h3>
            <p className="text-xs text-gray-500">Solicitudes cuya fecha de regreso ya ha pasado ({pastRequests.length} registradas)</p>
          </div>
          <div className="p-2 bg-gray-50 rounded-xl border border-gray-100 text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 hover:border-indigo-100 transition-all">
            {isPastRequestsOpen ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
          </div>
        </button>

        {isPastRequestsOpen && (
          <div className="p-5 border-t border-gray-50 bg-gray-50/10">
            <div className="overflow-auto border border-gray-100 rounded-xl bg-white">
              {pastRequests.length > 0 ? (
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-gray-50 text-gray-500 font-bold uppercase tracking-wider border-b border-gray-100">
                      <th className="p-3">Empleado</th>
                      <th className="p-3">Fecha Permiso</th>
                      <th className="p-3">Fecha de Regreso</th>
                      <th className="p-3 text-center">Días</th>
                      <th className="p-3">Autorizado por:</th>
                      <th className="p-3 text-right">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 text-gray-700">
                    {pastRequests.map((req) => (
                      <tr key={req.id} className="hover:bg-gray-50/50 transition-colors">
                        <td className="p-3">
                          <div>
                            <p className="font-extrabold text-gray-900">{req.employeeName}</p>
                            <p className="text-[10px] text-gray-400">{req.employeeCategory}</p>
                          </div>
                        </td>
                        <td className="p-3">
                          <div className="flex flex-col">
                            <span className="font-medium text-gray-700">{req.startDate} al {req.endDate}</span>
                            <span className={`text-[10px] font-bold ${
                              req.type === 'disponibles' ? 'text-indigo-600' : 'text-emerald-600'
                            }`}>
                              {req.type === 'disponibles' ? 'Días Disponibles' : 'Descuento Nómina'}
                            </span>
                          </div>
                        </td>
                        <td className="p-3">
                          <span className="font-semibold text-gray-800">{calculateReturnDate(req.endDate)}</span>
                        </td>
                        <td className="p-3 text-center font-black text-gray-800">
                          {req.totalDays}
                        </td>
                        <td className="p-3">
                          <div className="flex flex-col items-start gap-1">
                            {getStatusBadge(req.status)}
                            <span className="text-[10px] text-gray-400 font-bold">Por: {req.registeredBy || 'Admin'}</span>
                          </div>
                        </td>
                        <td className="p-3 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {req.status === 'PENDIENTE' && (
                              <>
                                <button
                                  onClick={() => handleUpdateStatus(req.id, 'APROBADA')}
                                  className="p-1.5 bg-green-50 text-green-600 hover:bg-green-100 rounded-lg transition-colors border border-green-200"
                                  title="Aprobar Solicitud"
                                >
                                  <Check className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={() => handleUpdateStatus(req.id, 'RECHAZADA')}
                                  className="p-1.5 bg-red-50 text-red-600 hover:bg-red-100 rounded-lg transition-colors border border-red-200"
                                  title="Rechazar Solicitud"
                                >
                                  <X className="w-3.5 h-3.5" />
                                </button>
                              </>
                            )}
                            <button
                              onClick={() => handleDeleteRequest(req.id)}
                              className="p-1.5 bg-gray-50 text-gray-500 hover:bg-red-50 hover:text-red-600 rounded-lg transition-colors border border-gray-200 hover:border-red-200"
                              title="Eliminar Registro"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div className="text-center py-10 text-gray-400 flex flex-col items-center justify-center gap-2">
                  No se encontraron solicitudes anteriores.
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* New Request Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 backdrop-blur-xs">
          <div className="bg-white rounded-2xl w-full max-w-4xl shadow-2xl relative border border-slate-100 flex flex-col max-h-[92vh] overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            
            {/* Header */}
            <div className="flex gap-3 items-start p-6 bg-slate-50 border-b border-slate-200/60 rounded-t-2xl">
              <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-xl">
                <Calendar className="w-5 h-5" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-black text-slate-900 leading-tight">
                  Registrar Permiso de Personal
                </h3>
                <p className="text-xs text-slate-500 font-medium mt-1">
                  Completa los datos para registrar una ausencia o período vacacional para el empleado seleccionado.
                </p>
              </div>
              <button 
                onClick={() => setIsModalOpen(false)}
                className="text-gray-400 hover:text-gray-600 p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto no-scrollbar flex flex-col min-h-0">
              {/* Main Grid: Left inputs, Right summary */}
              <div className="p-6 grid grid-cols-1 lg:grid-cols-12 gap-6 flex-1 bg-slate-50/50 overflow-y-auto no-scrollbar">
                
                {/* Left Column (Inputs) */}
                <div className="lg:col-span-7 space-y-6">
                  {error && (
                    <div className="p-3.5 bg-red-50 border border-red-100 rounded-xl text-red-600 text-xs font-semibold">
                      {error}
                    </div>
                  )}
                  {success && (
                    <div className="p-3.5 bg-green-50 border border-green-100 rounded-xl text-green-600 text-xs font-semibold">
                      {success}
                    </div>
                  )}

                  {/* 1. SELECCIONAR EMPLEADO */}
                  <div className="space-y-2">
                    <label className="block text-[11px] font-black text-slate-400 tracking-wider uppercase">
                      1. SELECCIONAR EMPLEADO
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        required
                        placeholder="Escribe el nombre del colaborador..."
                        className="w-full bg-white border border-slate-200 rounded-xl py-3 pl-4 pr-10 text-sm font-bold text-slate-800 placeholder-slate-400 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition-all uppercase"
                        value={empSearchQuery}
                        onChange={(e) => {
                          setEmpSearchQuery(e.target.value);
                          setIsEmpDropdownOpen(true);
                          setSelectedEmpId(''); // Clear selection while typing
                        }}
                        onFocus={() => setIsEmpDropdownOpen(true)}
                      />
                      <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                        <ChevronsUpDown className="w-4 h-4" />
                      </div>

                      {/* Suggestions List Box */}
                      {isEmpDropdownOpen && (
                        <div className="absolute z-50 left-0 right-0 mt-1.5 max-h-52 overflow-y-auto bg-white border border-slate-200 rounded-xl shadow-xl divide-y divide-slate-100 animate-in fade-in-50 duration-100">
                          {(() => {
                            const filtered = employees
                              .filter(e => e.status !== 'BAJA')
                              .filter(e => {
                                const fullName = `${e.firstName} ${e.lastName}`.toLowerCase();
                                return fullName.includes(empSearchQuery.toLowerCase());
                              });

                            if (filtered.length > 0) {
                              return filtered.map(e => (
                                <button
                                  key={e.id}
                                  type="button"
                                  className="w-full text-left px-4 py-3 text-xs hover:bg-indigo-50/50 transition-colors flex flex-col"
                                  onClick={() => {
                                    setSelectedEmpId(e.id);
                                    setEmpSearchQuery(`${e.firstName} ${e.lastName}`);
                                    setIsEmpDropdownOpen(false);
                                    setError('');
                                  }}
                                >
                                  <span className="font-extrabold text-slate-800">{e.firstName} {e.lastName}</span>
                                  <span className="text-[10px] text-slate-400 font-semibold">{e.category} • {e.position || 'Sin puesto'}</span>
                                </button>
                              ));
                            } else {
                              return (
                                <div className="px-4 py-3 text-xs text-slate-400 italic text-center">
                                  No se encontraron colaboradores activos
                                </div>
                              );
                            }
                          })()}
                        </div>
                      )}

                      {/* Click outside backdrop container */}
                      {isEmpDropdownOpen && (
                        <div 
                          className="fixed inset-0 z-40 bg-transparent pointer-events-auto"
                          onClick={() => setIsEmpDropdownOpen(false)}
                        />
                      )}
                    </div>
                  </div>

                  <hr className="border-slate-200/60" />

                  {/* 2. DETALLES DEL PERMISO */}
                  <div className="space-y-3">
                    <label className="block text-[11px] font-black text-slate-400 tracking-wider uppercase">
                      2. DETALLES DEL PERMISO
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <span className="text-xs font-bold text-slate-600 block">Días Solicitados</span>
                        <input
                          type="number"
                          min={1}
                          max={100}
                          required
                          className="w-full bg-white border border-slate-200 rounded-xl p-3 text-sm font-extrabold text-slate-800 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition-all"
                          value={requestedDays}
                          onChange={(e) => setRequestedDays(Math.max(1, parseInt(e.target.value) || 0))}
                        />
                      </div>

                      <div className="space-y-1.5">
                        <span className="text-xs font-bold text-slate-600 block">Fecha de Inicio</span>
                        <div className="relative">
                          <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4 pointer-events-none" />
                          <input
                            type="date"
                            required
                            className="w-full bg-white border border-slate-200 rounded-xl py-3 pl-10 pr-4 text-sm font-bold text-slate-800 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition-all"
                            value={startDate}
                            onChange={(e) => setStartDate(e.target.value)}
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  <hr className="border-slate-200/60" />

                  {/* 3. TIPO DE PERMISO */}
                  <div className="space-y-3">
                    <label className="block text-[11px] font-black text-slate-400 tracking-wider uppercase">
                      3. TIPO DE PERMISO
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {/* Card 1: A cuenta de vacaciones */}
                      <button
                        type="button"
                        onClick={() => setRequestType('disponibles')}
                        className={`p-4 rounded-2xl border-2 text-center flex flex-col items-center justify-center gap-2.5 transition-all group ${
                          requestType === 'disponibles'
                            ? 'border-indigo-600 bg-white ring-1 ring-indigo-500 shadow-md shadow-indigo-600/5'
                            : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/50'
                        }`}
                      >
                        <div className={`p-2 rounded-xl transition-colors ${
                          requestType === 'disponibles' ? 'bg-indigo-50 text-indigo-600' : 'bg-slate-100 text-slate-500 group-hover:bg-slate-200'
                        }`}>
                          <Calendar className="w-5 h-5" />
                        </div>
                        <div>
                          <span className="block text-xs font-extrabold text-slate-800">A cuenta de vacaciones</span>
                          <span className="block text-[10px] text-slate-500 font-medium mt-0.5">
                            {activeEmpBalance ? activeEmpBalance.balance : 0} días disponibles
                          </span>
                        </div>
                      </button>

                      {/* Card 2: Con descuento a sueldo */}
                      <button
                        type="button"
                        onClick={() => setRequestType('descuento')}
                        className={`p-4 rounded-2xl border-2 text-center flex flex-col items-center justify-center gap-2.5 transition-all group ${
                          requestType === 'descuento'
                            ? 'border-indigo-600 bg-white ring-1 ring-indigo-500 shadow-md shadow-indigo-600/5'
                            : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/50'
                        }`}
                      >
                        <div className={`p-2 rounded-xl transition-colors ${
                          requestType === 'descuento' ? 'bg-indigo-50 text-indigo-600' : 'bg-slate-100 text-slate-500 group-hover:bg-slate-200'
                        }`}>
                          <Wallet className="w-5 h-5" />
                        </div>
                        <div>
                          <span className="block text-xs font-extrabold text-slate-800">Con descuento a sueldo</span>
                          <span className="block text-[10px] text-slate-500 font-medium mt-0.5">
                            Se descontará del pago
                          </span>
                        </div>
                      </button>
                    </div>
                  </div>
                </div>

                {/* Right Column (Sidebar Summary & Authorization) */}
                <div className="lg:col-span-5 space-y-4">
                  
                  {/* Card: Resumen del Empleado */}
                  <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
                    <div className="bg-slate-50/60 px-5 py-3 border-b border-slate-100 flex items-center gap-2">
                      <User className="w-4 h-4 text-indigo-600" />
                      <h4 className="text-xs font-extrabold text-slate-800 uppercase tracking-wide">Resumen del Empleado</h4>
                    </div>
                    <div className="p-5 space-y-3.5 text-xs">
                      <div className="flex justify-between items-center">
                        <span className="text-slate-500 font-semibold">Fecha de Ingreso:</span>
                        <span className="text-slate-800 font-black text-right">
                          {activeEmployee?.hireDate ? (() => {
                            try {
                              const d = new Date(activeEmployee.hireDate + 'T00:00:00');
                              if (isNaN(d.getTime())) return activeEmployee.hireDate;
                              return d.toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' });
                            } catch {
                              return activeEmployee.hireDate;
                            }
                          })() : 'N/R'}
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-slate-500 font-semibold">Vacaciones Restantes:</span>
                        <span className="bg-slate-100 text-slate-700 px-3 py-1 rounded-full font-black text-[11px]">
                          {activeEmpBalance ? activeEmpBalance.balance : 0} días
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Card: Resumen y Autorización */}
                  <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
                    <div className="bg-slate-50/60 px-5 py-3 border-b border-slate-100">
                      <h4 className="text-xs font-extrabold text-slate-800 uppercase tracking-wide">Resumen y Autorización</h4>
                    </div>
                    <div className="p-5 space-y-4 text-xs">
                      
                      {/* Calculated return banner */}
                      <div className="bg-[#f5f3ff] border border-indigo-100/60 rounded-xl p-3.5 flex justify-between items-center gap-2">
                        <span className="text-slate-600 font-bold">Fecha de Regreso:</span>
                        <span className="text-indigo-600 font-black text-right text-sm">
                          {startDate && requestedDays > 0 ? (computedResults.returnDateSpanish || 'Cargando...') : 'N/R'}
                        </span>
                      </div>

                      {/* Authorized by Field */}
                      <div className="space-y-1.5">
                        <span className="text-[10px] font-black text-slate-400 tracking-wider uppercase block">
                          Autorizado por
                        </span>
                        <input
                          type="text"
                          required
                          className="w-full bg-slate-50/50 border border-slate-200 rounded-xl p-3 text-sm font-bold text-slate-800 focus:bg-white focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition-all"
                          value={authorizedBy}
                          onChange={(e) => setAuthorizedBy(e.target.value)}
                        />
                      </div>

                    </div>
                  </div>

                </div>

              </div>

              {/* Action Buttons Footer */}
              <div className="flex justify-end gap-3 p-5 bg-slate-50 border-t border-slate-200/60 rounded-b-2xl">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-6 py-2.5 bg-white border border-slate-200 text-slate-700 font-bold hover:bg-slate-50 rounded-xl text-xs transition-all"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={loading || !selectedEmpId || !startDate || requestedDays <= 0}
                  className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold rounded-xl text-xs disabled:opacity-50 transition-all shadow-sm"
                >
                  {loading ? 'Procesando...' : 'Registrar Permiso'}
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

      {/* Confirm Action Modal */}
      {confirmModal.isOpen && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[100] p-4 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-xl border border-gray-100 animate-in fade-in zoom-in-95 duration-200">
            <h4 className="text-base font-extrabold text-gray-900 mb-2">{confirmModal.title}</h4>
            <p className="text-xs text-gray-500 mb-6 font-medium">
              {confirmModal.message}
            </p>
            
            <div className="flex gap-2 justify-end">
              <button
                type="button"
                onClick={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
                className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 font-extrabold text-xs rounded-xl transition-all"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={confirmModal.onConfirm}
                className={`px-4 py-2 text-white font-extrabold text-xs rounded-xl shadow-sm transition-all ${confirmModal.confirmBg || 'bg-indigo-600 hover:bg-indigo-700'}`}
              >
                {confirmModal.confirmText || 'Aceptar'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
