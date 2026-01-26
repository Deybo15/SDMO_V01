// @ts-ignore
import * as RW from 'react-window';
// @ts-ignore
import * as AS from 'react-virtualized-auto-sizer';

// Advanced resolution for CJS/ESM interop in Vite
const resolveComponent = (module: any, name: string) => {
    if (!module) return null;

    const targets = [
        module[name],
        module.default?.[name],
        module.default?.default?.[name],
        module.default,
        module.default?.default,
        module
    ];

    for (const t of targets) {
        if (typeof t === 'function') return t;
        // AutoSizer can be a class or a functional component
        if (t && (t.prototype?.render || t.$$typeof)) return t;
    }

    return null;
};

const List = resolveComponent(RW, 'FixedSizeList');
const AutoSizer = resolveComponent(AS, 'AutoSizer');

import { cn } from '../lib/utils';
import { ReactNode, CSSProperties } from 'react';

interface Column {
    header: string;
    width: string;
    className?: string;
}

interface VirtualizedTableProps<T> {
    data: T[];
    columns: Column[];
    rowHeight?: number;
    renderCell: (item: T, columnIndex: number, rowIndex: number) => ReactNode;
    className?: string;
}

interface ListChildProps {
    index: number;
    style: CSSProperties;
}

export default function VirtualizedTable<T>({
    data,
    columns,
    rowHeight = 80,
    renderCell,
    className
}: VirtualizedTableProps<T>) {
    // Failsafe: If virtualization fails to load, render a standard table as fallback
    if (!List || !AutoSizer) {
        console.warn('VirtualizedTable: Falling back to standard table.');
        return (
            <div className={cn("w-full h-full flex flex-col overflow-hidden rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900/30", className)}>
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead className="sticky top-0 z-10 bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-white/10">
                            <tr>
                                {columns.map((col, idx) => (
                                    <th
                                        key={idx}
                                        style={{ width: col.width, minWidth: col.width }}
                                        className={cn(
                                            "px-6 py-4 text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-[0.2em]",
                                            col.className
                                        )}
                                    >
                                        {col.header}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                            {data.map((item, rowIndex) => (
                                <tr key={rowIndex} className="hover:bg-slate-50 dark:hover:bg-white/5 transition-colors">
                                    {columns.map((col, colIdx) => (
                                        <td
                                            key={colIdx}
                                            className={cn("px-6 py-4", col.className)}
                                        >
                                            {renderCell(item, colIdx, rowIndex)}
                                        </td>
                                    ))}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                {data.length === 0 && (
                    <div className="p-12 text-center text-slate-500 italic">No hay datos para mostrar</div>
                )}
            </div>
        );
    }

    return (
        <div className={cn("w-full h-full flex flex-col overflow-hidden", className)}>
            {/* Header */}
            <div className="flex bg-slate-50 dark:bg-slate-700/50 border-b border-slate-200 dark:border-slate-700 z-10 shadow-sm">
                {columns.map((col, idx) => (
                    <div
                        key={idx}
                        style={{ width: col.width, minWidth: 0 }}
                        className={cn(
                            "px-3 py-4 text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-[0.2em]",
                            col.className
                        )}
                    >
                        {col.header}
                    </div>
                ))}
            </div>

            {/* Body */}
            <div className="flex-1 min-h-[400px]">
                <AutoSizer>
                    {({ height, width }: { height: number; width: number }) => (
                        <List
                            height={height}
                            itemCount={data.length}
                            itemSize={rowHeight}
                            width={width}
                            className="scrollbar-thin scrollbar-thumb-slate-300 dark:scrollbar-thumb-slate-700"
                        >
                            {({ index, style }: ListChildProps) => {
                                const item = data[index];
                                return (
                                    <div
                                        style={style}
                                        className={cn(
                                            "flex items-start hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors border-b border-slate-100 dark:border-slate-800 overflow-hidden",
                                            index % 2 === 0 ? "bg-white dark:bg-slate-900/10" : "bg-white dark:bg-transparent"
                                        )}
                                    >
                                        {columns.map((col, colIdx) => (
                                            <div
                                                key={colIdx}
                                                style={{ width: col.width, minWidth: 0 }}
                                                className={cn("px-3 py-4 flex flex-col justify-start", col.className)}
                                            >
                                                {renderCell(item, colIdx, index)}
                                            </div>
                                        ))}
                                    </div>
                                );
                            }}
                        </List>
                    )}
                </AutoSizer>
            </div>
        </div>
    );
}
