import { Trash2, Plus, Search } from 'lucide-react';
import { DetalleSalida } from '../../types/inventory';

interface TransactionTableProps {
    items: DetalleSalida[];
    onUpdateQuantity: (codigo: string, quantity: number, max: number) => void;
    onRemoveItem: (codigo: string) => void;
    onOpenSearch: () => void;
    themeColor?: string;
}

export const TransactionTable = ({
    items,
    onUpdateQuantity,
    onRemoveItem,
    onOpenSearch,
    themeColor = 'blue'
}: TransactionTableProps) => {
    return (
        <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
                <thead>
                    <tr className="border-b border-white/10 text-gray-400 text-sm">
                        <th className="py-3 px-4">Artículo</th>
                        <th className="py-3 px-4 w-32 text-center">Cantidad</th>
                        <th className="py-3 px-4 w-24">Acciones</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                    {items.length === 0 ? (
                        <tr>
                            <td colSpan={3} className="py-8 text-center text-gray-500">
                                No hay artículos seleccionados
                                <button
                                    type="button"
                                    onClick={onOpenSearch}
                                    className={`ml-2 text-${themeColor}-400 hover:underline`}
                                >
                                    Agregar
                                </button>
                            </td>
                        </tr>
                    ) : (
                        items.map((item) => (
                            <tr key={item.codigo_articulo} className="hover:bg-white/5 transition-colors">
                                <td className="py-3 px-4">
                                    <div className="font-medium text-white">{item.articulo}</div>
                                    <div className="text-xs text-gray-500">{item.codigo_articulo}</div>
                                </td>
                                <td className="py-3 px-4">
                                    <input
                                        type="number"
                                        min="1"
                                        value={item.cantidad}
                                        onChange={(e) => onUpdateQuantity(item.codigo_articulo, parseInt(e.target.value) || 0, 9999)} // Using placeholder max, ideally passed from item logic
                                        className="w-20 bg-[#1a1d29] border border-gray-700 rounded p-1 text-center text-white focus:border-blue-500 outline-none"
                                    />
                                </td>
                                <td className="py-3 px-4">
                                    <button
                                        onClick={() => onRemoveItem(item.codigo_articulo)}
                                        className="p-2 text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                                    >
                                        <Trash2 className="w-5 h-5" />
                                    </button>
                                </td>
                            </tr>
                        ))
                    )}
                </tbody>
            </table>
        </div>
    );
};
