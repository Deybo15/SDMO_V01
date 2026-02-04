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
    onWarning
}: TransactionTableProps) => {

    return (
        <div className="w-full">
            <div className="flex justify-between items-center mb-8 pb-4">
                <span className="text-[10px] font-black text-[#86868B] uppercase tracking-[0.2em] hidden sm:block">
                    {items.length} {items.length === 1 ? 'Artículo seleccionado' : 'Artículos seleccionados'}
                </span>
                <button
                    type="button"
                    onClick={onAddRow}
                    className="w-full sm:w-auto h-12 px-8 bg-[#0071E3] hover:brightness-110 text-white font-black rounded-[8px] transition-all flex items-center justify-center gap-2.5 shadow-xl shadow-[#0071E3]/20 text-[10px] uppercase tracking-widest active:scale-95"
                >
                    <PlusCircle className="w-5 h-5" />
                    Agregar Artículo
                </button>
            </div>

            {/* Desktop Table View */}
            <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="border-b border-[#333333] text-[#86868B] text-[9px] font-black uppercase tracking-[0.2em]">
                            <th className="pb-5 pl-4 w-[45%]">Descripción del Artículo</th>
                            <th className="pb-5 w-[15%]">Marca</th>
                            <th className="pb-5 w-[15%]">Cantidad</th>
                            <th className="pb-5 w-[15%]">Unidad</th>
                            <th className="pb-5 w-[10%] text-center">Acción</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-[#333333]/30">
                        {items.map((item, index) => (
                            <tr key={index} className="group hover:bg-white/[0.01] transition-colors">
                                <td className="py-5 pl-4">
                                    <div
                                        onClick={() => onOpenSearch(index)}
                                        className="w-full bg-[#1D1D1F] border border-[#333333] rounded-[8px] py-4 pl-6 pr-12 text-[#F5F5F7] text-[13px] cursor-pointer hover:border-[#0071E3]/50 transition-all min-h-[56px] flex items-center relative shadow-sm"
                                    >
                                        <span className={`line-clamp-2 uppercase font-black tracking-tight ${!item.articulo ? 'text-[#86868B] italic' : ''}`}>
                                            {item.articulo || "Buscar artículo..."}
                                        </span>
                                        <Search className="absolute right-5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#0071E3] group-hover:scale-110 transition-transform" />
                                    </div>
                                </td>
                                <td className="py-5">
                                    <span className="px-3 py-1 bg-black/40 border border-[#333333] rounded-[4px] text-[#86868B] text-[10px] font-black uppercase tracking-tight">
                                        {item.marca || 'NA'}
                                    </span>
                                </td>
                                <td className="py-5">
                                    <div className="relative max-w-[140px]">
                                        <input
                                            type="text"
                                            inputMode="decimal"
                                            value={item.cantidad === 0 ? '' : item.cantidad}
                                            onChange={(e) => {
                                                const val = e.target.value.replace(',', '.');
                                                if (val !== '' && !/^\d*\.?\d*$/.test(val)) return;
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
                                                onUpdateRow(index, 'cantidad', finalVal);
                                            }}
                                            onBlur={(e) => {
                                                const val = e.target.value;
                                                if (val.startsWith('.')) {
                                                    onUpdateRow(index, 'cantidad', '0' + val);
                                                }
                                            }}
                                            onFocus={(e) => e.target.select()}
                                            className="w-full h-14 bg-black/40 border border-[#333333] rounded-[8px] px-6 text-[#F5F5F7] text-lg font-black focus:border-[#0071E3]/50 focus:outline-none transition-all placeholder-[#424245] shadow-inner font-mono"
                                            placeholder="0"
                                        />
                                        {item.cantidad_disponible !== undefined && item.codigo_articulo && (
                                            <div className="text-[11px] text-[#86868B] mt-2 font-black uppercase tracking-widest pl-1">
                                                Stock: <span className="text-[#0071E3]">{item.cantidad_disponible}</span>
                                            </div>
                                        )}
                                    </div>
                                </td>
                                <td className="py-5">
                                    <span className="text-[#86868B] font-black text-[10px] uppercase tracking-widest">{item.unidad || '-'}</span>
                                </td>
                                <td className="py-5 text-center">
                                    <button
                                        type="button"
                                        onClick={() => onRemoveRow(index)}
                                        className="h-10 w-10 text-[#86868B] hover:text-rose-500 hover:bg-rose-500/10 rounded-[8px] transition-all active:scale-90 flex items-center justify-center mx-auto"
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
            <div className="md:hidden space-y-6">
                {items.map((item, index) => (
                    <div key={index} className="bg-[#1D1D1F] border border-[#333333] rounded-[8px] p-6 shadow-xl relative overflow-hidden group">
                        <div className="absolute top-0 left-0 w-1 h-full bg-[#0071E3]" />

                        <div className="flex justify-between items-start gap-4 mb-6">
                            <div className="flex-1 min-w-0">
                                <label className="text-[9px] font-black text-[#86868B] uppercase tracking-widest mb-3 block">Artículo Seleccionado</label>
                                <div
                                    onClick={() => onOpenSearch(index)}
                                    className="bg-black/40 border border-[#333333] rounded-[8px] p-4 text-[#F5F5F7] min-h-[64px] flex items-center justify-between active:bg-white/5 transition-colors cursor-pointer"
                                >
                                    <span className={`line-clamp-2 font-black text-xs uppercase tracking-tight ${!item.articulo ? 'text-[#86868B] italic' : ''}`}>
                                        {item.articulo || "Seleccionar..."}
                                    </span>
                                    <Search className="w-5 h-5 text-[#0071E3] shrink-0 ml-3" />
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={() => onRemoveRow(index)}
                                className="h-14 w-14 bg-rose-500/10 text-rose-500 rounded-[8px] active:scale-90 transition-all mt-6 shadow-lg shadow-rose-500/5 flex items-center justify-center border border-rose-500/20"
                            >
                                <Trash2 className="w-6 h-6" />
                            </button>
                        </div>

                        <div className="grid grid-cols-2 gap-6">
                            <div>
                                <label className="text-[9px] font-black text-[#86868B] uppercase tracking-widest mb-3 block">Cantidad</label>
                                <div className="relative">
                                    <input
                                        type="text"
                                        inputMode="decimal"
                                        value={item.cantidad === 0 ? '' : item.cantidad}
                                        onChange={(e) => {
                                            const val = e.target.value.replace(',', '.');
                                            if (val !== '' && !/^\d*\.?\d*$/.test(val)) return;
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
                                            onUpdateRow(index, 'cantidad', finalVal);
                                        }}
                                        onBlur={(e) => {
                                            const val = e.target.value;
                                            if (val.startsWith('.')) {
                                                onUpdateRow(index, 'cantidad', '0' + val);
                                            }
                                        }}
                                        className="w-full h-14 bg-black/40 border border-[#333333] rounded-[8px] px-4 text-[#F5F5F7] text-xl font-black focus:border-[#0071E3] outline-none transition-all shadow-inner font-mono"
                                        placeholder="0"
                                    />
                                    {item.codigo_articulo && (
                                        <div className="flex items-center gap-2 mt-2">
                                            <div className="w-1.5 h-1.5 rounded-full bg-[#0071E3]" />
                                            <span className="text-[11px] text-[#86868B] font-black uppercase tracking-tight">
                                                DISP: <span className="text-[#F5F5F7]">{item.cantidad_disponible}</span> {item.unidad}
                                            </span>
                                        </div>
                                    )}
                                </div>
                            </div>
                            <div className="flex flex-col justify-end">
                                <label className="text-[9px] font-black text-[#86868B] uppercase tracking-widest mb-3 block">Especificaciones</label>
                                <div className="space-y-2">
                                    <div className="flex items-center justify-between bg-black/20 border border-[#333333] rounded-[4px] px-3 py-2">
                                        <span className="text-[8px] font-black text-[#86868B] uppercase">Marca</span>
                                        <span className="text-[10px] font-black text-[#0071E3] truncate ml-2 uppercase">{item.marca || 'N/A'}</span>
                                    </div>
                                    <div className="flex items-center justify-between bg-black/20 border border-[#333333] rounded-[4px] px-3 py-2">
                                        <span className="text-[8px] font-black text-[#86868B] uppercase">Uni.</span>
                                        <span className="text-[10px] font-black text-[#F5F5F7] truncate ml-2 uppercase">{item.unidad || 'UND'}</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                ))}
            </div>


            {items.length === 0 && (
                <div className="py-24 text-center bg-[#1D1D1F] border border-[#333333] rounded-[8px]">
                    <PlusCircle className="w-12 h-12 text-[#333333] mx-auto mb-6 opacity-50" />
                    <p className="text-[#86868B] font-black uppercase tracking-[0.2em] text-[10px] mb-6">No hay artículos cargados</p>
                    <button
                        onClick={onAddRow}
                        className="text-[#0071E3] font-black text-[11px] uppercase tracking-widest hover:underline active:scale-95 transition-all"
                    >
                        Haz clic aquí para agregar el primero
                    </button>
                </div>
            )}
        </div>
    );
};
