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
    theme?: 'default' | 'neutral';
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
    locked = false,
    theme = 'default'
}: FormSelectProps) {
    const neutral = theme === 'neutral';
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
                        neutral && 'bg-[#111112] rounded-lg',
                        (disabled || loading || locked) ? 'opacity-50 cursor-not-allowed' : neutral ? 'cursor-pointer hover:border-[#a1a1aa] hover:bg-[#18181b]' : 'cursor-pointer hover:border-[#0071E3]/40 hover:bg-white/[0.02]',
                        locked ? (neutral ? 'border-[#52525b] bg-[#18181b]' : 'border-[#0071E3]/20 bg-[#0071E3]/5') : neutral ? 'border-[#3f3f46]' : 'border-[#333333]'
                    )}
                >
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                        {Icon && <Icon className={`w-4 h-4 ${value ? (neutral ? 'text-white' : 'text-[#0071E3]') : 'text-[#86868B]'}`} />}
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
                            <div className={cn("flex items-center gap-1.5 px-2 py-1 border rounded-[8px]", neutral ? "bg-[#27272a] border-[#52525b]" : "bg-[#0071E3]/10 border-[#0071E3]/20")}>
                                <Shield className={cn("w-3 h-3", neutral ? "text-white" : "text-[#0071E3]")} />
                                <span className={cn("text-[9px] font-black uppercase tracking-tighter", neutral ? "text-white" : "text-[#0071E3]")}>Asignado</span>
                            </div>
                        )}
                        <div className="w-px h-4 bg-[#333333] mx-1"></div>
                        <Search className={cn(
                            "w-4 h-4 transition-transform duration-300",
                            !locked && "group-hover/field:scale-110",
                            (value || locked) ? (neutral ? 'text-white' : 'text-[#0071E3]') : 'text-[#86868B]'
                        )} />
                    </div>
                </div>
            </div>
        </div>
    );
}
