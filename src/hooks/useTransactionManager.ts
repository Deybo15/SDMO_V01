import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useNavigate } from 'react-router-dom';
import { Articulo, Colaborador, DetalleSalida } from '../types/inventory';

interface UseTransactionManagerProps {
    tipoSalidaId?: string; // e.g. 'equipos', 'herramientas' for fetching type ID
    defaultDescription?: string;
    onSuccessRoute?: string;
}

export const useTransactionManager = ({
    tipoSalidaId,
    defaultDescription,
    onSuccessRoute
}: UseTransactionManagerProps = {}) => {
    const navigate = useNavigate();

    // State
    const [loading, setLoading] = useState(false);
    const [feedback, setFeedback] = useState<{ message: string, type: 'success' | 'error' | 'warning' } | null>(null);
    const [items, setItems] = useState<DetalleSalida[]>([]);

    // Data State
    const [colaboradores, setColaboradores] = useState<{ autorizados: Colaborador[], retirantes: Colaborador[] }>({
        autorizados: [],
        retirantes: []
    });

    // Load Colaboradores
    useEffect(() => {
        const fetchColaboradores = async () => {
            const { data } = await supabase
                .from('colaboradores_06')
                .select('identificacion, alias, colaborador, autorizado, condicion_laboral')
                .or('autorizado.eq.true,condicion_laboral.eq.false');

            if (data) {
                setColaboradores({
                    autorizados: data.filter((c: any) => c.autorizado).map((c: any) => ({
                        ...c,
                        colaborador: c.colaborador || c.alias // Ensure name
                    })),
                    retirantes: data.filter((c: any) => !c.autorizado).map((c: any) => ({
                        ...c,
                        colaborador: c.colaborador || c.alias
                    }))
                });
            }
        };
        fetchColaboradores();
    }, []);

    // Feedback Helper
    const showFeedback = (message: string, type: 'success' | 'error' | 'warning') => {
        setFeedback({ message, type });
        setTimeout(() => setFeedback(null), 3000);
    };

    // Item Management
    const addItem = (articulo: Articulo) => {
        if (items.find(i => i.codigo_articulo === articulo.codigo_articulo)) {
            showFeedback('El artículo ya está en la lista', 'warning');
            return;
        }

        const newItem: DetalleSalida = {
            codigo_articulo: articulo.codigo_articulo,
            articulo: articulo.nombre_articulo,
            cantidad: 1, // Default to 1
            precio_unitario: articulo.precio_unitario
        };

        // Check stock immediately? Optional.
        if (articulo.cantidad_disponible <= 0) {
            showFeedback('No hay stock disponible', 'error');
            return;
        }

        setItems([...items, newItem]);
    };

    const updateItemQuantity = (codigo: string, cantidad: number, max: number) => {
        if (cantidad > max) {
            showFeedback(`Solo hay ${max} disponibles`, 'warning');
            cantidad = max;
        }
        if (cantidad < 0) cantidad = 0;

        setItems(prev => prev.map(i => i.codigo_articulo === codigo ? { ...i, cantidad } : i));
    };

    const removeItem = (codigo: string) => {
        setItems(prev => prev.filter(i => i.codigo_articulo !== codigo));
    };

    // Submit Transaction
    const processTransaction = async (
        header: { autoriza: string, retira: string, comentarios?: string, destino?: string, fecha_solicitud?: string, numero_solicitud?: string | number },
        extraLogic?: (idSalida: number, numeroSolicitud: number) => Promise<void>
    ) => {

        if (!header.autoriza || !header.retira) {
            showFeedback('Seleccione Responsable y Receptor', 'warning');
            return;
        }

        const validItems = items.filter(i => Number(i.cantidad) > 0);
        if (validItems.length === 0) {
            showFeedback('Agregue artículos con cantidad válida', 'warning');
            return;
        }

        setLoading(true);
        try {
            // 1. Create Request (Solicitud)
            let solicitudId = 0;

            if (tipoSalidaId) {
                const { data: tipoData } = await supabase
                    .from('tipo_solicitud_75')
                    .select('tipo_solicitud')
                    .ilike('descripcion_tipo_salida', `%${tipoSalidaId}%`)
                    .limit(1)
                    .single();

                const finalTipoId = tipoData?.tipo_solicitud || 1; // Fallback

                const { data: solData, error: solError } = await supabase
                    .from('solicitud_17')
                    .insert([{
                        tipo_solicitud: finalTipoId,
                        descripcion_solicitud: defaultDescription || 'Solicitud Generada',
                        fecha_solicitud: header.fecha_solicitud || new Date().toISOString(),
                        profesional_responsable: header.autoriza,
                        dependencia_solicitante: header.destino
                    }])
                    .select('numero_solicitud')
                    .single();

                if (solError) throw solError;
                solicitudId = solData.numero_solicitud;
            }

            // 2. Create Output Header (Salida)
            const { data: outData, error: outError } = await supabase
                .from('salida_articulo_08')
                .insert([{
                    fecha_salida: new Date().toISOString(),
                    autoriza: header.autoriza,
                    retira: header.retira,
                    numero_solicitud: solicitudId > 0 ? solicitudId : header.numero_solicitud, // Use created ID or passed one
                    comentarios: header.comentarios,
                    finalizada: true
                }])
                .select('id_salida')
                .single();

            if (outError) throw outError;

            // 3. Insert Details
            const detailsPayload = validItems.map(d => ({
                id_salida: outData.id_salida,
                articulo: d.codigo_articulo,
                cantidad: Number(d.cantidad),
                precio_unitario: d.precio_unitario
            }));

            const { error: detError } = await supabase
                .from('dato_salida_13')
                .insert(detailsPayload);

            if (detError) throw detError;

            // 4. Extra Logic (e.g. Navigation)
            if (extraLogic) await extraLogic(outData.id_salida, solicitudId);

            showFeedback('Transacción procesada correctamente', 'success');

            if (onSuccessRoute) {
                setTimeout(() => navigate(onSuccessRoute), 1500);
            } else {
                // Reset?
                setItems([]);
            }

        } catch (error) {
            console.error('Error processing transaction:', error);
            showFeedback('Error al procesar la solicitud', 'error');
        } finally {
            setLoading(false);
        }
    };

    return {
        loading,
        feedback,
        items,
        colaboradores,
        addItem,
        updateItemQuantity,
        removeItem,
        processTransaction
    };
};
