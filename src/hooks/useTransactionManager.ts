// useTransactionManager.ts - v2.1 (Fixing ReferenceError)
import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useNavigate } from 'react-router-dom';
import { Articulo, Colaborador, DetalleSalida, TransactionHeader } from '../types/inventory';

interface UseTransactionManagerProps {
    tipoSalidaId?: string; // e.g. 'equipos', 'herramientas' for fetching type ID
    defaultDescription?: string;
    onSuccessRoute?: string;
    onSuccess?: () => void;
}

export const useTransactionManager = ({
    tipoSalidaId,
    defaultDescription,
    onSuccessRoute,
    onSuccess
}: UseTransactionManagerProps = {}) => {
    const navigate = useNavigate();

    // State
    const [loading, setLoading] = useState(false);
    const [feedback, setFeedback] = useState<{ message: string, type: 'success' | 'error' | 'warning' } | null>(null);
    const [items, setItems] = useState<DetalleSalida[]>([]);

    // Data State
    const [colaboradores, setColaboradores] = useState<{ autorizados: Colaborador[], todos: Colaborador[] }>({
        autorizados: [],
        todos: []
    });

    const [autorizaId, setAutorizaId] = useState('');

    // Load Colaboradores & Auto-select Responsable
    useEffect(() => {
        const initialize = async () => {
            try {
                // 1. Get current user
                const { data: { user } } = await supabase.auth.getUser();
                const userEmail = user?.email;

                // 2. Fetch collaborators
                const { data } = await supabase
                    .from('colaboradores_06')
                    .select('identificacion, alias, colaborador, autorizado, condicion_laboral, correo_colaborador')
                    .or('autorizado.eq.true,condicion_laboral.eq.false');

                if (data) {
                    const mappedData = data.map((c: any) => ({
                        ...c,
                        colaborador: c.colaborador || c.alias
                    }));

                    setColaboradores({
                        autorizados: mappedData.filter((c: any) => c.autorizado),
                        todos: mappedData
                    });

                    // 3. Auto-populate based on email
                    if (userEmail) {
                        const matched = mappedData.find(c =>
                            c.correo_colaborador?.toLowerCase() === userEmail.toLowerCase()
                        );
                        if (matched && matched.autorizado) {
                            setAutorizaId(matched.identificacion);
                        }
                    }
                }
            } catch (err) {
                console.error('Error initializing transaction manager:', err);
            }
        };
        initialize();
    }, []);

    // Feedback Helper
    const showFeedback = (message: string, type: 'success' | 'error' | 'warning') => {
        setFeedback({ message, type });
        setTimeout(() => setFeedback(null), 3000);
    };

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

        console.log('✅ SELECCIONADO:', article.nombre_articulo);

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


    const processTransaction = async (header: TransactionHeader, extraLogic?: (idSalida: number, validItems: DetalleSalida[], solicitudId?: string | number) => Promise<void>) => {
        // Validate Header (basic)
        if (!header.autoriza || !header.retira) {
            setFeedback({ message: 'Debe seleccionar responsables', type: 'error' });
            setTimeout(() => setFeedback(null), 3000);
            return;
        }

        // Validate Items
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
            // STEP 1: Create Request (Solicitud) - if tipoSalidaId is provided
            let solicitudId: number | string = header.numero_solicitud || 'S/N';

            if (tipoSalidaId) {
                // Try direct code match first
                let { data: tipoData } = await supabase
                    .from('tipo_solicitud_75')
                    .select('tipo_solicitud')
                    .eq('tipo_solicitud', tipoSalidaId.toUpperCase())
                    .maybeSingle();

                // If not found, try description match
                if (!tipoData) {
                    const { data: descMatch } = await supabase
                        .from('tipo_solicitud_75')
                        .select('tipo_solicitud')
                        .ilike('descripcion_tipo_salida', `%${tipoSalidaId}%`)
                        .limit(1)
                        .maybeSingle();
                    tipoData = descMatch;
                }

                if (!tipoData) {
                    throw new Error(`Tipo de solicitud no válido: "${tipoSalidaId}"`);
                }

                const finalTipoId = tipoData.tipo_solicitud;

                const { data: solData, error: solError } = await supabase
                    .from('solicitud_17')
                    .insert([{
                        tipo_solicitud: finalTipoId,
                        descripcion_solicitud: header.comentarios || defaultDescription || 'Solicitud Generada',
                        fecha_solicitud: header.fecha_solicitud || new Date().toISOString(),
                        profesional_responsable: header.autoriza,
                        equipo_automotor: header.equipo_automotor,
                        dependencia_municipal: header.destino
                    }])
                    .select('numero_solicitud')
                    .single();

                if (solError) {
                    console.error("Step 1 Error (solicitud_17):", solError);
                    throw new Error(`Error al crear solicitud: ${solError.message}`);
                }
                solicitudId = solData.numero_solicitud;
            }

            // STEP 2: Create Output Header (Salida) - marked as finalizada: FALSE
            const { data: headerData, error: headerError } = await supabase
                .from('salida_articulo_08')
                .insert({
                    fecha_salida: new Date().toISOString(),
                    autoriza: header.autoriza,
                    retira: header.retira,
                    numero_solicitud: solicitudId,
                    comentarios: header.comentarios,
                    finalizada: false // REQUIRED: Initially FALSE for Make automation
                })
                .select('id_salida')
                .single();

            if (headerError) {
                console.error("Step 2 Error (salida_articulo_08):", headerError);
                throw new Error(`Error al crear encabezado de salida: ${headerError.message}`);
            }
            const newId = headerData.id_salida;

            // Extra Logic (e.g. equipment updates)
            if (extraLogic) {
                try {
                    await extraLogic(newId, validItems, solicitudId);
                } catch (extraErr: any) {
                    console.error("Extra Logic Error:", extraErr);
                    // We might decide whether to throw or just log depending on criticality
                }
            }

            // STEP 3: Insert Details (dato_salida_13)
            const detallesToInsert = validItems.map(d => ({
                id_salida: newId,
                articulo: d.codigo_articulo,
                cantidad: Number(d.cantidad),
                precio_unitario: d.precio_unitario
            }));

            const { error: detailsError } = await supabase
                .from('dato_salida_13')
                .insert(detallesToInsert);

            if (detailsError) {
                console.error("Step 3 Error (dato_salida_13):", detailsError);
                throw new Error(`Error al insertar detalles: ${detailsError.message}`);
            }

            // STEP 4: Update Header - set finalizada: TRUE - THIS TRIGGERS MAKE
            const { error: finalError } = await supabase
                .from('salida_articulo_08')
                .update({ finalizada: true })
                .eq('id_salida', newId);

            if (finalError) {
                console.error("Step 4 Error (final update):", finalError);
                throw new Error(`Error al finalizar la salida: ${finalError.message}`);
            }

            setFeedback({ message: 'Solicitud procesada y finalizada correctamente', type: 'success' });

            // Reset items locally in all cases
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

            // Call external success callback
            if (onSuccess) onSuccess();

            // Redirect
            if (onSuccessRoute) {
                setTimeout(() => {
                    navigate(onSuccessRoute);
                }, 1500);
            }

        } catch (error: any) {
            console.error("Transaction failed:", error);
            setFeedback({ message: error.message || 'Error al procesar solicitud', type: 'error' });
            // Don't auto-clear the error as quickly so user can read it if needed
            setTimeout(() => setFeedback(null), 8000);
        } finally {
            setLoading(false);
        }
    };

    return {
        loading,
        feedback,
        items,
        colaboradores,
        autorizaId,
        setAutorizaId,
        addEmptyRow,
        updateRow,
        updateRowWithArticle,
        removeRow,
        processTransaction,
        showAlert: showFeedback
    };
};
