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
        <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-black/80 backdrop-blur-[20px] animate-in fade-in duration-300">
            <div className="bg-[#121212] w-full max-w-lg rounded-[8px] border border-[#333333] shadow-4xl flex flex-col max-h-[85vh] overflow-hidden">
                {/* Header */}
                <div className="p-6 border-b border-[#333333] flex justify-between items-center bg-black/20">
                    <h3 className="text-[15px] font-black text-[#F5F5F7] uppercase tracking-widest flex items-center gap-3">
                        <Truck className="w-5 h-5 text-[#0071E3]" />
                        Buscar Equipo
                    </h3>
                    <button
                        onClick={onClose}
                        className="text-gray-400 hover:text-white transition-colors p-1 hover:bg-white/10 rounded-lg"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Search Input */}
                <div className="p-6 border-b border-[#333333]">
                    <div className="relative group">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#86868B] group-focus-within:text-[#0071E3] transition-colors" />
                        <input
                            type="text"
                            placeholder="Buscar por número, placa o descripción..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full bg-[#1D1D1F] border border-[#333333] rounded-[8px] pl-12 pr-6 py-4 text-sm text-[#F5F5F7] focus:border-[#0071E3] outline-none transition-all placeholder:text-[#424245] font-bold"
                            autoFocus
                        />
                    </div>
                </div>

                {/* List */}
                <div className="flex-1 overflow-y-auto p-2">
                    {loading ? (
                        <div className="flex justify-center py-8">
                            <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
                        </div>
                    ) : (
                        <div className="space-y-1 px-2">
                            {filteredEquipos.map((item) => (
                                <div
                                    key={item.numero_activo}
                                    onClick={() => {
                                        onSelect(item);
                                        onClose();
                                    }}
                                    className="p-4 rounded-[8px] hover:bg-[#1D1D1F] cursor-pointer border border-transparent hover:border-[#333333] transition-all group"
                                >
                                    <div className="flex justify-between items-start mb-1">
                                        <h4 className="text-sm font-black text-[#F5F5F7] group-hover:text-[#0071E3] transition-colors uppercase tracking-tight">
                                            {item.descripcion_equipo}
                                        </h4>
                                        <span className="text-[10px] font-black bg-[#0071E3]/20 text-[#0071E3] px-2 py-0.5 rounded-[4px] uppercase tracking-tighter">
                                            #{item.numero_activo}
                                        </span>
                                    </div>
                                    <p className="text-[10px] text-[#86868B] font-bold uppercase tracking-widest mt-0.5">
                                        Placa: <span className="opacity-80">{item.placa}</span>
                                    </p>
                                </div>
                            ))}

                            {filteredEquipos.length === 0 && (
                                <div className="text-center py-8 text-gray-500">
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
                <div className="p-4 border-t border-[#333333] bg-black/20 text-[9px] text-[#86868B] font-black uppercase tracking-widest text-center">
                    {filteredEquipos.length} equipos encontrados
                </div>
            </div>
        </div>,
        document.body
    );
}
