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
    compact?: boolean;
}

export const PageHeader = ({
    title,
    icon: Icon,
    themeColor = 'blue',
    backRoute,
    subtitle = "Gabinete de Gestión Operativa",
    rightElement,
    compact = false
}: PageHeaderProps) => {
    const navigate = useNavigate();

    if (compact) {
        return (
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 flex-1 min-w-0">
                <div>
                    <div className="flex items-center gap-3 mb-1">
                        {Icon && (
                            <div className="p-2 rounded-lg bg-[#0071E3]/10 text-[#0071E3] border border-[#0071E3]/20 shrink-0">
                                <Icon className="w-6 h-6" />
                            </div>
                        )}
                        <h1 className="text-2xl md:text-3xl font-black tracking-tight text-white">
                            {title}
                        </h1>
                    </div>
                    <p className="text-sm text-[#a1a1aa]">{subtitle}</p>
                </div>

                {rightElement && <div className="flex items-center gap-4">{rightElement}</div>}
            </div>
        );
    }

    return (
        <div className="relative bg-[#000000] mb-8">
            <div className="max-w-[1600px] mx-auto px-4 md:px-8 py-8">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#27272a] pb-6">
                    <div className="flex items-start sm:items-center gap-3 min-w-0">
                        <button
                            onClick={() => backRoute ? navigate(backRoute) : navigate(-1)}
                            className="w-10 h-10 rounded-lg bg-[#27272a] hover:bg-[#3f3f46] border border-[#3f3f46]/50 flex items-center justify-center text-[#a1a1aa] hover:text-white transition-all shrink-0 active:scale-95"
                            aria-label="Regresar"
                        >
                            <ChevronLeft className="w-5 h-5" />
                        </button>

                        {Icon && (
                            <div className="p-2 rounded-lg bg-[#0071E3]/10 text-[#0071E3] border border-[#0071E3]/20 shrink-0">
                                <Icon className="w-6 h-6" />
                            </div>
                        )}

                        <div className="min-w-0">
                            <h1 className="text-2xl md:text-3xl font-black tracking-tight text-white leading-tight">
                                {title}
                            </h1>
                            <p className="text-sm text-[#a1a1aa] mt-1">{subtitle}</p>
                        </div>
                    </div>

                    {rightElement && <div className="flex items-center gap-4">{rightElement}</div>}
                </div>
            </div>
        </div>
    );
};
