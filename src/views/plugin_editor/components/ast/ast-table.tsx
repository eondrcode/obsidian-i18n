import React, { useMemo, useCallback, useRef, useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
    TableHead,
    TableHeader,
    TableRow,
    TableBody,
    TableCell,
    Button
} from '~/shadcn';
import { RotateCcw, Trash2 } from 'lucide-react';
import {
    ColumnDef,
    flexRender,
    getCoreRowModel,
    useReactTable,
} from "@tanstack/react-table";
import { useVirtualizer } from '@tanstack/react-virtual';
import { AstItem, DiagnoseError } from '../../types';
import { ASTTableEmptyState } from './ast-table-empty-state';
import { useRegexStore } from '../../store';

interface Props {
    data: AstItem[];
    editingId: number | null;
    onRowClick: (id: number) => void;
    onDelete: (id: number) => void;
    onReset: (id: number) => void;
}

// 颜色样式缓存，避免每次渲染重复计算哈希
const colorStyleCache = new Map<string, React.CSSProperties>();
const getColorStyle = (str: string): React.CSSProperties => {
    const cached = colorStyleCache.get(str);
    if (cached) return cached;

    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    const hue = Math.abs(hash) % 360;
    const style = { '--item-hue': hue } as React.CSSProperties;
    colorStyleCache.set(str, style);
    return style;
};

// Target Cell with inline editing
const TargetCell = React.memo(({
    id,
    source,
    target,
    updateItem,
    onEditingIdChange
}: {
    id: number,
    source: string,
    target: string,
    updateItem: (id: number, data: string) => void,
    onEditingIdChange: (id: number | null) => void
}) => {
    const handleBlur = useCallback((e: React.FocusEvent<HTMLDivElement>) => {
        const text = e.currentTarget.textContent || '';
        if (text !== target) {
            updateItem(id, text);
        }
        onEditingIdChange(null);
    }, [id, target, updateItem, onEditingIdChange]);

    const handleFocus = useCallback(() => {
        onEditingIdChange(id);
    }, [id, onEditingIdChange]);

    return (
        <div
            key={`cell-${id}-${source.slice(0, 10)}`}
            contentEditable
            suppressContentEditableWarning
            onFocus={handleFocus}
            onBlur={handleBlur}
            className="min-h-[32px] w-full text-sm leading-relaxed focus:outline-none focus:ring-1 focus:ring-primary p-1 rounded break-all whitespace-pre-wrap"
        >
            {target}
        </div>
    );
}, (prev, next) => {
    return prev.id === next.id && prev.target === next.target && prev.source === next.source;
});

// 行级 memo 组件（带 forwardRef，供虚拟滚动测量高度）
interface MemoizedAstRowProps {
    row: any;
    isSelected: boolean;
    onRowClick: (id: number) => void;
    getCellClass: (columnId: string) => string;
    dataIndex: number;
    errorType?: 'error' | 'unused' | 'security' | null;
}

const errorRowStyles: Record<string, string> = {
    error: 'bg-destructive/8 border-l-2 border-l-destructive',
    unused: 'bg-orange-500/8 border-l-2 border-l-orange-500',
    security: 'bg-purple-500/8 border-l-2 border-l-purple-500',
};

const MemoizedAstRowInner = React.forwardRef<HTMLTableRowElement, MemoizedAstRowProps>(
    ({ row, isSelected, onRowClick, getCellClass, dataIndex, errorType }, ref) => {
        const handleClick = useCallback(() => {
            onRowClick(row.original.id);
        }, [row.original.id, onRowClick]);

        const errorClass = errorType ? errorRowStyles[errorType] || '' : '';

        return (
            <TableRow
                ref={ref}
                data-index={dataIndex}
                id={`ast-row-${row.original.id}`}
                data-state={isSelected ? "selected" : undefined}
                className={`cursor-pointer hover:bg-accent/50 ${isSelected ? 'bg-accent' : ''} ${errorClass}`}
                onClick={handleClick}
            >
                {row.getVisibleCells().map((cell: any) => (
                    <TableCell
                        key={cell.id}
                        className={getCellClass(cell.column.id)}
                    >
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                ))}
            </TableRow>
        );
    }
);
MemoizedAstRowInner.displayName = 'MemoizedAstRow';

const MemoizedAstRow = React.memo(MemoizedAstRowInner, (prev, next) => {
    return prev.isSelected === next.isSelected
        && prev.row.original === next.row.original
        && prev.errorType === next.errorType;
});

export const ASTTable = React.forwardRef<HTMLDivElement, Props>(({ data, editingId, onRowClick, onDelete, onReset }, ref) => {
    const { t } = useTranslation();
    const updateAstItem = useRegexStore.use.updateAstItem();
    const parentRef = useRef<HTMLDivElement>(null);

    // 诊断错误高亮映射 {id -> errorType}
    const [errorMap, setErrorMap] = useState<Map<number, 'error' | 'unused' | 'security'>>(new Map());

    useEffect(() => {
        const handleErrors = (e: CustomEvent<{ errors: DiagnoseError[] }>) => {
            const map = new Map<number, 'error' | 'unused' | 'security'>();
            for (const err of e.detail.errors) {
                if (err.type !== 'ast') continue;
                if (err.severity === 'critical' || err.severity === 'warning') {
                    map.set(err.id, 'security');
                } else if (err.isUnused) {
                    map.set(err.id, 'unused');
                } else {
                    map.set(err.id, 'error');
                }
            }
            setErrorMap(map);
        };
        window.addEventListener('i18n-diagnose-errors', handleErrors as EventListener);
        return () => window.removeEventListener('i18n-diagnose-errors', handleErrors as EventListener);
    }, []);

    const columns = useMemo<ColumnDef<AstItem>[]>(
        () => [
            {
                accessorKey: "type",
                header: ({ column }) => <div className="text-center">{t('Editor.Table.ColumnType')}</div>,
                cell: ({ row }) => (
                    <div className="flex justify-center">
                        <span
                            className="px-2 py-0.5 rounded-md text-xs whitespace-nowrap bg-[hsl(var(--item-hue),85%,96%)] text-[hsl(var(--item-hue),80%,35%)] dark:bg-[hsl(var(--item-hue),60%,20%)] dark:text-[hsl(var(--item-hue),80%,80%)]"
                            style={getColorStyle(row.original.type)}
                        >
                            {row.original.type}
                        </span>
                    </div>
                ),
            },
            {
                accessorKey: "name",
                header: ({ column }) => <div className="text-center">{t('Editor.Table.ColumnName')}</div>,
                cell: ({ row }) => (
                    <div className="flex justify-center">
                        <span
                            className="truncate max-w-[120px] font-mono text-xs px-1.5 py-0.5 rounded text-center bg-[hsl(var(--item-hue),85%,96%)] text-[hsl(var(--item-hue),80%,35%)] dark:bg-[hsl(var(--item-hue),60%,20%)] dark:text-[hsl(var(--item-hue),80%,80%)]"
                            style={getColorStyle(row.original.name)}
                            title={row.original.name}
                        >
                            {row.original.name}
                        </span>
                    </div>
                ),
            },
            {
                accessorKey: "source",
                header: ({ column }) => <div className="text-center">{t('Editor.Table.ColumnSource')}</div>,
                cell: ({ row }) => (
                    <div className="whitespace-pre-wrap break-all text-sm px-1 py-1">
                        {row.original.source}
                    </div>
                ),
            },
            {
                accessorKey: "target",
                header: ({ column }) => <div className="text-center">{t('Editor.Table.ColumnTarget')}</div>,
                cell: ({ row }) => (
                    <TargetCell
                        id={row.original.id}
                        source={row.original.source}
                        target={row.original.target}
                        updateItem={updateAstItem}
                        onEditingIdChange={onRowClick}
                    />
                ),
            },
            {
                id: "actions",
                header: ({ column }) => <div className="text-center">{t('Editor.Table.ColumnActions')}</div>,
                cell: ({ row }) => {
                    const hasTranslation = row.original.target && row.original.target !== row.original.source;
                    return (
                        <div className="flex items-center justify-center gap-1">
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-muted-foreground hover:text-primary"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onReset(row.original.id);
                                }}
                                title={t('Editor.Actions.Restore')}
                                disabled={!hasTranslation}
                            >
                                <RotateCcw className="h-3 w-3" />
                            </Button>
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-muted-foreground hover:text-destructive"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onDelete(row.original.id);
                                }}
                                title={t('Common.Actions.Delete')}
                            >
                                <Trash2 className="h-3 w-3" />
                            </Button>
                        </div>
                    );
                },
            },
        ],
        [onDelete, onReset, updateAstItem, onRowClick]
    );

    const table = useReactTable({
        data,
        columns,
        getCoreRowModel: getCoreRowModel(),
        getRowId: (row) => String(row.id),
    });

    const { rows } = table.getRowModel();

    const virtualizer = useVirtualizer({
        count: rows.length,
        getScrollElement: () => parentRef.current,
        estimateSize: () => 50,
        overscan: 10,
    });

    // Auto-scroll to selected row
    React.useEffect(() => {
        if (editingId !== null) {
            const index = rows.findIndex(row => row.original.id === editingId);
            if (index !== -1) {
                virtualizer.scrollToIndex(index, { align: 'auto' });
            }
        }
    }, [editingId]);

    // Helper to determine cell classes（稳定引用）
    const getCellClass = useCallback((columnId: string) => {
        if (columnId === 'type' || columnId === 'name') {
            return "w-[1%] whitespace-nowrap p-2";
        }
        if (columnId === 'actions') {
            return "w-[1%] whitespace-nowrap p-2";
        }
        // source & target 用相同百分比强制等宽
        return "w-[38%] p-2";
    }, []);

    // Check for empty data
    if (!data || data.length === 0) {
        return (
            <div ref={ref} className="rounded-md border h-full overflow-hidden flex flex-col">
                <ASTTableEmptyState />
            </div>
        );
    }

    const virtualRows = virtualizer.getVirtualItems();
    const totalSize = virtualizer.getTotalSize();
    const paddingTop = virtualRows.length > 0 ? virtualRows[0].start : 0;
    const paddingBottom = virtualRows.length > 0 ? totalSize - virtualRows[virtualRows.length - 1].end : 0;

    return (
        <div ref={ref} className="rounded-md border h-full overflow-hidden flex flex-col">
            <div ref={parentRef} className="flex-1 h-full overflow-auto" style={{ willChange: 'transform' }}>
                <table className="w-full caption-bottom text-sm">
                    <TableHeader>
                        {table.getHeaderGroups().map((headerGroup) => (
                            <TableRow key={headerGroup.id}>
                                {headerGroup.headers.map((header) => {
                                    return (
                                        <TableHead
                                            key={header.id}
                                            className={`${getCellClass(header.id)} sticky top-0 bg-background z-20 shadow-sm`}
                                        >
                                            {header.isPlaceholder
                                                ? null
                                                : flexRender(
                                                    header.column.columnDef.header,
                                                    header.getContext()
                                                )}
                                        </TableHead>
                                    )
                                })}
                            </TableRow>
                        ))}
                    </TableHeader>
                    <TableBody>
                        {paddingTop > 0 && (
                            <tr><td colSpan={columns.length} style={{ height: paddingTop, padding: 0, border: 'none' }} /></tr>
                        )}
                        {virtualRows.map((virtualRow) => {
                            const row = rows[virtualRow.index];
                            return (
                                <MemoizedAstRow
                                    key={row.id}
                                    ref={virtualizer.measureElement}
                                    dataIndex={virtualRow.index}
                                    row={row}
                                    isSelected={row.original.id === editingId}
                                    onRowClick={onRowClick}
                                    getCellClass={getCellClass}
                                    errorType={errorMap.get(row.original.id) || null}
                                />
                            );
                        })}
                        {paddingBottom > 0 && (
                            <tr><td colSpan={columns.length} style={{ height: paddingBottom, padding: 0, border: 'none' }} /></tr>
                        )}
                    </TableBody>
                </table>
            </div>
        </div>
    );
});

ASTTable.displayName = 'ASTTable';
