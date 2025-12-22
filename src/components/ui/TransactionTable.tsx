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
        <div className="overflow-x-auto">
            <div className="flex justify-end mb-4">
                <button
                    type="button"
                    onClick={onAddRow}
                    className={`px-4 py-2 bg-gradient-to-r from-${themeColor}-600 to-${themeColor}-400 text-white font-semibold rounded-lg hover:brightness-110 transition-all flex items-center gap-2`}
                >
                    <PlusCircle className="w-4 h-4" />
                    Agregar Artículo
                </button>
            </div>

            <table className="w-full text-left border-collapse">
                <thead>
                    <tr className="border-b border-white/10 text-gray-400 text-sm">
                        <th className="pb-4 pl-2 w-[40%]">Artículo</th>
                        <th className="pb-4 w-[15%]">Marca</th>
                        <th className="pb-4 w-[15%]">Cantidad</th>
                        <th className="pb-4 w-[20%]">Unidad</th>
                        <th className="pb-4 w-[10%] text-center">Acción</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                    {items.map((item, index) => (
                        <tr key={index} className="group hover:bg-white/5 transition-colors">
                            <td className="py-3 pl-2">
                                <div className="flex gap-2">
                                    <div className="relative flex-1 group/input">
                                        <div
                                            onClick={() => onOpenSearch(index)}
                                            className="w-full bg-white/5 border border-white/10 rounded-lg py-2 pl-3 pr-10 text-white text-sm cursor-pointer hover:bg-white/10 transition-colors min-h-[42px] flex items-center select-none"
                                        >
                                            <span className={`line-clamp-2 break-words leading-tight ${!item.articulo ? 'text-gray-500' : ''}`}>
                                                {item.articulo || "Seleccione un artículo..."}
                                            </span>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => onOpenSearch(index)}
                                            className={`absolute right-0 top-0 bottom-0 px-3 text-${themeColor}-400 hover:bg-${themeColor}-400/10 rounded-r-lg transition-colors border-l border-white/10 flex items-center justify-center`}
                                        >
                                            <Search className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>
                            </td>
                            <td className="py-3">
                                <div className="px-2 text-gray-300 text-sm truncate" title={item.marca}>
                                    {item.marca}
                                </div>
                            </td>
                            <td className="py-3">
                                <div className="relative">
                                    <input
                                        type="number"
                                        min="0"
                                        step="any"
                                        max={item.cantidad_disponible}
                                        value={Number(item.cantidad) === 0 ? '' : item.cantidad}
                                        onChange={(e) => {
                                            const val = e.target.value;
                                            // Allow empty to just clear it
                                            if (val === '') {
                                                onUpdateRow(index, 'cantidad', 0);
                                                return;
                                            }

                                            // Parse
                                            let numVal = parseFloat(val);
                                            let finalVal: string | number = val;

                                            // Clamp if max exists
                                            if (item.cantidad_disponible !== undefined && numVal > item.cantidad_disponible) {
                                                finalVal = item.cantidad_disponible;
                                                if (onWarning) onWarning(`La cantidad no puede exceder el disponible (${item.cantidad_disponible})`);
                                            }
                                            if (numVal < 0) finalVal = 0;

                                            onUpdateRow(index, 'cantidad', finalVal);
                                        }}
                                        onFocus={(e) => e.target.select()}
                                        className={`w-full bg-white/5 border border-white/10 rounded-lg py-2 px-3 text-white text-sm ${focusClass} focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none`}
                                        placeholder="0"
                                    />
                                    {item.cantidad_disponible !== undefined && item.codigo_articulo && (
                                        <div className="text-xs text-gray-500 mt-1 text-right">
                                            Máx: {item.cantidad_disponible}
                                        </div>
                                    )}
                                </div>
                            </td>
                            <td className="py-3">
                                <input
                                    type="text"
                                    value={item.unidad}
                                    readOnly
                                    className="w-full bg-transparent border-none text-gray-300 text-sm focus:ring-0 px-2"
                                />
                            </td>
                            <td className="py-3 text-center">
                                <button
                                    type="button"
                                    onClick={() => onRemoveRow(index)}
                                    className="p-2 text-red-400 hover:bg-red-500/20 rounded-lg transition-colors"
                                >
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            </td>
                        </tr>
                    ))}
                    {items.length === 0 && (
                        <tr>
                            <td colSpan={5} className="py-8 text-center text-gray-500 italic">
                                No hay artículos en la lista. Haga clic en "Agregar Artículo" para comenzar.
                            </td>
                        </tr>
                    )}
                </tbody>
            </table>
        </div>
    );
};
