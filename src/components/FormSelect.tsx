import { Search, X, LucideIcon, Shield } from 'lucide-react';
import { cn } from '../lib/utils';

interface FormSelectProps {
    label: string;
    value: string | number;
    displayValue: string;
    placeholder?: string;
    onOpenSearch?: () => void;
    onClear?: () => void;
    loading?: boolean;
    disabled?: boolean;
    required?: boolean;
    locked?: boolean;
    icon?: LucideIcon;
}

export default function FormSelect({
    label,
    value,
    displayValue,
    placeholder = '-- Seleccione una opción --',
    onOpenSearch,
    onClear,
    icon: Icon,
    loading = false,
    disabled = false,
    required = false,
    locked = false
}: FormSelectProps) {
    return (
        <div className="space-y-2">
            <label className={`block text-[11px] font-black uppercase tracking-wider text-[#86868B] ${required ? "after:content-['_*'] after:text-rose-500 after:font-bold" : ''}`}>
                {label}
            </label>
            <div className="relative group/field">
                <div
                    onClick={() => !disabled && !loading && !locked && onOpenSearch?.()}
                    className={cn(
                        "relative w-full bg-[#1D1D1F] border rounded-[8px] px-4 py-3.5 text-[#F5F5F7] transition-all flex items-center justify-between",
                        (disabled || loading || locked) ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:border-[#0071E3]/40 hover:bg-white/[0.02]',
                        locked ? 'border-[#0071E3]/20 bg-[#0071E3]/5' : 'border-[#333333]'
                    )}
                >
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                        {Icon && <Icon className={`w-4 h-4 ${value ? 'text-[#0071E3]' : 'text-[#86868B]'}`} />}
                        <span className={`truncate text-sm ${!value ? 'text-[#86868B] font-medium' : 'text-[#F5F5F7] font-semibold'}`}>
                            {loading ? 'Cargando datos...' : (value ? displayValue : placeholder)}
                        </span>
                    </div>

                    <div className="flex items-center gap-2">
                        {value && !disabled && !loading && !locked && onClear && (
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onClear();
                                }}
                                className="p-1 px-2 bg-transparent border border-[#F5F5F7] text-[#F5F5F7] rounded-[8px] hover:bg-white/5 transition-all flex items-center gap-1"
                            >
                                <X className="w-3 h-3" />
                                <span className="text-[9px] font-black uppercase tracking-tighter">Limpiar</span>
                            </button>
                        )}
                        {locked && (
                            <div className="flex items-center gap-1.5 px-2 py-1 bg-[#0071E3]/10 border border-[#0071E3]/20 rounded-[8px]">
                                <Shield className="w-3 h-3 text-[#0071E3]" />
                                <span className="text-[9px] font-black text-[#0071E3] uppercase tracking-tighter">Asignado</span>
                            </div>
                        )}
                        <div className="w-px h-4 bg-[#333333] mx-1"></div>
                        <Search className={cn(
                            "w-4 h-4 transition-transform duration-300",
                            !locked && "group-hover/field:scale-110",
                            (value || locked) ? 'text-[#0071E3]' : 'text-[#86868B]'
                        )} />
                    </div>
                </div>
            </div>
        </div>
    );
}
