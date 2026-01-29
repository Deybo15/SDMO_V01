import { ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface PageHeaderProps {
    title: string;
    icon?: React.ElementType;
    themeColor?: string; // e.g. 'blue', 'orange'
    gradientFrom?: string;
    gradientTo?: string;
    backRoute?: string;
}

export const PageHeader = ({
    title,
    icon: Icon,
    themeColor = 'blue',
    gradientFrom = 'from-blue-900',
    gradientTo = 'to-slate-900',
    backRoute
}: PageHeaderProps) => {
    const navigate = useNavigate();

    return (
        <div className={`relative overflow-hidden bg-[#0f111a] border-b border-white/5 pb-8 mb-8`}>
            {/* Background Gradient Glow */}
            <div className={`absolute -top-24 -left-24 w-64 h-64 bg-${themeColor}-500/10 rounded-full blur-[100px] pointer-events-none`} />

            <div className="max-w-7xl mx-auto px-4 md:px-0 pt-8">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                    <div className="flex items-center gap-6">
                        <button
                            onClick={() => backRoute ? navigate(backRoute) : navigate(-1)}
                            className="p-3 bg-white/5 hover:bg-white/10 rounded-2xl transition-all text-white border border-white/10 active:scale-95 group shadow-lg"
                        >
                            <ArrowLeft className="w-6 h-6 group-hover:-translate-x-1 transition-transform" />
                        </button>
                        <div>
                            <div className="flex items-center gap-3 mb-1">
                                {Icon && <div className={`p-2 bg-${themeColor}-500/10 rounded-lg text-${themeColor}-400`}>
                                    <Icon className="w-6 h-6" />
                                </div>}
                                <span className="text-[10px] font-black text-gray-500 uppercase tracking-[0.3em]">Sistema de Gestión</span>
                            </div>
                            <h1 className="text-3xl font-black text-white tracking-tight">
                                {title}
                            </h1>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
