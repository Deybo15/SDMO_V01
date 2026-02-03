import { ChevronLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { cn } from '../../lib/utils';

interface PageHeaderProps {
    title: string;
    icon?: React.ElementType;
    themeColor?: string; // e.g. 'blue', 'orange'
    gradientFrom?: string;
    gradientTo?: string;
    backRoute?: string;
    subtitle?: string;
    rightElement?: React.ReactNode;
}

export const PageHeader = ({
    title,
    icon: Icon,
    themeColor = 'blue',
    backRoute,
    subtitle = "Gabinete de Gestión Operativa",
    rightElement
}: PageHeaderProps) => {
    const navigate = useNavigate();

    return (
        <div className="relative overflow-hidden bg-[#000000] border-b border-[#333333] mb-8">
            <div className="max-w-[1600px] mx-auto px-4 md:px-8 py-10">
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-8">
                    <div className="flex items-start md:items-center gap-6">
                        <button
                            onClick={() => backRoute ? navigate(backRoute) : navigate(-1)}
                            className="w-14 h-14 bg-transparent border border-[#F5F5F7]/30 rounded-[8px] flex items-center justify-center text-[#F5F5F7] hover:bg-[#F5F5F7]/10 transition-all shadow-xl active:scale-95"
                        >
                            <ChevronLeft className="w-6 h-6" />
                        </button>

                        <div className="space-y-2">
                            <div className="flex items-center gap-3">
                                {Icon && <div className="w-10 h-10 rounded-[6px] bg-[#0071E3] flex items-center justify-center shadow-2xl shadow-[#0071E3]/20">
                                    <Icon className="w-5 h-5 text-white" />
                                </div>}
                                <span className="text-[10px] font-black text-[#0071E3] uppercase tracking-[0.4em] drop-shadow-sm">
                                    {subtitle}
                                </span>
                            </div>
                            <h1 className="text-4xl md:text-5xl font-black text-[#F5F5F7] tracking-tighter leading-none italic uppercase font-heading">
                                {title}
                            </h1>
                        </div>
                    </div>

                    {rightElement && (
                        <div className="flex items-center gap-4">
                            {rightElement}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
