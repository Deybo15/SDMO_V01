import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
    Box,
    Calendar,
    UserCircle,
    Search,
    PlusCircle,
    Save,
    Printer,
    CheckCircle,
    AlertTriangle,
    Info,
    Loader2,
    Ticket,
    MessageSquare,
    ChevronRight
} from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

// Shared Components
import { PageHeader } from '../components/ui/PageHeader';
import { TransactionTable } from '../components/ui/TransactionTable';
import ArticuloSearchModal from '../components/ArticleSearchModal';
import ColaboradorSearchModal from '../components/ColaboradorSearchModal';
import { Articulo, DetalleSalida, Colaborador } from '../types/inventory';

export default function RealizarSalida() {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();

    // 1. Transaction State
    const [loading, setLoading] = useState(false);
    const [feedback, setFeedback] = useState<{ message: string, type: 'success' | 'error' | 'warning' | 'info' } | null>(null);
    const [items, setItems] = useState<DetalleSalida[]>([{
        codigo_articulo: '',
        articulo: '',
        cantidad: 0,
        unidad: '',
        precio_unitario: 0,
        marca: '',
        cantidad_disponible: 0
    }]);

    // 2. Header State
    const [autorizaId, setAutorizaId] = useState('');
    const [autorizaAlias, setAutorizaAlias] = useState('');
    const [retiraId, setRetiraId] = useState('');
    const [retiraName, setRetiraName] = useState('');
    const [numeroSolicitud, setNumeroSolicitud] = useState('');
    const [comentarios, setComentarios] = useState('');
    const [finalizado, setFinalizado] = useState(false);
    const [ultimoIdSalida, setUltimoIdSalida] = useState<number | null>(null);

    // 3. Data State
    const [colaboradores, setColaboradores] = useState<{ autorizados: Colaborador[], todos: Colaborador[] }>({
        autorizados: [],
        todos: []
    });
    const [fechaActual, setFechaActual] = useState('');

    // 4. Modals State
    const [showBusquedaModal, setShowBusquedaModal] = useState(false);
    const [busquedaTipo, setBusquedaTipo] = useState<'autoriza' | 'retira'>('autoriza');
    const [showArticulosModal, setShowArticulosModal] = useState(false);
    const [currentRowIndex, setCurrentRowIndex] = useState<number>(0);

    const themeColor = 'teal';

    // Initialize
    useEffect(() => {
        const now = new Date();
        setFechaActual(now.toLocaleDateString('es-ES', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        }));

        const numSol = searchParams.get('numero');
        if (numSol) setNumeroSolicitud(numSol);

        fetchColaboradores();
    }, [searchParams]);

    // Load    const fetchColaboradores = async () => {
    try {
        const { data: { user } } = await supabase.auth.getUser();
        const userEmail = user?.email;

        const { data, error } = await supabase
            .from('colaboradores_06')
            .select('identificacion, alias, colaborador, autorizado, condicion_laboral, correo_colaborador')
            .or('autorizado.eq.true,condicion_laboral.eq.false');

        if (error) throw error;

        if (data) {
            const mappedData = data.map((c: any) => ({
                ...c,
                colaborador: c.colaborador || c.alias
            }));

            setColaboradores({
                autorizados: mappedData.filter((c: any) => c.autorizado),
                todos: mappedData
            });

            if (userEmail) {
                const matched = mappedData.find((c: any) =>
                    c.correo_colaborador?.toLowerCase() === userEmail.toLowerCase() && c.autorizado
                );
                if (matched) {
                    setAutorizaId(matched.identificacion);
                    setAutorizaAlias(matched.alias || matched.colaborador);
                }
            }
        }
    } catch (err) {
        console.error('Error fetching colaboradores:', err);
    }
};

// Table Actions
const agregarFila = () => {
    setItems([...items, {
        codigo_articulo: '',
        articulo: '',
        cantidad: 0,
        unidad: '',
        precio_unitario: 0,
        marca: '',
        cantidad_disponible: 0
    }]);
};

const eliminarFila = (index: number) => {
    if (items.length === 1) {
        setItems([{
            codigo_articulo: '',
            articulo: '',
            cantidad: 0,
            unidad: '',
            precio_unitario: 0,
            marca: '',
            cantidad_disponible: 0
        }]);
        return;
    }
    const newItems = [...items];
    newItems.splice(index, 1);
    setItems(newItems);
};

const updateDetalle = (index: number, field: keyof DetalleSalida, value: any) => {
    const newItems = [...items];
    newItems[index] = { ...newItems[index], [field]: value };
    setItems(newItems);
};

// Modals Handlers
const handleOpenArticulos = (index: number) => {
    setCurrentRowIndex(index);
    setShowArticulosModal(true);
};

const handleSelectArticulo = (articulo: any) => {
    const itemExistente = items.some((it, i) => it.codigo_articulo === articulo.codigo_articulo && i !== currentRowIndex);

    if (itemExistente) {
        showAlert('Este artículo ya está en la lista', 'warning');
        return;
    }

    const newItems = [...items];
    newItems[currentRowIndex] = {
        codigo_articulo: articulo.codigo_articulo,
        articulo: articulo.nombre_articulo,
        cantidad: 1,
        unidad: articulo.unidad || 'UND',
        precio_unitario: articulo.precio_unitario || 0,
        marca: articulo.marca || 'S/M',
        cantidad_disponible: articulo.cantidad_disponible || 0
    };
    setItems(newItems);
    setShowArticulosModal(false);
};

const handleOpenBusqueda = (tipo: 'autoriza' | 'retira') => {
    setBusquedaTipo(tipo);
    setShowBusquedaModal(true);
};

const handleSelectColaborador = (colab: any) => {
    if (busquedaTipo === 'autoriza') {
        setAutorizaId(colab.identificacion);
        setAutorizaAlias(colab.alias || colab.colaborador);
    } else {
        setRetiraId(colab.identificacion);
        setRetiraName(colab.colaborador);
    }
};

const showAlert = (message: string, type: 'success' | 'error' | 'warning' | 'info') => {
    setFeedback({ message, type });
    setTimeout(() => setFeedback(null), 4000);
};

// Save Logic
const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validations
    if (!autorizaId || !retiraId) {
        showAlert('Debe seleccionar quien autoriza y quien retira', 'error');
        return;
    }

    const itemsValidos = items.filter(i => i.codigo_articulo !== '' && i.cantidad > 0);
    if (itemsValidos.length === 0) {
        showAlert('Debe agregar al menos un artículo con cantidad válida', 'error');
        return;
    }

    for (const item of itemsValidos) {
        if (item.cantidad > item.cantidad_disponible!) {
            showAlert(`Stock insuficiente para ${item.articulo}`, 'error');
            return;
        }
    }

    setLoading(true);
    try {
        // 1. Get current user session
        const { data: { user } } = await supabase.auth.getUser();

        // 2. Insert Header (salida_articulo_08)
        const { data: salida, error: errorSalida } = await supabase
            .from('salida_articulo_08')
            .insert({
                fecha_salida: new Date().toISOString(),
                solicitud_articulo: numeroSolicitud || null,
                autoriza_salida: autorizaId,
                retira_salida: retiraId,
                personal_entrega: user?.email || 'sistema',
                observaciones: comentarios || null
            })
            .select('id_salida')
            .single();

        if (errorSalida) throw errorSalida;

        // 3. Insert Details (dato_salida_13)
        const detalles = itemsValidos.map(item => ({
            id_salida: salida.id_salida,
            articulo: item.codigo_articulo,
            cantidad: item.cantidad,
            precio_unitario: item.precio_unitario,
            subtotal: item.cantidad * item.precio_unitario,
            registro_salida: salida.id_salida
        }));

        const { error: errorDetalles } = await supabase
            .from('dato_salida_13')
            .insert(detalles);

        if (errorDetalles) throw errorDetalles;

        // 4. Success Actions
        setUltimoIdSalida(salida.id_salida);
        setFinalizado(true);
        showAlert('¡Salida registrada exitosamente!', 'success');

    } catch (err: any) {
        console.error('Error guardando salida:', err);
        showAlert(err.message || 'Error al guardar la salida', 'error');
    } finally {
        setLoading(false);
    }
};

const handleFinalizar = () => {
    generarPDF();
    navigate(-1);
};

const generarPDF = () => {
    if (!ultimoIdSalida) return;

    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();

    // Header
    doc.setFillColor(0, 128, 128);
    doc.rect(0, 0, pageWidth, 40, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(22);
    doc.setFont('helvetica', 'bold');
    doc.text('COMPROBANTE DE SALIDA', pageWidth / 2, 25, { align: 'center' });

    // Info Box
    doc.setTextColor(60, 60, 60);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    let y = 55;
    doc.text(`ID Transacción: #${ultimoIdSalida}`, 15, y);
    doc.text(`Fecha: ${new Date().toLocaleString()}`, 15, y + 6);
    doc.text(`Solicitud: ${numeroSolicitud || 'N/A'}`, 15, y + 12);

    doc.text(`Autoriza: ${autorizaAlias}`, 110, y);
    doc.text(`Retira: ${retiraName}`, 110, y + 6);

    // Table
    const tableData = items.filter(i => i.codigo_articulo !== '').map(item => [
        item.codigo_articulo,
        item.articulo,
        item.marca || 'N/A',
        item.cantidad,
        item.unidad,
        new Intl.NumberFormat('es-CR', { style: 'currency', currency: 'CRC' }).format(item.precio_unitario),
        new Intl.NumberFormat('es-CR', { style: 'currency', currency: 'CRC' }).format(item.cantidad * item.precio_unitario)
    ]);

    autoTable(doc, {
        startY: 85,
        head: [['COD', 'ARTÍCULO', 'MARCA', 'CANT', 'UNID', 'PRECIO', 'TOTAL']],
        body: tableData,
        theme: 'grid',
        headStyles: { fillColor: [0, 128, 128], textColor: 255, fontStyle: 'bold' },
        alternateRowStyles: { fillColor: [245, 245, 245] },
        styles: { fontSize: 8, cellPadding: 3 }
    });

    // Signatures
    const finalY = (doc as any).lastAutoTable.finalY + 30;
    doc.line(15, finalY, 80, finalY);
    doc.text('Firma Autoriza', 47.5, finalY + 5, { align: 'center' });

    doc.line(130, finalY, 195, finalY);
    doc.text('Firma Recibe', 162.5, finalY + 5, { align: 'center' });

    doc.save(`Salida_${ultimoIdSalida}.pdf`);
};

return (
    <div className="min-h-screen bg-[#0f111a] p-4 md:p-8">
        <PageHeader
            title="Realizar Salida"
            icon={Box}
            themeColor={themeColor}
        />

        <div className="max-w-6xl mx-auto">
            {/* Feedback Toast */}
            {feedback && (
                <div className={`fixed top-8 right-8 z-[100] px-6 py-4 rounded-2xl shadow-2xl backdrop-blur-xl border flex items-center gap-3 animate-in slide-in-from-top-4 duration-300 ${feedback.type === 'success' ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-400' :
                    feedback.type === 'error' ? 'bg-rose-500/20 border-rose-500/50 text-rose-400' :
                        feedback.type === 'warning' ? 'bg-amber-500/20 border-amber-500/50 text-amber-400' :
                            'bg-blue-500/20 border-blue-500/50 text-blue-400'
                    }`}>
                    {feedback.type === 'success' && <CheckCircle className="w-5 h-5" />}
                    {feedback.type === 'error' && <AlertTriangle className="w-5 h-5" />}
                    {feedback.type === 'warning' && <AlertTriangle className="w-5 h-5" />}
                    {feedback.type === 'info' && <Info className="w-5 h-5" />}
                    <span className="font-bold">{feedback.message}</span>
                </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-6">
                {/* Section 1: Header Information */}
                <div className="bg-[#1e2235] border border-white/10 rounded-3xl shadow-2xl overflow-hidden p-6 md:p-8">
                    <div className="flex items-center gap-3 mb-8 border-b border-white/10 pb-4">
                        <Info className={`w-5 h-5 text-${themeColor}-400`} />
                        <h3 className="text-xl font-black text-white uppercase tracking-tight">Información de la Salida</h3>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                        {/* Autoriza Selector */}
                        <div className="space-y-3">
                            <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1 block">Responsable (Autoriza)</label>
                            <div
                                onClick={() => handleOpenBusqueda('autoriza')}
                                className="group relative bg-black/30 border border-white/10 rounded-2xl p-4 cursor-pointer hover:bg-white/5 hover:border-teal-500/30 transition-all flex items-center justify-between shadow-inner"
                            >
                                <div className="flex items-center gap-4 min-w-0">
                                    <div className={`w-10 h-10 rounded-xl bg-${themeColor}-500/10 flex items-center justify-center shrink-0`}>
                                        <UserCircle className={`w-5 h-5 text-${themeColor}-400 group-hover:scale-110 transition-transform`} />
                                    </div>
                                    <div className="min-w-0">
                                        <span className={`block truncate font-bold ${autorizaId ? 'text-white' : 'text-gray-600 italic'}`}>
                                            {autorizaAlias || 'Seleccionar...'}
                                        </span>
                                        {autorizaId && <span className="text-[9px] text-gray-500 font-mono tracking-tighter uppercase">{autorizaId}</span>}
                                    </div>
                                </div>
                                <ChevronRight className="w-5 h-5 text-gray-700 group-hover:translate-x-1 transition-transform shrink-0" />
                            </div>
                        </div>

                        {/* Retira Selector */}
                        <div className="space-y-3">
                            <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1 block">Persona que Retira</label>
                            <div
                                onClick={() => handleOpenBusqueda('retira')}
                                className="group relative bg-black/30 border border-white/10 rounded-2xl p-4 cursor-pointer hover:bg-white/5 hover:border-teal-500/30 transition-all flex items-center justify-between shadow-inner"
                            >
                                <div className="flex items-center gap-4 min-w-0">
                                    <div className={`w-10 h-10 rounded-xl bg-${themeColor}-500/10 flex items-center justify-center shrink-0`}>
                                        <UserCircle className={`w-5 h-5 text-${themeColor}-400 group-hover:scale-110 transition-transform`} />
                                    </div>
                                    <div className="min-w-0">
                                        <span className={`block truncate font-bold ${retiraId ? 'text-white' : 'text-gray-600 italic'}`}>
                                            {retiraName || 'Seleccionar...'}
                                        </span>
                                        {retiraId && <span className="text-[9px] text-gray-500 font-mono tracking-tighter uppercase">{retiraId}</span>}
                                    </div>
                                </div>
                                <ChevronRight className="w-5 h-5 text-gray-700 group-hover:translate-x-1 transition-transform shrink-0" />
                            </div>
                        </div>

                        {/* Solicitud Input */}
                        <div className="space-y-3">
                            <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1 block">Número de Solicitud</label>
                            <div className="relative group">
                                <Ticket className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-600 group-focus-within:text-teal-400 transition-colors" />
                                <input
                                    type="text"
                                    value={numeroSolicitud}
                                    onChange={(e) => setNumeroSolicitud(e.target.value)}
                                    className="w-full bg-black/30 border border-white/10 rounded-2xl py-4 pl-14 pr-4 text-white font-bold placeholder-gray-700 focus:outline-none focus:border-teal-500/50 transition-all shadow-inner"
                                    placeholder="Ejem: 8639..."
                                />
                            </div>
                        </div>
                    </div>

                    <div className="space-y-3">
                        <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1 block">Observaciones adicionales</label>
                        <div className="relative group">
                            <MessageSquare className="absolute left-5 top-5 w-5 h-5 text-gray-600 group-focus-within:text-teal-400 transition-colors" />
                            <textarea
                                value={comentarios}
                                onChange={(e) => setComentarios(e.target.value)}
                                className="w-full bg-black/30 border border-white/10 rounded-2xl py-5 pl-14 pr-6 text-white font-medium placeholder-gray-700 focus:outline-none focus:border-teal-500/50 transition-all shadow-inner min-h-[120px] resize-none"
                                placeholder="Detalles sobre la entrega, destino o requerimientos especiales..."
                            />
                        </div>
                    </div>
                </div>

                {/* Section 2: Items Table */}
                <div className="bg-[#1e2235] border border-white/10 rounded-3xl shadow-2xl overflow-hidden p-6 md:p-8">
                    <TransactionTable
                        items={items}
                        onUpdateRow={updateDetalle}
                        onRemoveRow={eliminarFila}
                        onOpenSearch={handleOpenArticulos}
                        onAddRow={agregarFila}
                        onWarning={(msg) => showAlert(msg, 'warning')}
                        themeColor={themeColor}
                    />
                </div>

                {/* Form Controls */}
                <div className="flex justify-end pt-4">
                    {!finalizado ? (
                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full md:w-auto px-12 py-5 bg-gradient-to-r from-teal-600 to-teal-400 text-white font-black text-xl rounded-2xl hover:brightness-110 active:scale-95 transition-all flex items-center justify-center gap-3 disabled:opacity-50 shadow-xl shadow-teal-500/20 uppercase tracking-tight"
                        >
                            {loading ? <Loader2 className="w-7 h-7 animate-spin" /> : <Save className="w-7 h-7" />}
                            Procesar Salida
                        </button>
                    ) : (
                        <button
                            type="button"
                            onClick={handleFinalizar}
                            className="w-full md:w-auto px-12 py-5 bg-gradient-to-r from-emerald-600 to-emerald-400 text-white font-black text-xl rounded-2xl hover:brightness-110 active:scale-95 transition-all flex items-center justify-center gap-3 shadow-xl shadow-emerald-500/20 uppercase tracking-tight animate-in zoom-in duration-300"
                        >
                            <Printer className="w-7 h-7" />
                            Finalizar e Imprimir
                        </button>
                    )}
                </div>
            </form>
        </div>

        {/* Modals */}
        <ColaboradorSearchModal
            isOpen={showBusquedaModal}
            onClose={() => setShowBusquedaModal(false)}
            onSelect={handleSelectColaborador}
            colaboradores={busquedaTipo === 'autoriza'
                ? colaboradores.autorizados
                : colaboradores.todos
            }
            title={busquedaTipo === 'autoriza' ? 'Autorizado Por...' : 'Recibido Por...'}
        />

        <ArticuloSearchModal
            isOpen={showArticulosModal}
            onClose={() => setShowArticulosModal(false)}
            onSelect={handleSelectArticulo}
            themeColor={themeColor}
        />
    </div>
);
}
