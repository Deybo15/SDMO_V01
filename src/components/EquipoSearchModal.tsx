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
        const filtered = equipos.filter(eq =>
            (eq.descripcion_equipo || '').toLowerCase().includes(term) ||
            (eq.numero_activo || '').toString().includes(term) ||
            (eq.placa || '').toLowerCase().includes(term)
        );
        setFilteredEquipos(filtered);
    }, [searchTerm, equipos]);

    if (!isOpen) return null;

    return createPortal(
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
            <div className="bg-[#1e2235] w-full max-w-lg rounded-xl border border-white/10 shadow-2xl flex flex-col max-h-[85vh] animate-fadeInUp">
                {/* Header */}
                <div className="p-4 border-b border-white/10 flex justify-between items-center bg-blue-900/20 rounded-t-xl">
                    <h3 className="text-lg font-bold text-white flex items-center gap-2">
                        <Truck className="w-5 h-5 text-blue-400" />
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
                <div className="p-4 border-b border-white/10">
                    <div className="relative">
                        <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-500" />
                        <input
                            type="text"
                            placeholder="Buscar por número, placa o descripción..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full bg-[#1a1d29] border border-gray-700 rounded-lg pl-9 pr-4 py-2 text-sm text-white focus:border-blue-500 outline-none transition-colors placeholder:text-gray-600"
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
                        <div className="space-y-2">
                            {filteredEquipos.map((item) => (
                                <div
                                    key={item.numero_activo}
                                    onClick={() => {
                                        onSelect(item);
                                        onClose();
                                    }}
                                    className="p-3 rounded-lg bg-white/5 hover:bg-white/10 cursor-pointer border border-transparent hover:border-blue-500/30 transition-all group"
                                >
                                    <div className="flex justify-between items-start mb-1">
                                        <h4 className="text-sm font-medium text-white group-hover:text-blue-300 transition-colors">
                                            {item.descripcion_equipo}
                                        </h4>
                                        <span className="text-xs font-bold bg-blue-500/20 text-blue-400 px-2 py-0.5 rounded">
                                            #{item.numero_activo}
                                        </span>
                                    </div>
                                    <p className="text-xs text-gray-400">
                                        Placa: <span className="text-gray-300">{item.placa}</span>
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
                <div className="p-3 border-t border-white/10 bg-black/20 text-xs text-gray-500 text-center rounded-b-xl">
                    {filteredEquipos.length} equipos encontrados
                </div>
            </div>
        </div>,
        document.body
    );
}
