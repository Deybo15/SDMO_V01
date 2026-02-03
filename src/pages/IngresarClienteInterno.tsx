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
        <div className="min-h-screen bg-[#000000] p-4 md:p-8 relative overflow-hidden text-[#F5F5F7]">
            <div className="relative z-10 max-w-4xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
                    <PageHeader
                        title="Registrar Cliente Interno"
                        icon={UserPlus}
                        themeColor="blue"
                    />
                    <button
                        onClick={() => navigate('/cliente-interno')}
                        className="h-14 px-8 rounded-[8px] border border-[#333333] flex items-center gap-3 text-[#86868B] hover:text-[#F5F5F7] hover:bg-white/5 transition-all group"
                    >
                        <ArrowLeft className="w-5 h-5 text-[#0071E3] group-hover:-translate-x-1 transition-transform" />
                        <span className="text-[11px] font-black uppercase tracking-widest leading-none">Regresar</span>
                    </button>
                </div>

                <div className="bg-[#121212] border border-[#333333] rounded-[8px] overflow-hidden shadow-2xl">
                    <div className="p-8 md:p-12 space-y-10">
                        {success ? (
                            <div className="py-20 flex flex-col items-center justify-center text-center animate-in zoom-in-95 duration-500">
                                <div className="relative mb-8">
                                    <div className="absolute inset-0 bg-[#0071E3]/20 rounded-full blur-3xl scale-150 animate-pulse" />
                                    <div className="w-24 h-24 bg-[#1D1D1F] border border-[#0071E3]/30 rounded-full flex items-center justify-center relative z-10 shadow-2xl">
                                        <CheckCircle2 className="w-12 h-12 text-[#0071E3]" />
                                    </div>
                                </div>
                                <h3 className="text-3xl font-black text-white tracking-tight uppercase italic mb-4">Registro Exitoso</h3>
                                <p className="text-[#86868B] max-w-sm mx-auto font-bold text-xs leading-relaxed tracking-widest uppercase mb-10">
                                    El cliente interno ha sido guardado correctamente en la base de datos técnica del SDMO.
                                </p>
                                <div className="flex flex-col md:flex-row gap-4 w-full md:w-auto">
                                    <button
                                        onClick={handleReset}
                                        className="btn-primary h-14 px-10 flex items-center justify-center gap-3"
                                    >
                                        <UserPlus className="w-4 h-4" />
                                        <span className="text-[10px] uppercase font-black tracking-widest">Registrar Otro</span>
                                    </button>
                                    <button
                                        onClick={() => navigate('/cliente-interno')}
                                        className="btn-ghost h-14 px-10 flex items-center justify-center gap-3 border-[#333333] hover:border-white/20"
                                    >
                                        <ArrowLeft className="w-4 h-4" />
                                        <span className="text-[10px] uppercase font-black tracking-widest">Volver al Menú</span>
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <>
                                <div className="space-y-1">
                                    <h3 className="text-2xl font-black text-white tracking-tight uppercase italic">Información Personal</h3>
                                    <p className="text-[10px] text-[#86868B] font-bold uppercase tracking-[0.2em]">Complete todos los campos requeridos</p>
                                </div>

                                <form onSubmit={handleSubmit} className="space-y-10">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-10 gap-y-8">
                                        {/* Nombre */}
                                        <div className="space-y-3">
                                            <label className="flex items-center gap-2 text-[10px] font-black text-[#86868B] uppercase tracking-[0.2em] ml-1">
                                                <User className="w-3.5 h-3.5 text-[#0071E3]" />
                                                Nombre Completo
                                            </label>
                                            <input
                                                required
                                                type="text"
                                                name="nombre"
                                                value={formData.nombre}
                                                onChange={handleChange}
                                                placeholder="Nombre del funcionario"
                                                className="w-full h-14 bg-[#1D1D1F] border border-[#333333] rounded-[8px] px-6 text-white placeholder-[#333333] focus:outline-none focus:border-[#0071E3]/50 transition-all font-bold"
                                            />
                                        </div>

                                        {/* Dependencia */}
                                        <div className="space-y-3">
                                            <label className="flex items-center gap-2 text-[10px] font-black text-[#86868B] uppercase tracking-[0.2em] ml-1">
                                                <Building2 className="w-3.5 h-3.5 text-[#0071E3]" />
                                                Dependencia
                                            </label>
                                            <input
                                                type="text"
                                                name="dependencia"
                                                value={formData.dependencia}
                                                onChange={handleChange}
                                                placeholder="Unidad administrativa"
                                                className="w-full h-14 bg-[#1D1D1F] border border-[#333333] rounded-[8px] px-6 text-white placeholder-[#333333] focus:outline-none focus:border-[#0071E3]/50 transition-all font-bold"
                                            />
                                        </div>

                                        {/* Puesto */}
                                        <div className="space-y-3">
                                            <label className="flex items-center gap-2 text-[10px] font-black text-[#86868B] uppercase tracking-[0.2em] ml-1">
                                                <Briefcase className="w-3.5 h-3.5 text-[#0071E3]" />
                                                Puesto
                                            </label>
                                            <input
                                                type="text"
                                                name="puesto"
                                                value={formData.puesto}
                                                onChange={handleChange}
                                                placeholder="Cargo institucional"
                                                className="w-full h-14 bg-[#1D1D1F] border border-[#333333] rounded-[8px] px-6 text-white placeholder-[#333333] focus:outline-none focus:border-[#0071E3]/50 transition-all font-bold"
                                            />
                                        </div>

                                        {/* Correo */}
                                        <div className="space-y-3">
                                            <label className="flex items-center gap-2 text-[10px] font-black text-[#86868B] uppercase tracking-[0.2em] ml-1">
                                                <Mail className="w-3.5 h-3.5 text-[#0071E3]" />
                                                Correo
                                            </label>
                                            <input
                                                type="email"
                                                name="correo"
                                                value={formData.correo}
                                                onChange={handleChange}
                                                placeholder="usuario@msj.go.cr"
                                                className="w-full h-14 bg-[#1D1D1F] border border-[#333333] rounded-[8px] px-6 text-white placeholder-[#333333] focus:outline-none focus:border-[#0071E3]/50 transition-all font-bold"
                                            />
                                        </div>

                                        {/* Telefono */}
                                        <div className="space-y-3 md:col-span-2">
                                            <label className="flex items-center gap-2 text-[10px] font-black text-[#86868B] uppercase tracking-[0.2em] ml-1">
                                                <Phone className="w-3.5 h-3.5 text-[#0071E3]" />
                                                Teléfono
                                            </label>
                                            <input
                                                type="text"
                                                name="telefono"
                                                value={formData.telefono}
                                                onChange={handleChange}
                                                placeholder="Número de contacto o extensión"
                                                className="w-full h-14 bg-[#1D1D1F] border border-[#333333] rounded-[8px] px-6 text-white placeholder-[#333333] focus:outline-none focus:border-[#0071E3]/50 transition-all font-bold"
                                            />
                                        </div>
                                    </div>

                                    <div className="pt-8 border-t border-[#333333] flex flex-col md:flex-row gap-6">
                                        <button
                                            type="submit"
                                            disabled={loading}
                                            className={cn(
                                                "flex-1 h-16 bg-[#0071E3] hover:bg-[#0077ED] text-white rounded-[8px] flex items-center justify-center gap-4 transition-all shadow-xl shadow-[#0071E3]/10 active:scale-[0.98]",
                                                loading && "opacity-50 pointer-events-none"
                                            )}
                                        >
                                            {loading ? (
                                                <Loader2 className="w-6 h-6 animate-spin" />
                                            ) : (
                                                <>
                                                    <Save className="w-5 h-5 group-hover:scale-110 transition-transform" />
                                                    <span className="text-xs font-black uppercase tracking-[0.2em]">Guardar Registro Técnico</span>
                                                </>
                                            )}
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => navigate('/cliente-interno')}
                                            className="px-10 h-16 bg-transparent border border-[#333333] rounded-[8px] flex items-center justify-center text-[11px] font-black uppercase tracking-widest text-[#F5F5F7] hover:bg-white/5 transition-all"
                                        >
                                            Cancelar
                                        </button>
                                    </div>
                                </form>
                            </>
                        )}
                    </div>
                </div>

                <div className="bg-[#121212] p-6 border border-[#333333] rounded-[8px]">
                    <p className="text-[10px] text-[#86868B] font-bold uppercase tracking-widest text-center leading-relaxed italic">
                        Sistema de Gestión de Clientes Internos • SDMO
                    </p>
                </div>
            </div>

            {/* Notification Toast */}
            {notification && (
                <div className={cn(
                    "fixed bottom-8 right-8 z-[100] px-8 py-5 rounded-[8px] border border-[#333333] bg-[#121212] backdrop-blur-2xl flex items-center gap-5 animate-in slide-in-from-right-10 shadow-3xl",
                    notification.type === 'success' ? 'text-emerald-400' : 'text-rose-400'
                )}>
                    {notification.type === 'success' ? <CheckCircle2 className="w-6 h-6" /> : <XCircle className="w-6 h-6" />}
                    <span className="text-xs font-black uppercase tracking-[0.2em]">{notification.message}</span>
                </div>
            )}
        </div>
    );
}
