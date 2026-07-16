
import React, { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Plus, 
  Trash2, 
  Tag, 
  Calendar, 
  ChevronLeft, 
  ChevronRight, 
  FileText, 
  Upload, 
  Image as ImageIcon, 
  X, 
  Eye, 
  Edit, 
  ChevronDown, 
  AlertCircle, 
  Loader2, 
  RefreshCw,
  Building2,
  Key,
  LogOut,
  Lock,
  Settings,
  SlidersHorizontal,
  Check
} from 'lucide-react';
import { Expense, Office, Employee } from '../types';
import { 
  addExpense, 
  deleteExpense, 
  updateExpense,
  subscribeToOffices,
  addOffice,
  updateOffice,
  deleteOffice,
  subscribeToExpenseCategories,
  addExpenseCategory,
  deleteExpenseCategory,
  ExpenseCategory
} from '../services/dbService';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface ExpensesProps {
  expenses: Expense[];
  employees?: Employee[];
  isLoading?: boolean;
  loadAll?: boolean;
  isSyncing?: boolean;
  onLoadAll?: () => void;
  multiOfficeEnabled?: boolean;
  currentUser?: any;
}

export const Expenses: React.FC<ExpensesProps> = ({ 
  expenses, 
  employees = [],
  isLoading, 
  loadAll, 
  isSyncing, 
  onLoadAll, 
  multiOfficeEnabled = false,
  currentUser
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [viewTicketImage, setViewTicketImage] = useState<string | null>(null); // State for viewing image
  
  const [formData, setFormData] = useState<Partial<Expense>>({
    description: '', amount: 0, category: 'Oficina', date: new Date().toISOString().split('T')[0], ticketImage: '', officeId: ''
  });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // --- Multi-Office State ---
  const [offices, setOffices] = useState<Office[]>([]);
  const [officeSession, setOfficeSession] = useState<Office | null>(null);
  const [selectedOfficeFilter, setSelectedOfficeFilter] = useState<string>('all');
  const [showManageOffices, setShowManageOffices] = useState(false);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [loginCode, setLoginCode] = useState('');
  const [loginError, setLoginError] = useState('');
  
  // New office registration form
  const [newOfficeName, setNewOfficeName] = useState('');
  const [newOfficeCode, setNewOfficeCode] = useState('');
  const [newOfficeResponsibleId, setNewOfficeResponsibleId] = useState('');
  const [editingOfficeId, setEditingOfficeId] = useState<string | null>(null);
  const [editingOfficeName, setEditingOfficeName] = useState('');
  const [editingOfficeCode, setEditingOfficeCode] = useState('');
  const [editingOfficeResponsibleId, setEditingOfficeResponsibleId] = useState('');
  const [officeFormError, setOfficeFormError] = useState('');
  const [isRegisteringOffice, setIsRegisteringOffice] = useState(false);

  // --- Custom Categories State ---
  const [customCategories, setCustomCategories] = useState<ExpenseCategory[]>([]);
  const [showManageCategories, setShowManageCategories] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [categoryFormError, setCategoryFormError] = useState('');
  const [isRegisteringCategory, setIsRegisteringCategory] = useState(false);

  const defaultCategories = useMemo(() => ['Oficina', 'Comida', 'Transporte', 'Software', 'Servicios', 'Otros'], []);
  const availableCategories = useMemo(() => {
    return customCategories.length > 0 ? customCategories.map(c => c.name) : defaultCategories;
  }, [customCategories, defaultCategories]);

  const sortedEmployees = useMemo(() => {
    return [...employees].sort((a, b) => 
      `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`)
    );
  }, [employees]);

  // Load office session on mount or from currentUser
  useEffect(() => {
    if (multiOfficeEnabled && currentUser?.isOfficeUser) {
      setOfficeSession({
        id: currentUser.officeId || '',
        name: currentUser.firstName,
        code: currentUser.accessCode || '',
        createdAt: ''
      });
    } else {
      const saved = localStorage.getItem('office_expense_session');
      if (saved) {
        try {
          setOfficeSession(JSON.parse(saved));
        } catch (e) {
          console.error("Error parsing office session", e);
        }
      } else {
        setOfficeSession(null);
      }
    }
  }, [currentUser, multiOfficeEnabled]);

  // Subscribe to offices list if multi-office is enabled
  useEffect(() => {
    if (!multiOfficeEnabled) return;
    const unsub = subscribeToOffices(
      (data) => {
        setOffices(data);
        // Verify current session still exists (only for non-app-login office session)
        if (officeSession && (!currentUser || !currentUser.isOfficeUser)) {
          const exists = data.some(o => o.id === officeSession.id);
          if (!exists) {
            setOfficeSession(null);
            localStorage.removeItem('office_expense_session');
          }
        }
      },
      (err) => console.error("Error loading offices in Expenses:", err)
    );
    return () => unsub();
  }, [multiOfficeEnabled, officeSession, currentUser]);

  // Subscribe to custom categories
  useEffect(() => {
    const unsub = subscribeToExpenseCategories(
      (data) => {
        setCustomCategories(data);
      },
      (err) => console.error("Error loading custom categories in Expenses:", err)
    );
    return () => unsub();
  }, []);

  const handleOfficeLogout = () => {
    setOfficeSession(null);
    localStorage.removeItem('office_expense_session');
  };

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

  // Filter expenses for current week and active office/filter
  const filteredExpenses = useMemo(() => {
    return expenses.filter(expense => {
      // 1. Filter by week
      const expDate = new Date(expense.date + 'T12:00:00'); // Mid-day to avoid timezone offset issues
      const inWeek = expDate >= weekRange.filterStart && expDate <= weekRange.filterEnd;
      if (!inWeek) return false;

      // 2. Filter by office session (active login)
      if (multiOfficeEnabled && officeSession) {
        return expense.officeId === officeSession.id;
      }

      // 3. Filter by admin selected office filter
      if (multiOfficeEnabled && selectedOfficeFilter && selectedOfficeFilter !== 'all') {
        if (selectedOfficeFilter === 'global') {
          return !expense.officeId;
        }
        return expense.officeId === selectedOfficeFilter;
      }

      return true;
    });
  }, [expenses, weekRange, multiOfficeEnabled, officeSession, selectedOfficeFilter]);

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
    doc.text("Reporte Semanal de Gastos", 14, 18);

    doc.setFontSize(11);
    doc.setFont("helvetica", "normal");
    doc.text(`Período: ${weekRange.label} - ${weekRange.end.getFullYear()}`, 14, 26);
    
    if (multiOfficeEnabled) {
      const activeOfficeLabel = officeSession 
        ? `Oficina: ${officeSession.name}` 
        : (selectedOfficeFilter !== 'all' 
            ? `Oficina: ${offices.find(o => o.id === selectedOfficeFilter)?.name || 'Matriz/Global'}` 
            : 'Oficina: Todas');
      doc.text(activeOfficeLabel, 14, 32);
    }

    // --- Meta Info ---
    doc.setTextColor(80, 80, 80);
    doc.setFontSize(10);
    doc.text(`Fecha de generación: ${new Date().toLocaleDateString('es-ES')} a las ${new Date().toLocaleTimeString('es-ES', {hour: '2-digit', minute:'2-digit'})}`, 14, 48);

    if (multiOfficeEnabled && !officeSession) {
      // 1. --- Summary Table of Offices (Resumen General) ---
      doc.setFontSize(11);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(31, 41, 55); // Gray 800
      doc.text("Resumen General de Oficinas", 14, 56);

      const weekExpenses = expenses.filter(expense => {
        const expDate = new Date(expense.date + 'T12:00:00');
        return expDate >= weekRange.filterStart && expDate <= weekRange.filterEnd;
      });

      const globalExpenses = weekExpenses.filter(e => !e.officeId);
      const globalTotal = globalExpenses.reduce((sum, curr) => sum + curr.amount, 0);

      const summaryHeaders = [['Oficina / Sucursal', 'Cant. Gastos', 'Total Gastado']];
      const totalWeekExpensesAmount = weekExpenses.reduce((sum, curr) => sum + curr.amount, 0);

      const summaryBody = [
        [
          'Matriz / Global',
          globalExpenses.length.toString(),
          `$${globalTotal.toFixed(2)}`
        ]
      ];

      offices.forEach(office => {
        const oExpenses = weekExpenses.filter(e => e.officeId === office.id);
        const oTotal = oExpenses.reduce((sum, curr) => sum + curr.amount, 0);
        summaryBody.push([
          office.name,
          oExpenses.length.toString(),
          `$${oTotal.toFixed(2)}`
        ]);
      });

      summaryBody.push([
        'TOTAL CONSOLIDADO',
        weekExpenses.length.toString(),
        `$${totalWeekExpensesAmount.toFixed(2)}`
      ]);

      autoTable(doc, {
        startY: 60,
        head: summaryHeaders,
        body: summaryBody,
        theme: 'striped',
        headStyles: {
          fillColor: [31, 41, 55], // Gray-800
          textColor: 255,
          fontStyle: 'bold'
        },
        columnStyles: {
          0: { cellWidth: 'auto' },
          1: { cellWidth: 40, halign: 'center' },
          2: { cellWidth: 50, halign: 'right' }
        },
        styles: {
          fontSize: 9,
          cellPadding: 2.5
        },
        didParseCell: function(data) {
          if (data.row.index === summaryBody.length - 1) {
            data.cell.styles.fontStyle = 'bold';
            data.cell.styles.fillColor = [243, 244, 246]; // Gray 100
          }
        }
      });

      let currentY = (doc as any).lastAutoTable.finalY + 12;

      // 2. --- Sections Separated by Office with Totals ---
      doc.setFontSize(11);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(31, 41, 55);
      doc.text("Detalle de Gastos por Oficina", 14, currentY);
      currentY += 4;

      const officesToRender = [
        { id: '', name: 'Matriz / Global', expenses: globalExpenses, total: globalTotal },
        ...offices.map(o => {
          const oExpenses = weekExpenses.filter(e => e.officeId === o.id);
          const oTotal = oExpenses.reduce((sum, curr) => sum + curr.amount, 0);
          return { id: o.id, name: o.name, expenses: oExpenses, total: oTotal };
        })
      ];

      officesToRender.forEach((section) => {
        if (section.expenses.length === 0) return;

        if (currentY > 230) {
          doc.addPage();
          currentY = 20;
        }

        doc.setFontSize(10);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(22, 163, 74); // Green-600
        doc.text(`${section.name} (Total: $${section.total.toFixed(2)})`, 14, currentY);
        currentY += 2.5;

        const detailHeaders = [['Fecha', 'Categoría', 'Descripción', 'Monto']];
        const detailBody = section.expenses.map(exp => [
          exp.date,
          exp.category,
          exp.description + (exp.ticketImage ? ' (Con Ticket)' : ''),
          `$${exp.amount.toFixed(2)}`
        ]);

        detailBody.push(['', '', 'SUBTOTAL', `$${section.total.toFixed(2)}`]);

        autoTable(doc, {
          startY: currentY,
          head: detailHeaders,
          body: detailBody,
          theme: 'striped',
          headStyles: {
            fillColor: [75, 85, 99], // Slate 600
            textColor: 255,
            fontStyle: 'bold'
          },
          columnStyles: {
            0: { cellWidth: 25 }, // Date
            1: { cellWidth: 35 }, // Category
            2: { cellWidth: 'auto' }, // Description
            3: { cellWidth: 35, halign: 'right', fontStyle: 'bold' } // Amount
          },
          styles: {
            fontSize: 8.5,
            cellPadding: 2
          },
          didParseCell: function(data) {
            if (data.row.index === detailBody.length - 1) {
              data.cell.styles.fontStyle = 'bold';
              data.cell.styles.fillColor = [249, 250, 251];
              if (data.column.index === 3) {
                data.cell.styles.textColor = [22, 163, 74];
              }
            }
          }
        });

        currentY = (doc as any).lastAutoTable.finalY + 8;
      });

      const finalY = currentY + 10;
      doc.setDrawColor(150);
      if (finalY + 20 < 270) {
        doc.line(14, finalY + 15, 80, finalY + 15);
        doc.setFontSize(9);
        doc.setTextColor(100);
        doc.text("Firma de Aprobación", 14, finalY + 20);
      }

      const pageCount = (doc as any).internal.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.text(`Página ${i} de ${pageCount}`, 190, 270, { align: 'right' });
      }

      doc.save(`Gastos_Consolidado_${weekRange.start.toISOString().split('T')[0]}.pdf`);

    } else {
      const showOfficeCol = multiOfficeEnabled && !officeSession && selectedOfficeFilter === 'all';
      
      const tableHeaders = showOfficeCol
        ? [['Fecha', 'Oficina', 'Categoría', 'Descripción', 'Monto']]
        : [['Fecha', 'Categoría', 'Descripción', 'Monto']];

      const tableBody = filteredExpenses.map(expense => {
        const officeName = offices.find(o => o.id === expense.officeId)?.name || 'Matriz/Global';
        return showOfficeCol
          ? [
              expense.date,
              officeName,
              expense.category,
              expense.description + (expense.ticketImage ? ' (Con Ticket)' : ''),
              `$${expense.amount.toFixed(2)}`
            ]
          : [
              expense.date,
              expense.category,
              expense.description + (expense.ticketImage ? ' (Con Ticket)' : ''),
              `$${expense.amount.toFixed(2)}`
            ];
      });

      if (showOfficeCol) {
        tableBody.push(['', '', '', 'TOTAL', `$${weeklyTotal.toFixed(2)}`]);
      } else {
        tableBody.push(['', '', 'TOTAL', `$${weeklyTotal.toFixed(2)}`]);
      }

      autoTable(doc, {
        startY: 55,
        head: tableHeaders,
        body: tableBody,
        theme: 'striped',
        headStyles: {
          fillColor: [22, 163, 74], // Green-600
          textColor: 255,
          fontStyle: 'bold'
        },
        columnStyles: showOfficeCol 
          ? {
              0: { cellWidth: 25 }, 
              1: { cellWidth: 30 }, 
              2: { cellWidth: 30 }, 
              3: { cellWidth: 'auto' }, 
              4: { cellWidth: 30, halign: 'right', fontStyle: 'bold' } 
            }
          : {
              0: { cellWidth: 30 }, 
              1: { cellWidth: 35 }, 
              2: { cellWidth: 'auto' }, 
              3: { cellWidth: 35, halign: 'right', fontStyle: 'bold' } 
            },
        styles: {
          fontSize: 10,
          cellPadding: 3,
          valign: 'middle'
        },
        didParseCell: function(data) {
          if (data.row.index === filteredExpenses.length) {
            data.cell.styles.fontStyle = 'bold';
            data.cell.styles.fillColor = [240, 253, 244]; 
            const totalValIndex = showOfficeCol ? 4 : 3;
            if (data.column.index === totalValIndex) {
              data.cell.styles.textColor = [22, 163, 74];
            }
          }
        }
      });

      const finalY = (doc as any).lastAutoTable.finalY + 10;
      doc.setDrawColor(150);
      if (finalY + 20 < 270) {
        doc.line(14, finalY + 15, 80, finalY + 15);
        doc.setFontSize(9);
        doc.setTextColor(100);
        doc.text("Firma de Aprobación", 14, finalY + 20);
      }

      const pageCount = (doc as any).internal.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.text(`Página ${i} de ${pageCount}`, 190, 270, { align: 'right' });
      }

      const activeOfficeName = officeSession 
        ? officeSession.name.replace(/\s+/g, '_') 
        : (selectedOfficeFilter !== 'all' 
            ? (offices.find(o => o.id === selectedOfficeFilter)?.name || 'Matriz').replace(/\s+/g, '_')
            : 'Consolidado');

      doc.save(`Gastos_${activeOfficeName}_${weekRange.start.toISOString().split('T')[0]}.pdf`);
    }
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
        const payload: Partial<Expense> = {
          ...formData,
          officeId: officeSession ? officeSession.id : (formData.officeId || '')
        };

        if (editingId) {
          await updateExpense(editingId, payload);
        } else {
          await addExpense(payload as Omit<Expense, 'id'>);
        }
        setIsModalOpen(false);
        setFormData({ description: '', amount: 0, category: availableCategories[0] || 'Oficina', date: new Date().toISOString().split('T')[0], ticketImage: '', officeId: '' });
        setEditingId(null);
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
      ticketImage: expense.ticketImage || '',
      officeId: expense.officeId || ''
    });
    setEditingId(expense.id);
    setIsModalOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (confirm('¿Eliminar gasto?')) {
      await deleteExpense(id);
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">Control de Gastos</h2>
          <p className="text-sm text-gray-500">Gestión semanal (Sábado a Viernes)</p>
        </div>

        <AnimatePresence>
          {isSyncing && (
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-indigo-50 border border-indigo-100 p-3 rounded-xl flex flex-col gap-2 shadow-sm flex-1 max-w-md"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-indigo-700 font-bold text-[10px]">
                  <Loader2 className="w-3 h-3 animate-spin" />
                  Sincronizando historial completo...
                </div>
              </div>
              <div className="w-full bg-indigo-100 rounded-full h-1 overflow-hidden">
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
      </div>

      {/* MULTI OFFICE SESSION CONTROL BAR */}
      {multiOfficeEnabled && !currentUser?.isOfficeUser && (
        <div className="bg-white border border-gray-150 p-4 rounded-xl flex flex-col md:flex-row justify-between items-start md:items-center gap-4 shadow-sm">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-xl ${officeSession ? 'bg-indigo-50 text-indigo-600' : 'bg-gray-50 text-gray-500'}`}>
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              {officeSession ? (
                <>
                  <span className="text-[10px] uppercase font-extrabold tracking-wider text-gray-400">Sucursal de Operación</span>
                  <div className="flex items-center gap-2">
                    <h4 className="text-sm font-bold text-gray-800">
                      {officeSession.name}
                    </h4>
                    <span className="bg-indigo-100 text-indigo-700 font-extrabold text-[9px] px-2 py-0.5 rounded-full">
                      SÓLO SUCURSAL
                    </span>
                  </div>
                </>
              ) : (
                <div className="flex items-center gap-2">
                  <h4 className="text-sm font-bold text-gray-800">
                    Multioficina
                  </h4>
                </div>
              )}
            </div>
          </div>
          
          <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto">
            {officeSession ? (
              <button
                onClick={handleOfficeLogout}
                className="w-full md:w-auto bg-gray-100 hover:bg-gray-200 text-gray-700 px-3.5 py-1.5 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all shadow-sm"
              >
                <LogOut className="w-3.5 h-3.5" /> Cerrar Sesión Sucursal
              </button>
            ) : (
              <>
                <button
                  onClick={() => {
                    setLoginCode('');
                    setLoginError('');
                    setShowLoginModal(true);
                  }}
                  className="bg-indigo-50 hover:bg-indigo-100 text-indigo-700 px-3.5 py-1.5 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all border border-indigo-150 shadow-sm"
                >
                  <Lock className="w-3.5 h-3.5" /> Iniciar Sesión Sucursal
                </button>
                <button
                  onClick={() => {
                    setOfficeFormError('');
                    setNewOfficeName('');
                    setNewOfficeCode('');
                    setShowManageOffices(true);
                  }}
                  className="bg-gray-50 hover:bg-gray-100 text-gray-600 border border-gray-200 px-3.5 py-1.5 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all shadow-sm"
                >
                  <Settings className="w-3.5 h-3.5" /> Gestionar Oficinas
                </button>
                <button
                  onClick={() => {
                    setCategoryFormError('');
                    setNewCategoryName('');
                    setShowManageCategories(true);
                  }}
                  className="bg-gray-50 hover:bg-gray-100 text-gray-600 border border-gray-200 px-3.5 py-1.5 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all shadow-sm"
                >
                  <Tag className="w-3.5 h-3.5 text-green-600" /> Gestionar Categorías
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* COMPACT & PROFESSIONAL SUMMARY OF EXPENSES BY OFFICE */}
      {multiOfficeEnabled && !currentUser?.isOfficeUser && !officeSession && offices.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-150 overflow-hidden p-3.5">
          <div className="flex items-center gap-1.5 mb-2.5">
            <Building2 className="w-4 h-4 text-indigo-600" />
            <h3 className="font-bold text-gray-800 text-xs">Resumen de Gastos por Oficina (Semana Actual)</h3>
          </div>
          <div 
            className="grid gap-2" 
            style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))' }}
          >
            {/* 1. All Offices Consolidated card */}
            {(() => {
              const weekExpenses = expenses.filter(e => {
                const expDate = new Date(e.date + 'T12:00:00');
                return expDate >= weekRange.filterStart && expDate <= weekRange.filterEnd;
              });
              const totalWeekExpensesAmount = weekExpenses.reduce((sum, curr) => sum + curr.amount, 0);
              return (
                <div 
                  onClick={() => setSelectedOfficeFilter('all')}
                  className={`p-2 rounded-lg border transition-all cursor-pointer flex flex-col justify-between ${
                    selectedOfficeFilter === 'all' 
                      ? 'bg-indigo-50 border-indigo-200 ring-2 ring-indigo-500/10' 
                      : 'bg-gray-50/40 border-gray-150 hover:bg-gray-50'
                  }`}
                >
                  <span className="text-[9px] font-extrabold text-indigo-600 uppercase tracking-wider truncate">Todas (Consolidado)</span>
                  <div className="flex items-baseline justify-between mt-1">
                    <span className="text-sm font-extrabold text-gray-800">${totalWeekExpensesAmount.toLocaleString('es-MX', { minimumFractionDigits: 2 })}</span>
                    <span className="text-[9px] font-semibold text-gray-400">{weekExpenses.length}g</span>
                  </div>
                </div>
              );
            })()}

            {/* 2. Global/Matriz item */}
            {(() => {
              const globalExpenses = expenses.filter(e => {
                const expDate = new Date(e.date + 'T12:00:00');
                const inWeek = expDate >= weekRange.filterStart && expDate <= weekRange.filterEnd;
                return inWeek && !e.officeId;
              });
              const globalTotal = globalExpenses.reduce((sum, curr) => sum + curr.amount, 0);
              return (
                <div 
                  onClick={() => setSelectedOfficeFilter('global')}
                  className={`p-2 rounded-lg border transition-all cursor-pointer flex flex-col justify-between ${
                    selectedOfficeFilter === 'global' 
                      ? 'bg-indigo-50 border-indigo-200 ring-2 ring-indigo-500/10' 
                      : 'bg-gray-50/40 border-gray-150 hover:bg-gray-50'
                  }`}
                >
                  <span className="text-[9px] font-extrabold text-gray-500 uppercase tracking-wider truncate">Matriz / Global</span>
                  <div className="flex items-baseline justify-between mt-1">
                    <span className="text-sm font-extrabold text-gray-800">${globalTotal.toLocaleString('es-MX', { minimumFractionDigits: 2 })}</span>
                    <span className="text-[9px] font-semibold text-gray-400">{globalExpenses.length}g</span>
                  </div>
                </div>
              );
            })()}

            {/* 3. Each registered office */}
            {offices.map(office => {
              const officeExpenses = expenses.filter(e => {
                const expDate = new Date(e.date + 'T12:00:00');
                const inWeek = expDate >= weekRange.filterStart && expDate <= weekRange.filterEnd;
                return inWeek && e.officeId === office.id;
              });
              const officeTotal = officeExpenses.reduce((sum, curr) => sum + curr.amount, 0);
              return (
                <div 
                  key={office.id}
                  onClick={() => setSelectedOfficeFilter(office.id)}
                  className={`p-2 rounded-lg border transition-all cursor-pointer flex flex-col justify-between ${
                    selectedOfficeFilter === office.id 
                      ? 'bg-indigo-50 border-indigo-200 ring-2 ring-indigo-500/10' 
                      : 'bg-gray-50/40 border-gray-150 hover:bg-gray-50'
                  }`}
                >
                  <div className="flex items-center justify-between gap-1">
                    <span className="text-[9px] font-extrabold text-gray-600 uppercase tracking-wider truncate max-w-[70%]" title={office.name}>
                      {office.name}
                    </span>
                    <span className="text-[8px] bg-gray-100 text-gray-500 px-1 py-0.2 rounded font-mono font-bold" title="Código de Acceso">
                      {office.code}
                    </span>
                  </div>
                  <div className="flex items-baseline justify-between mt-1">
                    <span className="text-sm font-extrabold text-gray-800">${officeTotal.toLocaleString('es-MX', { minimumFractionDigits: 2 })}</span>
                    <span className="text-[9px] font-semibold text-gray-400">{officeExpenses.length}g</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Week Navigation & Controls row */}
      <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4">
        <div className="flex flex-wrap items-center gap-3 w-full xl:w-auto">
          {/* Week Selector */}
          <div className="flex items-center bg-white rounded-lg p-1 border shadow-sm">
            <button onClick={() => changeWeek(-1)} className="p-2 hover:bg-gray-100 rounded-md text-gray-600">
              <ChevronLeft className="w-5 h-5" />
            </button>
            <div className="px-4 py-1 font-semibold text-gray-700 min-w-[160px] text-center capitalize text-sm">
              {weekRange.label}
            </div>
            <button onClick={() => changeWeek(1)} className="p-2 hover:bg-gray-100 rounded-md text-gray-600">
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>

          {/* Office filter selector for Global admin view */}
          {multiOfficeEnabled && !officeSession && offices.length > 0 && (
            <div className="flex items-center bg-white rounded-lg px-3 py-1.5 border border-gray-200 shadow-sm text-xs">
              <span className="text-gray-500 font-semibold mr-2 flex items-center gap-1">
                <SlidersHorizontal className="w-3.5 h-3.5" /> Filtrar:
              </span>
              <select
                value={selectedOfficeFilter}
                onChange={(e) => setSelectedOfficeFilter(e.target.value)}
                className="bg-transparent border-none font-bold text-gray-700 outline-none pr-6 cursor-pointer focus:ring-0"
              >
                <option value="all">Todas las Oficinas</option>
                <option value="global">Matriz / Global</option>
                {offices.map(o => (
                  <option key={o.id} value={o.id}>{o.name}</option>
                ))}
              </select>
            </div>
          )}
        </div>

        <div className="flex gap-2 w-full xl:w-auto justify-end">
          <button 
            onClick={handleDownloadPDF}
            className="bg-white hover:bg-gray-50 text-gray-700 border border-gray-200 px-4 py-2 rounded-lg flex items-center justify-center transition-colors shadow-sm text-xs font-bold"
            title="Descargar PDF"
          >
            <FileText className="w-4 h-4 mr-1.5 text-red-500" /> PDF
          </button>
          
          <button 
            onClick={() => {
              setEditingId(null);
              setFormData({ 
                description: '', 
                amount: 0, 
                category: availableCategories[0] || 'Oficina', 
                date: new Date().toISOString().split('T')[0], 
                ticketImage: '', 
                officeId: officeSession ? officeSession.id : '' 
              });
              setIsModalOpen(true);
            }}
            className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg flex items-center justify-center transition-colors shadow-sm text-xs font-bold"
          >
            <Plus className="w-4 h-4 mr-1.5" /> Nuevo Gasto
          </button>
        </div>
      </div>

      {/* Summary Card for Selected Week */}
      <div className="bg-gradient-to-r from-green-50 to-emerald-50 border border-green-100 p-6 rounded-xl flex items-center justify-between">
        <div>
          <p className="text-green-800 font-medium mb-1">
            {officeSession 
              ? `Total Semana Actual (${officeSession.name})` 
              : `Total Semana Actual ${selectedOfficeFilter !== 'all' ? `(${offices.find(o => o.id === selectedOfficeFilter)?.name || 'Matriz'})` : '(Consolidado)'}`
            }
          </p>
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
              {multiOfficeEnabled && !officeSession && (
                <th className="p-4 font-semibold text-gray-600 hidden lg:table-cell">Oficina</th>
              )}
              <th className="p-4 font-semibold text-gray-600 hidden sm:table-cell">Categoría</th>
              <th className="p-4 font-semibold text-gray-600 hidden md:table-cell">Fecha</th>
              <th className="p-4 font-semibold text-gray-600 text-right">Monto</th>
              <th className="p-4 font-semibold text-gray-600 w-10"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {isLoading ? (
              <tr>
                <td colSpan={7} className="p-20 text-center">
                  <div className="flex flex-col items-center">
                    <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600 mb-4"></div>
                    <p className="text-gray-500 font-medium">Cargando gastos...</p>
                  </div>
                </td>
              </tr>
            ) : filteredExpenses.length === 0 ? (
              <tr>
                <td colSpan={7} className="p-12 text-center text-gray-400">
                  No hay gastos registrados en la semana del <span className="font-semibold text-gray-500">{weekRange.label}</span>.
                </td>
              </tr>
            ) : (
              filteredExpenses.map(expense => (
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
                    <div className="sm:hidden text-xs text-gray-400 mt-1 flex flex-wrap gap-2 items-center">
                      <span>{expense.category}</span>
                      <span>•</span>
                      <span>{expense.date}</span>
                      {multiOfficeEnabled && !officeSession && (
                        <>
                          <span>•</span>
                          <span className="text-indigo-600 font-semibold">
                            {offices.find(o => o.id === expense.officeId)?.name || 'Matriz/Global'}
                          </span>
                        </>
                      )}
                    </div>
                  </td>
                  {multiOfficeEnabled && !officeSession && (
                    <td className="p-4 hidden lg:table-cell">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-100">
                        <Building2 className="w-3 h-3 mr-1" />
                        {offices.find(o => o.id === expense.officeId)?.name || 'Matriz/Global'}
                      </span>
                    </td>
                  )}
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
              ))
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
                    value={formData.category || availableCategories[0]} onChange={e => setFormData({...formData, category: e.target.value})}>
                     {availableCategories.map(c => (
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

              {/* Optional Office Selector (Only if Multi-Office is enabled and admin is creating/editing) */}
              {multiOfficeEnabled && !officeSession && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Oficina / Sucursal</label>
                  <select 
                    className="w-full border p-2 rounded focus:ring-2 focus:ring-green-500 outline-none bg-white text-gray-900"
                    value={formData.officeId || ''} 
                    onChange={e => setFormData({...formData, officeId: e.target.value})}
                  >
                    <option value="">Matriz / Global</option>
                    {offices.map(office => (
                      <option key={office.id} value={office.id}>{office.name}</option>
                    ))}
                  </select>
                </div>
              )}

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

      {/* LOGIN TO OFFICE MODAL */}
      {showLoginModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm p-6 shadow-2xl">
            <div className="flex items-center gap-2.5 mb-4">
              <div className="p-1.5 rounded-lg bg-indigo-50 text-indigo-600">
                <Lock className="w-5 h-5" />
              </div>
              <h3 className="text-lg font-bold text-gray-800">Iniciar Sesión de Sucursal</h3>
            </div>
            
            <form onSubmit={(e) => {
              e.preventDefault();
              const found = offices.find(o => o.code === loginCode.trim());
              if (found) {
                setOfficeSession(found);
                localStorage.setItem('office_expense_session', JSON.stringify(found));
                setShowLoginModal(false);
                setLoginCode('');
                setLoginError('');
              } else {
                setLoginError('Código incorrecto o sucursal no encontrada.');
              }
            }} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Código de Acceso de Oficina</label>
                <input
                  required
                  type="password"
                  placeholder="Ingrese el código de la sucursal"
                  className="w-full border border-gray-200 p-2.5 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none bg-white text-gray-900 font-mono text-center text-lg tracking-widest placeholder:text-sm placeholder:tracking-normal"
                  value={loginCode}
                  onChange={e => {
                    setLoginCode(e.target.value);
                    setLoginError('');
                  }}
                />
                {loginError && (
                  <p className="text-red-500 text-xs mt-1 font-semibold flex items-center gap-1">
                    <AlertCircle className="w-3.5 h-3.5" /> {loginError}
                  </p>
                )}
              </div>
              
              <div className="flex justify-end gap-2.5 pt-3 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setShowLoginModal(false)}
                  className="px-4 py-2 text-xs font-bold text-gray-500 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold transition-colors shadow-sm"
                >
                  Verificar e Ingresar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MANAGE OFFICES MODAL */}
      {showManageOffices && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-3xl p-6 shadow-2xl max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100 mb-4 flex-shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="p-1.5 rounded-lg bg-gray-50 text-gray-600">
                  <Building2 className="w-5 h-5" />
                </div>
                <h3 className="text-lg font-bold text-gray-800">Gestionar Oficinas</h3>
              </div>
              <button 
                onClick={() => {
                  setShowManageOffices(false);
                  setEditingOfficeId(null);
                }}
                className="text-gray-400 hover:text-gray-600 transition-colors p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-12 gap-6 overflow-y-auto pr-1 flex-grow">
              {/* Left Column: Register or Edit office form */}
              <div className="md:col-span-5 space-y-4">
                {editingOfficeId ? (
                  <div className="bg-indigo-50/50 rounded-xl p-4 border border-indigo-100">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="text-xs font-extrabold text-indigo-700 uppercase tracking-wider">Editar Oficina</h4>
                      <button 
                        onClick={() => setEditingOfficeId(null)}
                        className="text-xs text-indigo-600 hover:underline font-bold"
                      >
                        Registrar Nueva
                      </button>
                    </div>
                    
                    <div className="space-y-3">
                      <div>
                        <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Nombre de la Oficina</label>
                        <input
                          type="text"
                          placeholder="Ej. Oficina Norte, Zacatecas, Everest"
                          className="w-full border border-gray-200 p-2 rounded-lg text-xs focus:ring-2 focus:ring-indigo-500 outline-none bg-white text-gray-900"
                          value={editingOfficeName}
                          onChange={e => {
                            setEditingOfficeName(e.target.value);
                            setOfficeFormError('');
                          }}
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Código de Acceso (Único)</label>
                        <input
                          type="text"
                          placeholder="Ej. NORT12, ZAC24, EVE88"
                          className="w-full border border-gray-200 p-2 rounded-lg text-xs font-mono focus:ring-2 focus:ring-indigo-500 outline-none bg-white text-gray-900"
                          value={editingOfficeCode}
                          onChange={e => {
                            setEditingOfficeCode(e.target.value.toUpperCase().replace(/\s/g, ''));
                            setOfficeFormError('');
                          }}
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Empleado Responsable</label>
                        <select
                          className="w-full border border-gray-200 p-2 rounded-lg text-xs focus:ring-2 focus:ring-indigo-500 outline-none bg-white text-gray-900"
                          value={editingOfficeResponsibleId}
                          onChange={e => setEditingOfficeResponsibleId(e.target.value)}
                        >
                          <option value="">-- Sin responsable asignado --</option>
                          {sortedEmployees.map(emp => (
                            <option key={emp.id} value={emp.id}>
                              {emp.firstName} {emp.lastName} ({emp.position})
                            </option>
                          ))}
                        </select>
                      </div>
                      {officeFormError && (
                        <p className="text-red-500 text-xs font-semibold flex items-center gap-1">
                          <AlertCircle className="w-3.5 h-3.5" /> {officeFormError}
                        </p>
                      )}
                      
                      <div className="flex gap-2.5">
                        <button
                          type="button"
                          onClick={() => setEditingOfficeId(null)}
                          className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-700 py-2 rounded-lg text-xs font-bold transition-all"
                        >
                          Cancelar
                        </button>
                        <button
                          type="button"
                          disabled={isRegisteringOffice}
                          onClick={async () => {
                            if (!editingOfficeName.trim() || !editingOfficeCode.trim()) {
                              setOfficeFormError('El nombre y el código son requeridos.');
                              return;
                            }
                            if (offices.some(o => o.code === editingOfficeCode.trim() && o.id !== editingOfficeId)) {
                              setOfficeFormError('Este código ya está registrado en otra oficina.');
                              return;
                            }
                            setIsRegisteringOffice(true);
                            try {
                              const selectedEmp = sortedEmployees.find(emp => emp.id === editingOfficeResponsibleId);
                              await updateOffice(editingOfficeId, {
                                name: editingOfficeName.trim(),
                                code: editingOfficeCode.trim(),
                                responsibleEmployeeId: editingOfficeResponsibleId || '',
                                responsibleEmployeeName: selectedEmp ? `${selectedEmp.firstName} ${selectedEmp.lastName}` : ''
                              });
                              setEditingOfficeId(null);
                              setOfficeFormError('');
                            } catch (e: any) {
                              setOfficeFormError(e.message || 'Error al guardar la oficina.');
                            } finally {
                              setIsRegisteringOffice(false);
                            }
                          }}
                          className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white py-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1 disabled:opacity-50"
                        >
                          {isRegisteringOffice ? 'Guardando...' : 'Guardar'}
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
                    <h4 className="text-xs font-extrabold text-gray-500 uppercase tracking-wider mb-3">Registrar Nueva Oficina</h4>
                    
                    <div className="space-y-3">
                      <div>
                        <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Nombre de la Oficina</label>
                        <input
                          type="text"
                          placeholder="Ej. Oficina Norte, Zacatecas, Everest"
                          className="w-full border border-gray-200 p-2 rounded-lg text-xs focus:ring-2 focus:ring-indigo-500 outline-none bg-white text-gray-900"
                          value={newOfficeName}
                          onChange={e => {
                            setNewOfficeName(e.target.value);
                            setOfficeFormError('');
                          }}
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Código de Acceso (Único)</label>
                        <input
                          type="text"
                          placeholder="Ej. NORT12, ZAC24, EVE88"
                          className="w-full border border-gray-200 p-2 rounded-lg text-xs font-mono focus:ring-2 focus:ring-indigo-500 outline-none bg-white text-gray-900"
                          value={newOfficeCode}
                          onChange={e => {
                            setNewOfficeCode(e.target.value.toUpperCase().replace(/\s/g, ''));
                            setOfficeFormError('');
                          }}
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Empleado Responsable (Opcional)</label>
                        <select
                          className="w-full border border-gray-200 p-2 rounded-lg text-xs focus:ring-2 focus:ring-indigo-500 outline-none bg-white text-gray-900"
                          value={newOfficeResponsibleId}
                          onChange={e => setNewOfficeResponsibleId(e.target.value)}
                        >
                          <option value="">-- Sin responsable asignado --</option>
                          {sortedEmployees.map(emp => (
                            <option key={emp.id} value={emp.id}>
                              {emp.firstName} {emp.lastName} ({emp.position})
                            </option>
                          ))}
                        </select>
                      </div>
                      {officeFormError && (
                        <p className="text-red-500 text-xs font-semibold flex items-center gap-1">
                          <AlertCircle className="w-3.5 h-3.5" /> {officeFormError}
                        </p>
                      )}
                      
                      <button
                        type="button"
                        disabled={isRegisteringOffice}
                        onClick={async () => {
                          if (!newOfficeName.trim() || !newOfficeCode.trim()) {
                            setOfficeFormError('El nombre y el código son requeridos.');
                            return;
                          }
                          if (offices.some(o => o.code === newOfficeCode.trim())) {
                            setOfficeFormError('Este código ya está registrado en otra oficina.');
                            return;
                          }
                          setIsRegisteringOffice(true);
                          try {
                            const selectedEmp = sortedEmployees.find(emp => emp.id === newOfficeResponsibleId);
                            await addOffice({
                              name: newOfficeName.trim(),
                              code: newOfficeCode.trim(),
                              responsibleEmployeeId: newOfficeResponsibleId || undefined,
                              responsibleEmployeeName: selectedEmp ? `${selectedEmp.firstName} ${selectedEmp.lastName}` : undefined
                            });
                            setNewOfficeName('');
                            setNewOfficeCode('');
                            setNewOfficeResponsibleId('');
                            setOfficeFormError('');
                          } catch (e: any) {
                            setOfficeFormError(e.message || 'Error al guardar la oficina.');
                          } finally {
                            setIsRegisteringOffice(false);
                          }
                        }}
                        className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1 disabled:opacity-50"
                      >
                        {isRegisteringOffice ? 'Guardando...' : (
                          <>
                            <Plus className="w-3.5 h-3.5" /> Registrar Oficina
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Right Column: List of registered offices */}
              <div className="md:col-span-7 space-y-3">
                <h4 className="text-xs font-extrabold text-gray-400 uppercase tracking-wider font-sans">Oficinas Registradas ({offices.length})</h4>
                {offices.length === 0 ? (
                  <p className="text-sm text-gray-400 italic text-center py-8 bg-gray-50 rounded-xl border border-dashed">
                    No hay oficinas registradas aún. Registre una a la izquierda.
                  </p>
                ) : (
                  <div className="divide-y divide-gray-100 border border-gray-200 rounded-xl overflow-hidden bg-white max-h-[360px] overflow-y-auto shadow-sm">
                    {offices.map(office => (
                      <div key={office.id} className="flex items-center justify-between p-3 hover:bg-gray-50 transition-all">
                        <div className="min-w-0 flex-1 pr-2">
                          <p className="font-bold text-sm text-gray-800 truncate" title={office.name}>{office.name}</p>
                          <p className="text-xs text-gray-400 font-mono mt-0.5">Código: <span className="font-bold text-indigo-600">{office.code}</span></p>
                          <p className="text-[11px] text-gray-500 font-medium mt-1 truncate">
                            Responsable: <span className="text-gray-700 font-semibold">{office.responsibleEmployeeName || 'Sin asignar'}</span>
                          </p>
                        </div>
                        <div className="flex items-center gap-1.5 flex-shrink-0">
                          <button
                            onClick={() => {
                              setEditingOfficeId(office.id);
                              setEditingOfficeName(office.name);
                              setEditingOfficeCode(office.code);
                              setEditingOfficeResponsibleId(office.responsibleEmployeeId || '');
                              setOfficeFormError('');
                            }}
                            className="text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 p-1.5 rounded-lg transition-colors"
                            title="Editar Oficina"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => {
                              setOfficeSession(office);
                              localStorage.setItem('office_expense_session', JSON.stringify(office));
                              setShowManageOffices(false);
                            }}
                            className="text-[10px] font-bold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 px-2.5 py-1.5 rounded-lg transition-colors"
                            title="Simular/Iniciar sesión como esta oficina"
                          >
                            Simular
                          </button>
                          <button
                            onClick={async () => {
                              if (confirm(`¿Eliminar la oficina "${office.name}"? Los gastos asociados conservarán su referencia pero no se podrán filtrar por oficina.`)) {
                                await deleteOffice(office.id);
                                if (editingOfficeId === office.id) {
                                  setEditingOfficeId(null);
                                }
                              }
                            }}
                            className="text-gray-300 hover:text-red-500 hover:bg-red-50 p-1.5 rounded-lg transition-colors"
                            title="Eliminar Oficina"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
            
            <div className="flex justify-end pt-3 border-t border-gray-100 mt-4 flex-shrink-0">
              <button
                type="button"
                onClick={() => {
                  setShowManageOffices(false);
                  setEditingOfficeId(null);
                }}
                className="px-4 py-2 text-xs font-bold text-gray-500 hover:bg-gray-100 rounded-lg transition-colors"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MANAGE CATEGORIES MODAL */}
      {showManageCategories && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100 mb-4">
              <div className="flex items-center gap-2.5">
                <div className="p-1.5 rounded-lg bg-gray-50 text-gray-600">
                  <Tag className="w-5 h-5 text-green-600" />
                </div>
                <h3 className="text-lg font-bold text-gray-800">Gestionar Categorías</h3>
              </div>
              <button 
                onClick={() => setShowManageCategories(false)}
                className="text-gray-400 hover:text-gray-600 transition-colors p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* List of custom categories */}
            <div className="space-y-3 mb-6">
              <h4 className="text-xs font-extrabold text-gray-400 uppercase tracking-wider font-sans">
                Categorías Personalizadas ({customCategories.length})
              </h4>
              
              {customCategories.length === 0 ? (
                <div className="p-4 bg-gray-50 rounded-xl border border-dashed text-center">
                  <p className="text-sm text-gray-500 font-medium">No hay categorías personalizadas registradas aún.</p>
                  <p className="text-[11px] text-gray-400 mt-1">Actualmente se aplican las categorías predeterminadas:</p>
                  <div className="flex flex-wrap justify-center gap-1.5 mt-2">
                    {defaultCategories.map(cat => (
                      <span key={cat} className="bg-white text-gray-600 border px-2 py-0.5 rounded text-[10px] font-medium">{cat}</span>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="divide-y divide-gray-100 border border-gray-200 rounded-xl overflow-hidden bg-white max-h-48 overflow-y-auto">
                  {customCategories.map(category => (
                    <div key={category.id} className="flex items-center justify-between p-3 hover:bg-gray-50 transition-all">
                      <div>
                        <p className="font-bold text-sm text-gray-800">{category.name}</p>
                      </div>
                      <button
                        onClick={async () => {
                          if (confirm(`¿Eliminar la categoría "${category.name}"?`)) {
                            await deleteExpenseCategory(category.id);
                          }
                        }}
                        className="text-gray-300 hover:text-red-500 transition-colors p-1"
                        title="Eliminar Categoría"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Register new category form */}
            <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
              <h4 className="text-xs font-extrabold text-gray-500 uppercase tracking-wider mb-3">Registrar Nueva Categoría</h4>
              
              <div className="space-y-3">
                <div>
                  <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Nombre de la Categoría</label>
                  <input
                    type="text"
                    placeholder="Ej. Viáticos, Publicidad, Papelería"
                    className="w-full border border-gray-200 p-2 rounded-lg text-xs focus:ring-2 focus:ring-green-500 outline-none bg-white text-gray-900"
                    value={newCategoryName}
                    onChange={e => {
                      setNewCategoryName(e.target.value);
                      setCategoryFormError('');
                    }}
                  />
                </div>
                {categoryFormError && (
                  <p className="text-red-500 text-xs font-semibold flex items-center gap-1">
                    <AlertCircle className="w-3.5 h-3.5" /> {categoryFormError}
                  </p>
                )}
                
                <button
                  type="button"
                  disabled={isRegisteringCategory}
                  onClick={async () => {
                    const trimmed = newCategoryName.trim();
                    if (!trimmed) {
                      setCategoryFormError('El nombre es requerido.');
                      return;
                    }
                    if (customCategories.some(c => c.name.toLowerCase() === trimmed.toLowerCase())) {
                      setCategoryFormError('Esta categoría ya está registrada.');
                      return;
                    }
                    setIsRegisteringCategory(true);
                    try {
                      await addExpenseCategory(trimmed);
                      setNewCategoryName('');
                      setCategoryFormError('');
                    } catch (e: any) {
                      setCategoryFormError(e.message || 'Error al guardar la categoría.');
                    } finally {
                      setIsRegisteringCategory(false);
                    }
                  }}
                  className="w-full bg-green-600 hover:bg-green-700 text-white py-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1 disabled:opacity-50"
                >
                  {isRegisteringCategory ? 'Guardando...' : (
                    <>
                      <Plus className="w-3.5 h-3.5" /> Registrar Categoría
                    </>
                  )}
                </button>
              </div>
            </div>
            
            <div className="flex justify-end pt-4 border-t border-gray-100 mt-4">
              <button
                type="button"
                onClick={() => setShowManageCategories(false)}
                className="px-4 py-2 text-xs font-bold text-gray-500 hover:bg-gray-100 rounded-lg transition-colors"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
