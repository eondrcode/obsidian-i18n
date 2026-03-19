import React, { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
    Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
    Input, Button, Checkbox, Badge, ScrollArea,
    DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger
} from '~/shadcn';
import { Search, Download, Upload, Trash2, MoreVertical, FileJson, Globe, HardDrive, Filter, Info, Puzzle, Palette } from 'lucide-react';
import I18N from 'src/main';
import { TranslationSource } from 'src/types';
import { Notice } from 'obsidian';
import * as fs from 'fs-extra';
import * as zlib from 'zlib';
import * as path from 'path';
import { useGlobalStoreInstance, i18nOpen } from '~/utils';
import { loadTranslationFile } from '../../../manager/io-manager';
import { EDITOR_VIEW_TYPE } from '../../../views';

interface TranslationManagerPanelProps {
    i18n: I18N;
}

export const TranslationManagerPanel: React.FC<TranslationManagerPanelProps> = ({ i18n }) => {
    const { t } = useTranslation();
    const sourceManager = i18n.sourceManager;

    const [searchQuery, setSearchQuery] = useState('');
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [originFilter, setOriginFilter] = useState<'all' | 'local' | 'cloud'>('all');
    const [typeFilter, setTypeFilter] = useState<'all' | 'plugin' | 'theme'>('all');

    // 监听全局更新 Tick 以刷新列表
    const sourceTick = useGlobalStoreInstance((state) => state.sourceUpdateTick);

    // 获取所有翻译源并应用过滤
    const allSources = useMemo(() => {
        let sources = sourceManager.getAllSources();

        if (searchQuery) {
            const query = searchQuery.toLowerCase();
            sources = sources.filter(s =>
                s.title.toLowerCase().includes(query) ||
                s.plugin.toLowerCase().includes(query) ||
                s.id.toLowerCase().includes(query)
            );
        }

        if (originFilter !== 'all') {
            sources = sources.filter(s => s.origin === originFilter);
        }

        if (typeFilter !== 'all') {
            sources = sources.filter(s => s.type === typeFilter);
        }

        return sources.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
    }, [i18n, searchQuery, originFilter, typeFilter, sourceTick]);

    // 处理全选/反选
    const toggleSelectAll = () => {
        if (selectedIds.size === allSources.length) {
            setSelectedIds(new Set());
        } else {
            setSelectedIds(new Set(allSources.map(s => s.id)));
        }
    };

    const toggleSelect = (id: string) => {
        const next = new Set(selectedIds);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        setSelectedIds(next);
    };

    // 格式化日期
    const formatDate = (ts?: number) => {
        if (!ts) return '-';
        return new Date(ts).toLocaleString();
    };

    // 批量导出逻辑
    const handleBatchExport = async () => {
        if (selectedIds.size === 0) return;

        try {
            const exportData: Record<string, any> = {};
            for (const id of selectedIds) {
                const source = sourceManager.getSource(id);
                if (source) {
                    const content = sourceManager.readSourceFile(id);
                    exportData[id] = {
                        meta: source,
                        content: content
                    };
                }
            }

            const jsonString = JSON.stringify(exportData);
            const compressed = zlib.gzipSync(Buffer.from(jsonString, 'utf-8'));
            const blob = new Blob([new Uint8Array(compressed)], { type: 'application/gzip' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `i18n-translations-export-${Date.now()}.i18n.gz`;
            a.click();
            URL.revokeObjectURL(url);

            new Notice(t('Manager.TranslationManager.Actions.ExportSuccess'));
        } catch (error) {
            console.error('Export failed:', error);
            new Notice(t('Manager.Errors.Error'));
        }
    };

    // 导入逻辑
    const handleImport = () => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.i18n.gz,.gz,.json';
        input.onchange = async (e: any) => {
            const file = e.target.files[0];
            if (!file) return;

            try {
                const reader = new FileReader();
                reader.onload = async (event) => {
                    try {
                        const buffer = event.target?.result as ArrayBuffer;
                        let content: string;

                        // 根据后缀或内容尝试解压
                        if (file.name.endsWith('.gz') || file.name.endsWith('.i18n.gz')) {
                            const decompressed = zlib.gunzipSync(Buffer.from(buffer));
                            content = decompressed.toString('utf-8');
                        } else {
                            // 兼容旧的 JSON 格式
                            content = new TextDecoder().decode(buffer);
                        }

                        const data = JSON.parse(content);
                        let addedCount = 0;
                        let updatedCount = 0;
                        let skippedCount = 0;

                        if (data && typeof data === 'object') {
                            for (const key in data) {
                                const item = data[key];
                                if (item.meta && item.content) {
                                    const existing = sourceManager.getSource(item.meta.id);
                                    if (existing) {
                                        if (existing.checksum === item.meta.checksum) {
                                            skippedCount++;
                                            continue;
                                        } else {
                                            updatedCount++;
                                        }
                                    } else {
                                        addedCount++;
                                    }

                                    sourceManager.saveSource(item.meta);
                                    sourceManager.saveSourceFile(item.meta.id, item.content);
                                }
                            }
                        }

                        if (addedCount > 0 || updatedCount > 0) {
                            let msg = '';
                            if (addedCount > 0) msg += `新增 ${addedCount} `;
                            if (updatedCount > 0) msg += `更新 ${updatedCount} `;
                            if (skippedCount > 0) msg += `(跳过 ${skippedCount} 项重复)`;
                            new Notice(msg.trim() || t('Manager.TranslationManager.Actions.ImportSuccess', { count: addedCount + updatedCount }));
                            // 刷新列表
                            useGlobalStoreInstance.getState().triggerSourceUpdate();
                        } else if (skippedCount > 0) {
                            new Notice(`全部 ${skippedCount} 项已存在且内容一致，无需导入`);
                        } else {
                            new Notice(t('Manager.Errors.ErrorDesc'));
                        }
                    } catch (err) {
                        console.error('Import processing failed:', err);
                        new Notice(t('Manager.Errors.Error'));
                    }
                };
                reader.readAsArrayBuffer(file);
            } catch (error) {
                new Notice(t('Manager.Errors.Error'));
            }
        };
        input.click();
    };

    // 批量删除
    const handleBatchDelete = async () => {
        if (selectedIds.size === 0) return;

        const confirmed = window.confirm(t('Manager.TranslationManager.Actions.DeleteConfirm', { count: selectedIds.size }));
        if (!confirmed) return;

        try {
            for (const id of selectedIds) {
                sourceManager.removeSource(id);
            }
            setSelectedIds(new Set());
            new Notice(t('Common.Notices.DeleteSuccess'));
            // 刷新列表
            useGlobalStoreInstance.getState().triggerSourceUpdate();
        } catch (error) {
            new Notice(t('Manager.Errors.Error'));
        }
    };

    return (
        <div className="flex flex-col h-full bg-background">
            {/* 顶栏控制区 */}
            <div className="shrink-0 p-4 border-b space-y-4 shadow-sm bg-muted/20">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <h2 className="text-lg font-bold flex items-center gap-2">
                            <FileJson className="w-5 h-5 text-primary" />
                            {t('Manager.TranslationManager.Title')}
                        </h2>
                        <p className="text-xs text-muted-foreground mt-1">
                            {t('Manager.TranslationManager.Subtitle')}
                        </p>
                    </div>
                    <div className="flex items-center gap-2">
                        <Button variant="outline" size="sm" onClick={handleImport} className="gap-1.5 h-8">
                            <Upload className="w-3.5 h-3.5" />
                            {t('Manager.TranslationManager.Actions.Import')}
                        </Button>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={handleBatchExport}
                            disabled={selectedIds.size === 0}
                            className="gap-1.5 h-8"
                        >
                            <Download className="w-3.5 h-3.5" />
                            {t('Manager.TranslationManager.Actions.Export')}
                        </Button>
                        <Button
                            variant="destructive"
                            size="sm"
                            onClick={handleBatchDelete}
                            disabled={selectedIds.size === 0}
                            className="gap-1.5 h-8"
                        >
                            <Trash2 className="w-3.5 h-3.5" />
                            {t('Manager.TranslationManager.Actions.BatchDelete')}
                        </Button>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    <div className="relative flex-1 max-w-sm">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <Input
                            className="pl-9 h-9 text-sm rounded-none border-muted-foreground/20 focus:ring-1"
                            placeholder={t('Manager.TranslationManager.Filters.SearchPlaceholder')}
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm" className="h-9 gap-1.5 border border-dashed rounded-none">
                                <Filter className="w-3.5 h-3.5" />
                                {originFilter === 'all' ? t('Manager.Filters.All') :
                                    originFilter === 'local' ? t('Manager.TranslationManager.Filters.OriginLocal') :
                                        t('Manager.TranslationManager.Filters.OriginCloud')}
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="start" className="w-40 rounded-none">
                            <DropdownMenuItem onClick={() => setOriginFilter('all')}>{t('Manager.Filters.All')}</DropdownMenuItem>
                            <DropdownMenuItem onClick={() => setOriginFilter('local')}>{t('Manager.TranslationManager.Filters.OriginLocal')}</DropdownMenuItem>
                            <DropdownMenuItem onClick={() => setOriginFilter('cloud')}>{t('Manager.TranslationManager.Filters.OriginCloud')}</DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>

                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm" className="h-9 gap-1.5 border border-dashed rounded-none">
                                <Filter className="w-3.5 h-3.5" />
                                {typeFilter === 'all' ? t('Manager.Filters.All') :
                                    typeFilter === 'plugin' ? t('Common.Labels.Plugins') :
                                        t('Common.Labels.Themes')}
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="start" className="w-40 rounded-none">
                            <DropdownMenuItem onClick={() => setTypeFilter('all')}>{t('Manager.Filters.All')}</DropdownMenuItem>
                            <DropdownMenuItem onClick={() => setTypeFilter('plugin')}>{t('Common.Labels.Plugins')}</DropdownMenuItem>
                            <DropdownMenuItem onClick={() => setTypeFilter('theme')}>{t('Common.Labels.Themes')}</DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
            </div>

            {/* 内容列表区 */}
            <ScrollArea className="flex-1">
                <Table>
                    <TableHeader className="sticky top-0 bg-background z-10 shadow-sm">
                        <TableRow className="hover:bg-transparent">
                            <TableHead className="w-12 text-center">
                                <Checkbox
                                    checked={allSources.length > 0 && selectedIds.size === allSources.length}
                                    onCheckedChange={toggleSelectAll}
                                />
                            </TableHead>
                            <TableHead className="w-10 px-0"></TableHead>
                            <TableHead className="text-xs font-semibold uppercase text-muted-foreground">
                                {t('Manager.TranslationManager.Table.Name')}
                            </TableHead>
                            <TableHead className="hidden md:table-cell text-xs font-semibold uppercase text-muted-foreground">
                                {t('Manager.TranslationManager.Table.Origin')}
                            </TableHead>
                            <TableHead className="text-xs font-semibold uppercase text-muted-foreground">
                                {t('Manager.TranslationManager.Table.Mtime')}
                            </TableHead>
                            <TableHead className="w-20 text-right"></TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {allSources.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={6} className="h-64 text-center">
                                    <div className="flex flex-col items-center justify-center text-muted-foreground py-10">
                                        <FileJson className="w-12 h-12 opacity-20 mb-4" />
                                        <p className="text-sm font-medium">{t('Manager.Status.NoTrans')}</p>
                                        <p className="text-xs">{t('Manager.Placeholders.SearchPlaceholder')}</p>
                                    </div>
                                </TableCell>
                            </TableRow>
                        ) : (
                            allSources.map(source => (
                                <TableRow key={source.id} className="group hover:bg-muted/50 transition-colors">
                                    <TableCell className="text-center">
                                        <Checkbox
                                            checked={selectedIds.has(source.id)}
                                            onCheckedChange={() => toggleSelect(source.id)}
                                        />
                                    </TableCell>
                                    <TableCell className="px-0">
                                        {source.origin === 'cloud' ? (
                                            <Globe className="w-3.5 h-3.5 text-blue-500" />
                                        ) : (
                                            <HardDrive className="w-3.5 h-3.5 text-emerald-500" />
                                        )}
                                    </TableCell>
                                    <TableCell className="max-w-[200px] md:max-w-none">
                                        <div className="flex items-center gap-2">
                                            {source.type === 'theme' ? (
                                                <Badge className="bg-orange-500/10 text-orange-600 hover:bg-orange-500/10 border-orange-200/50 text-[10px] h-5 px-1 rounded-none font-normal shrink-0">
                                                    {t('Common.Labels.Themes')}
                                                </Badge>
                                            ) : (
                                                <Badge className="bg-purple-500/10 text-purple-600 hover:bg-purple-500/10 border-purple-200/50 text-[10px] h-5 px-1 rounded-none font-normal shrink-0">
                                                    {t('Common.Labels.Plugins')}
                                                </Badge>
                                            )}
                                            <div className="flex flex-col min-w-0">
                                                <span className="text-sm font-medium truncate group-hover:text-primary transition-colors">
                                                    {source.title}
                                                </span>
                                                <span className="text-[10px] text-muted-foreground font-mono mt-0.5">
                                                    {source.plugin}
                                                </span>
                                            </div>
                                        </div>
                                    </TableCell>
                                    <TableCell className="hidden md:table-cell">
                                        <Badge variant="outline" className="text-[10px] px-1.5 py-0 rounded font-normal">
                                            {source.origin === 'cloud' ? t('Manager.TranslationManager.Filters.OriginCloud') : t('Manager.TranslationManager.Filters.OriginLocal')}
                                        </Badge>
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex flex-col">
                                            <span className="text-xs tabular-nums text-muted-foreground">
                                                {formatDate(source.updatedAt).split(' ')[0]}
                                            </span>
                                            <span className="text-[10px] tabular-nums text-muted-foreground/60">
                                                {formatDate(source.updatedAt).split(' ')[1]}
                                            </span>
                                        </div>
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <Button variant="ghost" size="icon" className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <MoreVertical className="w-4 h-4" />
                                                </Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end" className="w-40 rounded-none">
                                                <DropdownMenuItem className="text-xs" onClick={() => {
                                                    const filePath = sourceManager.getSourceFilePath(source.id);
                                                    const pluginTranslationV1 = loadTranslationFile(filePath);
                                                    useGlobalStoreInstance.getState().setEditorPluginTranslation(pluginTranslationV1);
                                                    useGlobalStoreInstance.getState().setEditorPluginTranslationPath(filePath);
                                                    i18n.view.activateView(EDITOR_VIEW_TYPE);
                                                }}>
                                                    {t('Manager.Actions.Edit')}
                                                </DropdownMenuItem>
                                                <DropdownMenuItem className="text-xs" onClick={() => {
                                                    const filePath = sourceManager.getSourceFilePath(source.id);
                                                    i18nOpen(i18n, path.dirname(filePath));
                                                }}>
                                                    {t('Manager.Actions.OpenFolder')}
                                                </DropdownMenuItem>
                                                <DropdownMenuItem className="text-xs text-destructive focus:text-destructive" onClick={() => {
                                                    sourceManager.removeSource(source.id);
                                                    new Notice(t('Common.Notices.DeleteSuccess'));
                                                    // 刷新列表
                                                    useGlobalStoreInstance.getState().triggerSourceUpdate();
                                                }}>
                                                    {t('Manager.Actions.Delete')}
                                                </DropdownMenuItem>
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </ScrollArea>

            {/* 状态栏 */}
            <div className="shrink-0 px-4 py-2 border-t bg-muted/30 flex items-center justify-between text-[10px] text-muted-foreground">
                <div className="flex items-center gap-4">
                    <span className="flex items-center gap-1">
                        <Info className="w-3 h-3" />
                        {t('Manager.TranslationManager.Stats.Total')}: {allSources.length}
                    </span>
                    {selectedIds.size > 0 && (
                        <span className="text-primary font-medium">
                            {t('Manager.TranslationManager.Stats.Selected')}: {selectedIds.size}
                        </span>
                    )}
                </div>
                <div className="flex items-center gap-2">
                    <span className="px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
                        {t('Manager.TranslationManager.Filters.OriginLocal')}: {allSources.filter(s => s.origin === 'local').length}
                    </span>
                    <span className="px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-600 border border-blue-500/20">
                        {t('Manager.TranslationManager.Filters.OriginCloud')}: {allSources.filter(s => s.origin === 'cloud').length}
                    </span>
                </div>
            </div>
        </div>
    );
};
