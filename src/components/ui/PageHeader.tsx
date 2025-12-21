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
        <div className={`bg-gradient-to-r ${gradientFrom} ${gradientTo} border-b border-white/10 p-6 shadow-lg`}>
            <div className="max-w-7xl mx-auto flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <button
                        onClick={() => backRoute ? navigate(backRoute) : navigate(-1)}
                        className="p-2 bg-white/10 hover:bg-white/20 rounded-lg transition-colors text-white"
                    >
                        <ArrowLeft className="w-6 h-6" />
                    </button>
                    <div>
                        <h1 className="text-2xl font-bold text-white flex items-center gap-3">
                            {Icon && <Icon className={`w-8 h-8 text-${themeColor}-400`} />}
                            {title}
                        </h1>
                    </div>
                </div>
            </div>
        </div>
    );
};
