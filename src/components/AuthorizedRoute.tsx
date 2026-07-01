import { Navigate, Outlet } from 'react-router-dom';
import { Loader2, ShieldAlert } from 'lucide-react';
import { useAuthorization } from '../hooks/useAuthorization';

export const AuthorizedRoute = () => {
    const { status } = useAuthorization();

    if (status === 'loading') {
        return (
            <div className="h-screen w-full flex items-center justify-center bg-slate-900">
                <div className="flex flex-col items-center gap-4">
                    <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
                    <p className="text-sm text-slate-400 font-medium">Verificando autorizaciones...</p>
                </div>
            </div>
        );
    }

    if (status === 'no-session') {
        return <Navigate to="/login" replace />;
    }

    if (status === 'unauthorized') {
        return (
            <div className="h-screen w-full flex items-center justify-center bg-slate-900 p-6 text-center">
                <div className="max-w-md bg-slate-800/50 p-8 rounded-3xl border border-red-500/20 shadow-2xl backdrop-blur-sm animate-in zoom-in-95 duration-300">
                    <div className="w-20 h-20 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-6 border border-red-500/20">
                        <ShieldAlert className="w-10 h-10 text-red-500" />
                    </div>
                    <h1 className="text-2xl font-bold text-white mb-4 tracking-tight">Acceso Restringido</h1>
                    <p className="text-red-400 font-bold text-lg mb-6 leading-relaxed">
                        NO ESTÁ AUTORIZADO PARA INGRESAR A ESTA PAGINA
                    </p>
                    <div className="h-px bg-white/5 w-full mb-6"></div>
                    <p className="text-slate-400 text-sm mb-8">
                        Esta sección está limitada a personal con permisos de gestión de datos. Si cree que esto es un error, contacte al administrador.
                    </p>
                    <button
                        onClick={() => window.location.href = '/'}
                        className="w-full py-3 px-6 bg-slate-700 hover:bg-slate-600 text-white font-bold rounded-xl transition-all border border-white/5 shadow-lg group flex items-center justify-center gap-2"
                    >
                        Volver al Inicio
                    </button>
                </div>
            </div>
        );
    }

    return <Outlet />;
};
