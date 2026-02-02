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
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-8 bg-black/80 backdrop-blur-[20px] animate-in fade-in duration-300">
            <div className="w-full max-w-lg bg-[#121212] border border-[#333333] rounded-[8px] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
                <div className="p-8 border-b border-[#333333] bg-black/20 flex items-center justify-between">
                    <h3 className="text-xl font-black text-[#F5F5F7] uppercase italic tracking-tighter">{title}</h3>
                    <button
                        onClick={onClose}
                        className="p-2 bg-transparent border border-[#F5F5F7]/30 text-[#86868B] rounded-[8px] hover:text-[#F5F5F7] hover:bg-white/5 transition-all"
                    >
                        <X className="w-6 h-6" />
                    </button>
                </div>

                <div className="p-8 bg-black/40">
                    <div className="relative mb-6">
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
                            className="w-full bg-[#1D1D1F] border border-[#333333] rounded-[8px] px-4 py-3.5 text-[#F5F5F7] placeholder-[#424245] focus:outline-none focus:border-[#0071E3]/50 transition-all font-medium text-sm"
                        />
                        <Search className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#424245]" />
                    </div>

                    <ul ref={listRef} className="max-h-[300px] overflow-y-auto space-y-2 pr-2 custom-scrollbar">
                        {filteredOptions.length > 0 ? (
                            filteredOptions.map((item, index) => (
                                <li
                                    key={item.id}
                                    onClick={() => {
                                        onSelect(item);
                                        onClose();
                                    }}
                                    className={`p-4 rounded-[8px] border cursor-pointer transition-all duration-200 flex items-center gap-3 uppercase font-black text-[11px] tracking-tight ${index === selectedIndex
                                        ? 'bg-[#0071E3]/10 border-[#0071E3]/40 text-[#0071E3] translate-x-1'
                                        : 'bg-[#1D1D1F] border-[#333333] text-[#F5F5F7] hover:border-[#0071E3]/30 hover:bg-white/5'
                                        }`}
                                >
                                    <div className={`w-1.5 h-1.5 rounded-full ${index === selectedIndex ? 'bg-[#0071E3]' : 'bg-[#333333]'}`} />
                                    {item.label}
                                </li>
                            ))
                        ) : (
                            <li className="p-8 text-center text-[#86868B] font-black text-[10px] uppercase tracking-widest">No se encontraron resultados</li>
                        )}
                    </ul>
                </div>
            </div>
            <style>{`
                .custom-scrollbar::-webkit-scrollbar { width: 6px; }
                .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
                .custom-scrollbar::-webkit-scrollbar-thumb { background: #333333; border-radius: 3px; }
                .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #424245; }
            `}</style>
        </div>
    );
}
