import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Car, 
  User, 
  Calendar, 
  DollarSign, 
  Wrench, 
  Shield, 
  Clock, 
  Plus, 
  Trash2, 
  History, 
  CheckCircle2, 
  AlertTriangle, 
  X, 
  ChevronRight, 
  ArrowLeftRight, 
  UserPlus, 
  FileText, 
  CheckSquare, 
  Loader2,
  Search,
  SlidersHorizontal,
  FileCheck2,
  CalendarDays,
  Menu
} from 'lucide-react';
import { Employee, Vehicle, VehicleAssignment, VehicleEvent } from '../types';
import { 
  addVehicle, 
  updateVehicle, 
  deleteVehicle, 
  addVehicleAssignment, 
  addVehicleEvent, 
  deleteVehicleEvent 
} from '../services/dbService';

interface VehiclesProps {
  employees: Employee[];
  vehicles: Vehicle[];
  assignments: VehicleAssignment[];
  events: VehicleEvent[];
  isLoading: boolean;
  companyName: string;
}

export const Vehicles: React.FC<VehiclesProps> = ({ 
  employees, 
  vehicles, 
  assignments, 
  events, 
  isLoading,
  companyName
}) => {
  // Navigation / Selection States
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [selectedVehicle, setSelectedVehicle] = useState<Vehicle | null>(null);
  const [activeDetailTab, setActiveDetailTab] = useState<'movimientos' | 'gastos'>('movimientos');
  const [logCategory, setLogCategory] = useState<'Todos' | 'Asignaciones' | 'Servicios' | 'Seguros' | 'Refrendos' | 'Otros'>('Todos');
  const [isAssigning, setIsAssigning] = useState(false);

  // Filters State
  const [statusFilter, setStatusFilter] = useState<string>('Todos');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Form States - Add Vehicle (No icons, clean, formal)
  const [vehicleForm, setVehicleForm] = useState({
    brand: '',
    model: '',
    year: new Date().getFullYear(),
    plates: '',
    serialNumber: '',
    insurancePolicy: '',
    insuranceExpiry: '',
    status: 'Activo' as 'Activo' | 'En Taller' | 'Inactivo',
    initialEmployeeId: ''
  });

  // Form States - Log Event
  const [eventForm, setEventForm] = useState({
    type: 'Servicio' as 'Refrendo' | 'Servicio' | 'Seguro' | 'Reparación' | 'Otro',
    date: new Date().toISOString().split('T')[0],
    amount: 0,
    description: '',
    status: 'Pagado' as 'Pagado' | 'Pendiente' | 'N/A'
  });

  // Form States - Driver Assignment
  const [assignForm, setAssignForm] = useState({
    employeeId: '',
    notes: ''
  });

  const [driverSearchQuery, setDriverSearchQuery] = useState('');
  const [isDriverDropdownOpen, setIsDriverDropdownOpen] = useState(false);
  const [initialDriverSearchQuery, setInitialDriverSearchQuery] = useState('');
  const [isInitialDriverDropdownOpen, setIsInitialDriverDropdownOpen] = useState(false);

  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Filter employees eligible for driving (Executives, Supervisors, or Office staff)
  const eligibleDrivers = useMemo(() => {
    return employees.filter(emp => emp.category === 'Ejecutivos' || emp.category === 'Supervisoras' || emp.category === 'Oficina');
  }, [employees]);

  // Filter drivers based on search query in Assignment panel
  const filteredDrivers = useMemo(() => {
    if (!driverSearchQuery.trim()) return eligibleDrivers;
    const q = driverSearchQuery.toLowerCase().trim();
    return eligibleDrivers.filter(emp => {
      const fullName = `${emp.firstName} ${emp.lastName}`.toLowerCase();
      const category = emp.category.toLowerCase();
      return fullName.includes(q) || category.includes(q);
    });
  }, [eligibleDrivers, driverSearchQuery]);

  // Filter drivers based on search query in New Vehicle modal
  const filteredInitialDrivers = useMemo(() => {
    if (!initialDriverSearchQuery.trim()) return eligibleDrivers;
    const q = initialDriverSearchQuery.toLowerCase().trim();
    return eligibleDrivers.filter(emp => {
      const fullName = `${emp.firstName} ${emp.lastName}`.toLowerCase();
      const category = emp.category.toLowerCase();
      return fullName.includes(q) || category.includes(q);
    });
  }, [eligibleDrivers, initialDriverSearchQuery]);

  // Filtered vehicles based on search and status tabs
  const filteredVehicles = useMemo(() => {
    return vehicles.filter(v => {
      const matchesStatus = statusFilter === 'Todos' || v.status === statusFilter;
      
      const driver = employees.find(e => e.id === v.currentEmployeeId);
      const driverName = driver ? `${driver.firstName} ${driver.lastName}`.toLowerCase() : '';
      
      const query = searchQuery.toLowerCase().trim();
      const matchesSearch = !query || 
        v.brand.toLowerCase().includes(query) || 
        v.model.toLowerCase().includes(query) || 
        v.plates.toLowerCase().includes(query) ||
        (v.serialNumber && v.serialNumber.toLowerCase().includes(query)) ||
        driverName.includes(query);

      return matchesStatus && matchesSearch;
    });
  }, [vehicles, statusFilter, searchQuery, employees]);

  // Calculate Metrics/KPIs (Excluding Total Spent as requested)
  const metrics = useMemo(() => {
    const total = vehicles.length;
    const active = vehicles.filter(v => v.status === 'Activo').length;
    const workshop = vehicles.filter(v => v.status === 'En Taller').length;
    const assigned = vehicles.filter(v => v.currentEmployeeId).length;
    
    return { total, active, workshop, assigned };
  }, [vehicles]);

  // Handle Create Vehicle
  const handleCreateVehicle = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!vehicleForm.brand || !vehicleForm.model || !vehicleForm.plates) {
      alert('Por favor completa los campos obligatorios (Marca, Modelo, Placas)');
      return;
    }

    setSaving(true);
    try {
      const driver = employees.find(emp => emp.id === vehicleForm.initialEmployeeId);
      const vehicleData: Omit<Vehicle, 'id' | 'createdAt'> = {
        brand: vehicleForm.brand,
        model: vehicleForm.model,
        year: Number(vehicleForm.year) || new Date().getFullYear(),
        plates: vehicleForm.plates.toUpperCase().trim(),
        serialNumber: vehicleForm.serialNumber.trim() || undefined,
        insurancePolicy: vehicleForm.insurancePolicy.trim() || undefined,
        insuranceExpiry: vehicleForm.insuranceExpiry || undefined,
        currentEmployeeId: vehicleForm.initialEmployeeId || undefined,
        status: vehicleForm.status
      };

      const docRef = await addVehicle(vehicleData);

      // Create initial assignment log if a driver was selected
      if (vehicleForm.initialEmployeeId && driver) {
        await addVehicleAssignment({
          vehicleId: docRef.id,
          employeeId: vehicleForm.initialEmployeeId,
          employeeName: `${driver.firstName} ${driver.lastName}`,
          assignedAt: new Date().toISOString().split('T')[0],
          notes: 'Asignación inicial al registrar el vehículo'
        });
      }

      setIsAddModalOpen(false);
      setVehicleForm({
        brand: '',
        model: '',
        year: new Date().getFullYear(),
        plates: '',
        serialNumber: '',
        insurancePolicy: '',
        insuranceExpiry: '',
        status: 'Activo',
        initialEmployeeId: ''
      });
      setInitialDriverSearchQuery('');
    } catch (error) {
      console.error('Error saving vehicle:', error);
      alert('Ocurrió un error al guardar el vehículo');
    } finally {
      setSaving(false);
    }
  };

  // Handle Assign Driver
  const handleAssignDriver = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedVehicle) return;
    if (!assignForm.employeeId) {
      alert('Por favor selecciona un ejecutivo o supervisora');
      return;
    }

    setSaving(true);
    try {
      const newDriver = employees.find(emp => emp.id === assignForm.employeeId);
      if (!newDriver) throw new Error('Driver not found');

      const today = new Date().toISOString().split('T')[0];

      // Add new assignment
      await addVehicleAssignment({
        vehicleId: selectedVehicle.id,
        employeeId: assignForm.employeeId,
        employeeName: `${newDriver.firstName} ${newDriver.lastName}`,
        assignedAt: today,
        notes: assignForm.notes || 'Reasignación de vehículo'
      });

      // Update current employee link in vehicle
      await updateVehicle(selectedVehicle.id, {
        currentEmployeeId: assignForm.employeeId
      });

      // Update selected vehicle in state to reflect change in detail panel
      setSelectedVehicle(prev => prev ? { ...prev, currentEmployeeId: assignForm.employeeId } : null);

      setIsAssigning(false);
      setAssignForm({ employeeId: '', notes: '' });
      setDriverSearchQuery('');
      setIsDriverDropdownOpen(false);
    } catch (error) {
      console.error('Error assigning vehicle:', error);
      alert('Error al asignar el vehículo');
    } finally {
      setSaving(false);
    }
  };

  // Handle Unassign Driver
  const handleUnassignDriver = async () => {
    if (!selectedVehicle) return;
    if (!confirm('¿Seguro que deseas desvincular al conductor actual? El vehículo quedará disponible.')) return;

    setSaving(true);
    try {
      // Update vehicle reference
      await updateVehicle(selectedVehicle.id, {
        currentEmployeeId: undefined
      });

      // Update selected vehicle in state
      setSelectedVehicle(prev => prev ? { ...prev, currentEmployeeId: undefined } : null);
    } catch (error) {
      console.error('Error unassigning vehicle:', error);
      alert('Error al desvincular conductor');
    } finally {
      setSaving(false);
    }
  };

  // Handle Add Maintenance Event
  const handleAddEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedVehicle) return;
    if (!eventForm.description) {
      alert('Por favor ingresa una descripción del evento');
      return;
    }

    setSaving(true);
    try {
      await addVehicleEvent({
        vehicleId: selectedVehicle.id,
        type: eventForm.type,
        date: eventForm.date,
        amount: Number(eventForm.amount) || 0,
        description: eventForm.description,
        status: eventForm.status
      });

      setEventForm({
        type: 'Servicio',
        date: new Date().toISOString().split('T')[0],
        amount: 0,
        description: '',
        status: 'Pagado'
      });
    } catch (error) {
      console.error('Error logging event:', error);
      alert('Error al registrar el evento');
    } finally {
      setSaving(false);
    }
  };

  // Handle Delete Event
  const handleDeleteEvent = async (eventId: string) => {
    if (!confirm('¿Seguro que deseas eliminar este registro del historial?')) return;
    try {
      await deleteVehicleEvent(eventId);
    } catch (error) {
      console.error('Error deleting event:', error);
    }
  };

  // Handle Delete Vehicle
  const handleDeleteVehicle = async (vehicleId: string) => {
    if (!confirm('¿Seguro que deseas dar de baja este vehículo? Se perderán sus datos principales.')) return;
    setDeletingId(vehicleId);
    try {
      await deleteVehicle(vehicleId);
      if (selectedVehicle?.id === vehicleId) {
        setSelectedVehicle(null);
      }
    } catch (error) {
      console.error('Error deleting vehicle:', error);
    } finally {
      setDeletingId(null);
    }
  };

  // Handle Change Vehicle Status
  const handleUpdateStatus = async (vehicleId: string, newStatus: 'Activo' | 'En Taller' | 'Inactivo') => {
    try {
      await updateVehicle(vehicleId, { status: newStatus });
      if (selectedVehicle?.id === vehicleId) {
        setSelectedVehicle(prev => prev ? { ...prev, status: newStatus } : null);
      }
    } catch (error) {
      console.error('Error updating status:', error);
    }
  };

  // Get chronological events for selected vehicle
  const currentVehicleLogs = useMemo(() => {
    if (!selectedVehicle) return { assignments: [], events: [] };
    
    const vehicleAssignments = assignments
      .filter(a => a.vehicleId === selectedVehicle.id)
      .sort((a, b) => b.assignedAt.localeCompare(a.assignedAt));

    const vehicleEvents = events
      .filter(e => e.vehicleId === selectedVehicle.id)
      .sort((a, b) => b.date.localeCompare(a.date));

    return {
      assignments: vehicleAssignments,
      events: vehicleEvents
    };
  }, [selectedVehicle, assignments, events]);

  // Years for Refrendo checking
  const refrendoYears = useMemo(() => {
    const currentYear = new Date().getFullYear();
    return [currentYear, currentYear - 1, currentYear - 2];
  }, []);

  // Helper to determine if Refrendo is paid for a specific year
  const isRefrendoPaid = (vehicleId: string, year: number) => {
    const yearStr = year.toString();
    return events.some(
      e => e.vehicleId === vehicleId && 
      e.type === 'Refrendo' && 
      (e.description.includes(yearStr) || e.date.startsWith(yearStr)) &&
      e.status === 'Pagado'
    );
  };

  return (
    <div className="p-6 max-w-7xl mx-auto h-full flex flex-col space-y-6 overflow-y-auto">
      
      {/* HEADER */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-gray-100 pb-5">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 tracking-tight">
            Autos de {companyName || 'la Financiera'}
          </h2>
          <p className="text-xs text-gray-400 font-medium mt-1 uppercase tracking-wider">
            Control de flota corporativa, bitácora de conductores e historial técnico
          </p>
        </div>
        
        <button 
          onClick={() => setIsAddModalOpen(true)}
          className="bg-gray-900 hover:bg-gray-800 text-white px-4 py-2.5 rounded-xl font-bold text-xs flex items-center shadow transition-all self-start md:self-center"
        >
          <Plus className="w-4 h-4 mr-1.5" /> Registrar Vehículo
        </button>
      </div>

      {/* METRICS PANEL (3 Columns, clean, no background fluff, modern flat cards) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-gray-50 border border-gray-200/60 rounded-xl p-4 flex items-center justify-between">
          <div>
            <span className="text-[10px] text-gray-400 font-bold block uppercase tracking-wider">Flota Total</span>
            <span className="text-xl font-bold text-gray-800">{metrics.total} Vehículos</span>
          </div>
          <span className="text-xs font-bold text-indigo-600 bg-indigo-50 px-2 py-1 rounded-md">General</span>
        </div>

        <div className="bg-gray-50 border border-gray-200/60 rounded-xl p-4 flex items-center justify-between">
          <div>
            <span className="text-[10px] text-gray-400 font-bold block uppercase tracking-wider">En Operación Activa</span>
            <span className="text-xl font-bold text-gray-800">{metrics.assigned} en Uso</span>
          </div>
          <span className="text-xs font-bold text-green-600 bg-green-50 px-2 py-1 rounded-md">Asignados</span>
        </div>

        <div className="bg-gray-50 border border-gray-200/60 rounded-xl p-4 flex items-center justify-between">
          <div>
            <span className="text-[10px] text-gray-400 font-bold block uppercase tracking-wider">En Mantenimiento</span>
            <span className="text-xl font-bold text-gray-800">{metrics.workshop} en Taller</span>
          </div>
          <span className="text-xs font-bold text-amber-600 bg-amber-50 px-2 py-1 rounded-md">Taller</span>
        </div>
      </div>

      {/* SEARCH & FILTERS BAR */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-2 border border-gray-200 rounded-xl">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
          <input 
            type="text" 
            placeholder="Buscar por marca, modelo, placas, conductor..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-transparent pl-9 pr-4 py-2 text-xs font-medium text-gray-800 placeholder-gray-400 outline-none"
          />
        </div>

        <div className="flex items-center gap-1.5 border-t sm:border-t-0 pt-2 sm:pt-0 shrink-0">
          <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider px-2 flex items-center gap-1">
            <SlidersHorizontal className="w-3.5 h-3.5" /> Estado:
          </span>
          {['Todos', 'Activo', 'En Taller', 'Inactivo'].map(st => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                statusFilter === st 
                  ? 'bg-gray-100 text-gray-900 border border-gray-200' 
                  : 'text-gray-500 hover:bg-gray-50 border border-transparent'
              }`}
            >
              {st}
            </button>
          ))}
        </div>
      </div>

      {/* CORE CONTENT LAYOUT: COMPACT LISTING TABLE */}
      <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
          {isLoading ? (
            <div className="p-12 text-center">
              <Loader2 className="w-8 h-8 text-gray-800 animate-spin mx-auto mb-3" />
              <p className="text-xs text-gray-500 font-medium">Sincronizando flota corporativa...</p>
            </div>
          ) : filteredVehicles.length === 0 ? (
            <div className="p-16 text-center">
              <Car className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <h4 className="text-sm font-bold text-gray-700">No se encontraron autos</h4>
              <p className="text-xs text-gray-400 max-w-sm mx-auto mt-1">
                Ajusta los filtros de búsqueda o registra un nuevo vehículo oficial.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-gray-50/75 border-b border-gray-200 text-[10px] text-gray-400 font-bold uppercase tracking-wider">
                    <th className="py-3 px-4">Automóvil</th>
                    <th className="py-3 px-4">Placas</th>
                    <th className="py-3 px-4">Conductor Asignado</th>
                    <th className="py-3 px-4">Refrendos</th>
                    <th className="py-3 px-4">Estado</th>
                    <th className="py-3 px-4 text-right">Detalles</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-150">
                  {filteredVehicles.map(v => {
                    const driver = employees.find(e => e.id === v.currentEmployeeId);
                    const isSelected = selectedVehicle?.id === v.id;

                    return (
                      <tr 
                        key={v.id}
                        onClick={() => setSelectedVehicle(isSelected ? null : v)}
                        className={`hover:bg-gray-50/60 transition-colors cursor-pointer text-xs ${
                          isSelected ? 'bg-indigo-50/20 font-medium' : ''
                        }`}
                      >
                        {/* Car detail */}
                        <td className="py-3 px-4">
                          <div className="font-bold text-gray-800">{v.brand} {v.model}</div>
                          <div className="text-[10px] text-gray-400 font-medium mt-0.5">Modelo {v.year}</div>
                        </td>

                        {/* Plates */}
                        <td className="py-3 px-4 font-mono font-bold text-gray-700">
                          <span className="bg-gray-100 px-2 py-0.5 rounded border border-gray-200">
                            {v.plates}
                          </span>
                        </td>

                        {/* Driver */}
                        <td className="py-3 px-4">
                          {driver ? (
                            <div className="flex items-center gap-1.5">
                              <User className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                              <div>
                                <span className="font-semibold text-gray-700">{driver.firstName} {driver.lastName}</span>
                                <span className="text-[9px] text-gray-400 block">{driver.category}</span>
                              </div>
                            </div>
                          ) : (
                            <span className="text-[11px] text-amber-600 font-medium flex items-center gap-1">
                              <AlertTriangle className="w-3.5 h-3.5 shrink-0" /> Oficina / Disponible
                            </span>
                          )}
                        </td>

                        {/* Refrendos */}
                        <td className="py-3 px-4">
                          <div className="flex gap-1">
                            {refrendoYears.map(yr => {
                              const paid = isRefrendoPaid(v.id, yr);
                              return (
                                <span 
                                  key={yr}
                                  className={`text-[9px] font-bold px-1 py-0.2 rounded-md ${
                                    paid 
                                      ? 'bg-green-50 text-green-700 border border-green-150' 
                                      : 'bg-rose-50 text-rose-700 border border-rose-100'
                                  }`}
                                  title={`Refrendo ${yr}: ${paid ? 'Pagado' : 'Pendiente'}`}
                                >
                                  {yr.toString().slice(-2)}
                                </span>
                              );
                            })}
                          </div>
                        </td>

                        {/* Status */}
                        <td className="py-3 px-4">
                          <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            v.status === 'Activo' 
                              ? 'bg-green-50 text-green-700' 
                              : v.status === 'En Taller' 
                              ? 'bg-amber-50 text-amber-700' 
                              : 'bg-gray-100 text-gray-700'
                          }`}>
                            {v.status}
                          </span>
                        </td>

                        {/* Row Detail Link */}
                        <td className="py-3 px-4 text-right">
                          <button 
                            className={`p-1.5 rounded-lg transition-colors ${
                              isSelected ? 'bg-indigo-100 text-indigo-700' : 'text-gray-400 hover:bg-gray-100'
                            }`}
                          >
                            <ChevronRight className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
      </div>

      {/* SELECTED VEHICLE DETAIL MODAL (Elegant & Professional Overlay) */}
        <AnimatePresence>
          {selectedVehicle && (
            <div className="fixed inset-0 bg-black/45 flex items-center justify-center p-4 z-50 overflow-y-auto" onClick={(e) => {
              if (e.target === e.currentTarget) setSelectedVehicle(null);
            }}>
              <motion.div 
                initial={{ scale: 0.97, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.97, opacity: 0 }}
                onClick={(e) => e.stopPropagation()}
                className="bg-white rounded-2xl w-full max-w-2xl p-6 shadow-2xl border border-gray-150 flex flex-col my-auto max-h-[92vh] space-y-5 overflow-y-auto text-left"
              >
              {/* Card Title Header */}
              <div className="flex items-start justify-between border-b border-gray-100 pb-4">
                <div>
                  <h3 className="text-base font-bold text-gray-800">
                    {selectedVehicle.brand} {selectedVehicle.model}
                  </h3>
                  <p className="text-[10px] font-mono text-gray-400 font-bold mt-1 uppercase tracking-wider">
                    Placas: {selectedVehicle.plates} | Año {selectedVehicle.year}
                  </p>
                </div>
                <button 
                  onClick={() => setSelectedVehicle(null)}
                  className="p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-50 rounded-lg"
                >
                  <X className="w-4.5 h-4.5" />
                </button>
              </div>

              {/* COMPACT DETAIL GRID */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {/* Estatus & Deletion */}
                <div className="bg-gray-50/50 p-2.5 rounded-xl border border-gray-150 flex flex-col justify-between">
                  <div>
                    <span className="text-[9px] text-gray-400 font-bold block uppercase tracking-wider">Estatus del Auto</span>
                    <select 
                      value={selectedVehicle.status}
                      onChange={(e) => handleUpdateStatus(selectedVehicle.id, e.target.value as any)}
                      className="border border-gray-200 rounded-lg px-1.5 py-0.5 mt-1 text-[11px] font-bold text-gray-750 bg-white w-full outline-none focus:border-gray-450"
                    >
                      <option value="Activo">🟢 Activo</option>
                      <option value="En Taller">🟡 En Taller</option>
                      <option value="Inactivo">🔴 Inactivo</option>
                    </select>
                  </div>
                  <button 
                    onClick={() => handleDeleteVehicle(selectedVehicle.id)}
                    disabled={deletingId === selectedVehicle.id}
                    className="mt-2 text-rose-600 hover:text-rose-700 hover:bg-rose-50 px-2 py-1 rounded-lg text-[9px] font-bold border border-rose-100 transition-colors flex items-center justify-center w-full"
                  >
                    <Trash2 className="w-3 h-3 mr-1" /> Dar de Baja
                  </button>
                </div>

                {/* Technical specs (VIN) */}
                <div className="bg-gray-50/50 p-2.5 rounded-xl border border-gray-150 flex flex-col justify-between">
                  <div>
                    <span className="text-[9px] text-gray-400 font-bold block uppercase tracking-wider">No. de Serie (VIN)</span>
                    <span className="font-mono font-bold text-gray-700 truncate block mt-1.5 break-all text-[10px]" title={selectedVehicle.serialNumber}>
                      {selectedVehicle.serialNumber || 'No Registrado'}
                    </span>
                  </div>
                </div>

                {/* Insurance policy */}
                <div className="bg-gray-50/50 p-2.5 rounded-xl border border-gray-150 flex flex-col justify-between">
                  <div>
                    <span className="text-[9px] text-gray-400 font-bold block uppercase tracking-wider">Póliza de Seguro</span>
                    <span className="font-semibold text-gray-750 block truncate mt-1 text-[11px]" title={selectedVehicle.insurancePolicy}>
                      {selectedVehicle.insurancePolicy || 'No Registrada'}
                    </span>
                    {selectedVehicle.insuranceExpiry && (
                      <span className="text-[9px] text-amber-600 font-bold block mt-0.5">
                        Vence: {selectedVehicle.insuranceExpiry}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* COMPACT DRIVER CONNECTION PANEL */}
              <div className="bg-gray-50/55 p-3 rounded-xl border border-gray-150 flex flex-col gap-2.5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <User className="w-4 h-4 text-gray-400 shrink-0" />
                    <div>
                      <span className="text-[9px] text-gray-400 font-bold block uppercase tracking-wider">Conductor Asignado</span>
                      {selectedVehicle.currentEmployeeId ? (
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className="text-xs font-bold text-gray-800">
                            {employees.find(e => e.id === selectedVehicle.currentEmployeeId)?.firstName}{' '}
                            {employees.find(e => e.id === selectedVehicle.currentEmployeeId)?.lastName}
                          </span>
                          <span className="text-[9px] bg-gray-100 text-gray-400 px-1.5 py-0.2 rounded font-bold uppercase tracking-wider">
                            {employees.find(e => e.id === selectedVehicle.currentEmployeeId)?.category}
                          </span>
                        </div>
                      ) : (
                        <span className="text-xs font-bold text-amber-700 block mt-0.5">
                          Oficina (Disponible)
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5">
                    {selectedVehicle.currentEmployeeId && (
                      <button 
                        onClick={handleUnassignDriver}
                        className="text-gray-500 hover:text-rose-600 hover:bg-white px-2 py-1 rounded-lg text-[10px] font-bold border border-gray-200 transition-colors"
                      >
                        Desvincular
                      </button>
                    )}
                    <button 
                      onClick={() => setIsAssigning(!isAssigning)}
                      className="bg-gray-900 hover:bg-gray-800 text-white px-2.5 py-1 rounded-lg text-[10px] font-bold shadow-sm flex items-center transition-all"
                    >
                      <ArrowLeftRight className="w-3 h-3 mr-1" /> Reasignar
                    </button>
                  </div>
                </div>

                {/* SEARCH COMPACT AUTOCOMPLETE DROPDOWN */}
                <AnimatePresence>
                  {isAssigning && (
                    <motion.form 
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      onSubmit={handleAssignDriver}
                      className="border-t border-gray-150 pt-3 space-y-3 overflow-hidden"
                    >
                      <div className="relative">
                        <label className="block text-[10px] font-bold text-gray-500 mb-1 uppercase tracking-wider">Buscar Empleado / Conductor (Ejecutivo, Supervisora, Oficina) *</label>
                        <div className="relative">
                          <input 
                            type="text"
                            required
                            placeholder="Buscar por nombre o cargo..."
                            value={driverSearchQuery}
                            onFocus={() => setIsDriverDropdownOpen(true)}
                            onChange={(e) => {
                              setDriverSearchQuery(e.target.value);
                              setIsDriverDropdownOpen(true);
                              if (!e.target.value.trim()) {
                                setAssignForm(prev => ({ ...prev, employeeId: '' }));
                              }
                            }}
                            className="w-full border border-gray-200 rounded-lg p-2 text-xs bg-white pr-8 outline-none focus:border-gray-400 font-semibold text-gray-700"
                          />
                          {assignForm.employeeId && (
                            <button
                              type="button"
                              onClick={() => {
                                setDriverSearchQuery('');
                                setAssignForm(prev => ({ ...prev, employeeId: '' }));
                              }}
                              className="absolute right-2.5 top-2 text-gray-400 hover:text-gray-600"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>

                        {isDriverDropdownOpen && (
                          <>
                            <div className="fixed inset-0 z-10" onClick={() => setIsDriverDropdownOpen(false)} />
                            <motion.div 
                              initial={{ opacity: 0, y: -5 }}
                              animate={{ opacity: 1, y: 0 }}
                              exit={{ opacity: 0, y: -5 }}
                              className="absolute z-20 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-36 overflow-y-auto"
                            >
                              {filteredDrivers.length === 0 ? (
                                <div className="p-2 text-[11px] text-gray-400 text-center font-medium">
                                  No hay coincidencias
                                </div>
                              ) : (
                                filteredDrivers.map(emp => (
                                  <button
                                    key={emp.id}
                                    type="button"
                                    onClick={() => {
                                      setAssignForm(prev => ({ ...prev, employeeId: emp.id }));
                                      setDriverSearchQuery(`${emp.firstName} ${emp.lastName}`);
                                      setIsDriverDropdownOpen(false);
                                    }}
                                    className="w-full text-left px-3 py-2 text-xs font-semibold hover:bg-gray-50 flex items-center justify-between text-gray-700"
                                  >
                                    <span>{emp.firstName} {emp.lastName}</span>
                                    <span className="text-[9px] bg-gray-100 text-gray-400 px-1.5 py-0.2 rounded font-bold uppercase">
                                      {emp.category}
                                    </span>
                                  </button>
                                ))
                              )}
                            </motion.div>
                          </>
                        )}
                      </div>

                      <div>
                        <label className="block text-[10px] font-bold text-gray-500 mb-1 uppercase tracking-wider">Notas de Entrega</label>
                        <input 
                          type="text" 
                          placeholder="Ej. Se entrega limpio y con seguro al día"
                          value={assignForm.notes}
                          onChange={(e) => setAssignForm(prev => ({ ...prev, notes: e.target.value }))}
                          className="w-full border border-gray-200 rounded-lg p-2 text-xs bg-white font-medium text-gray-700 outline-none"
                        />
                      </div>

                      <div className="flex justify-end gap-1.5 pt-1.5">
                        <button 
                          type="button" 
                          onClick={() => setIsAssigning(false)}
                          className="px-2.5 py-1.5 text-[10px] font-bold text-gray-400 hover:bg-gray-100 rounded-lg"
                        >
                          Cancelar
                        </button>
                        <button 
                          type="submit" 
                          disabled={saving}
                          className="bg-gray-900 hover:bg-gray-800 text-white px-3 py-1.5 rounded-lg text-[10px] font-bold shadow-sm"
                        >
                          Confirmar Asignación
                        </button>
                      </div>
                    </motion.form>
                  )}
                </AnimatePresence>
              </div>

              {/* TAB SELECTION FOR HISTORY / LOGS */}
              <div className="border-b border-gray-150 flex items-center gap-1">
                <button
                  onClick={() => setActiveDetailTab('movimientos')}
                  className={`px-3 py-2 text-xs font-bold border-b-2 transition-all flex items-center gap-1.5 ${
                    activeDetailTab === 'movimientos' 
                      ? 'border-gray-800 text-gray-900' 
                      : 'border-transparent text-gray-400 hover:text-gray-600'
                  }`}
                >
                  <History className="w-3.5 h-3.5" /> Bitácora & Trámites
                </button>
                <button
                  onClick={() => setActiveDetailTab('gastos')}
                  className={`px-3 py-2 text-xs font-bold border-b-2 transition-all flex items-center gap-1.5 ${
                    activeDetailTab === 'gastos' 
                      ? 'border-gray-800 text-gray-900' 
                      : 'border-transparent text-gray-400 hover:text-gray-600'
                  }`}
                >
                  <Wrench className="w-3.5 h-3.5" /> Registrar Gasto/Trámite
                </button>
              </div>

              {/* TAB CONTENTS */}
              <div>
                {activeDetailTab === 'movimientos' ? (
                  <div className="space-y-3.5">
                    {/* CATEGORY SUB-TABS (Horizontal scrollable pill list) */}
                    <div className="flex items-center gap-1 overflow-x-auto pb-1.5 border-b border-gray-100 scrollbar-none shrink-0 select-none">
                      {([
                        { value: 'Todos', label: 'Todos' },
                        { value: 'Asignaciones', label: 'Conductores' },
                        { value: 'Servicios', label: 'Servicio/Taller' },
                        { value: 'Seguros', label: 'Seguros' },
                        { value: 'Refrendos', label: 'Refrendos' },
                        { value: 'Otros', label: 'Otros' }
                      ] as const).map(cat => (
                        <button
                          key={cat.value}
                          type="button"
                          onClick={() => setLogCategory(cat.value)}
                          className={`px-2.5 py-1 rounded-full text-[10px] font-bold shrink-0 transition-all ${
                            logCategory === cat.value 
                              ? 'bg-gray-800 text-white shadow-sm' 
                              : 'bg-gray-50 text-gray-400 hover:text-gray-600 hover:bg-gray-100 border border-gray-200'
                          }`}
                        >
                          {cat.label}
                        </button>
                      ))}
                    </div>

                    <div className="max-h-64 overflow-y-auto pr-1 space-y-2">
                      {(() => {
                        const allLogs = [
                          ...currentVehicleLogs.assignments.map(a => ({
                            id: a.id,
                            type: 'assignment' as const,
                            eventType: 'assignment' as const,
                            date: a.assignedAt,
                            title: `Asignación: ${a.employeeName}`,
                            notes: a.notes,
                            meta: a.returnedAt ? `Devuelto: ${a.returnedAt}` : 'Conductor activo',
                            icon: User,
                            colorStyle: 'bg-indigo-50 border-indigo-150 text-indigo-700'
                          })),
                          ...currentVehicleLogs.events.map(e => ({
                            id: e.id,
                            type: 'event' as const,
                            eventType: e.type,
                            date: e.date,
                            title: `${e.type}: ${e.description}`,
                            notes: `Estatus: ${e.status}`,
                            meta: e.amount > 0 ? `$${Number(e.amount).toLocaleString('es-MX', { minimumFractionDigits: 2 })}` : 'Sin Costo',
                            icon: e.type === 'Servicio' ? Wrench : e.type === 'Seguro' ? Shield : e.type === 'Refrendo' ? CheckSquare : e.type === 'Reparación' ? Wrench : DollarSign,
                            colorStyle: e.type === 'Servicio' ? 'bg-amber-50 border-amber-100 text-amber-700' : e.type === 'Seguro' ? 'bg-blue-50 border-blue-100 text-blue-700' : e.type === 'Refrendo' ? 'bg-green-50 border-green-100 text-green-700' : e.type === 'Reparación' ? 'bg-orange-50 border-orange-100 text-orange-700' : 'bg-purple-50 border-purple-100 text-purple-700'
                          }))
                        ].sort((a, b) => b.date.localeCompare(a.date));

                        const filteredLogs = allLogs.filter(item => {
                          if (logCategory === 'Todos') return true;
                          if (logCategory === 'Asignaciones') return item.type === 'assignment';
                          if (logCategory === 'Servicios') return item.type === 'event' && (item.eventType === 'Servicio' || item.eventType === 'Reparación');
                          if (logCategory === 'Seguros') return item.type === 'event' && item.eventType === 'Seguro';
                          if (logCategory === 'Refrendos') return item.type === 'event' && item.eventType === 'Refrendo';
                          if (logCategory === 'Otros') return item.type === 'event' && item.eventType === 'Otro';
                          return true;
                        });

                        if (filteredLogs.length === 0) {
                          return (
                            <div className="text-center py-12 text-gray-400 text-[11px] font-medium">
                              Sin registros en la categoría "{logCategory === 'Todos' ? 'Historial' : logCategory}"
                            </div>
                          );
                        }

                        return filteredLogs.map((item, idx) => {
                          const Icon = item.icon;
                          return (
                            <div key={idx} className="bg-gray-50/50 hover:bg-gray-50 border border-gray-150 rounded-xl p-3 text-[11px] relative group transition-all">
                              <div className="flex items-start justify-between gap-1.5">
                                <div className="flex items-center gap-1.5">
                                  <span className="text-[9px] font-mono font-bold bg-white border border-gray-200 px-1.5 py-0.2 rounded text-gray-400">
                                    {item.date}
                                  </span>
                                  <span className={`px-1.5 py-0.2 rounded-md text-[9px] font-bold ${item.colorStyle}`}>
                                    {item.meta}
                                  </span>
                                </div>

                                {item.type === 'event' && (
                                  <button 
                                    onClick={() => handleDeleteEvent(item.id)}
                                    className="text-gray-300 hover:text-rose-600 opacity-0 group-hover:opacity-100 transition-opacity p-0.5"
                                    title="Eliminar del historial"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                )}
                              </div>

                              <h5 className="font-bold text-gray-800 mt-2 flex items-center gap-1">
                                <Icon className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                                {item.title}
                              </h5>

                              {item.notes && (
                                <p className="text-[10px] text-gray-400 mt-1 italic pl-4.5 border-l border-gray-200">
                                  {item.notes}
                                </p>
                              )}
                            </div>
                          );
                        });
                      })()}
                    </div>
                  </div>
                ) : (
                  // REGISTRATION EVENT LOG (Clean, distraction free)
                  <form onSubmit={handleAddEvent} className="space-y-3.5 text-xs">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Tipo de Evento *</label>
                        <select 
                          value={eventForm.type}
                          onChange={(e) => setEventForm(prev => ({ ...prev, type: e.target.value as any }))}
                          className="w-full border border-gray-200 rounded-xl p-2 bg-white text-xs font-semibold text-gray-700 outline-none"
                        >
                          <option value="Servicio">Mantenimiento / Servicio</option>
                          <option value="Refrendo">Pago de Refrendo Anual</option>
                          <option value="Seguro">Pago de Seguro</option>
                          <option value="Reparación">Reparación / Taller</option>
                          <option value="Otro">Otro Trámite / Gasto</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Fecha *</label>
                        <input 
                          type="date" 
                          required
                          value={eventForm.date}
                          onChange={(e) => setEventForm(prev => ({ ...prev, date: e.target.value }))}
                          className="w-full border border-gray-200 rounded-xl p-2 bg-white text-xs font-semibold text-gray-700 outline-none"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Costo / Monto ($ MXN)</label>
                        <input 
                          type="number" 
                          min="0"
                          step="any"
                          placeholder="0.00"
                          value={eventForm.amount || ''}
                          onChange={(e) => setEventForm(prev => ({ ...prev, amount: Number(e.target.value) }))}
                          className="w-full border border-gray-200 rounded-xl p-2 text-xs font-semibold text-gray-800 outline-none"
                        />
                      </div>

                      <div>
                        <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Estatus del Gasto</label>
                        <select
                          value={eventForm.status}
                          onChange={(e) => setEventForm(prev => ({ ...prev, status: e.target.value as any }))}
                          className="w-full border border-gray-200 rounded-xl p-2 bg-white text-xs font-semibold text-gray-700 outline-none"
                        >
                          <option value="Pagado">Pagado</option>
                          <option value="Pendiente">Pendiente</option>
                          <option value="N/A">N/A (Solo Registro)</option>
                        </select>
                      </div>
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Descripción / Notas *</label>
                      <textarea 
                        required
                        placeholder="Ej. Cambio de balatas, Seguro cobertura amplia, Refrendo 2026..."
                        rows={2}
                        value={eventForm.description}
                        onChange={(e) => setEventForm(prev => ({ ...prev, description: e.target.value }))}
                        className="w-full border border-gray-200 rounded-xl p-2 text-xs font-medium text-gray-700 outline-none resize-none focus:border-gray-400"
                      />
                    </div>

                    <button 
                      type="submit" 
                      disabled={saving}
                      className="w-full bg-gray-900 hover:bg-gray-800 text-white py-2.5 rounded-xl font-bold text-[11px] shadow transition-all flex items-center justify-center"
                    >
                      {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" /> : null}
                      Guardar en Bitácora
                    </button>
                  </form>
                )}
              </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

      {/* FORMAL VEHICLE REGISTRATION MODAL (Icon-free as requested) */}
      <AnimatePresence>
        {isAddModalOpen && (
          <div className="fixed inset-0 bg-black/45 flex items-center justify-center p-4 z-50 overflow-y-auto">
            <motion.div 
              initial={{ scale: 0.97, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.97, opacity: 0 }}
              className="bg-white rounded-2xl w-full max-w-lg p-6 shadow-2xl border border-gray-150 flex flex-col my-auto max-h-[92vh]"
            >
              <div className="flex items-center justify-between border-b border-gray-100 pb-4 mb-4">
                <h3 className="text-lg font-bold text-gray-900 tracking-tight">Registrar Nuevo Vehículo</h3>
                <button onClick={() => setIsAddModalOpen(false)} className="text-gray-400 hover:text-gray-600 p-1 rounded-lg">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleCreateVehicle} className="space-y-4 overflow-y-auto pr-1 flex-1 text-xs">
                
                <div className="grid grid-cols-2 gap-3.5">
                  <div>
                    <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Marca *</label>
                    <input 
                      type="text" 
                      required
                      placeholder="Ej. Nissan, Toyota..."
                      value={vehicleForm.brand}
                      onChange={(e) => setVehicleForm(prev => ({ ...prev, brand: e.target.value }))}
                      className="w-full border border-gray-200 rounded-xl p-2.5 text-xs font-semibold text-gray-700 outline-none focus:border-gray-400"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Modelo *</label>
                    <input 
                      type="text" 
                      required
                      placeholder="Ej. Versa, Hilux..."
                      value={vehicleForm.model}
                      onChange={(e) => setVehicleForm(prev => ({ ...prev, model: e.target.value }))}
                      className="w-full border-2 border-gray-100 rounded-xl p-2.5 text-xs font-semibold text-gray-700 outline-none focus:border-gray-400"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3.5">
                  <div>
                    <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Año *</label>
                    <input 
                      type="number" 
                      required
                      min="1995"
                      max={new Date().getFullYear() + 2}
                      value={vehicleForm.year}
                      onChange={(e) => setVehicleForm(prev => ({ ...prev, year: Number(e.target.value) }))}
                      className="w-full border-2 border-gray-100 rounded-xl p-2.5 text-xs font-bold text-gray-800 outline-none focus:border-gray-400"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Placas *</label>
                    <input 
                      type="text" 
                      required
                      placeholder="Ej. PL-123-A"
                      value={vehicleForm.plates}
                      onChange={(e) => setVehicleForm(prev => ({ ...prev, plates: e.target.value.toUpperCase() }))}
                      className="w-full border-2 border-gray-100 rounded-xl p-2.5 text-xs font-mono font-bold text-gray-800 outline-none focus:border-gray-400"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Número de Serie (VIN / Chasis)</label>
                  <input 
                    type="text" 
                    placeholder="Número de identificación del vehículo..."
                    value={vehicleForm.serialNumber}
                    onChange={(e) => setVehicleForm(prev => ({ ...prev, serialNumber: e.target.value }))}
                    className="w-full border border-gray-200 rounded-xl p-2.5 text-xs font-mono font-semibold text-gray-700 outline-none focus:border-gray-400"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3.5">
                  <div>
                    <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Póliza de Seguro</label>
                    <input 
                      type="text" 
                      placeholder="No. Póliza y Aseguradora"
                      value={vehicleForm.insurancePolicy}
                      onChange={(e) => setVehicleForm(prev => ({ ...prev, insurancePolicy: e.target.value }))}
                      className="w-full border border-gray-200 rounded-xl p-2.5 text-xs font-semibold text-gray-700 outline-none focus:border-gray-400"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Vencimiento del Seguro</label>
                    <input 
                      type="date" 
                      value={vehicleForm.insuranceExpiry}
                      onChange={(e) => setVehicleForm(prev => ({ ...prev, insuranceExpiry: e.target.value }))}
                      className="w-full border border-gray-200 rounded-xl p-2.5 text-xs font-semibold text-gray-700 outline-none focus:border-gray-400"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3.5">
                  <div>
                    <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Estado de Operación Inicial</label>
                    <select 
                      value={vehicleForm.status}
                      onChange={(e) => setVehicleForm(prev => ({ ...prev, status: e.target.value as any }))}
                      className="w-full border border-gray-200 rounded-xl p-2.5 bg-white text-xs font-bold text-gray-700 outline-none"
                    >
                      <option value="Activo">Activo</option>
                      <option value="En Taller">En Taller</option>
                      <option value="Inactivo">Inactivo</option>
                    </select>
                  </div>

                  {/* AUTOCOMPLETE DROPDOWN SEARCH FOR DRIVER */}
                  <div className="relative">
                    <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Vincular Conductor Inicial</label>
                    <div className="relative">
                      <input 
                        type="text"
                        placeholder="Buscar conductor..."
                        value={initialDriverSearchQuery}
                        onFocus={() => setIsInitialDriverDropdownOpen(true)}
                        onChange={(e) => {
                          setInitialDriverSearchQuery(e.target.value);
                          setIsInitialDriverDropdownOpen(true);
                          if (!e.target.value.trim()) {
                            setVehicleForm(prev => ({ ...prev, initialEmployeeId: '' }));
                          }
                        }}
                        className="w-full border border-gray-200 rounded-xl p-2.5 text-xs font-semibold text-gray-700 outline-none focus:border-gray-400 pr-8"
                      />
                      {vehicleForm.initialEmployeeId && (
                        <button
                          type="button"
                          onClick={() => {
                            setInitialDriverSearchQuery('');
                            setVehicleForm(prev => ({ ...prev, initialEmployeeId: '' }));
                          }}
                          className="absolute right-2.5 top-2.5 text-gray-400 hover:text-gray-600"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>

                    {isInitialDriverDropdownOpen && (
                      <>
                        <div className="fixed inset-0 z-10" onClick={() => setIsInitialDriverDropdownOpen(false)} />
                        <motion.div 
                          initial={{ opacity: 0, y: -5 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -5 }}
                          className="absolute z-20 w-full mt-1 bg-white border border-gray-200 rounded-xl shadow-xl max-h-36 overflow-y-auto"
                        >
                          {filteredInitialDrivers.length === 0 ? (
                            <div className="p-2 text-[10px] text-gray-400 text-center font-semibold">
                              Sin coincidencias
                            </div>
                          ) : (
                            filteredInitialDrivers.map(emp => (
                              <button
                                key={emp.id}
                                type="button"
                                onClick={() => {
                                  setVehicleForm(prev => ({ ...prev, initialEmployeeId: emp.id }));
                                  setInitialDriverSearchQuery(`${emp.firstName} ${emp.lastName}`);
                                  setIsInitialDriverDropdownOpen(false);
                                }}
                                className="w-full text-left px-3 py-2 text-xs font-bold hover:bg-gray-50 flex items-center justify-between text-gray-700"
                              >
                                <span>{emp.firstName} {emp.lastName}</span>
                                <span className="text-[9px] bg-gray-100 text-gray-400 px-1.5 py-0.2 rounded font-bold uppercase">
                                  {emp.category}
                                </span>
                              </button>
                            ))
                          )}
                        </motion.div>
                      </>
                    )}
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-4 border-t border-gray-100">
                  <button 
                    type="button" 
                    onClick={() => setIsAddModalOpen(false)}
                    className="px-4 py-2.5 text-xs font-bold text-gray-500 hover:bg-gray-100 rounded-xl"
                  >
                    Cancelar
                  </button>
                  <button 
                    type="submit" 
                    disabled={saving}
                    className="bg-gray-900 hover:bg-gray-800 text-white px-5 py-2.5 rounded-xl font-bold text-xs shadow transition-all flex items-center"
                  >
                    {saving ? <Loader2 className="w-4 h-4 animate-spin mr-1.5" /> : null}
                    Confirmar Registro
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
};
