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
import { useRegexStore } from '../..';
import { RegexTableEmptyState } from './regex-table-empty-state';
import { RegexItem } from '../../types';

import {
    ColumnDef,
    flexRender,
    getCoreRowModel,
    useReactTable,
} from "@tanstack/react-table";
import { useVirtualizer } from '@tanstack/react-virtual';
import { RotateCcw, Trash2 } from 'lucide-react';

export interface Props {
    data: RegexItem[];
    editingId: number | null;
    onEditingIdChange: (id: number | null) => void;
}

// 提取 Target 单元格以优化性能并保持 hook 规则
const TargetCell = React.memo(({
    id,
    source,
    target,
    updateRegexItem,
    onEditingIdChange
}: {
    id: number,
    source: string,
    target: string,
    updateRegexItem: (id: number, data: Partial<RegexItem>) => void,
    onEditingIdChange: (id: number | null) => void
}) => {
    const handleBlur = useCallback((e: React.FocusEvent<HTMLDivElement>) => {
        const text = e.currentTarget.textContent || '';
        if (text !== target) {
            updateRegexItem(id, { target: text });
        }
        onEditingIdChange(null);
    }, [id, target, updateRegexItem, onEditingIdChange]);

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
interface MemoizedRegexRowProps {
    row: any;
    isSelected: boolean;
    dataIndex: number;
}

const MemoizedRegexRowInner = React.forwardRef<HTMLTableRowElement, MemoizedRegexRowProps>(
    ({ row, isSelected, dataIndex }, ref) => {
        return (
            <TableRow
                ref={ref}
                data-index={dataIndex}
                id={`regex-row-${row.original.id}`}
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

const MemoizedRegexRow = React.memo(MemoizedRegexRowInner, (prev, next) => {
    return prev.isSelected === next.isSelected
        && prev.row.original === next.row.original;
});

export const RegexTable = React.forwardRef<HTMLDivElement, Props>(({ data, editingId, onEditingIdChange }, ref) => {
    const { t } = useTranslation();
    const updateRegexItem = useRegexStore.use.updateRegexItem();
    const deleteRegexItem = useRegexStore.use.deleteRegexItem();
    const resetRegexItem = useRegexStore.use.resetRegexItem();
    const parentRef = useRef<HTMLDivElement>(null);

    const columns = useMemo<ColumnDef<RegexItem>[]>(
        () => [
            {
                accessorKey: "source",
                header: ({ column }) => <div className="text-center pl-4">{t('Editor.Table.ColumnSource')}</div>,
                cell: ({ row }) => (
                    <div className="break-all whitespace-pre-wrap text-sm leading-relaxed px-1 py-1 pl-4 cursor-text select-text">
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
                        source={row.original.source || ''}
                        target={row.original.target}
                        updateRegexItem={updateRegexItem}
                        onEditingIdChange={onEditingIdChange}
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
                                    resetRegexItem(row.original.id);
                                }}
                                title={t('Editor.Actions.Restore')}
                                disabled={row.original.source === row.original.target}
                            >
                                <RotateCcw className="h-3 w-3" />
                            </Button>
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-muted-foreground hover:text-destructive"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    deleteRegexItem(row.original.id);
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
        [onEditingIdChange, updateRegexItem, resetRegexItem, deleteRegexItem]
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

    if (!data || data.length === 0) {
        return (
            <Card ref={ref} className="w-full h-full p-0 overflow-hidden flex flex-col border">
                <RegexTableEmptyState />
            </Card>
        );
    }

    const virtualRows = virtualizer.getVirtualItems();
    const totalSize = virtualizer.getTotalSize();
    const paddingTop = virtualRows.length > 0 ? virtualRows[0].start : 0;
    const paddingBottom = virtualRows.length > 0 ? totalSize - virtualRows[virtualRows.length - 1].end : 0;

    return (
        <Card ref={ref} className="w-full h-full p-0 overflow-hidden flex flex-col border">
            <div ref={parentRef} className="flex-1 h-full overflow-auto" style={{ willChange: 'transform' }}>
                <table className="w-full caption-bottom text-sm">
                    <TableHeader>
                        {table.getHeaderGroups().map((headerGroup) => (
                            <TableRow key={headerGroup.id}>
                                {headerGroup.headers.map((header) => (
                                    <TableHead
                                        key={header.id}
                                        className={`${header.id === 'actions' ? "w-[1%] whitespace-nowrap pl-2 pr-4" : "px-4"
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
                                <MemoizedRegexRow
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

RegexTable.displayName = 'RegexTable';
