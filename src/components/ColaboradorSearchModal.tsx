import { useState, useEffect } from 'react';
import { Search, X, Loader2, User } from 'lucide-react';
import { createPortal } from 'react-dom';

interface Profesional {
    identificacion: string;
    alias?: string;
    colaborador: string;
    autorizado?: boolean;
}

interface ColaboradorSearchModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSelect: (colaborador: Profesional) => void;
    colaboradores: Profesional[];
    loading?: boolean;
    title?: string;
}

export default function ColaboradorSearchModal({
    isOpen,
    onClose,
    onSelect,
    colaboradores,
    loading = false,
    title = "Buscar Colaborador"
}: ColaboradorSearchModalProps) {
    const [searchTerm, setSearchTerm] = useState('');
    const [filteredColaboradores, setFilteredColaboradores] = useState<Profesional[]>(colaboradores);

    useEffect(() => {
        if (isOpen) {
            setSearchTerm('');
            setFilteredColaboradores(colaboradores);
        }
    }, [isOpen, colaboradores]);

    useEffect(() => {
        const term = searchTerm.toLowerCase();
        const filtered = colaboradores.filter(c => {
            if (!c) return false;
            return (c.colaborador || '').toLowerCase().includes(term) ||
                (c.identificacion || '').toLowerCase().includes(term) ||
                (c.alias || '').toLowerCase().includes(term);
        });
        setFilteredColaboradores(filtered);
    }, [searchTerm, colaboradores]);

    if (!isOpen) return null;

    return createPortal(
        <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-black/85 backdrop-blur-md">
            <div className="bg-[#0b0b0c] w-full max-w-xl rounded-2xl border border-[#3f3f46] shadow-2xl flex flex-col max-h-[85vh] overflow-hidden">
                {/* Header */}
                <div className="px-6 py-5 border-b border-[#27272a] flex justify-between items-center">
                    <h3 className="text-lg font-semibold text-white flex items-center gap-3">
                        <User className="w-5 h-5 text-[#d4d4d8]" />
                        {title}
                    </h3>
                    <button
                        onClick={(e) => {
                            console.log('Close button clicked');
                            onClose();
                        }}
                        className="w-10 h-10 flex items-center justify-center text-[#a1a1aa] hover:text-white transition-colors bg-[#111112] border border-[#3f3f46] hover:bg-[#18181b] rounded-lg"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Search Input */}
                <div className="p-5 border-b border-[#27272a]">
                    <div className="relative group">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#71717a] group-focus-within:text-white transition-colors" />
                        <input
                            type="text"
                            placeholder="Buscar por nombre, ID o alias..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full bg-[#111112] border border-[#3f3f46] rounded-lg pl-11 pr-5 py-3.5 text-sm text-white focus:border-[#a1a1aa] outline-none transition-colors placeholder:text-[#71717a]"
                            autoFocus
                        />
                    </div>
                </div>

                {/* List */}
                <div className="flex-1 overflow-y-auto p-2">
                    {loading ? (
                        <div className="flex justify-center py-8">
                            <Loader2 className="w-8 h-8 animate-spin text-white" />
                        </div>
                    ) : (
                        <div className="space-y-1 px-2">
                            {filteredColaboradores.map((item) => (
                                <div
                                    key={item.identificacion}
                                    onClick={() => {
                                        console.log('Colaborador selected via click:', item.colaborador);
                                        onSelect(item);
                                        onClose();
                                    }}
                                    className="p-4 rounded-lg bg-[#111112] cursor-pointer border border-[#27272a] hover:border-[#a1a1aa] hover:bg-[#18181b] transition-colors group flex items-center justify-between"
                                >
                                    <div className="flex flex-col">
                                        <h4 className="text-sm font-semibold text-[#f4f4f5] transition-colors">
                                            {item.alias || item.colaborador}
                                        </h4>
                                        <p className="text-[10px] text-[#71717a] font-medium uppercase tracking-wider mt-1">
                                            ID: {item.identificacion}
                                            {item.alias && <span className="ml-2 opacity-50">({item.colaborador})</span>}
                                        </p>
                                    </div>
                                    <User className="w-4 h-4 text-[#71717a] group-hover:text-white transition-colors" />
                                </div>
                            ))}

                            {filteredColaboradores.length === 0 && (
                                <div className="text-center py-8 text-gray-500">
                                    <div className="flex justify-center mb-2">
                                        <Search className="w-8 h-8 opacity-20" />
                                    </div>
                                    No se encontraron colaboradores
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-4 border-t border-[#27272a] text-xs text-[#71717a] font-medium text-center">
                    {filteredColaboradores.length} encontrados
                </div>
            </div>
        </div>,
        document.body
    );
}
