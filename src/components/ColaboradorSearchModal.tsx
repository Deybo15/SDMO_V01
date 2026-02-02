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
        <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-black/85">
            <div className="bg-[#121212] w-full max-w-lg rounded-[8px] border border-[#333333] shadow-4xl flex flex-col max-h-[85vh] overflow-hidden">
                {/* Header */}
                <div className="p-6 border-b border-[#333333] flex justify-between items-center bg-black/20">
                    <h3 className="text-[15px] font-black text-[#F5F5F7] uppercase tracking-widest flex items-center gap-3">
                        <User className="w-5 h-5 text-[#0071E3]" />
                        {title}
                    </h3>
                    <button
                        onClick={(e) => {
                            console.log('Close button clicked');
                            onClose();
                        }}
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
                            placeholder="Buscar por nombre, ID o alias..."
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
                            {filteredColaboradores.map((item) => (
                                <div
                                    key={item.identificacion}
                                    onClick={() => {
                                        console.log('Colaborador selected via click:', item.colaborador);
                                        onSelect(item);
                                        onClose();
                                    }}
                                    className="p-4 rounded-[8px] hover:bg-[#1D1D1F] cursor-pointer border border-transparent hover:border-[#333333] transition-all group flex items-center justify-between"
                                >
                                    <div className="flex flex-col">
                                        <h4 className="text-sm font-black text-[#F5F5F7] group-hover:text-[#0071E3] transition-colors uppercase tracking-tight">
                                            {item.alias || item.colaborador}
                                        </h4>
                                        <p className="text-[10px] text-[#86868B] font-bold uppercase tracking-widest mt-0.5">
                                            ID: {item.identificacion}
                                            {item.alias && <span className="ml-2 opacity-50">({item.colaborador})</span>}
                                        </p>
                                    </div>
                                    <User className="w-4 h-4 text-[#333333] group-hover:text-[#0071E3] opacity-0 group-hover:opacity-100 transition-all" />
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
                <div className="p-4 border-t border-[#333333] bg-black/20 text-[9px] text-[#86868B] font-black uppercase tracking-widest text-center">
                    {filteredColaboradores.length} encontrados
                </div>
            </div>
        </div>,
        document.body
    );
}
