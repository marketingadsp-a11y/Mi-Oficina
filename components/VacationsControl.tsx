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
  ChevronRight
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

  // Requests List Filters
  const [statusFilter, setStatusFilter] = useState<'TODOS' | 'PENDIENTE' | 'APROBADA' | 'RECHAZADA'>('TODOS');
  const [typeFilter, setTypeFilter] = useState<'TODOS' | 'disponibles' | 'descuento'>('TODOS');

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
      
      // 1 year complete = 12 days automatically, 2 years = 24 days etc.
      const totalEarned = yearsOfService >= 1 ? yearsOfService * 12 : 0;
      
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
        notes: notes.trim() || undefined,
        registeredBy: currentUser ? `${currentUser.firstName} ${currentUser.lastName}` : 'Administrador'
      });

      setSuccess('Solicitud registrada con éxito como PENDIENTE.');
      
      // Reset form
      setSelectedEmpId('');
      setStartDate('');
      setRequestedDays(1);
      setRequestType('disponibles');
      setNotes('');
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
  const handleUpdateStatus = async (id: string, newStatus: 'APROBADA' | 'RECHAZADA') => {
    if (!window.confirm(`¿Estás seguro de cambiar el estado de la solicitud a ${newStatus}?`)) return;
    try {
      await updateVacationRequest(id, { status: newStatus });
    } catch (err) {
      console.error(err);
      alert('Error al actualizar el estado de la solicitud.');
    }
  };

  // Delete request action
  const handleDeleteRequest = async (id: string) => {
    if (!window.confirm('¿Estás seguro de eliminar de forma permanente esta solicitud? Esta acción no se puede deshacer.')) return;
    try {
      await deleteVacationRequest(id);
    } catch (err) {
      console.error(err);
      alert('Error al eliminar la solicitud.');
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'PENDIENTE':
        return <span className="px-2.5 py-1 text-xs font-bold rounded-full bg-amber-100 text-amber-800 border border-amber-200">⏳ PENDIENTE</span>;
      case 'APROBADA':
        return <span className="px-2.5 py-1 text-xs font-bold rounded-full bg-green-100 text-green-800 border border-green-200">✅ APROBADA</span>;
      case 'RECHAZADA':
        return <span className="px-2.5 py-1 text-xs font-bold rounded-full bg-red-100 text-red-800 border border-red-200">❌ RECHAZADA</span>;
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
                          <span>{req.type === 'disponibles' ? '🌴 Vacaciones' : '💸 Descuento'}</span>
                          <span>{req.status === 'PENDIENTE' ? '⏳ Pend.' : '✅ Aprob.'}</span>
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
              <option value="PENDIENTE">⏳ Pendientes</option>
              <option value="APROBADA">✅ Aprobadas</option>
              <option value="RECHAZADA">❌ Rechazadas</option>
            </select>

            <select
              className="p-1.5 border border-gray-200 rounded-lg text-xs bg-white cursor-pointer focus:ring-1 focus:ring-indigo-500 outline-none"
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value as any)}
            >
              <option value="TODOS">Todos los Modos</option>
              <option value="disponibles">🌴 Por Días Disponibles</option>
              <option value="descuento">💸 Descuento de Nómina</option>
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
          {filteredRequests.length > 0 ? (
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
                {filteredRequests.map((req) => (
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
                          {req.type === 'disponibles' ? '🌴 Días Disponibles' : '💸 Descuento Nómina'}
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
              No se encontraron solicitudes registradas.
            </div>
          )}
        </div>
      </div>

      {/* New Request Modal (WITHOUT ICONS as requested) */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 backdrop-blur-xs">
          <div className="bg-white rounded-2xl w-full max-w-lg p-6 shadow-2xl relative border border-gray-100 flex flex-col max-h-[90vh]">
            
            {/* Header (No icons) */}
            <div className="flex justify-between items-center pb-4 border-b">
              <h3 className="text-lg font-extrabold text-gray-900">
                Registrar Solicitud de Vacaciones
              </h3>
              <button 
                onClick={() => setIsModalOpen(false)}
                className="text-gray-400 hover:text-gray-600 p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4 pt-4 overflow-y-auto flex-1 pr-1 no-scrollbar">
              {error && (
                <div className="p-3 bg-red-50 border border-red-100 rounded-xl text-red-600 text-xs font-medium">
                  {error}
                </div>
              )}
              {success && (
                <div className="p-3 bg-green-50 border border-green-100 rounded-xl text-green-600 text-xs font-medium">
                  {success}
                </div>
              )}

              {/* Autocomplete Collaborator Selection */}
              <div className="relative">
                <label className="block text-xs font-bold text-gray-700 mb-1.5 uppercase tracking-wider">
                  Colaborador (Buscar por nombre)
                </label>
                <div className="relative">
                  <input
                    type="text"
                    required
                    placeholder="Escribe el nombre del colaborador..."
                    className="w-full border border-gray-200 rounded-xl p-3 text-sm bg-white text-gray-800 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-200 outline-none font-medium"
                    value={empSearchQuery}
                    onChange={(e) => {
                      setEmpSearchQuery(e.target.value);
                      setIsEmpDropdownOpen(true);
                      setSelectedEmpId(''); // Clear selection while typing
                    }}
                    onFocus={() => setIsEmpDropdownOpen(true)}
                  />
                  {selectedEmpId && (
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedEmpId('');
                        setEmpSearchQuery('');
                      }}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 font-bold text-xs px-2.5 py-1 hover:bg-gray-100 rounded-lg transition-colors"
                    >
                      Cambiar
                    </button>
                  )}
                </div>

                {/* Suggestions List Box */}
                {isEmpDropdownOpen && (
                  <div className="absolute z-50 left-0 right-0 mt-1 max-h-52 overflow-y-auto bg-white border border-gray-200 rounded-xl shadow-xl divide-y divide-gray-100">
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
                            className="w-full text-left px-4 py-2.5 text-xs hover:bg-indigo-50/50 transition-colors flex flex-col"
                            onClick={() => {
                              setSelectedEmpId(e.id);
                              setEmpSearchQuery(`${e.firstName} ${e.lastName}`);
                              setIsEmpDropdownOpen(false);
                              setError('');
                            }}
                          >
                            <span className="font-extrabold text-gray-800">{e.firstName} {e.lastName}</span>
                            <span className="text-[10px] text-gray-400 font-medium">{e.category} • {e.position || 'Sin puesto'}</span>
                          </button>
                        ));
                      } else {
                        return (
                          <div className="px-4 py-3 text-xs text-gray-400 italic text-center">
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

              {/* Show selected employee details & stats (No icons) */}
              {activeEmployee && activeEmpBalance && (
                <div className="p-2.5 bg-indigo-50/40 rounded-xl border border-indigo-100/60">
                  <div className="flex flex-wrap items-center justify-center gap-x-2 text-[11px] text-indigo-900 font-medium">
                    <span className="text-indigo-950 font-bold">{activeEmployee.hireDate || 'N/R'}</span>
                    <span className="text-indigo-300">/</span>
                    <span>{activeEmpBalance.text} serv.</span>
                    <span className="text-indigo-300">/</span>
                    <span className="bg-indigo-100/60 px-2 py-0.5 rounded-md font-black text-indigo-700">
                      {activeEmpBalance.balance} d. disp.
                    </span>
                  </div>
                </div>
              )}

              {/* Vacation Mode Selector (No icons) */}
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1.5 uppercase tracking-wider">
                  Modo de Vacaciones
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setRequestType('disponibles')}
                    className={`p-3 rounded-xl border-2 text-left transition-all ${
                      requestType === 'disponibles'
                        ? 'border-indigo-600 bg-indigo-50/30'
                        : 'border-gray-200 bg-white hover:bg-gray-50'
                    }`}
                  >
                    <div>
                      <span className="block text-xs font-extrabold text-gray-800">Días Disponibles</span>
                      <span className="block text-[10px] text-gray-400 font-medium">Se restan de su saldo acumulado</span>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setRequestType('descuento')}
                    className={`p-3 rounded-xl border-2 text-left transition-all ${
                      requestType === 'descuento'
                        ? 'border-emerald-600 bg-emerald-50/20'
                        : 'border-gray-200 bg-white hover:bg-gray-50'
                    }`}
                  >
                    <div>
                      <span className="block text-xs font-extrabold text-gray-800">Descuento de Nómina</span>
                      <span className="block text-[10px] text-gray-400 font-medium">Días sin goce de sueldo cobrados</span>
                    </div>
                  </button>
                </div>
              </div>

              {/* Dates & Requested Days input (Only Start Date and Requested Days) */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1.5 uppercase tracking-wider">
                    Fecha de Inicio
                  </label>
                  <input
                    type="date"
                    required
                    className="w-full border border-gray-200 rounded-xl p-2.5 text-xs bg-white text-gray-800 focus:border-indigo-500 outline-none font-medium"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1.5 uppercase tracking-wider">
                    Días Solicitados
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={100}
                    required
                    className="w-full border border-gray-200 rounded-xl p-2.5 text-xs bg-white text-gray-800 focus:border-indigo-500 outline-none font-extrabold"
                    value={requestedDays}
                    onChange={(e) => setRequestedDays(Math.max(1, parseInt(e.target.value) || 0))}
                  />
                </div>
              </div>

              {/* Display Calculated Return Date (No icons) */}
              {startDate && requestedDays > 0 && computedResults.endDateStr && (
                <div className="p-3 bg-gray-50 rounded-xl border border-gray-200 space-y-1.5 text-xs">
                  <div className="flex justify-between items-center text-gray-600">
                    <span>Último día de descanso:</span>
                    <strong className="text-gray-900 font-extrabold uppercase text-[10px]">
                      {computedResults.endDateSpanish}
                    </strong>
                  </div>
                  <div className="flex justify-between items-center border-t border-gray-200 pt-1.5 text-indigo-900">
                    <span className="font-bold">Fecha de regreso a oficina:</span>
                    <strong className="text-indigo-600 font-black uppercase text-[11px]">
                      {computedResults.returnDateSpanish}
                    </strong>
                  </div>
                </div>
              )}

              {/* Notes */}
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1 uppercase tracking-wider">
                  Comentarios / Observaciones
                </label>
                <textarea
                  rows={2}
                  className="w-full border border-gray-200 rounded-xl p-3 text-xs bg-white text-gray-800 focus:border-indigo-500 outline-none placeholder-gray-400 font-medium"
                  placeholder="Especifica el motivo o detalles de la solicitud..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </div>

              {/* Action Buttons */}
              <div className="flex justify-end gap-3 pt-4 border-t mt-4">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 border border-gray-200 text-gray-500 font-bold hover:bg-gray-50 rounded-xl text-xs transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={loading || !startDate || requestedDays <= 0}
                  className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs disabled:opacity-50 transition-colors shadow-sm"
                >
                  {loading ? 'Procesando...' : 'Registrar Solicitud'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
