import { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
    Box,
    UserCircle,
    Save,
    Printer,
    CheckCircle,
    AlertTriangle,
    Info,
    Loader2,
    Ticket,
    MessageSquare,
    ChevronRight,
    Shield,
    ClipboardList,
    ArrowLeft
} from 'lucide-react';
import { cn } from '../lib/utils';




import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

// Shared Components
import { PageHeader } from '../components/ui/PageHeader';
import { TransactionTable } from '../components/ui/TransactionTable';
import ArticuloSearchGridModal from '../components/ArticleSearchGridModal';
import ColaboradorSearchModal from '../components/ColaboradorSearchModal';
import HistorialMaterialesModal from '../components/HistorialMaterialesModal';
import { DetalleSalida, Colaborador } from '../types/inventory';

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

    // 4. Modals State
    const [showBusquedaModal, setShowBusquedaModal] = useState(false);
    const [busquedaTipo, setBusquedaTipo] = useState<'autoriza' | 'retira'>('autoriza');
    const [showArticulosModal, setShowArticulosModal] = useState(false);
    const [showHistorialModal, setShowHistorialModal] = useState(false);
    const [currentRowIndex, setCurrentRowIndex] = useState<number>(0);

    const themeColor = '#0071E3';

    // 5. Validation Logic
    const isFormValid = useMemo(() => {
        const hasAutoriza = !!autorizaId;
        const hasRetira = !!retiraId;
        const hasVaildItems = items.some(item =>
            item.codigo_articulo.trim() !== '' &&
            Number(item.cantidad) > 0
        );

        return hasAutoriza && hasRetira && hasVaildItems;
    }, [autorizaId, retiraId, items]);

    // Initialize - Run only once on mount or when numero param changes
    useEffect(() => {
        const numSol = searchParams.get('numero');
        if (numSol) setNumeroSolicitud(numSol);

        fetchColaboradores();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const fetchColaboradores = async () => {
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

    const updateDetalle = useCallback((index: number, field: string, value: any) => {
        const newItems = [...items];
        newItems[index] = { ...newItems[index], [field]: value };
        setItems(newItems);
    }, [items]);

    // Modals Handlers
    const handleOpenArticulos = useCallback((index: number) => {
        setCurrentRowIndex(index);
        setShowArticulosModal(true);
    }, []);

    const handleSelectArticulo = useCallback((articulo: any) => {
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

        console.log('✅ SELECCIONADO:', articulo.nombre_articulo);
        setItems(newItems);
        setShowArticulosModal(false);
    }, [items, currentRowIndex]);

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

        const itemsValidos = items.filter(i => i.codigo_articulo !== '' && Number(i.cantidad) > 0);
        if (itemsValidos.length === 0) {
            showAlert('Debe agregar al menos un artículo con cantidad válida', 'error');
            return;
        }

        for (const item of itemsValidos) {
            if (Number(item.cantidad) > (item.cantidad_disponible || 0)) {
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
                    fecha_salida: new Date().toLocaleDateString('en-CA'),
                    numero_solicitud: numeroSolicitud ? parseInt(numeroSolicitud) : null,
                    autoriza: autorizaId,
                    retira: retiraId,
                    nota: user?.email || 'sistema',
                    comentarios: comentarios || null
                })
                .select('id_salida')
                .single();

            if (errorSalida) throw errorSalida;

            // 3. Insert Details (dato_salida_13)
            const detalles = itemsValidos.map(item => ({
                id_salida: salida.id_salida,
                articulo: item.codigo_articulo,
                cantidad: Number(item.cantidad),
                precio_unitario: Number(item.precio_unitario)
            }));

            const { error: errorDetalles } = await supabase
                .from('dato_salida_13')
                .insert(detalles);

            if (errorDetalles) throw errorDetalles;

            // 4. Update Header (finalizada: true) to trigger MAKE workflow
            const { error: errorFinalizar } = await supabase
                .from('salida_articulo_08')
                .update({ finalizada: true })
                .eq('id_salida', salida.id_salida);

            if (errorFinalizar) throw errorFinalizar;

            // 5. Success Actions
            setUltimoIdSalida(salida.id_salida);
            setFinalizado(true);
            showAlert('¡Salida registrada exitosamente!', 'success');

            // Reset Data States (Keep finalizado: true to show print button)
            setRetiraId('');
            setRetiraName('');
            setNumeroSolicitud('');
            setComentarios('');
            setItems([{
                codigo_articulo: '',
                articulo: '',
                cantidad: 0,
                unidad: '',
                precio_unitario: 0,
                marca: '',
                cantidad_disponible: 0
            }]);

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
            new Intl.NumberFormat('es-CR', { style: 'currency', currency: 'CRC' }).format(Number(item.precio_unitario)),
            new Intl.NumberFormat('es-CR', { style: 'currency', currency: 'CRC' }).format(Number(item.cantidad) * Number(item.precio_unitario))
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
        <div className="min-h-screen bg-[#000000] text-[#F5F5F7] flex flex-col pt-4">
            <PageHeader
                title="Realizar Salida"
                icon={Box}
                subtitle="Registro de salida de materiales y consumibles del inventario."
                rightElement={
                    <button
                        onClick={() => navigate('/cliente-interno/realizar-salidas')}
                        className="btn-ghost px-6 py-3 border border-[#F5F5F7]/20 rounded-[8px] hover:bg-[#F5F5F7]/5 transition-all flex items-center gap-2 group"
                    >
                        <ArrowLeft className="w-5 h-5 text-[#86868B] group-hover:text-[#F5F5F7] transition-colors" />
                        <span className="text-[11px] font-bold text-[#86868B] group-hover:text-[#F5F5F7] uppercase tracking-widest">Regresar</span>
                    </button>
                }
            />

            <div className="max-w-[1400px] mx-auto w-full px-8 pb-20">
                {/* Feedback Toast */}
                {feedback && (
                    <div className={cn(
                        "fixed top-8 right-8 z-[100] px-6 py-4 rounded-[8px] border flex items-center gap-3 animate-in slide-in-from-top-4 duration-300",
                        feedback.type === 'success' ? "bg-[#121212] border-[#0071E3]/50 text-white" : "bg-[#121212] border-rose-500/50 text-rose-400"
                    )}>
                        {feedback.type === 'success' ? <CheckCircle className="w-5 h-5 text-[#0071E3]" /> : <AlertTriangle className="w-5 h-5 text-rose-500" />}
                        <span className="text-[10px] font-black uppercase tracking-widest">{feedback.message}</span>
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-8">
                    {/* Section 1: Header Information */}
                    <div className="bg-[#121212] border border-[#333333] rounded-[8px] shadow-2xl overflow-hidden p-8">
                        <div className="space-y-1 mb-8">
                            <h3 className="text-xl font-black text-white italic uppercase tracking-tight flex items-center gap-3">
                                <Info className="w-5 h-5 text-[#0071E3]" />
                                Información de la Salida
                            </h3>
                            <p className="text-[10px] font-black text-[#86868B] uppercase tracking-[0.2em] ml-8">Detalles generales del registro de salida</p>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-8">
                            {/* Autoriza Selector */}
                            <div className="space-y-3">
                                <label className="text-[10px] font-black text-[#86868B] uppercase tracking-widest ml-1 block">Responsable (Autoriza)</label>
                                <div
                                    onClick={autorizaId ? undefined : () => handleOpenBusqueda('autoriza')}
                                    className={cn(
                                        "group relative border rounded-[8px] p-5 transition-all flex items-center justify-between",
                                        autorizaId ? "bg-black/20 border-[#333333] cursor-not-allowed text-[#86868B]" : "bg-[#1D1D1F] border-[#333333] cursor-pointer hover:border-[#0071E3]/50"
                                    )}
                                >
                                    <div className="flex items-center gap-4 min-w-0">
                                        <div className={cn(
                                            "w-10 h-10 rounded-[4px] flex items-center justify-center shrink-0",
                                            autorizaId ? "bg-black/40" : "bg-[#0071E3]/10"
                                        )}>
                                            <UserCircle className={cn("w-5 h-5", autorizaId ? "text-slate-600" : "text-[#0071E3]")} />
                                        </div>
                                        <div className="min-w-0">
                                            <span className={cn("block truncate font-bold text-[13px] uppercase", autorizaId ? 'text-[#86868B]' : 'text-white')}>
                                                {autorizaAlias || 'Seleccionar...'}
                                            </span>
                                        </div>
                                    </div>
                                    {!autorizaId && <ChevronRight className="w-5 h-5 text-[#86868B]" />}
                                </div>
                            </div>

                            {/* Retira Selector */}
                            <div className="space-y-3">
                                <label className="text-[10px] font-black text-[#86868B] uppercase tracking-widest ml-1 block">Persona que Retira</label>
                                <div
                                    onClick={() => handleOpenBusqueda('retira')}
                                    className="group relative bg-[#1D1D1F] border border-[#333333] rounded-[8px] p-5 cursor-pointer hover:border-[#0071E3]/50 transition-all flex items-center justify-between"
                                >
                                    <div className="flex items-center gap-4 min-w-0">
                                        <div className="w-10 h-10 rounded-[4px] bg-[#0071E3]/10 flex items-center justify-center shrink-0">
                                            <UserCircle className="w-5 h-5 text-[#0071E3]" />
                                        </div>
                                        <div className="min-w-0">
                                            <span className={cn("block truncate font-bold text-[13px] uppercase", retiraId ? 'text-white' : 'text-[#86868B] italic')}>
                                                {retiraName || 'Seleccionar...'}
                                            </span>
                                        </div>
                                    </div>
                                    <ChevronRight className="w-5 h-5 text-[#86868B]" />
                                </div>
                            </div>

                            {/* Solicitud Input */}
                            <div className="space-y-3">
                                <label className="text-[10px] font-black text-[#86868B] uppercase tracking-widest ml-1 block">Número de Solicitud</label>
                                <div className="relative group flex gap-3">
                                    <div className="relative flex-1">
                                        <Ticket className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-[#86868B]" />
                                        <input
                                            type="text"
                                            value={numeroSolicitud}
                                            readOnly
                                            className="w-full bg-black/20 border border-[#333333] rounded-[8px] py-4 pl-14 pr-4 text-[#86868B] font-bold cursor-not-allowed opacity-80"
                                            placeholder="Sin número..."
                                        />
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => setShowHistorialModal(true)}
                                        disabled={!numeroSolicitud}
                                        className="h-14 px-5 bg-transparent border border-[#333333] rounded-[8px] text-[#F5F5F7] hover:bg-white/5 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                                        title="Historial de materiales"
                                    >
                                        <ClipboardList className="w-6 h-6" />
                                    </button>
                                </div>
                            </div>
                        </div>

                        <div className="space-y-3">
                            <label className="text-[10px] font-black text-[#86868B] uppercase tracking-widest ml-1 block">Observaciones adicionales</label>
                            <div className="relative group">
                                <MessageSquare className="absolute left-5 top-5 w-5 h-5 text-[#86868B] group-focus-within:text-[#0071E3] transition-colors" />
                                <textarea
                                    value={comentarios}
                                    onChange={(e) => setComentarios(e.target.value)}
                                    className="w-full bg-[#1D1D1F] border border-[#333333] rounded-[8px] py-5 pl-14 pr-6 text-white font-medium placeholder-[#424245] focus:outline-none focus:border-[#0071E3]/50 transition-all min-h-[120px] resize-none"
                                    placeholder="Detalles sobre la entrega, destino o requerimientos especiales..."
                                />
                            </div>
                        </div>
                    </div>

                    {/* Section 2: Items Table */}
                    <div className="bg-[#121212] border border-[#333333] rounded-[8px] shadow-2xl overflow-hidden p-8">
                        <div className="space-y-1 mb-8">
                            <h3 className="text-xl font-black text-white italic uppercase tracking-tight flex items-center gap-3">
                                <ClipboardList className="w-5 h-5 text-[#0071E3]" />
                                Detalle de Artículos
                            </h3>
                            <p className="text-[10px] font-black text-[#86868B] uppercase tracking-[0.2em] ml-8">Seleccione los materiales a entregar</p>
                        </div>
                        <TransactionTable
                            items={items}
                            onUpdateRow={updateDetalle}
                            onRemoveRow={eliminarFila}
                            onOpenSearch={handleOpenArticulos}
                            onAddRow={agregarFila}
                            onWarning={(msg) => showAlert(msg, 'warning')}
                            themeColor="#0071E3"
                        />
                    </div>

                    {/* Form Controls */}
                    <div className="flex justify-end pt-4 pb-12">
                        <div className="flex gap-4">
                            {finalizado && (
                                <button
                                    type="button"
                                    onClick={generarPDF}
                                    className="h-14 px-8 bg-transparent border border-[#F5F5F7]/30 text-[#F5F5F7] rounded-[8px] text-[10px] font-black uppercase tracking-widest hover:bg-white/5 active:scale-95 transition-all flex items-center gap-3"
                                >
                                    <Printer className="w-5 h-5" />
                                    Imprimir Comprobante
                                </button>
                            )}
                            <button
                                type="submit"
                                disabled={loading || !isFormValid}
                                className={cn(
                                    "h-14 px-12 text-white font-black text-xs rounded-[8px] uppercase tracking-widest transition-all flex items-center gap-3",
                                    (loading || !isFormValid)
                                        ? "bg-[#333333] opacity-50 cursor-not-allowed"
                                        : "bg-[#0071E3] hover:brightness-110 active:scale-95 shadow-xl shadow-[#0071E3]/20"
                                )}
                            >
                                {loading ? <Loader2 className="w-6 h-6 animate-spin" /> : <Save className="w-6 h-6" />}
                                Procesar Salida
                            </button>
                        </div>
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

            <ArticuloSearchGridModal
                isOpen={showArticulosModal}
                onClose={() => setShowArticulosModal(false)}
                onSelect={handleSelectArticulo}
                themeColor="blue"
                title="BUSCADOR"
            />

            <HistorialMaterialesModal
                isOpen={showHistorialModal}
                onClose={() => setShowHistorialModal(false)}
                numeroSolicitud={numeroSolicitud}
            />
        </div>
    );
}
