
import React, { useState } from 'react';
import { FileSignature, Plus, Trash2, Printer, FileText, User, Hash, Pencil } from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface PromissoryNotesProps {
  companyName: string;
}

interface ClientEntry {
  id: string;
  name: string;
  folio: string;
}

export const PromissoryNotes: React.FC<PromissoryNotesProps> = ({ companyName }) => {
  const [clients, setClients] = useState<ClientEntry[]>([]);
  const [currentName, setCurrentName] = useState('');
  // Default value set to 'PAGARÉ ORIGINAL'
  const [currentFolio, setCurrentFolio] = useState('PAGARÉ ORIGINAL');
  
  // Editable Legal Text State
  const [legalText, setLegalText] = useState("Por medio de la presente, los abajo firmantes manifiestan de plena conformidad que han recibido el pagaré original correspondiente a su crédito, deslindando a la empresa de cualquier responsabilidad posterior a esta firma.");

  const handleAddClient = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentName.trim()) return;

    const newClient: ClientEntry = {
      id: Date.now().toString(),
      name: currentName.trim(),
      folio: currentFolio.trim() || 'PAGARÉ ORIGINAL'
    };

    setClients([...clients, newClient]);
    setCurrentName('');
    // Reset to default value instead of empty
    setCurrentFolio('PAGARÉ ORIGINAL');
  };

  const handleRemoveClient = (id: string) => {
    setClients(clients.filter(c => c.id !== id));
  };

  const generatePDF = () => {
    if (clients.length === 0) {
        alert("Agrega al menos un cliente a la lista.");
        return;
    }

    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.width;
    const pageHeight = doc.internal.pageSize.height;
    const today = new Date();
    const dateStr = today.toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' });

    // --- Header ---
    doc.setFont("helvetica", "bold");
    doc.setFontSize(18);
    doc.setTextColor(40, 40, 40);
    // Company Name Centered
    const title = companyName ? companyName.toUpperCase() : "NOMBRE DE LA FINANCIERA";
    doc.text(title, pageWidth / 2, 20, { align: 'center' });

    doc.setFontSize(14);
    doc.setFont("helvetica", "normal");
    doc.text("ACTA DE ENTREGA DE PAGARÉS", pageWidth / 2, 30, { align: 'center' });

    // --- Date ---
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text(`Fecha de emisión: ${dateStr}`, pageWidth - 14, 40, { align: 'right' });

    // --- Legal Text (Dynamic) ---
    doc.setFontSize(11);
    doc.setTextColor(0);
    
    const splitText = doc.splitTextToSize(legalText, pageWidth - 28);
    doc.text(splitText, 14, 55);

    // --- Table ---
    const tableBody = clients.map(client => [
      client.name.toUpperCase(),
      client.folio,
      '' // Empty column for signature
    ]);

    // Calculate Y position based on text length to avoid overlap
    const textHeight = doc.getTextDimensions(splitText).h;
    const startY = 55 + textHeight + 10;

    autoTable(doc, {
      startY: startY,
      head: [['Nombre del Cliente', 'Referencia', 'Firma de Conformidad']],
      body: tableBody,
      theme: 'grid',
      headStyles: {
        fillColor: [30, 41, 59], // Dark Slate
        textColor: 255,
        fontStyle: 'bold',
        halign: 'center'
      },
      columnStyles: {
        0: { cellWidth: 80, valign: 'middle' },
        1: { cellWidth: 40, valign: 'middle', halign: 'center' },
        2: { cellWidth: 'auto', minCellHeight: 15, valign: 'middle' } // Wider column for signature
      },
      styles: {
        fontSize: 10,
        cellPadding: 3,
        lineColor: [200, 200, 200]
      },
      didParseCell: function(data) {
        // Increase row height for signature space
        if (data.section === 'body') {
            data.row.height = 20; 
        }
      }
    });

    // --- Responsible Signature (Bottom Left) ---
    const finalY = (doc as any).lastAutoTable.finalY;
    
    // Posición fija desde abajo (ej. 35 unidades desde el borde inferior)
    // El footer está a 10 unidades del borde, la firma estará encima.
    const signatureBottomMargin = 35;
    const signatureY = pageHeight - signatureBottomMargin;
    
    // Verificar si la tabla choca con el área de la firma
    // Si la tabla termina muy abajo (más allá de signatureY - margen de seguridad), agregamos página
    if (finalY > (signatureY - 20)) {
        doc.addPage();
    }

    // Dibujar línea y texto alineado a la izquierda
    const signatureXStart = 14;         // Margen izquierdo estándar
    const signatureWidth = 70;          // Longitud de la línea
    
    doc.setDrawColor(0);
    doc.setLineWidth(0.5);
    // Línea de firma
    doc.line(signatureXStart, signatureY, signatureXStart + signatureWidth, signatureY);
    
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(0);
    // Texto centrado respecto a la línea
    doc.text("FIRMA DEL RESPONSABLE", signatureXStart + (signatureWidth / 2), signatureY + 5, { align: 'center' });

    // --- Footer ---
    const pageCount = (doc as any).internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setTextColor(150);
      doc.text(`Documento generado por Mi Oficina - ${title}`, 14, pageHeight - 10);
      doc.text(`Página ${i} de ${pageCount}`, pageWidth - 14, pageHeight - 10, { align: 'right' });
    }

    // Open/Save
    window.open(doc.output('bloburl'), '_blank');
  };

  return (
    <div className="p-6 max-w-5xl mx-auto h-full flex flex-col">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-800 flex items-center">
            <FileSignature className="w-8 h-8 mr-2 text-indigo-600" />
            Entrega de Pagarés
          </h2>
          {/* Subtítulo eliminado según solicitud */}
        </div>
        
        {clients.length > 0 && (
            <button 
                onClick={generatePDF}
                className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-3 rounded-xl shadow-lg flex items-center font-bold transition-all hover:scale-105 active:scale-95"
            >
                <Printer className="w-5 h-5 mr-2" /> Generar Documento PDF
            </button>
        )}
      </div>

      <div className="flex flex-col lg:flex-row gap-8 flex-1 overflow-hidden">
        
        {/* INPUT FORM */}
        <div className="w-full lg:w-1/3 flex flex-col gap-6">
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center border-b pb-2">
                    <Plus className="w-5 h-5 mr-2 text-green-600" /> Agregar Cliente
                </h3>
                
                <form onSubmit={handleAddClient} className="space-y-4">
                    <div>
                        <label className="block text-xs font-bold text-gray-500 mb-1 uppercase">Nombre Completo</label>
                        <div className="relative">
                            <User className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                            <input 
                                type="text" 
                                className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-200 focus:border-indigo-400 outline-none text-gray-800"
                                placeholder="Ej: Juan Pérez López"
                                value={currentName}
                                onChange={(e) => setCurrentName(e.target.value)}
                                autoFocus
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-gray-500 mb-1 uppercase">REFERENCIA</label>
                         <div className="relative">
                            <Hash className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                            <input 
                                type="text" 
                                className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-200 focus:border-indigo-400 outline-none text-gray-800"
                                placeholder="Ej: PAGARÉ ORIGINAL"
                                value={currentFolio}
                                onChange={(e) => setCurrentFolio(e.target.value)}
                            />
                        </div>
                    </div>

                    <button 
                        type="submit"
                        disabled={!currentName.trim()}
                        className="w-full bg-gray-800 hover:bg-gray-900 text-white font-medium py-3 rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex justify-center items-center"
                    >
                        Agregar a la Lista
                    </button>
                </form>
            </div>

            <div className="bg-blue-50 p-4 rounded-xl border border-blue-100 flex flex-col">
                <h4 className="font-bold text-blue-800 text-sm mb-2 flex items-center justify-between">
                    <span className="flex items-center"><FileText className="w-4 h-4 mr-2" /> Texto Legal del Acta</span>
                    <Pencil className="w-3 h-3 text-blue-400" />
                </h4>
                <textarea 
                    className="w-full bg-white/50 border border-blue-200 rounded-lg p-2 text-xs text-blue-900 focus:ring-2 focus:ring-blue-300 outline-none resize-none h-32 leading-relaxed"
                    value={legalText}
                    onChange={(e) => setLegalText(e.target.value)}
                />
            </div>
        </div>

        {/* LIST PREVIEW */}
        <div className="w-full lg:w-2/3 flex flex-col bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="p-4 bg-gray-50 border-b border-gray-100 flex justify-between items-center">
                <h3 className="font-bold text-gray-700">Clientes en esta Acta ({clients.length})</h3>
                {clients.length > 0 && (
                    <button 
                        onClick={() => { if(confirm('¿Borrar toda la lista?')) setClients([]); }}
                        className="text-xs text-red-500 hover:text-red-700 font-medium hover:underline"
                    >
                        Limpiar Todo
                    </button>
                )}
            </div>

            <div className="flex-1 overflow-y-auto p-2">
                {clients.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-gray-300 py-12">
                        <FileSignature className="w-16 h-16 mb-4 opacity-20" />
                        <p className="text-sm font-medium">La lista está vacía</p>
                        <p className="text-xs">Agrega clientes para generar el documento</p>
                    </div>
                ) : (
                    <div className="space-y-2">
                        {clients.map((client, index) => (
                            <div key={client.id} className="flex items-center justify-between p-4 bg-white border border-gray-100 rounded-xl hover:shadow-sm hover:border-gray-200 transition-all group animate-fade-in">
                                <div className="flex items-center">
                                    <span className="w-8 h-8 rounded-full bg-gray-100 text-gray-500 flex items-center justify-center font-bold text-xs mr-3">
                                        {index + 1}
                                    </span>
                                    <div>
                                        <h4 className="font-bold text-gray-800">{client.name}</h4>
                                        <p className="text-xs text-gray-500 font-mono">Ref: {client.folio}</p>
                                    </div>
                                </div>
                                <button 
                                    onClick={() => handleRemoveClient(client.id)}
                                    className="p-2 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                                    title="Quitar de la lista"
                                >
                                    <Trash2 className="w-5 h-5" />
                                </button>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
      </div>
    </div>
  );
};
