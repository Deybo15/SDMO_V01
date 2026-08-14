import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import {
    UserPlus,
    ArrowLeft,
    Save,
    User,
    Mail,
    Phone,
    Briefcase,
    Building2,
    CheckCircle2,
    XCircle,
    Loader2
} from 'lucide-react';
import { PageHeader } from '../components/ui/PageHeader';
import { cn } from '../lib/utils';

export default function IngresarClienteInterno() {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(false);
    const [success, setSuccess] = useState(false);
    const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

    const [formData, setFormData] = useState({
        nombre: '',
        dependencia: '',
        puesto: '',
        correo: '',
        telefono: ''
    });

    // 1. Recover draft from localStorage on mount
    useEffect(() => {
        const savedDraft = localStorage.getItem('sdmo_cliente_interno_draft');
        if (savedDraft) {
            try {
                setFormData(JSON.parse(savedDraft));
                console.log('✅ Borrador recuperado correctamente');
            } catch (e) {
                console.error('Error al recuperar borrador:', e);
            }
        }
    }, []);

    // 2. Save draft to localStorage on every change
    useEffect(() => {
        if (!success) {
            localStorage.setItem('sdmo_cliente_interno_draft', JSON.stringify(formData));
        }
    }, [formData, success]);

    const showNotification = (message: string, type: 'success' | 'error') => {
        setNotification({ message, type });
        setTimeout(() => setNotification(null), 4000);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        try {
            if (!formData.nombre.trim()) {
                throw new Error('El nombre es obligatorio');
            }

            const { error } = await supabase
                .from('cliente_interno_15')
                .insert([formData]);

            if (error) throw error;

            // Clear draft and show success
            localStorage.removeItem('sdmo_cliente_interno_draft');
            setSuccess(true);
            showNotification('Cliente registrado exitosamente', 'success');

            setFormData({
                nombre: '',
                dependencia: '',
                puesto: '',
                correo: '',
                telefono: ''
            });
        } catch (error: any) {
            console.error('Error al registrar cliente:', error);
            showNotification(error.message || 'Error al procesar la solicitud', 'error');
        } finally {
            setLoading(false);
        }
    };

    const handleReset = () => {
        setSuccess(false);
        setFormData({
            nombre: '',
            dependencia: '',
            puesto: '',
            correo: '',
            telefono: ''
        });
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    return (
        <div className="min-h-screen bg-black p-4 md:p-8 text-[#f4f4f5] selection:bg-white/20">
            <div className="max-w-5xl mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-5">
                    <PageHeader
                        title="Registrar Cliente Interno"
                        icon={UserPlus}
                        themeColor="neutral"
                        subtitle="Registro de funcionarios para la gestión de solicitudes internas."
                    />
                    <button
                        onClick={() => navigate('/cliente-interno')}
                        className="h-12 px-6 rounded-lg bg-[#111112] border border-[#52525b] flex items-center gap-3 text-[#d4d4d8] hover:text-white hover:bg-[#18181b] transition-colors group"
                    >
                        <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
                        <span className="text-sm font-semibold leading-none">Regresar</span>
                    </button>
                </div>

                <div className="bg-[#0d0d0e] border border-[#3f3f46] rounded-xl overflow-hidden">
                    <div className="p-6 md:p-8 space-y-8">
                        {success ? (
                            <div className="py-20 flex flex-col items-center justify-center text-center animate-in zoom-in-95 duration-500">
                                <div className="relative mb-8">
                                    <div className="absolute inset-0 bg-white/10 rounded-full blur-3xl scale-150 animate-pulse" />
                                    <div className="w-24 h-24 bg-[#18181b] border border-[#71717a] rounded-full flex items-center justify-center relative z-10 shadow-2xl">
                                        <CheckCircle2 className="w-12 h-12 text-white" />
                                    </div>
                                </div>
                                <h3 className="text-3xl font-semibold text-white tracking-tight mb-4">Registro exitoso</h3>
                                <p className="text-[#a1a1aa] max-w-md mx-auto text-sm leading-relaxed mb-10">
                                    El cliente interno ha sido guardado correctamente en la base de datos técnica del SDMO.
                                </p>
                                <div className="flex flex-col md:flex-row gap-4 w-full md:w-auto">
                                    <button
                                        onClick={handleReset}
                                        className="h-12 px-8 rounded-lg bg-[#e4e4e7] text-black hover:bg-white flex items-center justify-center gap-3 transition-colors"
                                    >
                                        <UserPlus className="w-4 h-4" />
                                        <span className="text-sm font-semibold">Registrar otro</span>
                                    </button>
                                    <button
                                        onClick={() => navigate('/cliente-interno')}
                                        className="h-12 px-8 rounded-lg bg-[#111112] border border-[#52525b] hover:bg-[#18181b] flex items-center justify-center gap-3 transition-colors"
                                    >
                                        <ArrowLeft className="w-4 h-4" />
                                        <span className="text-sm font-semibold">Volver al menú</span>
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <>
                                <div className="space-y-1 pb-5 border-b border-[#27272a]">
                                    <h3 className="text-xl font-semibold text-white tracking-tight">Información personal</h3>
                                    <p className="text-sm text-[#a1a1aa]">Complete los datos del funcionario. El nombre es obligatorio.</p>
                                </div>

                                <form onSubmit={handleSubmit} className="space-y-8">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-6">
                                        {/* Nombre */}
                                        <div className="space-y-3">
                                            <label className="flex items-center gap-2 text-[10px] font-semibold text-[#a1a1aa] uppercase tracking-[0.14em] ml-1">
                                                <User className="w-3.5 h-3.5 text-[#d4d4d8]" />
                                                Nombre Completo
                                            </label>
                                            <input
                                                required
                                                type="text"
                                                name="nombre"
                                                value={formData.nombre}
                                                onChange={handleChange}
                                                placeholder="Nombre del funcionario"
                                                className="w-full h-14 bg-[#111112] border border-[#3f3f46] rounded-lg px-5 text-white placeholder-[#52525b] focus:outline-none focus:border-[#a1a1aa] transition-colors"
                                            />
                                        </div>

                                        {/* Dependencia */}
                                        <div className="space-y-3">
                                            <label className="flex items-center gap-2 text-[10px] font-semibold text-[#a1a1aa] uppercase tracking-[0.14em] ml-1">
                                                <Building2 className="w-3.5 h-3.5 text-[#d4d4d8]" />
                                                Dependencia
                                            </label>
                                            <input
                                                type="text"
                                                name="dependencia"
                                                value={formData.dependencia}
                                                onChange={handleChange}
                                                placeholder="Unidad administrativa"
                                                className="w-full h-14 bg-[#111112] border border-[#3f3f46] rounded-lg px-5 text-white placeholder-[#52525b] focus:outline-none focus:border-[#a1a1aa] transition-colors"
                                            />
                                        </div>

                                        {/* Puesto */}
                                        <div className="space-y-3">
                                            <label className="flex items-center gap-2 text-[10px] font-semibold text-[#a1a1aa] uppercase tracking-[0.14em] ml-1">
                                                <Briefcase className="w-3.5 h-3.5 text-[#d4d4d8]" />
                                                Puesto
                                            </label>
                                            <input
                                                type="text"
                                                name="puesto"
                                                value={formData.puesto}
                                                onChange={handleChange}
                                                placeholder="Cargo institucional"
                                                className="w-full h-14 bg-[#111112] border border-[#3f3f46] rounded-lg px-5 text-white placeholder-[#52525b] focus:outline-none focus:border-[#a1a1aa] transition-colors"
                                            />
                                        </div>

                                        {/* Correo */}
                                        <div className="space-y-3">
                                            <label className="flex items-center gap-2 text-[10px] font-semibold text-[#a1a1aa] uppercase tracking-[0.14em] ml-1">
                                                <Mail className="w-3.5 h-3.5 text-[#d4d4d8]" />
                                                Correo
                                            </label>
                                            <input
                                                type="email"
                                                name="correo"
                                                value={formData.correo}
                                                onChange={handleChange}
                                                placeholder="usuario@msj.go.cr"
                                                className="w-full h-14 bg-[#111112] border border-[#3f3f46] rounded-lg px-5 text-white placeholder-[#52525b] focus:outline-none focus:border-[#a1a1aa] transition-colors"
                                            />
                                        </div>

                                        {/* Telefono */}
                                        <div className="space-y-3 md:col-span-2">
                                            <label className="flex items-center gap-2 text-[10px] font-semibold text-[#a1a1aa] uppercase tracking-[0.14em] ml-1">
                                                <Phone className="w-3.5 h-3.5 text-[#d4d4d8]" />
                                                Teléfono
                                            </label>
                                            <input
                                                type="text"
                                                name="telefono"
                                                value={formData.telefono}
                                                onChange={handleChange}
                                                placeholder="Número de contacto o extensión"
                                                className="w-full h-14 bg-[#111112] border border-[#3f3f46] rounded-lg px-5 text-white placeholder-[#52525b] focus:outline-none focus:border-[#a1a1aa] transition-colors"
                                            />
                                        </div>
                                    </div>

                                    <div className="pt-6 border-t border-[#27272a] flex flex-col md:flex-row gap-4">
                                        <button
                                            type="submit"
                                            disabled={loading}
                                            className={cn(
                                                "flex-1 h-12 bg-[#e4e4e7] hover:bg-white text-black rounded-lg flex items-center justify-center gap-3 transition-colors",
                                                loading && "opacity-50 pointer-events-none"
                                            )}
                                        >
                                            {loading ? (
                                                <Loader2 className="w-6 h-6 animate-spin" />
                                            ) : (
                                                <>
                                                    <Save className="w-5 h-5 group-hover:scale-110 transition-transform" />
                                                    <span className="text-sm font-semibold">Guardar registro</span>
                                                </>
                                            )}
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => navigate('/cliente-interno')}
                                            className="px-8 h-12 bg-[#111112] border border-[#52525b] rounded-lg flex items-center justify-center text-sm font-semibold text-white hover:bg-[#18181b] transition-colors"
                                        >
                                            Cancelar
                                        </button>
                                    </div>
                                </form>
                            </>
                        )}
                    </div>
                </div>

                <div className="p-4 border-t border-[#27272a]">
                    <p className="text-xs text-[#71717a] text-center leading-relaxed">
                        Sistema de Gestión de Clientes Internos • SDMO
                    </p>
                </div>
            </div>

            {/* Notification Toast */}
            {notification && (
                <div className={cn(
                    "fixed bottom-8 right-8 z-[100] px-6 py-4 rounded-lg border border-[#52525b] bg-[#111112] backdrop-blur-2xl flex items-center gap-4 animate-in slide-in-from-right-10 shadow-2xl",
                    notification.type === 'success' ? 'text-white' : 'text-[#d4d4d8]'
                )}>
                    {notification.type === 'success' ? <CheckCircle2 className="w-6 h-6" /> : <XCircle className="w-6 h-6" />}
                    <span className="text-sm font-semibold">{notification.message}</span>
                </div>
            )}
        </div>
    );
}
