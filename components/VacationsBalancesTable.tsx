import React, { useState, useMemo, useEffect } from 'react';
import { Search, Settings } from 'lucide-react';
import { Employee, VacationRequest } from '../types';

interface VacationsBalancesTableProps {
  employees: Employee[];
  vacationRequests: VacationRequest[];
}

export const VacationsBalancesTable: React.FC<VacationsBalancesTableProps> = ({ employees, vacationRequests }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('TODOS');
  const [daysPerYear, setDaysPerYear] = useState<number>(() => {
    const saved = localStorage.getItem('vacationDaysPerYear');
    return saved ? parseInt(saved, 10) : 12;
  });
  const [isConfigModalOpen, setIsConfigModalOpen] = useState(false);
  const [tempDaysValue, setTempDaysValue] = useState<string>(String(daysPerYear));

  // Keep state updated if changed elsewhere
  useEffect(() => {
    const handleChanged = () => {
      const saved = localStorage.getItem('vacationDaysPerYear');
      if (saved) {
        const parsed = parseInt(saved, 10);
        setDaysPerYear(parsed);
        setTempDaysValue(String(parsed));
      }
    };
    window.addEventListener('vacationDaysPerYearChanged', handleChanged);
    return () => {
      window.removeEventListener('vacationDaysPerYearChanged', handleChanged);
    };
  }, []);

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

  // Filtered list of active employees with vacation statistics
  const filteredBalances = useMemo(() => {
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
        // Search Term Filter
        const searchLower = searchTerm.toLowerCase();
        const fullName = `${item.emp.firstName} ${item.emp.lastName}`.toLowerCase();
        const plaza = (item.emp.plaza || '').toLowerCase();
        const position = (item.emp.position || '').toLowerCase();
        const matchesSearch = fullName.includes(searchLower) || plaza.includes(searchLower) || position.includes(searchLower);

        // Category Filter
        const matchesCategory = categoryFilter === 'TODOS' || item.emp.category === categoryFilter;

        return matchesSearch && matchesCategory;
      });
  }, [employees, vacationRequests, searchTerm, categoryFilter]);

  // Unique categories for filtering
  const categories = useMemo(() => {
    const list = new Set(employees.filter(e => e.status !== 'BAJA' && e.category).map(e => e.category));
    return Array.from(list);
  }, [employees]);

  // General Metrics Sum
  const totalMetrics = useMemo(() => {
    let earnedSum = 0;
    let usedSum = 0;
    let balanceSum = 0;

    filteredBalances.forEach(item => {
      earnedSum += item.totalEarned;
      usedSum += item.used;
      balanceSum += item.balance;
    });

    return {
      earnedSum,
      usedSum,
      balanceSum,
      count: filteredBalances.length
    };
  }, [filteredBalances]);

  return (
    <div className="space-y-6">
      
      {/* Title & Description with Configurar Button */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h3 className="text-xl font-bold text-gray-800">Saldos de Vacaciones</h3>
        </div>
        <button
          onClick={() => {
            setTempDaysValue(String(daysPerYear));
            setIsConfigModalOpen(true);
          }}
          className="flex items-center justify-center gap-1.5 px-4 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-extrabold text-xs rounded-xl transition-all border border-indigo-100 shadow-sm self-start sm:self-auto"
        >
          <Settings className="w-4 h-4" />
          Configurar
        </button>
      </div>

      {/* Control Tools */}
      <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm flex flex-col sm:flex-row gap-4 items-center justify-between">
        
        {/* Search */}
        <div className="relative w-full sm:max-w-md">
          <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Buscar por colaborador, plaza o puesto..."
            className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-xs bg-gray-50 focus:bg-white focus:ring-1 focus:ring-indigo-500 outline-none transition-all"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        {/* Filter Dropdown */}
        <div className="w-full sm:w-auto">
          <select
            className="w-full sm:w-48 p-2 border border-gray-200 rounded-lg text-xs bg-white cursor-pointer focus:ring-1 focus:ring-indigo-500 outline-none"
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
          >
            <option value="TODOS">Todas las Categorías</option>
            {categories.map(cat => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Main Balances Table */}
      <div className="bg-white border border-gray-100 rounded-xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-gray-50 text-gray-500 font-bold uppercase tracking-wider border-b border-gray-100">
                <th className="p-4">Colaborador</th>
                <th className="p-4">Categoría / Puesto</th>
                <th className="p-4 text-center">Ingreso / Antigüedad</th>
                <th className="p-4 text-center bg-indigo-50/20 text-indigo-800">Ganados</th>
                <th className="p-4 text-center bg-red-50/20 text-red-800">Usados</th>
                <th className="p-4 text-center bg-green-50/20 text-green-800 font-extrabold">Saldo Disponible</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-gray-700 font-medium">
              {filteredBalances.length > 0 ? (
                filteredBalances.map(({ emp, yearsOfService, totalEarned, used, balance }) => {
                  const hasOneYear = yearsOfService >= 1;
                  return (
                    <tr key={emp.id} className="hover:bg-gray-50/40 transition-colors">
                      <td className="p-4">
                        <div>
                          <p className="font-extrabold text-gray-900">{emp.firstName} {emp.lastName}</p>
                          <p className="text-[10px] text-gray-400 mt-0.5">ID: {emp.id.substring(0, 8)}...</p>
                        </div>
                      </td>
                      <td className="p-4">
                        <div>
                          <span className="px-2 py-0.5 text-[10px] bg-gray-100 text-gray-700 rounded font-bold">
                            {emp.category || 'Sin Categoría'}
                          </span>
                          <p className="text-[10px] text-gray-500 mt-1">{emp.position || 'N/R'}</p>
                        </div>
                      </td>
                      <td className="p-4 text-center">
                        <div>
                          <p className="text-gray-900 font-bold">{emp.hireDate || 'No Registrada'}</p>
                          <p className={`text-[10px] font-bold mt-1 ${hasOneYear ? 'text-green-600' : 'text-amber-600'}`}>
                            {yearsOfService === 0 ? 'Menos de 1 año' : `${yearsOfService} ${yearsOfService === 1 ? 'año' : 'años'} cumplidos`}
                          </p>
                        </div>
                      </td>
                      <td className="p-4 text-center bg-indigo-50/10 font-bold text-gray-900">
                        {totalEarned} días
                      </td>
                      <td className="p-4 text-center bg-red-50/10 font-bold text-red-600">
                        {used} días
                      </td>
                      <td className="p-4 text-center bg-green-50/10 font-black">
                        <span className={`inline-block px-3 py-1 rounded-lg border ${
                          balance > 0 
                            ? 'bg-green-50 border-green-200 text-green-700' 
                            : 'bg-gray-50 border-gray-200 text-gray-500'
                        }`}>
                          {balance} días
                        </span>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={6} className="text-center py-12 text-gray-400 font-medium">
                    No se encontraron colaboradores que coincidan con la búsqueda.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
      
      {/* Modal de Configuración de Días de Vacaciones */}
      {isConfigModalOpen && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-xl border border-gray-100 animate-in fade-in zoom-in-95 duration-200">
            <h4 className="text-base font-extrabold text-gray-900 mb-2">Configurar Días de Vacaciones</h4>
            
            <div className="space-y-4">
              <div>
                <label className="block text-[11px] font-extrabold text-gray-400 uppercase tracking-wider mb-2">
                  Días por año completo
                </label>
                <input
                  type="number"
                  min="1"
                  max="40"
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl text-xs bg-gray-50 focus:bg-white focus:ring-1 focus:ring-indigo-500 outline-none transition-all font-bold"
                  value={tempDaysValue}
                  onChange={(e) => setTempDaysValue(e.target.value)}
                />
              </div>

              <div className="flex gap-2 justify-end pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setTempDaysValue(String(daysPerYear));
                    setIsConfigModalOpen(false);
                  }}
                  className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 font-extrabold text-xs rounded-xl transition-all"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const parsed = parseInt(tempDaysValue, 10);
                    if (!isNaN(parsed) && parsed > 0) {
                      localStorage.setItem('vacationDaysPerYear', String(parsed));
                      setDaysPerYear(parsed);
                      setIsConfigModalOpen(false);
                      // Trigger custom event to notify other components in same session
                      window.dispatchEvent(new Event('vacationDaysPerYearChanged'));
                    }
                  }}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-xs rounded-xl shadow-sm transition-all"
                >
                  Guardar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
