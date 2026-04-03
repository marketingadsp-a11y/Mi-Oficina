import React, { useState, useMemo } from 'react';
import { Plus, Trash2, Clock, CheckCircle, AlertTriangle, Pencil, Search, Filter, X, Calendar, Upload, FileText, Download, Paperclip } from 'lucide-react';
import { Task, TaskStatus, Employee } from '../types';
import { addTask, updateTaskStatus, deleteTask, updateTask } from '../services/dbService';

interface TasksProps {
  tasks: Task[];
  employees: Employee[];
  refreshData: () => void;
}

const INITIAL_FORM_STATE = {
  title: '', 
  description: '', 
  status: TaskStatus.TODO, 
  priority: 'Media', 
  dueDate: new Date().toISOString().split('T')[0],
  assignedTo: ''
};

export const Tasks: React.FC<TasksProps> = ({ tasks, employees, refreshData }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDeliveryModalOpen, setIsDeliveryModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deliveringTask, setDeliveringTask] = useState<Task | null>(null);
  const [deliveryFile, setDeliveryFile] = useState<string>('');
  
  // Filter States
  const [searchTerm, setSearchTerm] = useState('');
  const [filterAssignee, setFilterAssignee] = useState('');
  const [filterDate, setFilterDate] = useState('');

  // Cast priority to string to avoid type issues with Partial<Task> initialization
  const [formData, setFormData] = useState<Partial<Task>>({
    ...INITIAL_FORM_STATE,
    priority: 'Media' as any,
    attachmentUrl: ''
  });

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>, field: 'attachmentUrl' | 'deliveryUrl') => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = () => {
      if (field === 'attachmentUrl') {
        setFormData(prev => ({ ...prev, attachmentUrl: reader.result as string }));
      } else {
        setDeliveryFile(reader.result as string);
      }
    };
    reader.readAsDataURL(file);
  };

  const openDeliveryModal = (task: Task) => {
    setDeliveringTask(task);
    setDeliveryFile('');
    setIsDeliveryModalOpen(true);
  };

  const handleDeliverTask = async () => {
    if (deliveringTask && deliveryFile) {
      await updateTask(deliveringTask.id, {
        status: TaskStatus.DONE,
        deliveryUrl: deliveryFile,
        deliveredAt: new Date().toISOString()
      });
      setIsDeliveryModalOpen(false);
      setDeliveringTask(null);
      setDeliveryFile('');
      refreshData();
    } else {
      alert("Por favor sube un archivo para entregar la tarea.");
    }
  };

  const filteredTasks = useMemo(() => {
    return tasks.filter(task => {
      const matchesSearch = (task.title.toLowerCase().includes(searchTerm.toLowerCase())) || 
                            (task.description?.toLowerCase().includes(searchTerm.toLowerCase()));
      const matchesAssignee = filterAssignee ? task.assignedTo === filterAssignee : true;
      const matchesDate = filterDate ? task.dueDate === filterDate : true;
      
      return matchesSearch && matchesAssignee && matchesDate;
    });
  }, [tasks, searchTerm, filterAssignee, filterDate]);

  const clearFilters = () => {
    setSearchTerm('');
    setFilterAssignee('');
    setFilterDate('');
  };

  const handleOpenModal = (task?: Task) => {
    if (task) {
      setEditingId(task.id);
      setFormData(task);
    } else {
      setEditingId(null);
      setFormData({
        ...INITIAL_FORM_STATE,
        priority: 'Media' as any
      });
    }
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (formData.title) {
      if (editingId) {
        await updateTask(editingId, formData);
      } else {
        await addTask(formData as Omit<Task, 'id'>);
      }
      setIsModalOpen(false);
      refreshData();
    }
  };

  const handleStatusChange = async (task: Task, newStatus: TaskStatus) => {
    await updateTaskStatus(task.id, newStatus);
    refreshData();
  };

  const getPriorityColor = (p: string) => {
    switch (p) {
      case 'Alta': return 'text-red-600 bg-red-50 border-red-200';
      case 'Media': return 'text-orange-600 bg-orange-50 border-orange-200';
      default: return 'text-green-600 bg-green-50 border-green-200';
    }
  };

  const Column = ({ title, status, icon: Icon, colorClass }: { title: string, status: TaskStatus, icon: any, colorClass: string }) => {
    const tasksInColumn = filteredTasks.filter(t => t.status === status);
    
    return (
      <div className="flex-1 min-w-[300px] bg-gray-50 rounded-xl p-4 flex flex-col h-full">
        <div className={`flex items-center mb-4 pb-2 border-b-2 ${colorClass}`}>
          <Icon className="w-5 h-5 mr-2 opacity-70" />
          <h3 className="font-bold text-gray-700">{title}</h3>
          <span className="ml-auto bg-white px-2 py-0.5 rounded text-xs font-bold shadow-sm">
            {tasksInColumn.length}
          </span>
        </div>
        
        <div className="space-y-3 overflow-y-auto flex-1 pr-1 custom-scrollbar">
          {tasksInColumn.length === 0 ? (
            <div className="text-center py-10 text-gray-400 text-sm italic">
              No hay tareas
            </div>
          ) : (
            tasksInColumn.map(task => (
              <div key={task.id} className="bg-white p-4 rounded-lg shadow-sm border border-gray-100 hover:shadow-md transition-all group">
                <div className="flex justify-between items-start mb-2">
                  <span className={`text-[10px] px-2 py-0.5 rounded border uppercase font-bold tracking-wide ${getPriorityColor(task.priority)}`}>
                    {task.priority}
                  </span>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button 
                      onClick={() => handleOpenModal(task)} 
                      className="text-gray-300 hover:text-blue-500 hover:bg-blue-50 rounded p-1"
                      title="Editar"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button 
                      onClick={() => { if(confirm('¿Eliminar?')) { deleteTask(task.id); refreshData(); }}} 
                      className="text-gray-300 hover:text-red-500 hover:bg-red-50 rounded p-1"
                      title="Eliminar"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                
                <h4 className="font-bold text-gray-800 mb-1">{task.title}</h4>
                <p className="text-xs text-gray-500 mb-3 line-clamp-2">{task.description}</p>
                
                {/* Files Section */}
                {(task.attachmentUrl || task.deliveryUrl) && (
                  <div className="flex gap-2 mb-3">
                    {task.attachmentUrl && (
                      <a 
                        href={task.attachmentUrl} 
                        download={`adjunto-${task.id}`}
                        className="text-[10px] flex items-center bg-gray-100 px-2 py-1 rounded text-gray-600 hover:bg-gray-200"
                        title="Descargar Adjunto"
                      >
                        <Paperclip className="w-3 h-3 mr-1" /> Adjunto
                      </a>
                    )}
                    {task.deliveryUrl && (
                      <a 
                        href={task.deliveryUrl} 
                        download={`entrega-${task.id}`}
                        className="text-[10px] flex items-center bg-green-50 px-2 py-1 rounded text-green-600 hover:bg-green-100"
                        title="Descargar Entrega"
                      >
                        <FileText className="w-3 h-3 mr-1" /> Entrega
                      </a>
                    )}
                  </div>
                )}

                <div className="flex justify-between items-end">
                  <div className="text-xs text-gray-400">
                    <div className="flex items-center mb-1"><Clock className="w-3 h-3 mr-1"/> {task.dueDate}</div>
                    <div>{employees.find(e => e.id === task.assignedTo)?.firstName || 'Sin asignar'}</div>
                  </div>
                  
                  <div className="flex gap-1">
                    {status !== TaskStatus.TODO && (
                      <button onClick={() => handleStatusChange(task, TaskStatus.TODO)} className="w-6 h-6 rounded bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-xs" title="Mover a Por Hacer">←</button>
                    )}
                    {status !== TaskStatus.IN_PROGRESS && (
                      <button onClick={() => handleStatusChange(task, TaskStatus.IN_PROGRESS)} className="w-6 h-6 rounded bg-blue-50 hover:bg-blue-100 text-blue-600 flex items-center justify-center text-xs" title="Mover a En Progreso">
                        {status === TaskStatus.TODO ? '→' : '←'}
                      </button>
                    )}
                    {status !== TaskStatus.DONE && (
                      <button 
                        onClick={() => openDeliveryModal(task)} 
                        className="w-6 h-6 rounded bg-green-50 hover:bg-green-100 text-green-600 flex items-center justify-center text-xs" 
                        title="Entregar y Completar"
                      >
                        <Upload className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="p-6 h-full flex flex-col">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">Tablero de Tareas</h2>
          <p className="text-sm text-gray-500">Gestiona y organiza el flujo de trabajo</p>
        </div>
        <button onClick={() => handleOpenModal()} className="bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 rounded-lg flex items-center transition-colors shadow-sm whitespace-nowrap">
          <Plus className="w-5 h-5 mr-2" /> Nueva Tarea
        </button>
      </div>

      {/* Search and Filter Bar */}
      <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 mb-6 grid grid-cols-1 md:grid-cols-4 gap-4 items-center">
        <div className="relative">
          <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 transform -translate-y-1/2" />
          <input 
            type="text" 
            placeholder="Buscar tarea..." 
            className="w-full pl-9 pr-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-orange-200 focus:border-orange-400 outline-none transition-all"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <div className="relative">
          <Filter className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 transform -translate-y-1/2" />
          <select 
            className="w-full pl-9 pr-3 py-2 border rounded-lg text-sm bg-white focus:ring-2 focus:ring-orange-200 focus:border-orange-400 outline-none appearance-none transition-all"
            value={filterAssignee}
            onChange={(e) => setFilterAssignee(e.target.value)}
          >
            <option value="">Todo el Personal</option>
            {employees.map(e => (
              <option key={e.id} value={e.id}>{e.firstName} {e.lastName}</option>
            ))}
          </select>
        </div>

        <div className="relative">
          <Calendar className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 transform -translate-y-1/2" />
          <input 
            type="date" 
            className="w-full pl-9 pr-3 py-2 border rounded-lg text-sm bg-white focus:ring-2 focus:ring-orange-200 focus:border-orange-400 outline-none transition-all"
            value={filterDate}
            onChange={(e) => setFilterDate(e.target.value)}
          />
        </div>

        {(searchTerm || filterAssignee || filterDate) && (
          <button 
            onClick={clearFilters}
            className="flex items-center justify-center px-4 py-2 text-sm text-gray-500 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors border border-dashed border-gray-300 hover:border-red-200"
          >
            <X className="w-4 h-4 mr-2" /> Limpiar Filtros
          </button>
        )}
      </div>

      <div className="flex gap-6 overflow-x-auto pb-4 h-[calc(100vh-280px)]">
        <Column title="Por Hacer" status={TaskStatus.TODO} icon={AlertTriangle} colorClass="border-gray-300" />
        <Column title="En Progreso" status={TaskStatus.IN_PROGRESS} icon={Clock} colorClass="border-blue-400" />
        <Column title="Completado" status={TaskStatus.DONE} icon={CheckCircle} colorClass="border-green-400" />
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-2xl">
            <h3 className="text-xl font-bold mb-4 text-gray-800">{editingId ? 'Editar Tarea' : 'Nueva Tarea'}</h3>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="text-xs text-gray-500">Título</label>
                <input required placeholder="Título" className="w-full border p-2 rounded bg-white text-gray-900 placeholder-gray-500" value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} />
              </div>
              
              <div>
                <label className="text-xs text-gray-500">Descripción</label>
                <textarea placeholder="Descripción" className="w-full border p-2 rounded h-20 bg-white text-gray-900 placeholder-gray-500" value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                 <div>
                   <label className="text-xs text-gray-500">Asignar a (Solo Oficina)</label>
                   <select className="w-full border p-2 rounded bg-white text-gray-900" value={formData.assignedTo || ''} onChange={e => setFormData({...formData, assignedTo: e.target.value})}>
                     <option value="">-- Seleccionar --</option>
                     {employees
                        .filter(e => e.category === 'Oficina')
                        .map(e => <option key={e.id} value={e.id}>{e.firstName} {e.lastName}</option>)}
                   </select>
                 </div>
                 <div>
                   <label className="text-xs text-gray-500">Prioridad</label>
                   <select className="w-full border p-2 rounded bg-white text-gray-900" value={formData.priority} onChange={e => setFormData({...formData, priority: e.target.value as any})}>
                     <option>Baja</option>
                     <option>Media</option>
                     <option>Alta</option>
                   </select>
                 </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                   <label className="text-xs text-gray-500">Fecha Límite</label>
                   <input type="date" className="w-full border p-2 rounded bg-white text-gray-900" value={formData.dueDate} onChange={e => setFormData({...formData, dueDate: e.target.value})} />
                </div>
                <div>
                   <label className="text-xs text-gray-500">Estado</label>
                   <select className="w-full border p-2 rounded bg-white text-gray-900" value={formData.status} onChange={e => setFormData({...formData, status: e.target.value as TaskStatus})}>
                     <option value={TaskStatus.TODO}>{TaskStatus.TODO}</option>
                     <option value={TaskStatus.IN_PROGRESS}>{TaskStatus.IN_PROGRESS}</option>
                     <option value={TaskStatus.DONE}>{TaskStatus.DONE}</option>
                   </select>
                </div>
              </div>

              <div>
                <label className="text-xs text-gray-500 block mb-1">Adjuntar Archivo (Opcional)</label>
                <div className="flex items-center gap-2">
                  <label className="cursor-pointer bg-gray-100 hover:bg-gray-200 text-gray-600 px-3 py-2 rounded-lg flex items-center text-sm transition-colors">
                    <Paperclip className="w-4 h-4 mr-2" />
                    {formData.attachmentUrl ? 'Cambiar Archivo' : 'Seleccionar Archivo'}
                    <input type="file" className="hidden" onChange={(e) => handleFileUpload(e, 'attachmentUrl')} />
                  </label>
                  {formData.attachmentUrl && (
                    <span className="text-xs text-green-600 flex items-center">
                      <CheckCircle className="w-3 h-3 mr-1" /> Archivo adjunto
                    </span>
                  )}
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded">Cancelar</button>
                <button type="submit" className="px-4 py-2 bg-orange-600 text-white rounded hover:bg-orange-700">
                  {editingId ? 'Actualizar' : 'Crear Tarea'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {isDeliveryModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-2xl">
            <h3 className="text-xl font-bold mb-4 text-gray-800">Entregar Tarea</h3>
            <p className="text-sm text-gray-600 mb-4">Para completar la tarea <strong>{deliveringTask?.title}</strong>, por favor sube el archivo de entrega.</p>
            
            <div className="space-y-4">
              <div className="border-2 border-dashed border-gray-300 rounded-xl p-6 text-center hover:bg-gray-50 transition-colors relative">
                {deliveryFile ? (
                  <div className="text-center">
                    <FileText className="w-12 h-12 text-green-500 mx-auto mb-2" />
                    <p className="text-sm font-medium text-green-600">Archivo seleccionado</p>
                    <button 
                      onClick={() => setDeliveryFile('')}
                      className="text-xs text-red-500 mt-2 hover:underline"
                    >
                      Cambiar archivo
                    </button>
                  </div>
                ) : (
                  <label className="cursor-pointer block">
                    <Upload className="w-10 h-10 text-gray-400 mx-auto mb-2" />
                    <span className="text-sm text-gray-600 font-medium">Click para subir archivo</span>
                    <input type="file" className="hidden" onChange={(e) => handleFileUpload(e, 'deliveryUrl')} />
                  </label>
                )}
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button 
                  onClick={() => setIsDeliveryModalOpen(false)} 
                  className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded"
                >
                  Cancelar
                </button>
                <button 
                  onClick={handleDeliverTask} 
                  disabled={!deliveryFile}
                  className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Entregar y Completar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};