import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useNavigate } from 'react-router-dom';
import { Articulo, Colaborador, DetalleSalida, TransactionHeader } from '../types/inventory';

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

    // Item Management is now handled by Row Actions


    // Actions
    const addEmptyRow = () => {
        setItems(prev => [...prev, {
            codigo_articulo: '',
            articulo: '',
            cantidad: 0,
            unidad: '',
            precio_unitario: 0,
            marca: '',
            cantidad_disponible: 0,
            imagen_url: null
        }]);
    };

    // Update a specific row (by index) with an article
    const updateRowWithArticle = (index: number, article: Articulo) => {
        // Check for duplicates
        const exists = items.some((item, i) => i !== index && item.codigo_articulo === article.codigo_articulo);
        if (exists) {
            setFeedback({ message: 'El artículo ya está en la lista', type: 'warning' });
            setTimeout(() => setFeedback(null), 3000);
            return;
        }

        setItems(prev => {
            const newItems = [...prev];
            newItems[index] = {
                codigo_articulo: article.codigo_articulo,
                articulo: article.nombre_articulo,
                cantidad: 0, // Reset quantity
                unidad: article.unidad,
                precio_unitario: article.precio_unitario,
                marca: article.marca || 'Sin Marca',
                cantidad_disponible: article.cantidad_disponible,
                imagen_url: article.imagen_url
            };
            return newItems;
        });
    };

    const updateRow = (index: number, field: keyof DetalleSalida, value: any) => {
        setItems(prev => {
            const newItems = [...prev];
            newItems[index] = { ...newItems[index], [field]: value };
            return newItems;
        });
    };

    const removeRow = (index: number) => {
        setItems(prev => prev.filter((_, i) => i !== index));
    };


    const processTransaction = async (header: TransactionHeader, extraLogic?: (idSalida: number, validItems: DetalleSalida[]) => Promise<void>) => {
        // Validate Header (basic)
        if (!header.autoriza || !header.retira) {
            setFeedback({ message: 'Debe seleccionar responsables', type: 'error' });
            setTimeout(() => setFeedback(null), 3000);
            return;
        }

        // Validate Items
        // Filter valid items (must have code and quantity > 0)
        const validItems = items.filter(i => i.codigo_articulo && Number(i.cantidad) > 0);

        if (validItems.length === 0) {
            setFeedback({ message: 'Debe agregar al menos un artículo válido con cantidad mayor a 0', type: 'error' });
            setTimeout(() => setFeedback(null), 3000);
            return;
        }

        // Check stock limits locally first
        for (const item of validItems) {
            if (item.cantidad_disponible !== undefined && Number(item.cantidad) > item.cantidad_disponible) {
                setFeedback({ message: `La cantidad para ${item.articulo} excede el disponible (${item.cantidad_disponible})`, type: 'error' });
                setTimeout(() => setFeedback(null), 3000);
                return;
            }
        }

        setLoading(true);
        try {
            // 1. Create Request (Solicitud) - if tipoSalidaId is provided
            let solicitudId: number | string = header.numero_solicitud || 'S/N'; // Default to S/N if not provided

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
            const { data: headerData, error: headerError } = await supabase
                .from('salida_articulo_08')
                .insert({
                    fecha_salida: new Date().toISOString(),
                    autoriza: header.autoriza,
                    retira: header.retira,
                    numero_solicitud: solicitudId, // Use created ID or passed one
                    comentarios: header.comentarios,
                    finalizada: true // Assuming it's finalized upon creation
                })
                .select('id_salida')
                .single();

            if (headerError) throw headerError;
            const newId = headerData.id_salida;

            // Extra Logic (e.g., specific table updates)
            if (extraLogic) {
                await extraLogic(newId, validItems);
            }

            // Insert Details (Standard)
            // Construct details for `dato_salida_13`
            const detallesToInsert = validItems.map(d => ({
                id_salida: newId,
                articulo: d.codigo_articulo,
                cantidad: Number(d.cantidad),
                precio_unitario: d.precio_unitario
            }));

            const { error: detailsError } = await supabase
                .from('dato_salida_13')
                .insert(detallesToInsert);

            if (detailsError) throw detailsError;

            setFeedback({ message: 'Solicitud procesada correctamente', type: 'success' });

            // Redirect
            if (onSuccessRoute) {
                setTimeout(() => {
                    navigate(onSuccessRoute);
                }, 1500);
            } else {
                // Reset
                setItems([{
                    codigo_articulo: '',
                    articulo: '',
                    cantidad: 0,
                    unidad: '',
                    precio_unitario: 0,
                    marca: '',
                    cantidad_disponible: 0,
                    imagen_url: null
                }]);
            }

        } catch (error: any) {
            console.error(error);
            setFeedback({ message: error.message || 'Error al procesar solicitud', type: 'error' });
            setTimeout(() => setFeedback(null), 5000);
        } finally {
            setLoading(false);
        }
    };

    return {
        loading,
        feedback,
        items,
        colaboradores,
        addEmptyRow,
        updateRow,
        updateRowWithArticle,
        removeRow,
        processTransaction,
        showAlert: showFeedback
    };
};
