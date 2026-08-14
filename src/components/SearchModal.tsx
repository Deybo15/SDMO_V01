import { useState, useEffect, useMemo, useRef } from 'react';
import { Search, X } from 'lucide-react';

interface Option {
    id: string | number;
    label: string;
}

interface SearchModalProps {
    isOpen: boolean;
    onClose: () => void;
    title: string;
    options: Option[];
    onSelect: (option: Option) => void;
}

export default function SearchModal({ isOpen, onClose, title, options, onSelect }: SearchModalProps) {
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedIndex, setSelectedIndex] = useState(0);
    const inputRef = useRef<HTMLInputElement>(null);
    const listRef = useRef<HTMLUListElement>(null);

    // Reset state when modal opens
    useEffect(() => {
        if (isOpen) {
            setSearchTerm('');
            setSelectedIndex(0);
            // Focus input after a small delay to allow animation/rendering
            setTimeout(() => inputRef.current?.focus(), 50);
        }
    }, [isOpen]);

    const filteredOptions = useMemo(() => {
        if (!searchTerm) return options;
        return options.filter(opt => opt.label.toLowerCase().includes(searchTerm.toLowerCase()));
    }, [options, searchTerm]);

    // Handle keyboard navigation
    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            setSelectedIndex(prev => (prev < filteredOptions.length - 1 ? prev + 1 : prev));
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setSelectedIndex(prev => (prev > 0 ? prev - 1 : prev));
        } else if (e.key === 'Enter') {
            e.preventDefault();
            if (filteredOptions.length > 0) {
                onSelect(filteredOptions[selectedIndex]);
                onClose();
            }
        } else if (e.key === 'Escape') {
            onClose();
        }
    };

    // Scroll selected item into view
    useEffect(() => {
        if (listRef.current && filteredOptions.length > 0) {
            const selectedElement = listRef.current.children[selectedIndex] as HTMLElement;
            if (selectedElement) {
                selectedElement.scrollIntoView({ block: 'nearest' });
            }
        }
    }, [selectedIndex, filteredOptions]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 md:p-8 bg-black/85 backdrop-blur-md animate-in fade-in duration-200">
            <div className="w-full max-w-xl bg-[#0b0b0c] border border-[#3f3f46] rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150">
                <div className="px-6 py-5 border-b border-[#27272a] flex items-center justify-between gap-4">
                    <div>
                        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#71717a]">Catálogo disponible</p>
                        <h3 className="mt-1 text-lg font-semibold text-[#f4f4f5]">{title}</h3>
                    </div>
                    <button
                        onClick={onClose}
                        aria-label="Cerrar selector"
                        className="w-10 h-10 flex items-center justify-center bg-[#111112] border border-[#3f3f46] text-[#a1a1aa] rounded-lg hover:text-white hover:bg-[#18181b] transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="p-6">
                    <div className="relative mb-4">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#71717a]" />
                        <input
                            ref={inputRef}
                            type="text"
                            value={searchTerm}
                            onChange={(e) => {
                                setSearchTerm(e.target.value);
                                setSelectedIndex(0); // Reset selection on search
                            }}
                            onKeyDown={handleKeyDown}
                            placeholder="Escriba para buscar..."
                            className="w-full bg-[#111112] border border-[#3f3f46] rounded-lg pl-11 pr-4 py-3.5 text-[#f4f4f5] placeholder-[#71717a] focus:outline-none focus:border-[#a1a1aa] transition-colors text-sm"
                        />
                    </div>

                    <ul ref={listRef} className="max-h-[360px] overflow-y-auto space-y-2 pr-2 custom-scrollbar">
                        {filteredOptions.length > 0 ? (
                            filteredOptions.map((item, index) => (
                                <li
                                    key={item.id}
                                    onClick={() => {
                                        onSelect(item);
                                        onClose();
                                    }}
                                    className={`px-4 py-3.5 rounded-lg border cursor-pointer transition-colors flex items-center gap-3 text-sm font-medium ${index === selectedIndex
                                        ? 'bg-[#e4e4e7] border-white text-black'
                                        : 'bg-[#111112] border-[#3f3f46] text-[#e4e4e7] hover:border-[#a1a1aa] hover:bg-[#18181b]'
                                        }`}
                                >
                                    <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${index === selectedIndex ? 'bg-black' : 'bg-[#71717a]'}`} />
                                    {item.label}
                                </li>
                            ))
                        ) : (
                            <li className="p-10 text-center text-[#71717a] text-sm">No se encontraron resultados</li>
                        )}
                    </ul>
                </div>
            </div>
            <style>{`
                .custom-scrollbar::-webkit-scrollbar { width: 6px; }
                .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
                .custom-scrollbar::-webkit-scrollbar-thumb { background: #52525b; border-radius: 3px; }
                .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #71717a; }
            `}</style>
        </div>
    );
}
