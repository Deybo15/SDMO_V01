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
            <label className={`block text-[11px] font-black uppercase tracking-wider text-purple-400 opacity-80 ${required ? "after:content-['_*'] after:text-rose-500 after:font-bold" : ''}`}>
                {label}
            </label>
            <div className="relative group/field">
                {/* Visual Glow Effect */}
                <div className="absolute -inset-1 bg-gradient-to-r from-purple-500/10 to-violet-500/10 rounded-xl blur opacity-0 group-hover/field:opacity-100 transition duration-500"></div>

                <div
                    onClick={() => !disabled && !loading && !locked && onOpenSearch?.()}
                    className={cn(
                        "relative w-full bg-[#1E293B]/40 backdrop-blur-xl border rounded-xl px-4 py-3.5 text-[#e4e6ea] transition-all flex items-center justify-between",
                        (disabled || loading || locked) ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer group-hover/field:border-purple-500/40 group-hover/field:bg-white/5',
                        locked ? 'border-purple-500/20 bg-purple-500/5' : 'border-white/10'
                    )}
                >
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                        {Icon && <Icon className={`w-4 h-4 ${value ? 'text-purple-400' : 'text-slate-500'}`} />}
                        <span className={`truncate text-sm ${!value ? 'text-slate-500 font-medium' : 'text-white font-semibold'}`}>
                            {loading ? 'Cargando datos...' : (value ? displayValue : placeholder)}
                        </span>
                    </div>

                    {/* Action Group */}
                    <div className="flex items-center gap-2">
                        {value && !disabled && !loading && !locked && onClear && (
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onClear();
                                }}
                                className="p-1 px-2 hover:bg-white/10 rounded-lg transition-colors text-slate-500 hover:text-white flex items-center gap-1 border border-white/5 hover:border-white/10"
                            >
                                <X className="w-3.5 h-3.5" />
                                <span className="text-[10px] font-black uppercase tracking-tighter">Limpiar</span>
                            </button>
                        )}
                        {locked && (
                            <div className="flex items-center gap-1.5 px-2 py-1 bg-purple-500/10 border border-purple-500/20 rounded-lg">
                                <Shield className="w-3 h-3 text-purple-400" />
                                <span className="text-[9px] font-black text-purple-400 uppercase tracking-tighter">Asignado</span>
                            </div>
                        )}
                        <div className="w-px h-4 bg-white/10 mx-1"></div>
                        <Search className={cn(
                            "w-4 h-4 transition-transform duration-300",
                            !locked && "group-hover/field:scale-110",
                            (value || locked) ? 'text-purple-400' : 'text-slate-400'
                        )} />
                    </div>
                </div>
            </div>
        </div>
    );
}
