import { useNavigate } from 'react-router-dom';
import { ArrowLeft, ArrowRight, FileEdit, RefreshCw } from 'lucide-react';

export default function GestionCambios() {
    const navigate = useNavigate();

    return (
        <div className="min-h-screen bg-black p-4 text-[#f4f4f5] selection:bg-white/20 md:px-8 md:py-6">
            <div className="w-full space-y-6 animate-fade-in-up">
                <header className="flex flex-col justify-between gap-4 border-b border-[#27272a] pb-4 md:flex-row md:items-center">
                    <div className="flex items-center gap-3">
                        <div className="rounded-lg border border-[#71717a] bg-[#111112] p-3 text-[#e4e4e7]">
                            <RefreshCw className="h-7 w-7" />
                        </div>
                        <div>
                            <h1 className="text-2xl font-black tracking-tight text-white md:text-[30px]">Gestión de Cambios</h1>
                            <p className="text-sm text-[#a1a1aa]">Control y seguimiento de cambios en las órdenes de trabajo</p>
                        </div>
                    </div>

                    <button
                        type="button"
                        onClick={() => navigate('/')}
                        className="inline-flex items-center justify-center gap-2 rounded-lg border border-[#71717a] bg-[#111112] px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-[#18181b]"
                    >
                        <ArrowLeft className="h-5 w-5" />
                        Menú principal
                    </button>
                </header>

                <section>
                    <h2 className="mb-3 flex items-center gap-4 text-xs font-semibold uppercase tracking-[0.18em] text-[#a1a1aa]">
                        Administración de órdenes
                        <span className="h-px flex-1 bg-[#27272a]" />
                    </h2>

                    <button
                        type="button"
                        onClick={() => navigate('/gestion-cambios/orden-trabajo')}
                        className="group flex min-h-[136px] w-full items-center gap-5 rounded-xl border border-[#3f3f46] bg-[#0d0d0e] p-5 text-left transition-colors hover:border-[#71717a] hover:bg-[#111112]"
                    >
                        <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg border border-[#52525b] bg-[#151517] text-[#e4e4e7]">
                            <FileEdit className="h-6 w-6" />
                        </span>
                        <span className="min-w-0 flex-1">
                            <strong className="block text-[15px] font-semibold text-white">Cambios en orden de trabajo</strong>
                            <span className="mt-1 block text-xs leading-relaxed text-[#a1a1aa]">
                                Modificar supervisor, área, instalación o solicitante de órdenes activas
                            </span>
                        </span>
                        <ArrowRight className="h-5 w-5 shrink-0 text-[#a1a1aa] transition-transform group-hover:translate-x-1 group-hover:text-white" />
                    </button>
                </section>
            </div>
        </div>
    );
}
