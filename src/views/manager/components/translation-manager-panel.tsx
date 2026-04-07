import React, { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
    Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
    Input, Button, Checkbox, Badge, ScrollArea,
    DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger
} from '~/shadcn';
import { cn } from '~/shadcn/lib/utils';
import { Search, Download, Upload, Trash2, MoreVertical, FileJson, Globe, HardDrive, Filter, Info, Puzzle, Palette, AlertCircle, Pen, FolderOpen, MoreHorizontal, CheckSquare } from 'lucide-react';
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

        sources = sources.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));

        // @ts-ignore - internal API
        const basePath = path.normalize(i18n.app.vault.adapter.getBasePath());

        return sources.map(s => {
            let isInstalled = false;
            if (s.type === 'plugin') {
                isInstalled = !!i18n.app.plugins.manifests[s.plugin];
            } else {
                isInstalled = fs.existsSync(path.join(basePath, '.obsidian', 'themes', s.plugin));
            }
            return { ...s, isInstalled };
        });
    }, [i18n, searchQuery, originFilter, typeFilter, sourceTick, i18n.app.plugins.manifests]);

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

    const handleSelectUninstalled = () => {
        const next = new Set(selectedIds);
        let changed = false;
        allSources.forEach(s => {
            if (!s.isInstalled && !next.has(s.id)) {
                next.add(s.id);
                changed = true;
            }
        });
        if (changed) setSelectedIds(next);
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

            new Notice(t('Manager.Sources.Actions.ExportSuccess'));
        } catch (error) {
            console.error('Export failed:', error);
            new Notice(t('Manager.Common.Errors.Error'));
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
                            new Notice(msg.trim() || t('Manager.Sources.Actions.ImportSuccess', { count: addedCount + updatedCount }));
                            // 刷新列表
                            useGlobalStoreInstance.getState().triggerSourceUpdate();
                        } else if (skippedCount > 0) {
                            new Notice(`全部 ${skippedCount} 项已存在且内容一致，无需导入`);
                        } else {
                            new Notice(t('Manager.Common.Errors.ErrorDesc'));
                        }
                    } catch (err) {
                        console.error('Import processing failed:', err);
                        new Notice(t('Manager.Common.Errors.Error'));
                    }
                };
                reader.readAsArrayBuffer(file);
            } catch (error) {
                new Notice(t('Manager.Common.Errors.Error'));
            }
        };
        input.click();
    };

    // 批量删除
    const handleBatchDelete = async () => {
        if (selectedIds.size === 0) return;

        const confirmed = window.confirm(t('Manager.Sources.Actions.DeleteConfirm', { count: selectedIds.size }));
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
            new Notice(t('Manager.Common.Errors.Error'));
        }
    };

    return (
        <div className="flex flex-col flex-1 min-h-0 bg-background">
            {/* 顶栏控制区 */}
            <div className="flex flex-col gap-4 py-2 px-4 border-b shrink-0">
                <div className="flex items-center gap-2 flex-wrap">


                    <div className="relative flex-1 min-w-[200px]">
                        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground/70" />
                        <Input
                            className="pl-8 h-9 rounded-none border-muted-foreground/20 focus:ring-1 text-[13px] bg-muted/10 shadow-sm transition-colors hover:bg-muted/20"
                            placeholder={t('Manager.Sources.Filters.SearchPlaceholder')}
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>

                    <div className="flex items-center gap-2">
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="outline" size="sm" className="h-9 shadow-sm gap-1.5 rounded-none border-muted-foreground/20 text-[13px] hover:bg-muted/30">
                                    <Filter className="w-3.5 h-3.5 text-muted-foreground/70" />
                                    {originFilter === 'all' ? t('Manager.Common.Filters.All') :
                                        originFilter === 'local' ? t('Manager.Sources.Filters.OriginLocal') :
                                            t('Manager.Sources.Filters.OriginCloud')}
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-40 rounded-none">
                                <DropdownMenuItem onClick={() => setOriginFilter('all')}>{t('Manager.Common.Filters.All')}</DropdownMenuItem>
                                <DropdownMenuItem onClick={() => setOriginFilter('local')}>{t('Manager.Sources.Filters.OriginLocal')}</DropdownMenuItem>
                                <DropdownMenuItem onClick={() => setOriginFilter('cloud')}>{t('Manager.Sources.Filters.OriginCloud')}</DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>

                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="outline" size="sm" className="h-9 shadow-sm gap-1.5 rounded-none border-muted-foreground/20 text-[13px] hover:bg-muted/30">
                                    <Filter className="w-3.5 h-3.5 text-muted-foreground/70" />
                                    {typeFilter === 'all' ? t('Manager.Common.Filters.All') :
                                        typeFilter === 'plugin' ? t('Common.Labels.Plugins') :
                                            t('Common.Labels.Themes')}
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-40 rounded-none">
                                <DropdownMenuItem onClick={() => setTypeFilter('all')}>{t('Manager.Common.Filters.All')}</DropdownMenuItem>
                                <DropdownMenuItem onClick={() => setTypeFilter('plugin')}>{t('Common.Labels.Plugins')}</DropdownMenuItem>
                                <DropdownMenuItem onClick={() => setTypeFilter('theme')}>{t('Common.Labels.Themes')}</DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>

                    <div className="flex items-center ml-auto gap-3">
                        {/* 选取组 */}
                        <div className="flex items-center rounded-none border border-muted-foreground/20 bg-background shadow-sm h-9">
                            <Button variant="ghost" size="sm" onClick={toggleSelectAll} className="gap-1.5 h-9 rounded-none px-3 border-r border-muted-foreground/20 hover:bg-muted/50">
                                <CheckSquare className={cn("w-4 h-4", allSources.length > 0 && selectedIds.size === allSources.length ? "text-primary" : "text-muted-foreground/70")} />
                                <span className={cn("hidden lg:inline text-[13px]", allSources.length > 0 && selectedIds.size === allSources.length ? "text-primary" : "text-muted-foreground/90")}>{t('Manager.Sources.Actions.SelectAll')}</span>
                            </Button>
                            <Button variant="ghost" size="sm" onClick={handleSelectUninstalled} className="gap-1.5 h-9 rounded-none px-3 hover:bg-destructive/10 hover:text-destructive group" title={t('Manager.Sources.Actions.SelectUninstalled')}>
                                <AlertCircle className="w-4 h-4 text-destructive/80 group-hover:text-destructive" />
                                <span className="hidden lg:inline text-[13px] text-destructive/90 group-hover:text-destructive">{t('Manager.Sources.Actions.SelectUninstalled')}</span>
                            </Button>
                        </div>

                        {/* 数据组 */}
                        <div className="flex items-center rounded-none border border-muted-foreground/20 bg-background shadow-sm h-9">
                            <Button variant="ghost" size="sm" onClick={handleImport} className="gap-1.5 h-9 rounded-none px-3 border-r border-muted-foreground/20 hover:bg-primary/5 hover:text-primary group">
                                <Upload className="w-4 h-4 text-muted-foreground/70 group-hover:text-primary" />
                                <span className="text-[13px] text-muted-foreground/90 hidden lg:inline group-hover:text-primary">{t('Manager.Sources.Actions.Import')}</span>
                            </Button>
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={handleBatchExport}
                                disabled={selectedIds.size === 0}
                                className="gap-1.5 h-9 rounded-none px-3 hover:bg-primary/5 hover:text-primary group"
                            >
                                <Download className="w-4 h-4 text-muted-foreground/70 group-hover:text-primary" />
                                <span className="text-[13px] text-muted-foreground/90 hidden lg:inline group-hover:text-primary">{t('Manager.Sources.Actions.Export')}</span>
                            </Button>
                        </div>

                        {/* 删除动作 */}
                        <Button
                            variant="destructive"
                            size="sm"
                            onClick={handleBatchDelete}
                            disabled={selectedIds.size === 0}
                            className="gap-1.5 h-9 rounded-none shadow-sm px-3 text-[13px]"
                        >
                            <Trash2 className="w-4 h-4" />
                            <span className="hidden lg:inline">{t('Manager.Sources.Actions.BatchDelete')}</span>
                        </Button>
                    </div>
                </div>
            </div>

            {/* 内容列表区 */}
            <ScrollArea className="flex-1 min-h-0 bg-background">
                <div className="px-4 py-2 h-full">


                    <div className="flex flex-col pb-6">
                        {allSources.length === 0 ? (
                            <div className="flex flex-col items-center justify-center text-muted-foreground py-24 border border-dashed border-border/50 bg-muted/5 my-4 rounded-none">
                                <FileJson className="w-10 h-10 opacity-30 text-primary mb-4" />
                                <p className="text-sm font-bold text-foreground/70 mb-1">{t('Manager.Plugins.Status.NoTrans')}</p>
                                <p className="text-xs opacity-60">{t('Manager.Common.Placeholders.SearchPlaceholder')}</p>
                            </div>
                        ) : (
                            allSources.map(source => {
                                const isUninstalled = !source.isInstalled;
                                const isCloud = source.origin === 'cloud';

                                // Special color system for Manager (Management / Data layer)
                                let statusColor = "bg-primary";
                                if (isUninstalled) {
                                    statusColor = "bg-destructive";
                                } else if (isCloud) {
                                    statusColor = "bg-indigo-500";
                                } else {
                                    statusColor = "bg-cyan-500";
                                }

                                const statusText = isUninstalled
                                    ? (source.type === 'theme' ? t('Manager.Sources.Status.ThemeNotInstalled') : t('Manager.Sources.Status.NotInstalled'))
                                    : (isCloud ? t('Manager.Sources.Filters.OriginCloud') : t('Manager.Sources.Filters.OriginLocal'));

                                return (
                                    <div key={source.id} className={cn(
                                        "group relative border rounded-none text-card-foreground shadow-xs hover:shadow-md hover:bg-muted/10 transition-all duration-300 px-4 py-1.5 w-full overflow-hidden backdrop-blur-md mb-1",
                                        isUninstalled && "border-dashed border-destructive/50",
                                        selectedIds.has(source.id)
                                            ? "bg-primary/[0.05] border-primary/40 ring-1 ring-primary/20"
                                            : "bg-card/75 hover:bg-muted/20 border-border/50"
                                    )}>
                                        {/* Side Status Accent */}
                                        <div className={cn("absolute left-0 top-0 bottom-0 w-[3px] transition-colors duration-300 z-10 bg-opacity-100", statusColor, isUninstalled && "animate-pulse")} />

                                        <div className="flex items-center gap-4 overflow-hidden min-w-0 relative z-0">
                                            <div className="flex items-center justify-center shrink-0">
                                                <Checkbox
                                                    className={cn("rounded-none transition-opacity", selectedIds.has(source.id) ? "opacity-100" : "opacity-30 group-hover:opacity-100")}
                                                    checked={selectedIds.has(source.id)}
                                                    onCheckedChange={() => toggleSelect(source.id)}
                                                />
                                            </div>

                                            <div className={cn("px-2.5 py-0.5 text-[9px] uppercase tracking-[0.1em] font-extrabold rounded-none bg-background border border-border shadow-xs flex items-center gap-1.5 shrink-0 justify-center", statusColor.replace(/bg-/g, 'text-'))}>
                                                <span className={cn("w-1.5 h-1.5 rounded-full shadow-sm", statusColor, isUninstalled ? "animate-pulse" : "")}></span>
                                                {statusText}
                                            </div>

                                            <div className="flex items-center gap-2.5 min-w-0 flex-1">
                                                <span className="font-bold truncate text-[13.5px] text-foreground/90 group-hover:text-primary transition-colors duration-300 shrink-0 max-w-[50%]" title={source.title}>
                                                    {source.title}
                                                </span>
                                                <span className="text-[10px] text-muted-foreground/50 font-mono truncate bg-muted/20 px-1.5 py-0.5 rounded-none max-w-[30%] border border-border/30 relative" title={source.plugin}>
                                                    {source.plugin}
                                                </span>
                                                {source.type === 'theme' ? (
                                                    <Badge variant="secondary" className="bg-orange-500/10 text-orange-600 hover:bg-orange-500/15 border border-orange-500/20 text-[9px] px-1.5 py-0 h-[18px] font-medium shrink-0 rounded-none">
                                                        {t('Common.Labels.Themes')}
                                                    </Badge>
                                                ) : (
                                                    <Badge variant="secondary" className="bg-purple-500/10 text-purple-600 hover:bg-purple-500/15 border border-purple-500/20 text-[9px] px-1.5 py-0 h-[18px] font-medium shrink-0 rounded-none">
                                                        {t('Common.Labels.Plugins')}
                                                    </Badge>
                                                )}
                                            </div>

                                            <div className="hidden md:flex flex-col items-end justify-center px-4 shrink-0 min-w-[120px] tabular-nums">
                                                <span className="text-[11px] font-bold text-muted-foreground/80 group-hover:text-foreground/80 transition-colors">
                                                    {formatDate(source.updatedAt).split(' ')[0]}
                                                </span>
                                                <span className="text-[9px] text-muted-foreground/50">
                                                    {formatDate(source.updatedAt).split(' ')[1]}
                                                </span>
                                            </div>

                                            <div className="shrink-0 flex items-center justify-end">
                                                <DropdownMenu>
                                                    <DropdownMenuTrigger asChild>
                                                        <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground/50 hover:text-foreground hover:bg-muted/50 rounded-none transition-all">
                                                            <MoreHorizontal className="w-4 h-4" />
                                                        </Button>
                                                    </DropdownMenuTrigger>
                                                    <DropdownMenuContent align="end" className="w-[180px] rounded-none p-1 shadow-2xl backdrop-blur-md bg-background/95 border-border/40">
                                                        <DropdownMenuItem className="text-[12px] rounded-none cursor-pointer py-2" onClick={() => {
                                                            const filePath = sourceManager.getSourceFilePath(source.id);
                                                            const pluginTranslationV1 = loadTranslationFile(filePath);
                                                            useGlobalStoreInstance.getState().setEditorPluginTranslation(pluginTranslationV1);
                                                            useGlobalStoreInstance.getState().setEditorPluginTranslationPath(filePath);
                                                            i18n.view.activateView(EDITOR_VIEW_TYPE);
                                                        }}>
                                                            <Pen className="w-3.5 h-3.5 mr-2.5 text-primary/70" />
                                                            {t('Manager.Common.Actions.Edit')}
                                                        </DropdownMenuItem>
                                                        <DropdownMenuItem className="text-[12px] rounded-none cursor-pointer py-2" onClick={() => {
                                                            const filePath = sourceManager.getSourceFilePath(source.id);
                                                            i18nOpen(i18n, path.dirname(filePath));
                                                        }}>
                                                            <FolderOpen className="w-3.5 h-3.5 mr-2.5 text-amber-500/70" />
                                                            {t('Manager.Common.Actions.OpenFolder')}
                                                        </DropdownMenuItem>
                                                        <div className="h-px bg-border/40 my-1 mx-1" />
                                                        <DropdownMenuItem className="text-[12px] text-destructive focus:text-destructive focus:bg-destructive/10 rounded-none cursor-pointer py-2" onClick={() => {
                                                            sourceManager.removeSource(source.id);
                                                            new Notice(t('Common.Notices.DeleteSuccess'));
                                                            useGlobalStoreInstance.getState().triggerSourceUpdate();
                                                        }}>
                                                            <Trash2 className="w-3.5 h-3.5 mr-2.5 opacity-70" />
                                                            {t('Manager.Common.Actions.Delete')}
                                                        </DropdownMenuItem>
                                                    </DropdownMenuContent>
                                                </DropdownMenu>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </div>
                </div>
            </ScrollArea>

            {/* 状态栏 */}
            <div className="shrink-0 px-4 py-2 border-t bg-muted/30 flex items-center justify-between text-[10px] text-muted-foreground">
                <div className="flex items-center gap-4">
                    <span className="flex items-center gap-1">
                        <Info className="w-3 h-3" />
                        {t('Manager.Sources.Stats.Total')}: {allSources.length}
                    </span>
                    {selectedIds.size > 0 && (
                        <span className="text-primary font-medium">
                            {t('Manager.Sources.Stats.Selected')}: {selectedIds.size}
                        </span>
                    )}
                </div>
                <div className="flex items-center gap-2">
                    <span className="px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
                        {t('Manager.Sources.Filters.OriginLocal')}: {allSources.filter(s => s.origin === 'local').length}
                    </span>
                    <span className="px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-600 border border-blue-500/20">
                        {t('Manager.Sources.Filters.OriginCloud')}: {allSources.filter(s => s.origin === 'cloud').length}
                    </span>
                </div>
            </div>
        </div>
    );
};
