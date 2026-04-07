import React, { useEffect, useRef, useState, useMemo, useDeferredValue, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import * as path from 'path';
import * as fs from 'fs-extra';
import { ItemView, WorkspaceLeaf } from 'obsidian';
import { Root } from 'react-dom/client';

import { ThemeTranslationV1, ThemeTranslationSchemaVersion } from 'src/types';
import I18N from "src/main";

import {
    Button, Badge, Input, Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
    ResizablePanelGroup, ResizablePanel, ResizableHandle, ScrollArea
} from '~/shadcn';
import { Save, Loader2, Search, Palette, Plus, Folder, Sparkles } from 'lucide-react';
import { TemplateCard } from '../plugin_editor/components/common/template-card';
import { useThemeTranslation } from './components/use-theme-translation';

import { useGlobalStoreInstance } from '~/utils';
import { mountReactView } from '~/utils';
import { saveTranslationFile } from '@/src/manager/io-manager';
import { t as gt } from 'src/locales';
import { generateTheme } from '@/src/utils';

import { useThemeEditorStore } from './store';
import { ThemeTranslationItem } from './types';
import { ThemeTable } from './components/theme-table';
import { ThemeMetadataCard } from './components/theme-metadata-card';
import { ThemeSidebar } from './components/theme-sidebar';

// ====================================================================================================
// ====================================================================================================
// SaveButton
// ====================================================================================================

const SaveButton: React.FC<{ onSave: () => void; isSaving: boolean }> = React.memo(({ onSave, isSaving }) => {
    const { t } = useTranslation();
    const items = useThemeEditorStore.use.items();
    return (
        <Button
            variant="default"
            size="sm"
            onClick={onSave}
            disabled={isSaving}
            className="shadow-sm hover:shadow-md transition-all active:scale-95 bg-primary hover:bg-primary/90"
        >
            {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            {t('Editor.Actions.Save')}
            <Badge variant="secondary" className="ml-2 bg-primary-foreground/20 text-primary-foreground border-none px-1 h-4">
                {items.length}
            </Badge>
        </Button>
    );
});

// ====================================================================================================
// ReactThemeEditor (主组件)
// ====================================================================================================

type FilterType = 'all' | 'translated' | 'untranslated';

const ReactThemeEditor: React.FC = () => {
    const { t } = useTranslation();
    const i18n = useGlobalStoreInstance.getState().i18n;
    const notice = i18n.notice;

    // 从 GlobalStore 获取主题翻译数据
    const themeTranslation = useGlobalStoreInstance.getState().editorThemeTranslation;
    const themeName = useGlobalStoreInstance.getState().editorThemeName;
    const themeDir = useGlobalStoreInstance.getState().editorThemeDir;
    const translationPath = useGlobalStoreInstance.getState().editorThemeTranslationPath;
    const storeThemeName = useThemeEditorStore.use.themeName();

    // Store setters
    const setItems = useThemeEditorStore.use.setItems();
    const setMetadata = useThemeEditorStore.use.setMetadata();
    const setThemeInfo = useThemeEditorStore.use.setThemeInfo();
    const addItem = useThemeEditorStore.use.addItem();

    // 初始化标记
    const initializedRef = useRef(false);
    const savingRef = useRef(false);
    const [isSaving, setIsSaving] = useState(false);


    // 搜索和筛选
    const [searchQuery, setSearchQuery] = useState('');
    const [filterType, setFilterType] = useState<FilterType>('all');
    const deferredSearchQuery = useDeferredValue(searchQuery);
    const deferredFilterType = useDeferredValue(filterType);

    const [editingId, setEditingId] = useState<number | null>(null);

    // 计算已应用状态
    const isApplied = useMemo(() => {
        if (!storeThemeName || !i18n?.stateManager) return false;
        return !!i18n.stateManager.getThemeState(storeThemeName)?.isApplied;
    }, [storeThemeName, i18n?.stateManager, isSaving]);

    // 初始化数据x
    useEffect(() => {
        if (initializedRef.current) return;

        if (themeTranslation?.dict && Array.isArray(themeTranslation.dict)) {
            // 给读取进来的数据补上缺失的内部 id (自增索引)，编辑器渲染要求 id
            const items = themeTranslation.dict.map((item, index) => ({
                id: (item.id !== undefined) ? item.id : index,
                type: item.type || 'unknown',
                source: item.source,
                target: item.target
            }));
            setItems(items);
        }

        if (themeTranslation?.metadata) {
            setMetadata(themeTranslation.metadata);
        } else if ((themeTranslation as any)?.manifest) {
            // 兼容旧版格式迁移
            const oldManifest = (themeTranslation as any).manifest;
            setMetadata({
                theme: themeName || '',
                language: 'zh-cn',
                version: '1.0.0',
                supportedVersions: oldManifest.pluginVersion || '0.0.0',
                title: themeName || '',
                description: '',
                author: ''
            });
        }

        if (themeName) {
            setThemeInfo(themeName, themeDir || '', translationPath || '');
        }

        initializedRef.current = true;
    }, [themeTranslation, themeName, themeDir, translationPath, setItems, setMetadata, setThemeInfo]);

    // 获取 store 数据
    const items = useThemeEditorStore.use.items();
    const metadata = useThemeEditorStore.use.metadata();

    // 过滤逻辑
    const filteredItems = useMemo(() => {
        let result = items;

        if (deferredFilterType === 'translated') {
            result = result.filter(item => item.target && item.target !== item.source);
        } else if (deferredFilterType === 'untranslated') {
            result = result.filter(item => !item.target || item.target === item.source);
        }

        if (deferredSearchQuery.trim()) {
            const query = deferredSearchQuery.toLowerCase();
            result = result.filter(item =>
                (item.source && item.source.toLowerCase().includes(query)) ||
                (item.target && item.target.toLowerCase().includes(query))
            );
        }

        return result;
    }, [items, deferredSearchQuery, deferredFilterType]);

    // 保存
    const save = useCallback(async () => {
        if (savingRef.current) return;
        savingRef.current = true;
        setIsSaving(true);
        try {
            const { items, metadata, translationPath } = useThemeEditorStore.getState();
            const globalState = useGlobalStoreInstance.getState();
            const i18n = globalState.i18n;

            // 由于现在需要保存为结构化的数组，我们可以剔除掉内部使用的自增 id 后直接保存
            const cleanDict = items.map(item => ({
                type: item.type || 'unknown',
                source: item.source,
                target: item.target
            }));

            const themeJson: ThemeTranslationV1 = {
                schemaVersion: ThemeTranslationSchemaVersion.V1,
                metadata: metadata || {
                    theme: themeName || '',
                    language: 'zh-cn',
                    version: '1.0.0',
                    supportedVersions: '0.0.0',
                    title: themeName || '',
                    description: '',
                    author: ''
                },
                dict: cleanDict,
            };

            if (translationPath) {
                saveTranslationFile(translationPath, themeJson);
                // 更新 GlobalStore 中的缓存
                useGlobalStoreInstance.setState({ editorThemeTranslation: themeJson });

                // 同步更新 meta.json (SourceManager)
                if (i18n?.sourceManager) {
                    try {
                        const ext = path.extname(translationPath);
                        const baseName = path.basename(translationPath, ext);
                        const source = i18n.sourceManager.getSource(baseName);
                        if (source) {
                            if (source.origin === 'cloud') {
                                source.origin = 'local';
                                source.cloud = undefined;
                            }
                            i18n.sourceManager.saveSource(source);
                        }
                    } catch (err) {
                        console.error("Failed to update meta.json", err);
                    }
                }

                notice.successPrefix(t('Editor.Titles.Main'), t('Common.Notices.SaveSuccess'));
            } else {
                notice.errorPrefix(t('Editor.Titles.Main'), t('Editor.Errors.SavePathMissing'));
            }
        } catch (e) {
            notice.errorPrefix(t('Editor.Titles.Main'), t('Common.Notices.SaveFail'), e);
        } finally {
            savingRef.current = false;
            setIsSaving(false);
        }
    }, [notice, t, themeName]);

    // 增量提取
    const incrementalExtract = useCallback(async () => {
        try {
            const { themeName, themeDir } = useThemeEditorStore.getState();

            // 安全检查：如果已应用，禁止增量提取
            const isApplied = !!i18n.stateManager.getThemeState(themeName)?.isApplied;
            if (isApplied) {
                notice.error(t('Editor.Actions.IncrementalExtractDisabledTip'));
                return;
            }

            const themeCssPath = path.join(themeDir, 'theme.css');

            if (!fs.existsSync(themeCssPath)) {
                notice.error(t('Editor.Errors.FileNotFound') + ': theme.css');
                return;
            }

            const cssStr = fs.readFileSync(themeCssPath).toString();
            const manifestPath = path.join(themeDir, 'manifest.json');
            let manifest = { name: themeName, version: '0.0.0', minAppVersion: '', author: '', authorUrl: '' };
            if (fs.existsSync(manifestPath)) {
                try { manifest = fs.readJsonSync(manifestPath); } catch (e) { /* use default */ }
            }

            const extracted = generateTheme(manifest, cssStr, i18n.settings);
            const currentItems = useThemeEditorStore.getState().items;
            const existingSources = new Set(currentItems.map(item => item.source));

            // 合并新条目 (extracted.dict 已经是结构化数组)
            let nextId = currentItems.length > 0 ? Math.max(...currentItems.map(i => i.id)) + 1 : 0;
            const newItems: ThemeTranslationItem[] = [];

            for (const extractedItem of extracted.dict) {
                if (!existingSources.has(extractedItem.source)) {
                    newItems.push({
                        id: nextId++,
                        type: extractedItem.type,
                        source: extractedItem.source,
                        target: extractedItem.target
                    });
                }
            }

            if (newItems.length > 0) {
                useThemeEditorStore.setState((state) => ({
                    items: [...state.items, ...newItems]
                }));
                notice.success(t('Editor.Hints.ExtractSummary', { count: newItems.length }));
            } else {
                notice.success(t('Editor.Hints.NoNewItems'));
            }
        } catch (e) {
            notice.error(t('Editor.Actions.IncrementalExtract') + ' ' + t('Common.Status.Failure') + ': ' + e);
        }
    }, [notice, t, i18n.settings]);



    // ================================================== Open File ==================================================
    const handleOpenFile = useCallback(async () => {
        try {
            const { themeDir } = useThemeEditorStore.getState();
            const themeCssPath = path.join(themeDir, 'theme.css');

            if (!fs.existsSync(themeCssPath)) {
                notice.error(t('Common.Notices.ThemeNotFound'));
                return;
            }

            const { i18nOpen } = await import('~/utils/common/general');
            i18nOpen(i18n, themeCssPath);
        } catch (e) {
            notice.error(t('Editor.Actions.OpenFile') + ' ' + t('Common.Status.Failure') + ': ' + e);
        }
    }, [i18n, notice, t]);



    // 快捷键: Ctrl + S 保存
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if ((e.ctrlKey || e.metaKey) && (e.key === 's' || e.key === 'S' || e.code === 'KeyS')) {
                e.preventDefault();
                e.stopPropagation();
                save();
            }
        };

        window.addEventListener('keydown', handleKeyDown, true);
        return () => {
            window.removeEventListener('keydown', handleKeyDown, true);
        };
    }, [save]);

    // ================================================== Render ==================================================
    return (
        <div className="h-full flex flex-col gap-0 bg-background/50 backdrop-blur-md">
            <ResizablePanelGroup direction="horizontal" className="h-full border-none">
                {/* 左侧栏：主题信息 */}
                <ResizablePanel defaultSize={20} minSize={10} maxSize={30} className="h-full">
                    <div className="flex flex-col h-full py-2 pl-2 pr-1">
                        <div className="flex flex-col h-full flex-1 min-h-0 rounded-lg border">
                            {/* 固定标题栏 */}
                            <div className="flex items-center gap-2 px-3 py-2 border-b shrink-0 min-h-[36px]">
                                <Folder className="w-4 h-4 text-primary shrink-0" />
                                <span className="text-sm font-semibold truncate">{storeThemeName || t('Common.Labels.Themes')}</span>
                            </div>
                            <div className="flex flex-col w-full flex-1 min-h-0 p-2">
                                <ScrollArea className="flex-1 min-h-0 pr-3 -mr-3">
                                    <div className="space-y-3 pb-2">
                                        {/* 文件列表卡片 */}
                                        <TemplateCard title={t('Editor.Titles.Main')} icon={Folder}>
                                            <div className="flex flex-col gap-2.5">
                                                <SaveButton onSave={save} isSaving={isSaving} />

                                                <Badge variant="outline" className="w-full justify-center bg-background/50 border-primary/20 text-primary font-normal truncate text-xs h-8">
                                                    {storeThemeName || t('Common.Labels.Themes')}
                                                </Badge>
                                            </div>
                                        </TemplateCard>

                                        {/* 元信息卡片 */}
                                        <ThemeMetadataCard />
                                    </div>
                                </ScrollArea>
                            </div>
                        </div>
                    </div>
                </ResizablePanel>

                <ResizableHandle withHandle />

                {/* 中间：主内容编辑器区 */}
                <ResizablePanel defaultSize={60} minSize={30} className="h-full">
                    <main className="w-full h-full flex flex-col px-1 overflow-hidden bg-background/20">
                        {/* 搜索/筛选工具栏 */}
                        <div className="flex items-center justify-between p-2 gap-2 shrink-0">
                            <div className="flex items-center gap-2">
                                <div className="relative">
                                    <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                                    <Input
                                        className="h-8 w-64 pl-8"
                                        placeholder={t('Common.Placeholders.Search')}
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                    />
                                </div>
                                <Select value={filterType} onValueChange={(v) => setFilterType(v as FilterType)}>
                                    <SelectTrigger size="sm" className="w-[100px]">
                                        <SelectValue placeholder={t('Common.Filters.All')} />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">{t('Common.Filters.All')}</SelectItem>
                                        <SelectItem value="translated">{t('Common.Filters.Translated')}</SelectItem>
                                        <SelectItem value="untranslated">{t('Common.Filters.Untranslated')}</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        {/* 表格内容区域 */}
                        <div className="flex-1 min-h-0 overflow-hidden p-2 pt-0">
                            <ThemeTable data={filteredItems} editingId={editingId} onEditingIdChange={setEditingId} />
                        </div>
                    </main>
                </ResizablePanel>

                <ResizableHandle withHandle />

                {/* 右侧：操作面板 */}
                <ResizablePanel defaultSize={20} minSize={10} maxSize={30} className="h-full">
                    <div className="flex flex-col h-full py-2 pr-2 pl-1">
                        <div className="flex flex-col h-full flex-1 min-h-0 rounded-lg border">
                            <ThemeSidebar
                                onIncrementalExtract={incrementalExtract}
                                onOpenFile={handleOpenFile}
                                isApplied={isApplied}
                            />
                        </div>
                    </div>
                </ResizablePanel>
            </ResizablePanelGroup>


        </div>
    );
};

// ====================================================================================================
// EditorView (Obsidian ItemView)
// ====================================================================================================

export const THEME_EDITOR_VIEW_TYPE = 'theme-editor-view-type';

export class ThemeEditorView extends ItemView {
    root: Root | null = null;
    i18n: I18N;
    shadowRoot: ShadowRoot | null = null;
    leftCollapsed: boolean = false;
    rightCollapsed: boolean = false;

    constructor(leaf: WorkspaceLeaf, i18n: I18N) {
        super(leaf);
        this.i18n = i18n;
    }

    getViewType() {
        return THEME_EDITOR_VIEW_TYPE;
    }

    getDisplayText() {
        return gt('Editor.Titles.Main');
    }

    getIcon() {
        return "palette";
    }

    async onOpen() {
        // 保存当前侧边栏状态
        // @ts-ignore
        this.leftCollapsed = this.app.workspace.leftSplit.collapsed;
        // @ts-ignore
        this.rightCollapsed = this.app.workspace.rightSplit.collapsed;

        // 自动折叠侧边栏
        // @ts-ignore
        this.app.workspace.leftSplit.collapse();
        // @ts-ignore
        this.app.workspace.rightSplit.collapse();

        const { root, shadowRoot } = mountReactView(
            this.contentEl,
            this.i18n,
            React.createElement(ReactThemeEditor)
        );
        this.root = root;
        this.shadowRoot = shadowRoot;
    }

    async onClose() {
        // 恢复侧边栏状态
        if (!this.leftCollapsed) {
            // @ts-ignore
            this.app.workspace.leftSplit.expand();
        }
        if (!this.rightCollapsed) {
            // @ts-ignore
            this.app.workspace.rightSplit.expand();
        }

        this.root?.unmount();
        this.shadowRoot?.empty();
    }
}
