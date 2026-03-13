import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import * as path from 'path';
import * as fs from 'fs-extra';
import { useTranslation } from 'react-i18next';
import { useVirtualizer } from '@tanstack/react-virtual';
import { FolderOpen, FileOutput, Search, LayoutGrid, List, Loader2, MoreHorizontal, XCircle, Pen } from 'lucide-react';

import I18N from 'src/main';
import { OBThemeManifest, ThemeTranslationV1 } from 'src/types';
import { useGlobalStoreInstance } from '~/utils';
import { THEME_EDITOR_VIEW_TYPE } from '../theme_editor/editor';
import { loadTranslationFile } from '../../manager/io-manager';

import {
    Button,
    Input,
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
    Badge,
    ScrollArea,
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
    Card,
    Separator,
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
    DropdownMenuSeparator,
} from '~/shadcn';
import { cn } from '~/shadcn/lib/utils';

interface ThemeManagerProps {
    i18n: I18N;
}

// 内部主题信息结构
interface ThemeInfo {
    name: string;
    manifest: OBThemeManifest | null;
    dir: string;
    isActive: boolean;
}

import { ThemeItem, ThemeItemData } from './components/theme-item';

export const ThemeManager: React.FC<ThemeManagerProps> = ({ i18n }) => {
    const { t } = useTranslation();
    const app = i18n.app;

    const [searchTerm, setSearchTerm] = useState('');
    const [sortType, setSortType] = useState('0');
    const [viewMode, setViewModeState] = useState<'list' | 'grid'>(i18n.settings.themeViewMode || 'list');

    const setViewMode = useCallback((mode: 'list' | 'grid') => {
        setViewModeState(mode);
        i18n.settings.themeViewMode = mode;
        i18n.saveSettings();
    }, [i18n]);

    const [themes, setThemes] = useState<ThemeInfo[]>([]);
    const [refreshKey, setRefreshKey] = useState(0);

    const [statusFilter, setStatusFilter] = useState<'all' | 'applied' | 'unapplied' | 'translated' | 'untranslated' | 'toExtract'>('all');

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
        const loadThemes = () => {
            try {
                // @ts-ignore - Obsidian internal API
                const basePath = path.normalize(app.vault.adapter.getBasePath());
                const themesDir = path.join(basePath, '.obsidian', 'themes');

                if (!fs.existsSync(themesDir)) {
                    setThemes([]);
                    return;
                }

                const entries = fs.readdirSync(themesDir, { withFileTypes: true });
                const themeList: ThemeInfo[] = [];

                // @ts-ignore
                const currentTheme = app.customCss?.theme || '';

                for (const entry of entries) {
                    if (!entry.isDirectory()) continue;
                    const themeDir = path.join(themesDir, entry.name);
                    const manifestPath = path.join(themeDir, 'manifest.json');

                    let manifest: OBThemeManifest | null = null;
                    if (fs.existsSync(manifestPath)) {
                        try {
                            manifest = fs.readJsonSync(manifestPath);
                        } catch (e) {
                            // skip invalid manifests
                        }
                    }

                    themeList.push({
                        name: entry.name,
                        manifest,
                        dir: themeDir,
                        isActive: entry.name === currentTheme,
                    });
                }

                setThemes(themeList);
            } catch (error) {
                console.error('[i18n] Failed to load themes:', error);
                setThemes([]);
            }
        };

        loadThemes();
    }, [app, refreshKey]);

    // --- 性能优化：预计算所有主题状态，避免在渲染路径中进行 I/O ---
    const checkIsTranslated = useCallback((json: ThemeTranslationV1) => {
        if (!json.dict) return false;
        return json.dict.some(item => item.target && item.target !== item.source);
    }, []);

    const allThemeStates = useMemo(() => {
        const stats: Record<string, ThemeItemData> = {};
        for (const theme of themes) {
            const themeDir = theme.dir;
            const themeCssPath = path.join(themeDir, 'theme.css');
            const sourceManager = i18n.sourceManager;

            const sources = sourceManager?.getSourcesForPlugin(theme.name) || [];
            const activeSourceId = sourceManager?.getActiveSourceId(theme.name);
            const translationPath = activeSourceId ? sourceManager?.getSourceFilePath(activeSourceId) : '';
            const hasTranslation = translationPath ? fs.existsSync(translationPath) : false;

            const state = i18n.stateManager.getThemeState(theme.name);

            let isTranslated = false;
            if (hasTranslation && translationPath) {
                try {
                    const localJson = loadTranslationFile(translationPath);
                    isTranslated = checkIsTranslated(localJson);
                } catch (e) {
                    // skip error
                }
            }

            let statusColor: string = "bg-muted-foreground";
            let statusText: string = t('Manager.Status.ToExtract');
            let statusDesc: string = t('Manager.Hints.NoTransDesc');

            const isApplied = !!(state && state.isApplied);

            if (isApplied) {
                statusColor = "bg-green-500 dark:bg-green-600";
                statusText = t('Manager.Status.Applied');
            } else if (isTranslated) {
                statusColor = "bg-blue-500 dark:bg-blue-600";
                statusText = t('Manager.Status.Unapplied');
            } else if (hasTranslation) {
                statusColor = "bg-amber-500 dark:bg-amber-600";
                statusText = t('Manager.Status.Untranslated');
            } else {
                statusColor = "bg-muted-foreground";
                statusText = t('Manager.Status.ToExtract');
            }
            statusDesc = theme.manifest ? `v${theme.manifest.version}` : '';

            stats[theme.name] = {
                statusColor, statusText, statusDesc,
                hasTranslation, translationPath: translationPath || '',
                themeDir, themeCssPath,
                sources, activeSourceId,
                isApplied,
                isTranslated
            };
        }
        return stats;
    }, [themes, i18n, refreshKey, sourceTick, t, checkIsTranslated]);

    const displayThemes = useMemo(() => {
        let result = [...themes];
        if (searchTerm) {
            result = result.filter(item => item.name.toLowerCase().includes(searchTerm.toLowerCase()));
        }

        if (statusFilter !== 'all') {
            result = result.filter(theme => {
                const data = allThemeStates[theme.name];
                if (!data) return false;

                switch (statusFilter) {
                    case 'applied': return data.isApplied;
                    case 'unapplied': return data.isTranslated && !data.isApplied;
                    case 'translated': return data.isTranslated;
                    case 'untranslated': return data.hasTranslation && !data.isTranslated;
                    case 'toExtract': return !data.hasTranslation;
                    default: return true;
                }
            });
        }

        if (sortType === '0') {
            result.sort((a, b) => a.name.localeCompare(b.name));
        } else if (sortType === '1') {
            result.sort((a, b) => b.name.localeCompare(a.name));
        }
        return result;
    }, [themes, searchTerm, sortType, statusFilter, allThemeStates]);

    const handleRefresh = useCallback(() => {
        setRefreshKey(k => k + 1);
    }, []);

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
        const count = Math.floor((containerWidth + 8) / (250 + 8));
        return Math.max(1, count);
    }, [viewMode, containerWidth]);

    const rowCount = Math.ceil(displayThemes.length / columns);

    const rowVirtualizer = useVirtualizer({
        count: rowCount,
        getScrollElement: () => parentRef.current,
        estimateSize: useCallback(() => viewMode === 'list' ? 50 + 8 : 158 + 8, [viewMode]), // 列表项约50px+8px间距，网格项约150px+16px间距总和
        overscan: 5,
    });

    const virtualItems = rowVirtualizer.getVirtualItems();
    // --- 虚拟化逻辑结束 ---

    return (
        <div className="flex flex-col h-full bg-background text-foreground overflow-hidden">
            <div className="flex flex-col gap-4 py-2 px-4 border-b shrink-0">
                <div className="flex gap-2">
                    <div className="relative flex-1">
                        <Search className="absolute left-2 top-2 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder={t('Manager.Placeholders.SearchThemes')}
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="pl-8 h-8"
                        />
                    </div>

                    <div className="flex items-center gap-1 border rounded-md p-0.5">
                        <Button
                            variant={viewMode === 'list' ? 'secondary' : 'ghost'}
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => setViewMode('list')}
                        >
                            <List className="h-4 w-4" />
                        </Button>
                        <Button
                            variant={viewMode === 'grid' ? 'secondary' : 'ghost'}
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => setViewMode('grid')}
                        >
                            <LayoutGrid className="h-4 w-4" />
                        </Button>
                    </div>

                    <Select value={statusFilter} onValueChange={(val: any) => setStatusFilter(val)}>
                        <SelectTrigger className="w-[120px]" size="sm">
                            <SelectValue placeholder={t('Manager.Filters.All')} />
                        </SelectTrigger>
                        <SelectContent>
                            {filterOptions.map((opt) => (
                                <SelectItem key={opt.key} value={opt.key}>{opt.label}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>

                    <Select value={sortType} onValueChange={setSortType}>
                        <SelectTrigger className="w-[120px]" size="sm">
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
                <div className="p-4">
                    <div
                        className={cn(
                            "gap-2 w-full overflow-hidden relative",
                            viewMode === 'grid' ? "grid grid-cols-[repeat(auto-fill,minmax(250px,1fr))]" : "flex flex-col"
                        )}
                        style={{
                            height: `${rowVirtualizer.getTotalSize()}px`,
                        }}
                    >
                        {virtualItems.map((virtualRow) => {
                            const startIndex = virtualRow.index * columns;
                            const itemsInRow = displayThemes.slice(startIndex, startIndex + columns);

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
                                        gap: '8px',
                                        paddingBottom: '8px',
                                    }}
                                >
                                    {itemsInRow.map((theme) => (
                                        <ThemeItem
                                            key={theme.name}
                                            theme={theme}
                                            i18n={i18n}
                                            data={allThemeStates[theme.name]}
                                            refreshParent={handleRefresh}
                                            viewMode={viewMode}
                                        />
                                    ))}
                                </div>
                            );
                        })}
                        {displayThemes.length === 0 && (
                            <div className="text-center text-muted-foreground py-8 col-span-full">
                                {t('Manager.Status.NoThemes')}
                            </div>
                        )}
                    </div>
                </div>
            </ScrollArea>
        </div>
    );
};

