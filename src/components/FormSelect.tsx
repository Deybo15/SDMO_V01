import { Search, X, Loader2 } from 'lucide-react';

interface FormSelectProps {
    label: string;
    value: string | number;
    displayValue: string;
    placeholder?: string;
    onOpenSearch: () => void;
    onClear: () => void;
    loading?: boolean;
    disabled?: boolean;
    required?: boolean;
}

export default function FormSelect({
    label,
    value,
    displayValue,
    placeholder = '-- Seleccione una opción --',
    onOpenSearch,
    onClear,
    loading = false,
    disabled = false,
    required = false
}: FormSelectProps) {
    return (
        <div className="space-y-2">
            <label className={`block text-sm font-medium text-[#e4e6ea] ${required ? "after:content-['_*'] after:text-red-500 after:font-bold" : ''}`}>
                {label}
            </label>
            <div className="relative group">
                <div
                    onClick={() => !disabled && !loading && onOpenSearch()}
                    className={`w-full bg-[#2d3241]/60 backdrop-blur-sm border border-white/10 rounded-xl px-4 py-3.5 text-[#e4e6ea] transition-all flex items-center justify-between ${disabled || loading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:bg-[#373c4b]/80'
                        }`}
                >
                    <span className={!value ? 'text-[#9ca3af]/70' : ''}>
                        {loading ? 'Cargando datos...' : (value ? displayValue : placeholder)}
                    </span>

                    {/* Clear Button */}
                    {value && !disabled && !loading && (
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                onClear();
                            }}
                            className="mr-12 p-1 hover:bg-white/10 rounded-full transition-colors text-[#9ca3af] hover:text-white"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    )}
                </div>

                <button
                    onClick={() => !disabled && !loading && onOpenSearch()}
                    disabled={disabled || loading}
                    className="absolute right-0 top-0 h-full w-12 flex items-center justify-center bg-gradient-to-br from-[#8e44ad]/30 to-[#9b59b6]/30 text-[#8e44ad] rounded-r-xl border-l border-white/10 hover:from-[#8e44ad]/40 hover:to-[#9b59b6]/40 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                </button>
            </div>
        </div>
    );
}
