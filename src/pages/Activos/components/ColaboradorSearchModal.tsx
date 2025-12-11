import { useState } from 'react';
import { Search, X } from 'lucide-react';

interface Colaborador {
    identificacion: string;
    colaborador: string;
    alias: string;
    autorizado: boolean;
}

interface ColaboradorSearchModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSelect: (colaborador: Colaborador) => void;
    colaboradores: Colaborador[];
}

export function ColaboradorSearchModal({ isOpen, onClose, onSelect, colaboradores }: ColaboradorSearchModalProps) {
    const [searchTerm, setSearchTerm] = useState('');

    if (!isOpen) return null;

    const filteredColaboradores = colaboradores.filter(c =>
        !searchTerm ||
        (c.colaborador || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (c.identificacion || '').includes(searchTerm)
    );

    return (
        <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-fade-in">
            <div className="bg-slate-800 border border-slate-700 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[80vh] flex flex-col animate-scale-up">
                <div className="p-6 border-b border-slate-700 flex justify-between items-center">
                    <h3 className="text-xl font-bold text-white">Buscar Colaborador</h3>
                    <button
                        onClick={onClose}
                        className="text-slate-400 hover:text-white transition-colors"
                    >
                        <X className="w-6 h-6" />
                    </button>
                </div>
                <div className="p-4 border-b border-slate-700 bg-slate-800/50">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                        <input
                            type="text"
                            placeholder="Escriba el nombre o identificación..."
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            autoFocus
                            className="w-full pl-10 pr-4 py-3 bg-slate-900 border border-slate-600 rounded-xl text-slate-200 focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 outline-none transition-all"
                        />
                    </div>
                </div>
                <div className="flex-1 overflow-y-auto p-2">
                    {filteredColaboradores.map(col => (
                        <button
                            key={col.identificacion}
                            onClick={() => onSelect(col)}
                            className="w-full text-left px-4 py-3 hover:bg-slate-700/50 rounded-lg transition-colors border-b border-slate-700/30 last:border-0 flex items-center gap-3 group"
                        >
                            <div className="w-10 h-10 rounded-full bg-blue-500/20 flex items-center justify-center text-blue-400 font-bold group-hover:bg-blue-500 group-hover:text-white transition-colors shrink-0">
                                {col.colaborador.charAt(0)}
                            </div>
                            <div>
                                <div className="font-medium text-slate-200 group-hover:text-white">{col.colaborador}</div>
                                <div className="text-sm text-slate-500">{col.identificacion}</div>
                            </div>
                        </button>
                    ))}
                    {filteredColaboradores.length === 0 && (
                        <div className="p-8 text-center text-slate-500">
                            No se encontraron colaboradores.
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
