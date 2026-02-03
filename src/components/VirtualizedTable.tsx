// @ts-ignore
import * as RW_All from 'react-window';
// @ts-ignore
import * as AS_All from 'react-virtualized-auto-sizer';

// Robust check for React Component (function, class, or React-specific object)
const isValidComponent = (c: any) => {
    if (!c) return false;
    // Check if it's a function (functional component or class component)
    if (typeof c === 'function') return true;
    // Check if it's a React-specific object (memo, forwardRef, etc.)
    return (typeof c === 'object' && !!c.$$typeof);
};

// Precise resolution for CJS/ESM hybrid environments
const resolveComponent = (mod: any, name: string) => {
    if (!mod) return null;

    // 1. Direct access if mod is the component itself
    if (isValidComponent(mod)) return mod;

    // 2. Default export handling (CommonJS/ESM interop)
    const def = mod.default;
    if (def) {
        if (isValidComponent(def[name])) return def[name];
        if (isValidComponent(def)) return def;
        if (def.default && isValidComponent(def.default)) return def.default;
    }

    // 3. Named export check
    if (isValidComponent(mod[name])) return mod[name];

    // 4. Try lowercase names if applicable
    const lowerName = name.toLowerCase();
    if (isValidComponent(mod[lowerName])) return mod[lowerName];

    return null;
};

const List: any = resolveComponent(RW_All, 'FixedSizeList');
const AutoSizerComponent: any = resolveComponent(AS_All, 'AutoSizer');

// Failsafe check
const checkComponents = () => !!(List && AutoSizerComponent);

// Logging initialization state (silent in production, useful for debug)
if (typeof window !== 'undefined' && !checkComponents()) {
    console.warn('VirtualizedTable: Core components failed to load. Falling back to standard Table.', {
        hasList: !!List,
        hasAutoSizer: !!AutoSizerComponent
    });
}

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
    if (!checkComponents()) {
        return (
            <div className={cn("w-full h-full flex flex-col overflow-hidden rounded-[8px] border border-[#333333] bg-[#000000]", className)}>
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead className="sticky top-0 z-10 bg-[#121212] border-b border-[#333333]">
                            <tr>
                                {columns.map((col, idx) => (
                                    <th
                                        key={idx}
                                        style={{ width: col.width, minWidth: col.width }}
                                        className={cn(
                                            "px-6 py-4 text-[10px] font-black text-[#86868B] uppercase tracking-[0.2em]",
                                            col.className
                                        )}
                                    >
                                        {col.header}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-[#333333]/30">
                            {data.map((item, rowIndex) => (
                                <tr key={rowIndex} className="hover:bg-white/5 transition-colors">
                                    {columns.map((col, colIdx) => (
                                        <td
                                            key={colIdx}
                                            className={cn("px-6 py-4 text-[#F5F5F7]", col.className)}
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
                    <div className="p-12 text-center text-[#86868B] italic text-[10px] uppercase tracking-widest font-black">No hay datos para mostrar</div>
                )}
            </div>
        );
    }

    return (
        <div className={cn("w-full h-full flex flex-col overflow-hidden bg-[#000000]", className)}>
            {/* Header */}
            <div className="flex bg-[#121212] border-b border-[#333333] z-10 shadow-sm">
                {columns.map((col, idx) => (
                    <div
                        key={idx}
                        style={{ width: col.width, minWidth: 0 }}
                        className={cn(
                            "px-3 py-4 text-[10px] font-black text-[#86868B] uppercase tracking-[0.2em]",
                            col.className
                        )}
                    >
                        {col.header}
                    </div>
                ))}
            </div>

            <div className="flex-1 min-h-[400px]">
                <AutoSizerComponent>
                    {({ height, width }: { height: number; width: number }) => (
                        <List
                            height={height}
                            itemCount={data.length}
                            itemSize={rowHeight}
                            width={width}
                            className="scrollbar-thin scrollbar-thumb-[#333333] hover:scrollbar-thumb-[#424245]"
                        >
                            {({ index, style }: ListChildProps) => {
                                const item = data[index];
                                return (
                                    <div
                                        style={style}
                                        className={cn(
                                            "flex items-start hover:bg-white/5 transition-colors border-b border-[#333333]/30 overflow-hidden",
                                            index % 2 === 0 ? "bg-[#121212]/10" : "bg-transparent"
                                        )}
                                    >
                                        {columns.map((col, colIdx) => (
                                            <div
                                                key={colIdx}
                                                style={{ width: col.width, minWidth: 0 }}
                                                className={cn("px-3 py-4 flex flex-col justify-start text-[#F5F5F7] text-sm font-bold", col.className)}
                                            >
                                                {renderCell(item, colIdx, index)}
                                            </div>
                                        ))}
                                    </div>
                                );
                            }}
                        </List>
                    )}
                </AutoSizerComponent>
            </div>
        </div>
    );
}
