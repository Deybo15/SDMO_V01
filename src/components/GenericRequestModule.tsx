import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { ArrowLeft, Save, ExternalLink, CheckCircle, AlertCircle, LucideIcon } from 'lucide-react';
import SalidaArticulosModal from './SalidaArticulosModal';

export interface Profesional {
    identificacion: string;
    alias: string;
}

interface TipoSolicitud {
    tipo_solicitud: string;
    descripcion_tipo_salida: string;
}

interface GenericRequestModuleProps {
    title: string;
    subtitle: string;
    description: string;
    icon: LucideIcon;
    colorTheme: 'blue' | 'orange' | 'purple' | 'pink' | 'gray' | 'amber' | 'indigo' | 'teal';
    searchKeywords: string[];
    onValidateAndGetExtraData: () => object | string | null;
    children: (props: {
        profesionales: Profesional[];
        fechaSolicitud: string;
        selectedProfesional: string;
        setSelectedProfesional: (id: string) => void;
        loading: boolean;
    }) => React.ReactNode;
}

const colorMap = {
    blue: {
        text: 'text-blue-500',
        bg: 'bg-blue-500/10',
        border: 'border-blue-500/20',
        textLight: 'text-blue-400',
        loader: 'border-blue-500',
        button: 'bg-blue-500/50 text-blue-200',
        buttonGradient: 'bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 shadow-blue-500/20'
    },
    orange: {
        text: 'text-orange-500',
        bg: 'bg-orange-500/10',
        border: 'border-orange-500/20',
        textLight: 'text-orange-400',
        loader: 'border-orange-500',
        button: 'bg-orange-500/50 text-orange-200',
        buttonGradient: 'bg-gradient-to-r from-orange-600 to-orange-500 hover:from-orange-500 hover:to-orange-400 shadow-orange-500/20'
    },
    purple: {
        text: 'text-purple-500',
        bg: 'bg-purple-500/10',
        border: 'border-purple-500/20',
        textLight: 'text-purple-400',
        loader: 'border-purple-500',
        button: 'bg-purple-500/50 text-purple-200',
        buttonGradient: 'bg-gradient-to-r from-purple-600 to-purple-500 hover:from-purple-500 hover:to-purple-400 shadow-purple-500/20'
    },
    pink: {
        text: 'text-pink-500',
        bg: 'bg-pink-500/10',
        border: 'border-pink-500/20',
        textLight: 'text-pink-400',
        loader: 'border-pink-500',
        button: 'bg-pink-500/50 text-pink-200',
        buttonGradient: 'bg-gradient-to-r from-pink-600 to-pink-500 hover:from-pink-500 hover:to-pink-400 shadow-pink-500/20'
    },
    gray: {
        text: 'text-gray-500',
        bg: 'bg-gray-500/10',
        border: 'border-gray-500/20',
        textLight: 'text-gray-400',
        loader: 'border-gray-500',
        button: 'bg-gray-500/50 text-gray-200',
        buttonGradient: 'bg-gradient-to-r from-gray-600 to-gray-500 hover:from-gray-500 hover:to-gray-400 shadow-gray-500/20'
    },
    amber: {
        text: 'text-amber-600',
        bg: 'bg-amber-500/10',
        border: 'border-amber-500/20',
        textLight: 'text-amber-400',
        loader: 'border-amber-500',
        button: 'bg-amber-500/50 text-amber-200',
        buttonGradient: 'bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 shadow-amber-500/20'
    },
    indigo: {
        text: 'text-indigo-500',
        bg: 'bg-indigo-500/10',
        border: 'border-indigo-500/20',
        textLight: 'text-indigo-400',
        loader: 'border-indigo-500',
        button: 'bg-indigo-500/50 text-indigo-200',
        buttonGradient: 'bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 shadow-indigo-500/20'
    },
    teal: {
        text: 'text-teal-500',
        bg: 'bg-teal-500/10',
        border: 'border-teal-500/20',
        textLight: 'text-teal-400',
        loader: 'border-teal-500',
        button: 'bg-teal-500/50 text-teal-200',
        buttonGradient: 'bg-gradient-to-r from-teal-600 to-teal-500 hover:from-teal-500 hover:to-teal-400 shadow-teal-500/20'
    }
};

export default function GenericRequestModule({
    title,
    subtitle,
    description,
    icon: Icon,
    colorTheme,
    searchKeywords,
    onValidateAndGetExtraData,
    children
}: GenericRequestModuleProps) {
    const navigate = useNavigate();
    const colors = colorMap[colorTheme];

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    // Data states
    const [profesionales, setProfesionales] = useState<Profesional[]>([]);
    const [tipoSolicitud, setTipoSolicitud] = useState<TipoSolicitud | null>(null);

    // Common Form states
    const [selectedProfesional, setSelectedProfesional] = useState('');
    const [fechaSolicitud, setFechaSolicitud] = useState('');
    const [solicitudGuardada, setSolicudGuardada] = useState<number | null>(null);

    // Modal state
    const [showSalidaModal, setShowSalidaModal] = useState(false);

    // Notification state
    const [notification, setNotification] = useState<{ message: string, type: 'success' | 'error' | null }>({ message: '', type: null });

    useEffect(() => {
        const initData = async () => {
            try {
                setLoading(true);

                // Set current date
                const now = new Date();
                setFechaSolicitud(now.toLocaleDateString('es-ES', { year: 'numeric', month: 'long', day: 'numeric' }));

                // 1. Fetch Tipo Solicitud
                const { data: tiposData, error: tiposError } = await supabase
                    .from('tipo_solicitud_75')
                    .select('tipo_solicitud, descripcion_tipo_salida');

                if (tiposError) throw tiposError;

                // Find the specific type based on keywords
                const targetTipo = tiposData?.find(t =>
                    searchKeywords.some(keyword => t.descripcion_tipo_salida.toLowerCase().includes(keyword.toLowerCase()))
                );

                if (targetTipo) {
                    setTipoSolicitud(targetTipo);
                } else {
                    console.error(`Tipo de solicitud para "${title}" no encontrado.`);
                    showNotification(`Error: Tipo de solicitud para "${title}" no configurado en el sistema.`, 'error');
                }

                // 2. Fetch Profesionales
                const { data: proData, error: proError } = await supabase
                    .from('colaboradores_06')
                    .select('identificacion, alias')
                    .eq('autorizado', true);

                if (proError) throw proError;
                setProfesionales(proData || []);

            } catch (error: any) {
                console.error('Error loading data:', error);
                showNotification('Error al cargar datos: ' + error.message, 'error');
            } finally {
                setLoading(false);
            }
        };

        initData();
    }, []);

    const showNotification = (message: string, type: 'success' | 'error') => {
        setNotification({ message, type });
        setTimeout(() => setNotification({ message: '', type: null }), 4000);
    };

    const handleGuardar = async () => {
        if (!selectedProfesional || !tipoSolicitud) {
            showNotification('Por favor complete todos los campos requeridos.', 'error');
            return;
        }

        const extraData = onValidateAndGetExtraData();

        if (extraData === null) {
            // Validation failed silently or parent handled it
            return;
        }

        if (typeof extraData === 'string') {
            // Validation failed with message
            showNotification(extraData, 'error');
            return;
        }

        try {
            setSaving(true);

            const insertObj = {
                tipo_solicitud: tipoSolicitud.tipo_solicitud,
                descripcion_solicitud: tipoSolicitud.descripcion_tipo_salida, // Default description
                fecha_solicitud: new Date().toLocaleDateString('en-CA'),
                profesional_responsable: selectedProfesional,
                ...extraData // Merge extra data (can override description)
            };

            const { data, error } = await supabase
                .from('solicitud_17')
                .insert([insertObj])
                .select('numero_solicitud')
                .single();

            if (error) throw error;

            // Automatically create tracking record so it's visible in the dashboard
            await supabase.from('seguimiento_solicitud').insert({
                numero_solicitud: data.numero_solicitud,
                estado_actual: 'ACTIVA'
            });

            setSolicudGuardada(data.numero_solicitud);
            showNotification(`Solicitud guardada exitosamente con número: ${data.numero_solicitud}`, 'success');

        } catch (error: any) {
            console.error('Error saving request:', error);
            showNotification('Error al guardar la solicitud: ' + error.message, 'error');
        } finally {
            setSaving(false);
        }
    };

    const handleGenerarSalida = () => {
        if (solicitudGuardada) {
            setShowSalidaModal(true);
        }
    };

    return (
        <div className="min-h-screen bg-[#0F172A] text-slate-100 p-6 relative">
            {/* Toast Notification */}
            {notification.type && (
                <div className={`fixed top-4 right-4 z-50 px-6 py-4 rounded-xl shadow-2xl flex items-center gap-3 transition-all duration-300 transform translate-y-0 ${notification.type === 'success'
                    ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400'
                    : 'bg-red-500/10 border border-red-500/20 text-red-400'
                    }`}>
                    {notification.type === 'success' ? <CheckCircle className="w-6 h-6" /> : <AlertCircle className="w-6 h-6" />}
                    <p className="font-medium">{notification.message}</p>
                </div>
            )}

            {/* Header */}
            <div className="flex items-center gap-4 mb-8">
                <button
                    onClick={() => navigate('/otras-solicitudes')}
                    className="p-2 hover:bg-slate-800 rounded-lg transition-colors text-slate-400 hover:text-white"
                >
                    <ArrowLeft className="w-6 h-6" />
                </button>
                <h1 className="text-2xl font-bold flex items-center gap-3">
                    <Icon className={`w-8 h-8 ${colors.text}`} />
                    {title}
                </h1>
            </div>

            {/* Main Content */}
            <div className="max-w-4xl mx-auto">
                <div className="bg-slate-800/50 border border-slate-700 rounded-2xl overflow-hidden backdrop-blur-sm">
                    {/* Module Header */}
                    <div className="p-8 text-center border-b border-slate-700 bg-slate-900/50">
                        <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-full ${colors.bg} ${colors.border} ${colors.textLight} mb-4`}>
                            <Icon className="w-4 h-4" />
                            <span className="text-sm font-medium">Formulario de Solicitud</span>
                        </div>
                        <h2 className="text-3xl font-bold text-white mb-2">{subtitle}</h2>
                        <p className="text-slate-400">{description}</p>
                    </div>

                    {/* Form Section */}
                    <div className="p-8">
                        {children({
                            profesionales,
                            fechaSolicitud,
                            selectedProfesional,
                            setSelectedProfesional,
                            loading
                        })}
                    </div>

                    {/* Actions Footer */}
                    <div className="p-6 bg-slate-900/30 border-t border-slate-700 flex flex-col sm:flex-row justify-between items-center gap-4">
                        <button
                            onClick={() => navigate('/otras-solicitudes')}
                            className="px-6 py-3 rounded-xl border border-slate-600 text-slate-300 hover:bg-slate-800 hover:text-white transition-all flex items-center gap-2 w-full sm:w-auto justify-center"
                        >
                            <ArrowLeft className="w-5 h-5" />
                            Regresar
                        </button>

                        <div className="flex flex-col sm:flex-row gap-4 w-full sm:w-auto">
                            <button
                                onClick={handleGenerarSalida}
                                disabled={!solicitudGuardada}
                                className={`px-6 py-3 rounded-xl font-medium flex items-center justify-center gap-2 transition-all w-full sm:w-auto ${solicitudGuardada
                                    ? 'bg-emerald-500/10 border border-emerald-500/50 text-emerald-400 hover:bg-emerald-500/20'
                                    : 'bg-slate-800 border border-slate-700 text-slate-500 cursor-not-allowed'
                                    }`}
                            >
                                <ExternalLink className="w-5 h-5" />
                                Generar Salida
                            </button>

                            <button
                                onClick={handleGuardar}
                                disabled={saving || loading || !tipoSolicitud}
                                className={`px-6 py-3 rounded-xl font-medium flex items-center justify-center gap-2 transition-all w-full sm:w-auto ${saving || loading || !tipoSolicitud
                                    ? `${colors.button} cursor-wait`
                                    : `${colors.buttonGradient} text-white shadow-lg`
                                    }`}
                            >
                                <Save className="w-5 h-5" />
                                {saving ? 'Guardando...' : 'Guardar Solicitud'}
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Salida Modal */}
            <SalidaArticulosModal
                isOpen={showSalidaModal}
                onClose={() => setShowSalidaModal(false)}
                solicitudId={solicitudGuardada}
            />
        </div>
    );
}
