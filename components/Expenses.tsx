
import React, { useState, useMemo, useEffect } from 'react';
import { Plus, Trash2, Tag, Calendar, ChevronLeft, ChevronRight, FileText, Upload, Image as ImageIcon, X, Eye, Edit } from 'lucide-react';
import { Expense } from '../types';
import { addExpense, deleteExpense, updateExpense } from '../services/dbService';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface ExpensesProps {
  expenses: Expense[];
  refreshData: () => void;
}

export const Expenses: React.FC<ExpensesProps> = ({ expenses, refreshData }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [viewTicketImage, setViewTicketImage] = useState<string | null>(null); // State for viewing image
  
  const [formData, setFormData] = useState<Partial<Expense>>({
    description: '', amount: 0, category: 'Oficina', date: new Date().toISOString().split('T')[0], ticketImage: ''
  });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // --- Weekly Logic ---
  
  // Helper to get the Saturday of the current week based on "Saturday to Friday" logic
  const getWeekStart = (date: Date) => {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    const day = d.getDay(); // 0 = Sun, 1 = Mon, ..., 6 = Sat
    
    // Logic: If today is Saturday (6), diff is 0.
    // If today is Sunday (0), diff is 1.
    // If today is Friday (5), diff is 6.
    // Formula: (day + 1) % 7 gives days passed since Saturday
    const diff = (day + 1) % 7;
    
    d.setDate(d.getDate() - diff);
    return d;
  };

  const [currentWeekStart, setCurrentWeekStart] = useState<Date>(() => getWeekStart(new Date()));

  // Navigate weeks
  const changeWeek = (offset: number) => {
    const newStart = new Date(currentWeekStart);
    newStart.setDate(newStart.getDate() + (offset * 7));
    setCurrentWeekStart(newStart);
  };

  // Get Week Range strings for display and filtering
  const weekRange = useMemo(() => {
    const start = new Date(currentWeekStart);
    const end = new Date(currentWeekStart);
    end.setDate(start.getDate() + 6); // Friday is 6 days after Saturday
    
    // Set end of day for filtering
    const filterEnd = new Date(end);
    filterEnd.setHours(23, 59, 59, 999);

    return {
      start,
      end,
      filterStart: start,
      filterEnd: filterEnd,
      label: `${start.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })} - ${end.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}`
    };
  }, [currentWeekStart]);

  // Filter expenses for current week
  const filteredExpenses = useMemo(() => {
    return expenses.filter(expense => {
      // Create date objects for comparison (assuming expense.date is YYYY-MM-DD)
      // Append T00:00:00 to ensure local timezone parsing consistency or treat as UTC
      // Better approach for string comparison YYYY-MM-DD:
      const expDate = new Date(expense.date + 'T12:00:00'); // Mid-day to avoid timezone offset issues
      return expDate >= weekRange.filterStart && expDate <= weekRange.filterEnd;
    });
  }, [expenses, weekRange]);

  const weeklyTotal = useMemo(() => {
    return filteredExpenses.reduce((acc, curr) => acc + curr.amount, 0);
  }, [filteredExpenses]);


  // --- PDF Generation ---
  const handleDownloadPDF = () => {
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'letter'
    });

    // --- Header ---
    doc.setFillColor(22, 163, 74); // Green-600 color
    doc.rect(0, 0, 216, 40, 'F'); // Top banner

    doc.setTextColor(255, 255, 255);
    doc.setFontSize(22);
    doc.setFont("helvetica", "bold");
    doc.text("Reporte Semanal de Gastos", 14, 20);

    doc.setFontSize(12);
    doc.setFont("helvetica", "normal");
    doc.text(`Período: ${weekRange.label} - ${weekRange.end.getFullYear()}`, 14, 30);

    // --- Meta Info ---
    doc.setTextColor(80, 80, 80);
    doc.setFontSize(10);
    doc.text(`Fecha de generación: ${new Date().toLocaleDateString('es-ES')}`, 14, 50);

    // --- Table Data ---
    const tableBody = filteredExpenses.map(expense => [
      expense.date,
      expense.category,
      expense.description + (expense.ticketImage ? ' (Con Ticket)' : ''),
      `$${expense.amount.toFixed(2)}`
    ]);

    // Add Total Row
    tableBody.push(['', '', 'TOTAL', `$${weeklyTotal.toFixed(2)}`]);

    // --- Draw Table ---
    autoTable(doc, {
      startY: 55,
      head: [['Fecha', 'Categoría', 'Descripción', 'Monto']],
      body: tableBody,
      theme: 'striped',
      headStyles: {
        fillColor: [22, 163, 74], // Green-600
        textColor: 255,
        fontStyle: 'bold'
      },
      columnStyles: {
        0: { cellWidth: 30 }, // Date
        1: { cellWidth: 35 }, // Category
        2: { cellWidth: 'auto' }, // Description (auto width)
        3: { cellWidth: 35, halign: 'right', fontStyle: 'bold' } // Amount
      },
      styles: {
        fontSize: 10,
        cellPadding: 3,
        valign: 'middle'
      },
      didParseCell: function(data) {
        // Style the Total Row
        if (data.row.index === filteredExpenses.length) {
          data.cell.styles.fontStyle = 'bold';
          data.cell.styles.fillColor = [240, 253, 244]; // Light green bg
          if (data.column.index === 3) {
            data.cell.styles.textColor = [22, 163, 74];
          }
        }
      }
    });

    // --- Footer ---
    const finalY = (doc as any).lastAutoTable.finalY + 10;
    
    // Simple signature line
    doc.setDrawColor(150);
    doc.line(14, finalY + 20, 80, finalY + 20);
    doc.setFontSize(9);
    doc.setTextColor(100);
    doc.text("Firma de Aprobación", 14, finalY + 25);

    // Page numbers
    const pageCount = (doc as any).internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.text(`Página ${i} de ${pageCount}`, 190, 270, { align: 'right' });
    }

    doc.save(`Gastos_${weekRange.start.toISOString().split('T')[0]}.pdf`);
  };

  // --- Handlers ---

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Image Compression Logic
    const reader = new FileReader();
    reader.onloadend = () => {
      const img = new Image();
      img.src = reader.result as string;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        const MAX_WIDTH = 800; // Limit width to 800px to save space
        
        let width = img.width;
        let height = img.height;
        
        if (width > MAX_WIDTH) {
          height = (height * MAX_WIDTH) / width;
          width = MAX_WIDTH;
        }
        
        canvas.width = width;
        canvas.height = height;
        
        ctx?.drawImage(img, 0, 0, width, height);
        
        // Compress to JPEG 0.7
        const compressedBase64 = canvas.toDataURL('image/jpeg', 0.7);
        setFormData(prev => ({ ...prev, ticketImage: compressedBase64 }));
      };
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (formData.description && formData.amount) {
        if (editingId) {
          await updateExpense(editingId, formData);
        } else {
          await addExpense(formData as Omit<Expense, 'id'>);
        }
        setIsModalOpen(false);
        setFormData({ description: '', amount: 0, category: 'Oficina', date: new Date().toISOString().split('T')[0], ticketImage: '' });
        setEditingId(null);
        refreshData();
      }
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (expense: Expense) => {
    setFormData({
      description: expense.description,
      amount: expense.amount,
      category: expense.category,
      date: expense.date,
      ticketImage: expense.ticketImage || ''
    });
    setEditingId(expense.id);
    setIsModalOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (confirm('¿Eliminar gasto?')) {
      await deleteExpense(id);
      refreshData();
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">Control de Gastos</h2>
          <p className="text-sm text-gray-500">Gestión semanal (Sábado a Viernes)</p>
        </div>
        
        <div className="flex flex-col sm:flex-row items-center gap-3 w-full xl:w-auto">
          <div className="flex items-center bg-white rounded-lg p-1 border shadow-sm w-full sm:w-auto justify-between sm:justify-start">
            <button onClick={() => changeWeek(-1)} className="p-2 hover:bg-gray-100 rounded-md text-gray-600">
              <ChevronLeft className="w-5 h-5" />
            </button>
            <div className="px-4 py-1 font-semibold text-gray-700 min-w-[160px] text-center capitalize text-sm sm:text-base">
              {weekRange.label}
            </div>
            <button onClick={() => changeWeek(1)} className="p-2 hover:bg-gray-100 rounded-md text-gray-600">
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>

          <div className="flex gap-2 w-full sm:w-auto">
            <button 
              onClick={handleDownloadPDF}
              className="bg-white hover:bg-gray-50 text-gray-700 border border-gray-200 px-4 py-2 rounded-lg flex items-center justify-center transition-colors shadow-sm flex-1 sm:flex-none"
              title="Descargar PDF"
            >
              <FileText className="w-5 h-5 mr-2 text-red-500" /> PDF
            </button>
            
            <button 
              onClick={() => {
                setEditingId(null);
                setFormData({ description: '', amount: 0, category: 'Oficina', date: new Date().toISOString().split('T')[0], ticketImage: '' });
                setIsModalOpen(true);
              }}
              className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg flex items-center justify-center transition-colors shadow-sm flex-1 sm:flex-none"
            >
              <Plus className="w-5 h-5 mr-2" /> Nuevo Gasto
            </button>
          </div>
        </div>
      </div>

      {/* Summary Card for Selected Week */}
      <div className="bg-gradient-to-r from-green-50 to-emerald-50 border border-green-100 p-6 rounded-xl flex items-center justify-between">
        <div>
          <p className="text-green-800 font-medium mb-1">Total Semana Actual</p>
          <h3 className="text-3xl font-bold text-green-700">${weeklyTotal.toLocaleString('es-MX', { minimumFractionDigits: 2 })}</h3>
        </div>
        <div className="bg-white p-3 rounded-full shadow-sm">
          <Calendar className="w-8 h-8 text-green-600" />
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead className="bg-gray-50 border-b border-gray-100">
            <tr>
              <th className="p-4 font-semibold text-gray-600 w-12 text-center">Ticket</th>
              <th className="p-4 font-semibold text-gray-600">Descripción</th>
              <th className="p-4 font-semibold text-gray-600 hidden sm:table-cell">Categoría</th>
              <th className="p-4 font-semibold text-gray-600 hidden md:table-cell">Fecha</th>
              <th className="p-4 font-semibold text-gray-600 text-right">Monto</th>
              <th className="p-4 font-semibold text-gray-600 w-10"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filteredExpenses.map(expense => (
              <tr key={expense.id} className="hover:bg-gray-50/50 transition-colors group">
                {/* Ticket Column */}
                <td className="p-4 text-center">
                   {expense.ticketImage ? (
                      <button 
                        onClick={() => setViewTicketImage(expense.ticketImage || null)}
                        className="bg-blue-50 text-blue-600 p-1.5 rounded-lg hover:bg-blue-100 transition-colors"
                        title="Ver Ticket"
                      >
                         <Eye className="w-4 h-4" />
                      </button>
                   ) : (
                     <span className="text-gray-300 text-xs">-</span>
                   )}
                </td>
                <td className="p-4 text-gray-800 font-medium">
                  {expense.description}
                  {/* Mobile only view details */}
                  <div className="sm:hidden text-xs text-gray-400 mt-1 flex gap-2">
                    <span>{expense.category}</span>
                    <span>•</span>
                    <span>{expense.date}</span>
                  </div>
                </td>
                <td className="p-4 hidden sm:table-cell">
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                    <Tag className="w-3 h-3 mr-1" /> {expense.category}
                  </span>
                </td>
                <td className="p-4 text-gray-500 hidden md:table-cell text-sm">
                   <span className="font-mono bg-gray-50 px-2 py-1 rounded border border-gray-200">
                     {expense.date}
                   </span>
                </td>
                <td className="p-4 text-right font-bold text-gray-800">
                  ${expense.amount.toFixed(2)}
                </td>
                <td className="p-4 text-center">
                  <div className="flex items-center justify-center gap-2">
                    <button onClick={() => handleEdit(expense)} className="text-gray-300 hover:text-blue-500 transition-colors">
                      <Edit className="w-4 h-4" />
                    </button>
                    <button onClick={() => handleDelete(expense.id)} className="text-gray-300 hover:text-red-500 transition-colors">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {filteredExpenses.length === 0 && (
              <tr>
                <td colSpan={6} className="p-12 text-center text-gray-400">
                  No hay gastos registrados en la semana del <span className="font-semibold text-gray-500">{weekRange.label}</span>.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* NEW EXPENSE MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
            <h3 className="text-xl font-bold mb-4 text-gray-800">{editingId ? 'Editar Gasto' : 'Registrar Nuevo Gasto'}</h3>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Descripción</label>
                <input required className="w-full border p-2 rounded focus:ring-2 focus:ring-green-500 outline-none bg-white text-gray-900 placeholder-gray-500" 
                  value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Monto ($)</label>
                  <input required type="number" step="0.01" className="w-full border p-2 rounded focus:ring-2 focus:ring-green-500 outline-none bg-white text-gray-900 placeholder-gray-500" 
                    value={formData.amount || ''} onChange={e => setFormData({...formData, amount: parseFloat(e.target.value)})} />
                </div>
                <div>
                   <label className="block text-sm font-medium text-gray-700 mb-1">Categoría</label>
                   <select className="w-full border p-2 rounded focus:ring-2 focus:ring-green-500 outline-none bg-white text-gray-900"
                    value={formData.category} onChange={e => setFormData({...formData, category: e.target.value as any})}>
                     {['Oficina', 'Comida', 'Transporte', 'Software', 'Servicios', 'Otros'].map(c => (
                       <option key={c} value={c}>{c}</option>
                     ))}
                   </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Fecha</label>
                <input required type="date" className="w-full border p-2 rounded focus:ring-2 focus:ring-green-500 outline-none bg-white text-gray-900" 
                  value={formData.date} onChange={e => setFormData({...formData, date: e.target.value})} />
              </div>

              {/* TICKET UPLOAD SECTION */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Foto del Ticket (Opcional)</label>
                
                {!formData.ticketImage ? (
                   <label className="flex items-center justify-center w-full p-4 border-2 border-dashed border-gray-300 rounded-xl cursor-pointer hover:bg-gray-50 hover:border-green-400 transition-colors">
                      <div className="text-center">
                         <Upload className="w-6 h-6 text-gray-400 mx-auto mb-1" />
                         <span className="text-xs text-gray-500">Subir imagen</span>
                      </div>
                      <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
                   </label>
                ) : (
                  <div className="relative rounded-xl overflow-hidden border border-gray-200 bg-gray-50 h-32 flex items-center justify-center group">
                      <img src={formData.ticketImage} alt="Preview" className="h-full object-contain" />
                      <button 
                        type="button"
                        onClick={() => setFormData({...formData, ticketImage: ''})}
                        className="absolute top-2 right-2 bg-white rounded-full p-1 shadow-md text-red-500 hover:bg-red-50"
                      >
                         <X className="w-4 h-4" />
                      </button>
                  </div>
                )}
              </div>
              
              <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg">Cancelar</button>
                <button type="submit" disabled={loading} className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 font-medium">
                  {loading ? 'Guardando...' : (editingId ? 'Actualizar Gasto' : 'Guardar Gasto')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* VIEW TICKET MODAL */}
      {viewTicketImage && (
         <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4" onClick={() => setViewTicketImage(null)}>
            <div className="relative max-w-3xl max-h-[90vh] bg-transparent flex flex-col items-center">
               <button 
                 onClick={() => setViewTicketImage(null)}
                 className="absolute -top-10 right-0 text-white hover:text-gray-300"
               >
                  <X className="w-8 h-8" />
               </button>
               <img src={viewTicketImage} alt="Ticket" className="rounded-lg shadow-2xl max-h-[85vh] object-contain bg-white" onClick={(e) => e.stopPropagation()} />
            </div>
         </div>
      )}
    </div>
  );
};
