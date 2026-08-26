import { useState, useEffect } from 'react';
import { Search, X, Loader2, Truck } from 'lucide-react';
import { createPortal } from 'react-dom';

interface Equipo {
    numero_activo: number;
    placa: string;
    descripcion_equipo: string;
}

interface EquipoSearchModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSelect: (equipo: Equipo) => void;
    equipos: Equipo[];
    loading?: boolean;
}

export default function EquipoSearchModal({ isOpen, onClose, onSelect, equipos, loading = false }: EquipoSearchModalProps) {
    const [searchTerm, setSearchTerm] = useState('');
    const [filteredEquipos, setFilteredEquipos] = useState<Equipo[]>(equipos);

    useEffect(() => {
        if (isOpen) {
            setSearchTerm('');
            setFilteredEquipos(equipos);
        }
    }, [isOpen, equipos]);

    useEffect(() => {
        const term = searchTerm.toLowerCase();
        const filtered = equipos.filter(eq => {
            if (!eq) return false;
            return (eq.descripcion_equipo || '').toLowerCase().includes(term) ||
                (eq.numero_activo || '').toString().includes(term) ||
                (eq.placa || '').toLowerCase().includes(term);
        });
        setFilteredEquipos(filtered);
    }, [searchTerm, equipos]);

    if (!isOpen) return null;

    return createPortal(
        <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200">
            <div className="bg-[#111112] w-full max-w-2xl rounded-xl border border-[#3f3f46] shadow-2xl shadow-black/70 flex flex-col max-h-[82vh] overflow-hidden">
                {/* Header */}
                <div className="p-5 md:p-6 border-b border-[#27272a] flex justify-between items-center gap-4">
                    <div className="flex items-center gap-3 min-w-0">
                        <div className="w-11 h-11 rounded-lg border border-[#3f3f46] bg-[#18181b] flex items-center justify-center shrink-0">
                            <Truck className="w-5 h-5 text-[#d4d4d8]" />
                        </div>
                        <div className="min-w-0">
                            <h3 className="text-lg font-semibold text-white tracking-tight">Seleccionar equipo</h3>
                            <p className="text-xs text-[#a1a1aa] mt-0.5">Busque por número de activo, placa o descripción.</p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="w-10 h-10 text-[#a1a1aa] hover:text-white border border-[#3f3f46] hover:bg-[#27272a] transition-colors rounded-lg flex items-center justify-center shrink-0"
                        aria-label="Cerrar selector de equipos"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Search Input */}
                <div className="p-5 md:p-6 border-b border-[#27272a]">
                    <div className="relative group">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[#a1a1aa] group-focus-within:text-white transition-colors" />
                        <input
                            type="text"
                            placeholder="Buscar por número, placa o descripción..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full h-14 bg-[#18181b] border border-[#3f3f46] rounded-lg pl-12 pr-5 text-sm text-white focus:border-[#71717a] outline-none transition-all placeholder:text-[#71717a]"
                            autoFocus
                        />
                    </div>
                </div>

                {/* List */}
                <div className="flex-1 overflow-y-auto p-3 md:p-4">
                    {loading ? (
                        <div className="flex justify-center py-8">
                            <Loader2 className="w-7 h-7 animate-spin text-[#d4d4d8]" />
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {filteredEquipos.map((item) => (
                                <div
                                    key={item.numero_activo}
                                    onClick={() => {
                                        onSelect(item);
                                        onClose();
                                    }}
                                    className="p-4 rounded-lg bg-[#151516] hover:bg-[#1c1c1e] cursor-pointer border border-[#27272a] hover:border-[#52525b] transition-all group"
                                >
                                    <div className="flex justify-between items-start gap-4 mb-2">
                                        <h4 className="text-sm font-semibold text-white transition-colors uppercase leading-snug">
                                            {item.descripcion_equipo}
                                        </h4>
                                        <span className="text-[10px] font-semibold bg-[#27272a] text-[#d4d4d8] border border-[#3f3f46] px-2 py-1 rounded-md shrink-0">
                                            #{item.numero_activo}
                                        </span>
                                    </div>
                                    <p className="text-[10px] text-[#71717a] font-semibold uppercase tracking-[0.14em]">
                                        Placa: <span className="text-[#a1a1aa]">{item.placa || 'Sin placa'}</span>
                                    </p>
                                </div>
                            ))}

                            {filteredEquipos.length === 0 && (
                                <div className="text-center py-12 text-[#71717a] text-sm">
                                    <div className="flex justify-center mb-2">
                                        <Search className="w-8 h-8 opacity-20" />
                                    </div>
                                    No se encontraron equipos
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="px-6 py-4 border-t border-[#27272a] text-[10px] text-[#71717a] font-semibold uppercase tracking-[0.16em] text-center">
                    {filteredEquipos.length} equipos encontrados
                </div>
            </div>
        </div>,
        document.body
    );
}
