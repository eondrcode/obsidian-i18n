import React, { useMemo, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import {
    Card,
    TableHeader,
    TableBody,
    TableHead,
    TableRow,
    TableCell,
    Button
} from '~/shadcn';
import { useThemeEditorStore } from '../store';
import { ThemeTableEmptyState } from './theme-table-empty-state';
import { ThemeTranslationItem } from '../types';

import {
    ColumnDef,
    flexRender,
    getCoreRowModel,
    useReactTable,
} from "@tanstack/react-table";
import { useVirtualizer } from '@tanstack/react-virtual';
import { RotateCcw, Trash2 } from 'lucide-react';

export interface ThemeTableProps {
    data: ThemeTranslationItem[];
    editingId: number | null;
    onEditingIdChange: (id: number | null) => void;
}

// 可编辑的 Target 单元格
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
    updateItem: (id: number, target: string) => void,
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
            className="min-h-[24px] w-full text-sm leading-relaxed focus:outline-none focus:ring-1 focus:ring-primary p-1 rounded break-all whitespace-pre-wrap"
        >
            {target}
        </div>
    );
}, (prev, next) => {
    return prev.id === next.id && prev.target === next.target && prev.source === next.source;
});

// 行级 memo 组件
interface MemoizedThemeRowProps {
    row: any;
    isSelected: boolean;
    dataIndex: number;
}

const MemoizedThemeRowInner = React.forwardRef<HTMLTableRowElement, MemoizedThemeRowProps>(
    ({ row, isSelected, dataIndex }, ref) => {
        return (
            <TableRow
                ref={ref}
                data-index={dataIndex}
                id={`theme-row-${row.original.id}`}
                className={`border-b hover:bg-accent/50 ${isSelected ? 'bg-accent' : ''}`}
                data-state={isSelected ? "selected" : undefined}
            >
                {row.getVisibleCells().map((cell: any) => (
                    <TableCell
                        key={cell.id}
                        className="px-1 py-1"
                    >
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                ))}
            </TableRow>
        );
    }
);

const MemoizedThemeRow = React.memo(MemoizedThemeRowInner, (prev, next) => {
    return prev.isSelected === next.isSelected
        && prev.row.original === next.row.original;
});

export const ThemeTable = React.forwardRef<HTMLDivElement, ThemeTableProps>(({ data, editingId, onEditingIdChange }, ref) => {
    const { t } = useTranslation();
    const updateItem = useThemeEditorStore.use.updateItem();
    const deleteItem = useThemeEditorStore.use.deleteItem();
    const resetItem = useThemeEditorStore.use.resetItem();
    const parentRef = useRef<HTMLDivElement>(null);

    const columns = useMemo<ColumnDef<ThemeTranslationItem>[]>(
        () => [
            {
                accessorKey: "type",
                header: () => <div className="text-center">{t('Editor.Table.ColumnType')}</div>,
                cell: ({ row }) => {
                    const type = row.original.type?.toLowerCase() || '';
                    if (!type) return null;

                    let typeClass = 'bg-muted/50 text-muted-foreground/80 border-border/40';
                    if (type === 'name') typeClass = 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20';
                    else if (type === 'title') typeClass = 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20';
                    else if (type === 'description') typeClass = 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20';
                    else if (type === 'label') typeClass = 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20';
                    else if (type === 'markdown') typeClass = 'bg-pink-500/10 text-pink-600 dark:text-pink-400 border-pink-500/20';

                    return (
                        <div className="flex justify-center px-1">
                            <span className={`text-[10px] font-bold uppercase tracking-wider font-mono px-1.5 py-0.5 rounded-sm whitespace-nowrap border select-none ${typeClass}`}>
                                {row.original.type}
                            </span>
                        </div>
                    );
                },
            },
            {
                accessorKey: "source",
                header: () => <div className="text-center pl-4">{t('Editor.Table.ColumnSource')}</div>,
                cell: ({ row }) => (
                    <div className="break-all whitespace-pre-wrap text-sm leading-relaxed px-4 py-1 cursor-text select-text opacity-90">
                        {row.original.source}
                    </div>
                ),
            },
            {
                accessorKey: "target",
                header: () => <div className="text-center">{t('Editor.Table.ColumnTarget')}</div>,
                cell: ({ row }) => (
                    <TargetCell
                        id={row.original.id}
                        source={row.original.source || ''}
                        target={row.original.target}
                        updateItem={updateItem}
                        onEditingIdChange={onEditingIdChange}
                    />
                ),
            },
            {
                id: "actions",
                header: () => <div className="text-center">{t('Editor.Table.ColumnActions')}</div>,
                cell: ({ row }) => {
                    return (
                        <div className="flex items-center justify-center gap-1">
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6 text-muted-foreground hover:text-primary"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    resetItem(row.original.id);
                                }}
                                title={t('Editor.Actions.Restore')}
                                disabled={row.original.source === row.original.target}
                            >
                                <RotateCcw className="h-3 w-3" />
                            </Button>
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6 text-muted-foreground hover:text-destructive"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    deleteItem(row.original.id);
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
        [onEditingIdChange, updateItem, resetItem, deleteItem]
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
        estimateSize: () => 48,
        overscan: 20,
    });

    if (!data || data.length === 0) {
        return (
            <Card ref={ref} className="w-full h-full p-0 overflow-hidden flex flex-col border">
                <ThemeTableEmptyState />
            </Card>
        );
    }

    const virtualRows = virtualizer.getVirtualItems();
    const totalSize = virtualizer.getTotalSize();
    const paddingTop = virtualRows.length > 0 ? virtualRows[0].start : 0;
    const paddingBottom = virtualRows.length > 0 ? totalSize - virtualRows[virtualRows.length - 1].end : 0;

    return (
        <Card ref={ref} className="w-full h-full p-0 overflow-hidden flex flex-col border">
            <div ref={parentRef} className="flex-1 h-full overflow-auto" style={{ overflowAnchor: 'none', willChange: 'transform' }}>
                <table className="w-full caption-bottom text-sm">
                    <TableHeader>
                        {table.getHeaderGroups().map((headerGroup) => (
                            <TableRow key={headerGroup.id}>
                                {headerGroup.headers.map((header) => (
                                    <TableHead
                                        key={header.id}
                                        className={`${(header.id === 'actions' || header.id === 'type') ? "w-[1%] whitespace-nowrap px-4" : "px-4"
                                            } sticky top-0 bg-background z-20 shadow-sm border-b ring-0`}
                                        style={{ backgroundColor: 'var(--background-primary)' }}
                                    >
                                        {header.isPlaceholder
                                            ? null
                                            : flexRender(
                                                header.column.columnDef.header,
                                                header.getContext()
                                            )}
                                    </TableHead>
                                ))}
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
                                <MemoizedThemeRow
                                    key={row.id}
                                    ref={virtualizer.measureElement}
                                    dataIndex={virtualRow.index}
                                    row={row}
                                    isSelected={row.original.id === editingId}
                                />
                            );
                        })}
                        {paddingBottom > 0 && (
                            <tr><td colSpan={columns.length} style={{ height: paddingBottom, padding: 0, border: 'none' }} /></tr>
                        )}
                    </TableBody>
                </table>
            </div>
        </Card>
    );
});

ThemeTable.displayName = 'ThemeTable';
