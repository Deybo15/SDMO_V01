import { Trash2, Search, PlusCircle } from 'lucide-react';
import { DetalleSalida } from '../../types/inventory';

interface TransactionTableProps {
    items: DetalleSalida[];
    onUpdateRow: (index: number, field: keyof DetalleSalida, value: any) => void;
    onRemoveRow: (index: number) => void;
    onOpenSearch: (index: number) => void;
    onAddRow: () => void;
    onWarning?: (message: string) => void;
    themeColor?: string;
}

export const TransactionTable = ({
    items,
    onUpdateRow,
    onRemoveRow,
    onOpenSearch,
    onAddRow,
    onWarning,
    themeColor = 'blue'
}: TransactionTableProps) => {

    const getThemeColorClass = (color: string) => {
        // Simple mapping for focus borders
        const map: Record<string, string> = {
            teal: 'focus:border-teal-500',
            blue: 'focus:border-blue-500',
            orange: 'focus:border-orange-500',
            purple: 'focus:border-purple-500',
            pink: 'focus:border-pink-500',
            gray: 'focus:border-gray-500',
            amber: 'focus:border-amber-500',
            indigo: 'focus:border-indigo-500'
        };
        return map[color] || 'focus:border-blue-500';
    };

    const focusClass = getThemeColorClass(themeColor);

    return (
        <div className="w-full">
            <div className="flex justify-between items-center mb-6">
                <span className="text-xs font-bold text-gray-500 uppercase tracking-widest hidden sm:block">
                    {items.length} {items.length === 1 ? 'Artículo seleccionado' : 'Artículos seleccionados'}
                </span>
                <button
                    type="button"
                    onClick={onAddRow}
                    className={`w-full sm:w-auto px-5 py-3 bg-${themeColor}-500/10 hover:bg-${themeColor}-500/20 text-${themeColor}-400 border border-${themeColor}-500/30 font-bold rounded-xl transition-all flex items-center justify-center gap-2 group shadow-lg shadow-${themeColor}-500/5`}
                >
                    <PlusCircle className="w-5 h-5 group-hover:rotate-90 transition-transform" />
                    Agregar Artículo
                </button>
            </div>

            {/* Desktop Table View */}
            <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="border-b border-white/10 text-gray-400 text-[10px] font-black uppercase tracking-widest">
                            <th className="pb-4 pl-4 w-[45%]">Artículo</th>
                            <th className="pb-4 w-[15%]">Marca</th>
                            <th className="pb-4 w-[15%]">Cantidad</th>
                            <th className="pb-4 w-[15%]">Unidad</th>
                            <th className="pb-4 w-[10%] text-center">Acción</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                        {items.map((item, index) => (
                            <tr key={index} className="group hover:bg-white/[0.02] transition-colors">
                                <td className="py-4 pl-4">
                                    <div
                                        onClick={() => onOpenSearch(index)}
                                        className="w-full bg-white/5 border border-white/10 rounded-xl py-3 pl-4 pr-10 text-white text-sm cursor-pointer hover:bg-white/10 hover:border-white/20 transition-all min-h-[50px] flex items-center relative group/field shadow-inner"
                                    >
                                        <span className={`line-clamp-2 break-words leading-tight font-medium ${!item.articulo ? 'text-gray-500 italic' : ''}`}>
                                            {item.articulo || "Buscar artículo..."}
                                        </span>
                                        <Search className={`absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-${themeColor}-400/50 group-hover/field:text-${themeColor}-400 transition-colors`} />
                                    </div>
                                </td>
                                <td className="py-4">
                                    <span className="px-3 py-1 bg-white/5 border border-white/10 rounded-lg text-gray-400 text-xs font-bold uppercase tracking-tighter">
                                        {item.marca || 'NA'}
                                    </span>
                                </td>
                                <td className="py-4">
                                    <div className="relative max-w-[120px]">
                                        <input
                                            type="number"
                                            min="0"
                                            step="any"
                                            max={item.cantidad_disponible}
                                            value={Number(item.cantidad) === 0 ? '' : item.cantidad}
                                            onChange={(e) => {
                                                const val = e.target.value;
                                                if (val === '') {
                                                    onUpdateRow(index, 'cantidad', 0);
                                                    return;
                                                }
                                                let numVal = parseFloat(val);
                                                let finalVal: string | number = val;
                                                if (item.cantidad_disponible !== undefined && numVal > item.cantidad_disponible) {
                                                    finalVal = item.cantidad_disponible;
                                                    if (onWarning) onWarning(`Stock insuficiente (${item.cantidad_disponible})`);
                                                }
                                                if (numVal < 0) finalVal = 0;
                                                onUpdateRow(index, 'cantidad', finalVal);
                                            }}
                                            onFocus={(e) => e.target.select()}
                                            className={`w-full bg-white/5 border border-white/10 rounded-xl py-3 px-4 text-white text-base font-black ${focusClass} focus:outline-none focus:ring-4 focus:ring-${themeColor}-500/10 placeholder-gray-600 shadow-inner`}
                                            placeholder="0"
                                        />
                                        {item.cantidad_disponible !== undefined && item.codigo_articulo && (
                                            <div className="text-[10px] text-gray-500 mt-1 font-bold uppercase">
                                                Stock: {item.cantidad_disponible}
                                            </div>
                                        )}
                                    </div>
                                </td>
                                <td className="py-4">
                                    <span className="text-gray-500 font-bold text-xs uppercase">{item.unidad || '-'}</span>
                                </td>
                                <td className="py-4 text-center">
                                    <button
                                        type="button"
                                        onClick={() => onRemoveRow(index)}
                                        className="p-3 text-gray-500 hover:text-red-400 hover:bg-red-400/10 rounded-xl transition-all active:scale-90"
                                    >
                                        <Trash2 className="w-5 h-5" />
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Mobile Card View */}
            <div className="md:hidden space-y-4">
                {items.map((item, index) => (
                    <div key={index} className="bg-white/5 border border-white/10 rounded-2xl p-5 shadow-xl relative overflow-hidden group animate-in slide-in-from-right-4 duration-300" style={{ animationDelay: `${index * 50}ms` }}>
                        <div className={`absolute top-0 left-0 w-1.5 h-full bg-${themeColor}-500/50`} />

                        <div className="flex justify-between items-start gap-4 mb-5">
                            <div className="flex-1 min-w-0">
                                <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-2 block">Artículo</label>
                                <div
                                    onClick={() => onOpenSearch(index)}
                                    className="bg-black/40 border border-white/10 rounded-xl p-4 text-white text-sm min-h-[60px] flex items-center justify-between active:bg-white/5 transition-colors"
                                >
                                    <span className={`line-clamp-2 font-bold leading-tight ${!item.articulo ? 'text-gray-600 italic' : ''}`}>
                                        {item.articulo || "Seleccionar artículo..."}
                                    </span>
                                    <Search className={`w-5 h-5 text-${themeColor}-400 shrink-0 ml-3`} />
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={() => onRemoveRow(index)}
                                className="p-4 bg-red-500/10 text-red-400 rounded-xl active:scale-90 transition-all mt-6 shadow-lg shadow-red-500/5"
                            >
                                <Trash2 className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="grid grid-cols-2 gap-5">
                            <div>
                                <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-2 block">Cantidad</label>
                                <div className="relative">
                                    <input
                                        type="number"
                                        inputMode="decimal"
                                        value={Number(item.cantidad) === 0 ? '' : item.cantidad}
                                        onChange={(e) => {
                                            const val = e.target.value;
                                            if (val === '') {
                                                onUpdateRow(index, 'cantidad', 0);
                                                return;
                                            }
                                            let numVal = parseFloat(val);
                                            let finalVal: string | number = val;
                                            if (item.cantidad_disponible !== undefined && numVal > item.cantidad_disponible) {
                                                finalVal = item.cantidad_disponible;
                                                if (onWarning) onWarning(`Máximo ${item.cantidad_disponible}`);
                                            }
                                            if (numVal < 0) finalVal = 0;
                                            onUpdateRow(index, 'cantidad', finalVal);
                                        }}
                                        className={`w-full bg-black/40 border border-white/10 rounded-xl p-4 text-white text-xl font-black focus:border-${themeColor}-500 outline-none transition-all shadow-inner`}
                                        placeholder="0"
                                    />
                                    {item.codigo_articulo && (
                                        <div className="flex items-center gap-1.5 mt-2">
                                            <div className={`w-1.5 h-1.5 rounded-full bg-${themeColor}-500`} />
                                            <span className="text-[10px] text-gray-500 font-bold uppercase tracking-tight">
                                                DISP: {item.cantidad_disponible} {item.unidad}
                                            </span>
                                        </div>
                                    )}
                                </div>
                            </div>
                            <div className="flex flex-col justify-end pb-1">
                                <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-2 block">Detalles</label>
                                <div className="space-y-2">
                                    <div className="flex items-center justify-between bg-black/20 border border-white/5 rounded-lg px-3 py-2">
                                        <span className="text-[9px] font-black text-gray-600 uppercase">Marca</span>
                                        <span className={`text-xs font-bold text-${themeColor}-400/80 truncate ml-2`}>{item.marca || 'N/A'}</span>
                                    </div>
                                    <div className="flex items-center justify-between bg-black/20 border border-white/5 rounded-lg px-3 py-2">
                                        <span className="text-[9px] font-black text-gray-600 uppercase">Uni.</span>
                                        <span className="text-xs font-bold text-gray-400 truncate ml-2">{item.unidad || 'UND'}</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                ))}
            </div>


            {items.length === 0 && (
                <div className="py-20 text-center bg-white/[0.02] border-2 border-dashed border-white/10 rounded-3xl">
                    <PlusCircle className="w-12 h-12 text-gray-700 mx-auto mb-4 opacity-50" />
                    <p className="text-gray-500 font-bold uppercase tracking-widest text-sm">No hay artículos cargados</p>
                    <button
                        onClick={onAddRow}
                        className="mt-4 text-teal-400 font-black text-xs uppercase hover:underline"
                    >
                        Haz clic aquí para agregar el primero
                    </button>
                </div>
            )}
        </div>
    );
};
