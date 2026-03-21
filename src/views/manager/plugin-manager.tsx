import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { PluginManifest, Notice } from 'obsidian';
import * as path from 'path';
import * as fs from 'fs-extra';
import { useTranslation } from 'react-i18next';
import { useVirtualizer } from '@tanstack/react-virtual';
import { Search, LayoutGrid, List } from 'lucide-react';

import I18N from 'src/main';
import { PluginTranslationV1 } from 'src/types';
import { formatTimestamp, isValidPluginTranslationV1Format, i18nOpen } from '../../utils';
import { loadTranslationFile } from '../../manager/io-manager';
import { useGlobalStoreInstance } from '~/utils';

import {
    Button,
    Input,
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
    ScrollArea,
} from '~/shadcn';
import { cn } from '~/shadcn/lib/utils';

interface PluginManagerProps {
    i18n: I18N;
    close: () => void;
}

import { PluginItem, PluginItemData } from './components/plugin-item';

export const PluginManager: React.FC<PluginManagerProps> = ({ i18n, close }) => {
    const { t } = useTranslation();
    const app = i18n.app;
    const settings = i18n.settings;

    const [searchTerm, setSearchTerm] = useState(settings.searchText);
    const [sortType, setSortType] = useState(settings.sort);
    const [viewMode, setViewModeState] = useState<'list' | 'grid'>(settings.pluginViewMode || 'list');

    const setViewMode = useCallback((mode: 'list' | 'grid') => {
        setViewModeState(mode);
        settings.pluginViewMode = mode;
        i18n.saveSettings();
    }, [i18n, settings]);

    const [statusFilter, setStatusFilter] = useState<'all' | 'applied' | 'unapplied' | 'translated' | 'untranslated' | 'toExtract'>('all');
    const [plugins, setPlugins] = useState<PluginManifest[]>([]);
    const [enabledPlugins, setEnabledPlugins] = useState<Set<string>>(new Set());
    const [refreshKey, setRefreshKey] = useState(0);
    const [isReloading, setIsReloading] = useState(false);

    const [cloudManifest, setCloudManifest] = useState<any[]>([]);

    useEffect(() => {
        const repo = settings.defaultCloudRepo;
        if (!repo) {
            setCloudManifest([]);
            return;
        }
        const parts = repo.split('/');
        if (parts.length !== 2) return;
        const [owner, repoName] = parts;

        let isMounted = true;
        i18n.api.github.getFileContentWithFallback(owner, repoName, 'metadata.json')
            .then(res => {
                if (isMounted && res.state && Array.isArray(res.data)) {
                    setCloudManifest(res.data);
                }
            })
            .catch(e => console.error("Failed to fetch default cloud repo:", e));

        return () => { isMounted = false; };
    }, [settings.defaultCloudRepo, i18n]);

    // 监听全局源变?
    const sourceTick = useGlobalStoreInstance((state) => state.sourceUpdateTick);

    const sortOptions = useMemo(() => [
        { key: '0', label: t('Common.Data.SortAsc') },
        { key: '1', label: t('Common.Data.SortDesc') }
    ], [t]);

    const filterOptions = useMemo(() => [
        { key: 'all', label: t('Manager.Filters.All') },
        { key: 'toExtract', label: t('Manager.Filters.ToExtract') },
        { key: 'untranslated', label: t('Manager.Filters.Untranslated') },
        { key: 'translated', label: t('Manager.Filters.Translated') },
        { key: 'unapplied', label: t('Manager.Filters.Unapplied') },
        { key: 'applied', label: t('Manager.Filters.Applied') }
    ], [t]);

    useEffect(() => {
        // @ts-ignore
        const allPlugins = Object.values(app.plugins.manifests) as PluginManifest[];
        const filteredPlugins = allPlugins.filter(item => item.id !== i18n.manifest.id);
        setPlugins(filteredPlugins);
        // @ts-ignore
        setEnabledPlugins(new Set(app.plugins.enabledPlugins));
    }, [app, refreshKey, i18n.manifest.id]);

    // --- 性能优化：预计算所有插件状态，避免在渲染路径中进行 I/O ---
    const checkIsTranslated = useCallback((json: PluginTranslationV1) => {
        if (!json.dict) return false;
        return Object.values(json.dict).some(fileData =>
            fileData.ast.some(item => item.target && item.target !== item.source) ||
            fileData.regex.some(item => item.target && item.target !== item.source)
        );
    }, []);

    const allPluginStates = useMemo(() => {
        const stats: Record<string, PluginItemData> = {};
        // @ts-ignore
        const basePath = path.normalize(i18n.app.vault.adapter.getBasePath());

        for (const plugin of plugins) {
            const pluginDir = path.join(basePath, plugin.dir || '');
            const langDoc = i18n.sourceManager.getTranslationPath(plugin.id, pluginDir);
            const isLangDoc = fs.pathExistsSync(langDoc);
            const manifestDoc = path.join(pluginDir, 'manifest.json');
            const mainDoc = path.join(pluginDir, 'main.js');

            const state = i18n.stateManager.getPluginState(plugin.id);
            const sources = i18n.sourceManager?.getSourcesForPlugin(plugin.id) || [];
            const activeSourceId = i18n.sourceManager?.getActiveSourceId(plugin.id);

            let localJson: PluginTranslationV1 | undefined;
            let translationFormatMark = true;
            let isTranslated = false;
            if (isLangDoc) {
                try {
                    localJson = loadTranslationFile(langDoc);
                    translationFormatMark = isValidPluginTranslationV1Format(localJson);
                    if (translationFormatMark && localJson) {
                        isTranslated = checkIsTranslated(localJson);
                    }
                } catch (e) {
                    translationFormatMark = false;
                }
            }

            let statusColor: string = "bg-muted-foreground";
            let statusText: string = t('Manager.Status.ToExtract');
            let statusDesc: string = t('Manager.Hints.NoTransDesc');
            let mtime: number = 0;
            let translationVersion = '';
            let supportedVersion = '';

            if (localJson && translationFormatMark) {
                translationVersion = localJson.metadata.version;
                supportedVersion = localJson.metadata.supportedVersions;
                mtime = isLangDoc ? fs.statSync(langDoc).mtimeMs : Date.now();

                const isApplied = !!(state && state.isApplied);

                if (isApplied) {
                    statusColor = "bg-green-500 dark:bg-green-600";
                    statusText = t('Manager.Status.Applied');
                } else if (isTranslated) {
                    statusColor = "bg-blue-500 dark:bg-blue-600";
                    statusText = t('Manager.Status.Unapplied');
                } else {
                    statusColor = "bg-amber-500 dark:bg-amber-600";
                    statusText = t('Manager.Status.Untranslated');
                }
                statusDesc = `${t('Manager.Labels.Mtime')}: ${formatTimestamp(mtime)}`;
            } else if (localJson && !translationFormatMark) {
                statusColor = "bg-destructive";
                statusText = t('Manager.Errors.Error');
                statusDesc = t('Manager.Errors.ErrorDesc');
            } else if (!isLangDoc) {
                statusColor = "bg-muted-foreground";
                statusText = t('Manager.Status.ToExtract');
            }

            stats[plugin.id] = {
                statusColor, statusText, statusDesc, isLangDoc, langDoc, pluginDir,
                sources, activeSourceId, translationFormatMark, mainDoc, manifestDoc,
                isApplied: !!(state && state.isApplied),
                isTranslated,
                translationVersion,
                supportedVersion,
                cloudEntries: cloudManifest.filter(entry => entry.plugin === plugin.id && entry.type === 'plugin')
            };
        }
        return stats;
    }, [plugins, i18n, refreshKey, sourceTick, t, checkIsTranslated, cloudManifest]);

    const displayPlugins = useMemo(() => {
        let result = [...plugins];
        if (searchTerm) {
            result = result.filter(item => item.name.toLowerCase().includes(searchTerm.toLowerCase()));
        }

        if (statusFilter !== 'all') {
            result = result.filter(plugin => {
                const data = allPluginStates[plugin.id];
                if (!data) return false;

                switch (statusFilter) {
                    case 'applied':
                        return data.isApplied; // 已应用
                    case 'unapplied':
                        return data.isTranslated && !data.isApplied; // 未应用
                    case 'translated':
                        return data.isTranslated; // 已翻译 (含已应用和未应用)
                    case 'untranslated':
                        return data.isLangDoc && !data.isTranslated; // 未翻译 (有文件无内容)
                    case 'toExtract':
                        return !data.isLangDoc; // 待提取 (无文件)
                    default:
                        return true;
                }
            });
        }

        if (sortType === '0') {
            result.sort((a, b) => a.name.localeCompare(b.name));
        } else if (sortType === '1') {
            result.sort((a, b) => b.name.localeCompare(a.name));
        }
        return result;
    }, [plugins, searchTerm, sortType, statusFilter, allPluginStates]);

    const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value;
        setSearchTerm(val);
        settings.searchText = val;
        i18n.saveSettings();
    };

    const handleSortChange = (val: string) => {
        setSortType(val);
        settings.sort = val;
        i18n.saveSettings();
    };

    // --- 虚拟化逻辑 ---
    const parentRef = useRef<HTMLDivElement>(null);

    // 计算列数
    const [containerWidth, setContainerWidth] = useState(0);
    useEffect(() => {
        if (!parentRef.current) return;
        const resizeObserver = new ResizeObserver((entries) => {
            for (let entry of entries) {
                setContainerWidth(entry.contentRect.width);
            }
        });
        resizeObserver.observe(parentRef.current);
        return () => resizeObserver.disconnect();
    }, []);

    const columns = useMemo(() => {
        if (viewMode === 'list') return 1;
        // 网格模式：minmax(320px, 1fr)，加上 gap 4 (16px)，大致 336px 一个
        const count = Math.floor((containerWidth + 16) / (320 + 16));
        return Math.max(1, count);
    }, [viewMode, containerWidth]);

    const rowCount = Math.ceil(displayPlugins.length / columns);

    const rowVirtualizer = useVirtualizer({
        count: rowCount,
        getScrollElement: () => parentRef.current,
        estimateSize: useCallback(() => viewMode === 'list' ? 44 + 6 : 200 + 12, [viewMode]), // 列表项约44px+6px间距，网格约200px+12px间距总和
        getItemKey: useCallback((index: number) => `${viewMode}-${index}`, [viewMode]),
        overscan: 5,
    });

    const virtualItems = rowVirtualizer.getVirtualItems();
    // --- 虚拟化逻辑结束 ---

    const reloadPlugin = useCallback(async (id: string) => {
        try {
            // @ts-ignore
            if (app.plugins.enabledPlugins.has(id)) {
                // @ts-ignore
                await app.plugins.disablePlugin(id);
                // @ts-ignore
                await app.plugins.enablePlugin(id);
                new Notice(t('Manager.Notices.ReloadPlugin', { id }));
                return true;
            }
            return false;
        } catch (error) {
            new Notice(t('Manager.Errors.ReloadPluginFailed', { error }));
            return false;
        }
    }, [app, t]);

    const handleRefresh = useCallback(() => {
        setRefreshKey(k => k + 1);
    }, []);

    const handleReloadI18n = useCallback(async () => {
        setIsReloading(true);
        try {
            const currentPluginId = i18n.manifest.id;
            // @ts-ignore
            if (app.plugins.enabledPlugins.has(currentPluginId)) {
                // @ts-ignore
                await app.plugins.disablePlugin(currentPluginId);
                // @ts-ignore
                await app.plugins.enablePlugin(currentPluginId);
                new Notice(t('Manager.Notices.ReloadSuccess'));
            } else {
                new Notice(t('Manager.Errors.PluginNotEnabled'));
                setIsReloading(false);
            }
        } catch (error) {
            new Notice(t('Manager.Errors.ReloadFailed', { error }));
            setIsReloading(false);
        }
    }, [app, i18n.manifest.id, t]);

    return (
        <div className="flex flex-col h-full bg-background text-foreground overflow-hidden">
            <div className="flex flex-col gap-4 py-2 px-4 border-b shrink-0">
                <div className="flex gap-2">
                    <div className="relative flex-1">
                        <Search className="absolute left-2 top-2 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder={t('Manager.Placeholders.SearchPlugins')}
                            value={searchTerm}
                            onChange={handleSearchChange}
                            className="pl-8 h-9 rounded-none"
                        />
                    </div>

                    <div className="flex items-center gap-1 border rounded-none p-0.5 h-9 bg-muted/20">
                        <Button variant={viewMode === 'list' ? 'secondary' : 'ghost'} size="icon" className="h-8 w-8 rounded-none transition-all" onClick={() => setViewMode('list')} >
                            <List className="h-4 w-4" />
                        </Button>
                        <Button
                            variant={viewMode === 'grid' ? 'secondary' : 'ghost'}
                            size="icon"
                            className="h-8 w-8 rounded-none transition-all"
                            onClick={() => setViewMode('grid')}
                        >
                            <LayoutGrid className="h-4 w-4" />
                        </Button>
                    </div>

                    <Select value={statusFilter} onValueChange={(val: any) => setStatusFilter(val)}>
                        <SelectTrigger className="w-[120px] h-9 rounded-none" size="default">
                            <SelectValue placeholder={t('Manager.Filters.All')} />
                        </SelectTrigger>
                        <SelectContent>
                            {filterOptions.map((opt) => (
                                <SelectItem key={opt.key} value={opt.key}>{opt.label}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>

                    <Select value={sortType} onValueChange={handleSortChange}>
                        <SelectTrigger className="w-[130px] h-9 rounded-none" size="default">
                            <SelectValue placeholder={t('Common.Data.SortAsc')} />
                        </SelectTrigger>
                        <SelectContent>
                            {sortOptions.map((opt) => (
                                <SelectItem key={opt.key} value={opt.key}>{opt.label}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
            </div>

            <ScrollArea className="flex-1 min-h-0" viewportRef={parentRef}>
                <div className="py-2 px-4">
                    <div className={cn("gap-2 w-full overflow-hidden relative", viewMode === 'grid' ? "grid grid-cols-[repeat(auto-fill,minmax(300px,1fr))]" : "flex flex-col")}
                        style={{ height: `${rowVirtualizer.getTotalSize()}px`, }}   >
                        {virtualItems.map((virtualRow) => {
                            const startIndex = virtualRow.index * columns;
                            const itemsInRow = displayPlugins.slice(startIndex, startIndex + columns);

                            return (
                                <div
                                    key={virtualRow.key}
                                    style={{
                                        position: 'absolute',
                                        top: 0,
                                        left: 0,
                                        width: '100%',
                                        height: `${virtualRow.size}px`,
                                        transform: `translateY(${virtualRow.start}px)`,
                                        display: 'grid',
                                        gridTemplateColumns: `repeat(${columns}, 1fr)`,
                                        gap: viewMode === 'list' ? '0px' : '12px',
                                        paddingBottom: viewMode === 'list' ? '6px' : '12px',
                                    }}
                                >
                                    {itemsInRow.map((plugin) => (
                                        <PluginItem
                                            key={plugin.id}
                                            plugin={plugin}
                                            i18n={i18n}
                                            settings={settings}
                                            isEnabled={enabledPlugins.has(plugin.id)}
                                            data={allPluginStates[plugin.id]}
                                            reloadPlugin={reloadPlugin}
                                            refreshParent={handleRefresh}
                                            close={close}
                                            viewMode={viewMode}
                                        />
                                    ))}
                                </div>
                            );
                        })}
                        {displayPlugins.length === 0 && (
                            <div className="text-center text-muted-foreground py-8 col-span-full">
                                {t('Manager.Status.NoPlugins')}
                            </div>
                        )}
                    </div>
                </div>
            </ScrollArea>
        </div>
    );
};


