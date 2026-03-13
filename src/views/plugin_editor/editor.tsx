import React, { useEffect, useRef, useState } from 'react';
import * as path from 'path';
import * as fs from 'fs-extra';
import { ItemView, WorkspaceLeaf } from 'obsidian';
import { Root } from 'react-dom/client';

import { PluginTranslationV1, PluginTranslationV1Regex } from 'src/types';
import I18N from "src/main";

import { Button, Tabs, TabsContent, TabsList, TabsTrigger, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, Input, Label, DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger, Card, Badge, ResizablePanelGroup, ResizablePanel, ResizableHandle, ScrollArea } from '~/shadcn';
import { Save, Loader2, Plus, Trash2, ChevronDown, Folder, File, Info, Calendar, Hash, ChevronRight } from 'lucide-react';
import { useRegexStore } from './store';

import { EditorProps, DiagnoseError } from './types';
import { RegexEditor, AstEditor } from '.';

import { useGlobalStoreInstance } from '~/utils';
import { AstTranslator, RegexTranslator, mergeAstItems, mergeRegexItems, mountReactView } from '~/utils';
import { calculateChecksum } from '@/src/utils/translator/translation';
import { saveTranslationFile } from '@/src/manager/io-manager';

import { useTranslation } from 'react-i18next';
import { t as gt } from 'src/locales';

import { useAstTranslation } from './components/ast/use-ast-translation';
import { useRegexTranslation } from './components/regex/use-regex-translation';
import { MetadataCard } from './components/common/metadata-card';
import { AstSidebar } from './components/ast/ast-sidebar';
import { RegexSidebar } from './components/regex/regex-sidebar';
import { TemplateCard } from './components/common/template-card';

// ====================================================================================================
// 子组件 & 辅助功能
// ====================================================================================================

const SaveButton: React.FC<{ onSave: () => void; isSaving: boolean }> = React.memo(({ onSave, isSaving }) => {
    const { t } = useTranslation();
    const astItems = useRegexStore.use.astItems();
    const regexItems = useRegexStore.use.regexItems();
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
                {astItems.length + regexItems.length}
            </Badge>
        </Button>
    );
});

/**
 * 自动保存管理器
 * 监听翻译项变化，在停止输入一定时间后触发保存
 */
const AutoSaveManager: React.FC<{ onSave: (silent?: boolean) => void, enabled: boolean }> = ({ onSave, enabled }) => {
    const astItems = useRegexStore.use.astItems();
    const regexItems = useRegexStore.use.regexItems();
    const timerRef = useRef<NodeJS.Timeout | null>(null);
    const firstRenderRef = useRef(true);

    useEffect(() => {
        // 第一次挂载时不触发
        if (firstRenderRef.current) {
            firstRenderRef.current = false;
            return;
        }

        if (!enabled) return;

        // 清除旧定时器
        if (timerRef.current) clearTimeout(timerRef.current);

        // 设置新定时器 (500ms 防抖)
        timerRef.current = setTimeout(() => {
            onSave(true); // 自动保存时静默，不弹出提示
        }, 500);

        return () => {
            if (timerRef.current) clearTimeout(timerRef.current);
        };
    }, [astItems, regexItems, enabled, onSave]);

    return null;
};

// 组件
const ReactEditor: React.FC<EditorProps> = (_) => {
    const i18n = useGlobalStoreInstance.getState().i18n;
    const { t } = useTranslation();
    const logger = i18n.logger;
    const notice = i18n.notice;
    const loggerPrefix = t('Editor.Titles.Main');

    // 插件翻译文件
    const pluginTranslation = useGlobalStoreInstance.getState().editorPluginTranslation;

    // Lifted Translation State (Persists across tab switching)
    const astController = useAstTranslation();
    const regexController = useRegexTranslation();

    // Lifted Sidebar Tab State (Syncs across Views)
    const [activeSidebarTab, setActiveSidebarTab] = React.useState('overview');

    // 只获取 setter 函数（稳定引用），不订阅实际数据
    const setRegexItems = useRegexStore.use.setRegexItems();
    const setAstItems = useRegexStore.use.setAstItems();
    const setMetadata = useRegexStore.use.setMetadata();
    const setDictData = useRegexStore.use.setDictData();
    const setCurrentFile = useRegexStore.use.setCurrentFile();
    const addFile = useRegexStore.use.addFile();
    const deleteFile = useRegexStore.use.deleteFile();

    // 使用 ref 标记是否已初始化，防止 useEffect 重复执行时用原始数据覆盖用户编辑中的内容
    const initializedRef = useRef(false);
    const savingRef = useRef(false);
    const [isSaving, setIsSaving] = useState(false);
    const [isDiagnosing, setIsDiagnosing] = useState(false);
    const [errorItems, setErrorItems] = useState<DiagnoseError[]>([]);
    const [hasChecked, setHasChecked] = useState(false);
    const [activeTab, setActiveTab] = useState('ast');
    const [isAddPathDialogOpen, setIsAddPathDialogOpen] = useState(false);
    const [newPathInput, setNewPathInput] = useState('');

    useEffect(() => {
        // 如果已经初始化过，不再用原始数据覆盖 store
        if (initializedRef.current) return;

        if (pluginTranslation?.dict) {
            useRegexStore.setState({ currentFile: '' });
            setDictData(pluginTranslation.dict);

            const initialFile = pluginTranslation.dict['main.js'] ? 'main.js' : Object.keys(pluginTranslation.dict)[0];
            if (initialFile) {
                setCurrentFile(initialFile);
            }
        }

        // Metadata 数据初始化
        if (pluginTranslation?.metadata) {
            setMetadata(pluginTranslation.metadata);
        }

        initializedRef.current = true;
    }, [pluginTranslation, setDictData, setCurrentFile, setMetadata, logger]);

    // =================================== Function ===================================
    const save = React.useCallback(async (silent = false) => {
        if (savingRef.current) return;
        savingRef.current = true;
        setIsSaving(true);
        try {
            // Direct store access to avoid dependency tracking in useCallback
            const { regexItems, astItems, metadata, currentFile, syncFileDictInfo } = useRegexStore.getState();
            syncFileDictInfo(currentFile, astItems, regexItems);

            const finalDictData = useRegexStore.getState().dictData;

            const globalState = useGlobalStoreInstance.getState();
            const pluginTranslation = globalState.editorPluginTranslation;
            const pluginTranslationPath = globalState.editorPluginTranslationPath;
            const i18n = globalState.i18n;
            const notice = i18n.notice;

            const newPluginTranslation = JSON.parse(JSON.stringify(pluginTranslation)) as PluginTranslationV1;
            newPluginTranslation.dict = JSON.parse(JSON.stringify(finalDictData));
            if (metadata) { newPluginTranslation.metadata = { ...metadata }; }

            try {
                if (pluginTranslationPath) {
                    saveTranslationFile(pluginTranslationPath, newPluginTranslation);

                    useGlobalStoreInstance.setState({ editorPluginTranslation: newPluginTranslation });

                    // 同步更新 meta.json (SourceManager)
                    if (i18n && i18n.sourceManager) {
                        try {
                            const ext = path.extname(pluginTranslationPath);
                            const baseName = path.basename(pluginTranslationPath, ext);
                            const source = i18n.sourceManager.getSource(baseName);

                            if (source && metadata) {
                                if (metadata.title) source.title = metadata.title;
                                source.checksum = calculateChecksum(newPluginTranslation);
                                // 编辑过的云端翻译自动转为本地来源
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

                    if (!silent) {
                        notice.successPrefix(loggerPrefix, t("Common.Notices.SaveSuccess"));
                    }
                } else {
                    notice.errorPrefix(loggerPrefix, t("Common.Notices.SaveFailPath"));
                }
            } catch (e) {
                notice.errorPrefix(loggerPrefix, t("Common.Notices.SaveFail"), e);
            }
        } finally {
            savingRef.current = false;
            setIsSaving(false);
        }
    }, [loggerPrefix, t]);

    // ================================================== Incremental Extract ==================================================
    const incrementalExtractAst = React.useCallback(async () => {
        try {
            const { metadata } = useRegexStore.getState();
            if (!metadata) return;

            const pluginId = metadata.plugin;
            const currentFile = useRegexStore.getState().currentFile;
            // @ts-ignore
            const manifest = i18n.app.plugins.manifests[pluginId];
            if (!manifest) return;

            // @ts-ignore
            const basePath = path.normalize(i18n.app.vault.adapter.getBasePath());
            const fileDoc = path.join(basePath, manifest.dir, currentFile);

            if (!fs.existsSync(fileDoc)) {
                notice.error(t('Common.Notices.MainNotFound').replace('main.js', currentFile) + ` (${currentFile})`);
                return;
            }

            const mainStr = fs.readFileSync(fileDoc).toString();
            const astTranslator = new AstTranslator(i18n.settings);
            const ast = astTranslator.loadCode(mainStr);

            if (ast) {
                const newAstItems = astTranslator.extract(ast);
                const currentAstItems = useRegexStore.getState().astItems;

                // 合并新旧数据
                const merged = mergeAstItems(currentAstItems, newAstItems);

                // 更新 store (重新分配 ID 以保证唯一性和连续性)
                setAstItems(merged.map((item, index) => ({ ...item, id: index })));
                notice.success(t('Editor.Notices.SuccessIncrementalExtract'));
            }
        } catch (e) {
            notice.error(t('Editor.Errors.SyntaxErrorAst') + ': ' + e);
        }
    }, [i18n, notice, t, setAstItems]);

    const incrementalExtractRegex = React.useCallback(async () => {
        try {
            const { metadata } = useRegexStore.getState();
            if (!metadata) return;

            const pluginId = metadata.plugin;
            const currentFile = useRegexStore.getState().currentFile;
            // @ts-ignore
            const manifest = i18n.app.plugins.manifests[pluginId];
            if (!manifest) return;

            // @ts-ignore
            const basePath = path.normalize(i18n.app.vault.adapter.getBasePath());
            const fileDoc = path.join(basePath, manifest.dir, currentFile);

            if (!fs.existsSync(fileDoc)) {
                notice.error(t('Common.Notices.MainNotFound', { file: currentFile }));
                return;
            }

            const mainStr = fs.readFileSync(fileDoc).toString();

            const regexTranslator = new RegexTranslator(i18n.settings);
            const newRegexItems = regexTranslator.extractTranslationsByRegex(mainStr);
            const currentRegexItems = useRegexStore.getState().regexItems;

            // 合并新旧数据
            const merged = mergeRegexItems(currentRegexItems, newRegexItems);

            // 更新 store (重新分配 ID)
            setRegexItems(merged.map((item, index) => ({ ...item, id: index })));
            notice.success(t('Editor.Notices.SuccessIncrementalExtract'));
        } catch (e) {
            notice.error(t('Editor.Errors.SyntaxErrorRegex') + ': ' + e);
        }
    }, [i18n, notice, t, setRegexItems]);

    // ================================================== Open File ==================================================
    const handleOpenFile = React.useCallback(async () => {
        try {
            const { metadata } = useRegexStore.getState();
            if (!metadata) return;

            const pluginId = metadata.plugin;
            const currentFile = useRegexStore.getState().currentFile;
            // @ts-ignore
            const manifest = i18n.app.plugins.manifests[pluginId];
            if (!manifest) return;

            // @ts-ignore
            const basePath = path.normalize(i18n.app.vault.adapter.getBasePath());
            const fileDoc = path.join(basePath, manifest.dir, currentFile);

            if (!fs.existsSync(fileDoc)) {
                notice.error(t('Common.Notices.MainNotFound', { file: currentFile }));
                return;
            }

            const { i18nOpen } = await import('~/utils/common/general');
            i18nOpen(i18n, fileDoc);
        } catch (e) {
            notice.error(t('Editor.Actions.OpenFile') + ' ' + t('Common.Status.Failure') + ': ' + e);
        }
    }, [i18n, notice, t]);

    // ================================================== Diagnose ==================================================
    const handleDiagnose = React.useCallback(async () => {
        if (isDiagnosing) return;
        setIsDiagnosing(true);
        setErrorItems([]);
        setHasChecked(true);
        try {
            const { regexItems, astItems, metadata, currentFile, sourceCache, setSourceCache } = useRegexStore.getState();
            if (!metadata) {
                notice.error(t('Editor.Errors.NoMetadata'));
                return;
            }

            const pluginId = metadata.plugin;

            if (!currentFile || !currentFile.endsWith('.js')) {
                notice.info(t('Editor.Errors.NotJs'));
                return;
            }

            const state = i18n.stateManager.getPluginState(pluginId);
            const isApplied = !!(state && state.isApplied);

            // 1. 获取源代码 (内存优先)
            let originalCode: string | null = sourceCache[currentFile];
            if (!originalCode) {
                // 如果未译 (isApplied === false)，优先尝试从磁盘读取实际文件 (因为它就是原始代码)
                if (!isApplied) {
                    try {
                        // @ts-ignore
                        const manifest = i18n.app.plugins.manifests[pluginId];
                        if (manifest) {
                            // @ts-ignore
                            const basePath = path.normalize(i18n.app.vault.adapter.getBasePath());
                            const pluginDir = path.join(basePath, manifest.dir);
                            const targetFilePath = path.join(pluginDir, currentFile);
                            if (fs.existsSync(targetFilePath)) {
                                originalCode = fs.readFileSync(targetFilePath, 'utf8');
                            }
                        }
                    } catch (e) {
                        console.warn("Failed to read original source from disk, falling back to backup.", e);
                    }
                }

                // 如果仍为空 (已译或读取磁盘失败)，则从备份获取
                if (!originalCode) {
                    originalCode = await i18n.backupManager.getBackupContent(pluginId, currentFile);
                }

                if (originalCode) {
                    setSourceCache(currentFile, originalCode);
                }
            }

            if (!originalCode) {
                notice.error(t('Editor.Errors.NoBackup'));
                return;
            }

            const results: DiagnoseError[] = [];
            const astTranslator = new AstTranslator(i18n.settings);
            const regexTranslator = new RegexTranslator(i18n.settings);

            // 2. 批量语法检查 (性能优化)
            try {
                // 解析基准 AST 并缓存，避免后续重复解析
                const baseAst = astTranslator.loadCode(originalCode);
                if (!baseAst) {
                    notice.error(t('Editor.Errors.SourceError'));
                    return;
                }

                // 准备要测试的项
                const activeAstItems = astItems.filter(item => item.target && item.target !== item.source);
                const activeRegexItems = regexItems.filter(item => item.target && item.target !== item.source);

                if (activeAstItems.length === 0 && activeRegexItems.length === 0) {
                    notice.success(t('Editor.Notices.DiagnosisSuccess'));
                    return;
                }

                // 第一阶段：全量批量测试
                let batchSuccess = true;
                try {
                    const testAst = astTranslator.cloneAst(baseAst);
                    const astCode = astTranslator.translate(testAst, activeAstItems);
                    const finalCode = regexTranslator.translate(astCode, activeRegexItems);
                    if (!astTranslator.loadCode(finalCode)) {
                        batchSuccess = false;
                    }
                } catch (e) {
                    batchSuccess = false;
                }

                // 第二阶段：如果批量失败，使用二分法快速定位
                if (!batchSuccess) {
                    // 定义检查函数 (内部使用 AST 克隆)
                    const checkItems = (checkAstItems: typeof activeAstItems, checkRegexItems: typeof activeRegexItems): boolean => {
                        try {
                            const testAst = astTranslator.cloneAst(baseAst);
                            const astCode = astTranslator.translate(testAst, checkAstItems);
                            const finalCode = regexTranslator.translate(astCode, checkRegexItems);
                            return !!astTranslator.loadCode(finalCode);
                        } catch (e) {
                            return false;
                        }
                    };

                    // 递归二分查找逻辑
                    const findErrors = (items: { type: 'ast' | 'regex', data: any }[]) => {
                        if (items.length === 0) return;

                        // 验证当前这组是否有错
                        const currentAst = items.filter(i => i.type === 'ast').map(i => i.data);
                        const currentRegex = items.filter(i => i.type === 'regex').map(i => i.data);

                        if (checkItems(currentAst, currentRegex)) return; // 这组没问题

                        // 如果只有一个条目，那它就是元凶
                        if (items.length === 1) {
                            const err = items[0];
                            // 针对 AST 项，先尝试快速语法验证，排除掉简单的输入错误
                            if (err.type === 'ast' && !astTranslator.validateTargetSyntax(err.data.target)) {
                                results.push({ type: 'ast', id: err.data.id, source: err.data.source });
                            } else {
                                results.push({ type: err.type, id: err.data.id, source: err.data.source });
                            }
                            return;
                        }

                        // 二分分割
                        const mid = Math.floor(items.length / 2);
                        findErrors(items.slice(0, mid));
                        findErrors(items.slice(mid));
                    };

                    // 将所有待检测项合并为一个列表进行二分
                    const allItems: { type: 'ast' | 'regex', data: any }[] = [
                        ...activeAstItems.map(i => ({ type: 'ast' as const, data: i })),
                        ...activeRegexItems.map(i => ({ type: 'regex' as const, data: i }))
                    ];

                    findErrors(allItems);
                }
            } catch (e) {
                console.error("Diagnostic process failed", e);
                notice.error(t('Common.Status.Failure') + ': ' + e);
                return;
            }

            setErrorItems(results);
            if (results.length === 0) {
                notice.success(t('Editor.Notices.DiagnosisSuccess'));
            } else {
                notice.error(t('Editor.Errors.SyntaxErrorTotal', { count: results.length }));
            }
        } catch (e) {
            notice.error(t('Common.Status.Failure') + ' ' + t('Editor.Notices.DiagnosisSuccess') + ': ' + e);
        } finally {
            setIsDiagnosing(false);
        }
    }, [i18n, notice, t, isDiagnosing]);

    const handleClearDiagnose = React.useCallback(() => {
        setErrorItems([]);
        setHasChecked(false);
    }, []);

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

    const metadata = useRegexStore.use.metadata();
    const dictData = useRegexStore.use.dictData();
    const currentFile = useRegexStore.use.currentFile();
    const astItems = useRegexStore.use.astItems();
    const fileOptions = Object.keys(dictData || {});

    // 获取当前插件的翻译应用状态 (isApplied)
    const isApplied = React.useMemo(() => {
        if (!metadata?.plugin || !i18n?.stateManager) return false;
        return !!i18n.stateManager.getPluginState(metadata.plugin)?.isApplied;
    }, [metadata?.plugin, i18n?.stateManager, isSaving]); // isSaving 变化时重新计算作为一种同步触发源

    const handleAddFile = () => {
        if (newPathInput.trim()) {
            addFile(newPathInput.trim());
            setNewPathInput('');
            setIsAddPathDialogOpen(false);
        }
    };

    const switchFile = (file: string) => {
        if (file === currentFile) return;
        // 先同步当前输入
        useRegexStore.getState().syncFileDictInfo(
            useRegexStore.getState().currentFile,
            useRegexStore.getState().astItems,
            useRegexStore.getState().regexItems
        );
        // 再切换
        setCurrentFile(file);
    };

    // ================================================== Render ================================================== 
    return (
        <Tabs value={activeTab} onValueChange={setActiveTab} className="h-full flex flex-col gap-0 bg-background/50 backdrop-blur-md">
            <AutoSaveManager onSave={save} enabled={!!i18n.settings.autoSave} />
            <ResizablePanelGroup direction="horizontal" className="h-full border-none">
                {/* 左侧资源管理侧边栏 */}
                <ResizablePanel defaultSize={20} minSize={10} maxSize={30} className="h-full">
                    <div className="flex flex-col h-full py-2 pl-2 pr-1">
                        <div className="flex flex-col h-full flex-1 min-h-0 rounded-lg border">
                            {/* 固定标题栏 */}
                            <div className="flex items-center gap-2 px-3 py-2 border-b shrink-0 min-h-[36px]">
                                <Folder className="w-4 h-4 text-primary shrink-0" />
                                <span className="text-sm font-semibold truncate">{metadata?.plugin || t('Manager.Labels.Plugins')}</span>
                            </div>
                            <div className="flex flex-col w-full flex-1 min-h-0 p-2">
                                {/* 可滚动的卡片区域 */}
                                <ScrollArea className="flex-1 min-h-0 pr-3 -mr-3">
                                    <div className="space-y-3 pb-2">
                                        {/* 编辑器切换 & 保存卡片 */}
                                        <TemplateCard title={t('Editor.Titles.Main')} icon={Folder}>
                                            <div className="flex flex-col gap-3">
                                                <SaveButton onSave={save} isSaving={isSaving} />
                                                <TabsList className="w-full h-9 p-1.5 bg-muted/50 grid grid-cols-2">
                                                    <TabsTrigger className="text-xs data-[state=active]:shadow-sm" value="ast">AST</TabsTrigger>
                                                    <TabsTrigger className="text-xs data-[state=active]:shadow-sm" value="regex">Regex</TabsTrigger>
                                                </TabsList>
                                                <Badge variant="outline" className="w-full justify-center bg-background/50 border-primary/20 text-primary font-normal truncate text-xs h-8">
                                                    {currentFile}
                                                </Badge>
                                            </div>
                                        </TemplateCard>

                                        {/* 文件列表卡片 */}
                                        <TemplateCard
                                            title={t('Editor.Titles.Files')}
                                            icon={File}
                                            extra={
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-8 w-8 hover:bg-primary/10 text-primary"
                                                    onClick={() => setIsAddPathDialogOpen(true)}
                                                >
                                                    <Plus className="w-3.5 h-3.5" />
                                                </Button>
                                            }
                                        >
                                            <div className="flex flex-col gap-0.5">
                                                {fileOptions.map(file => (
                                                    <div
                                                        key={file}
                                                        className={`
                                                            group flex items-center justify-between px-2 h-8 rounded-md cursor-pointer transition-all text-sm
                                                            ${currentFile === file ? 'bg-primary text-primary-foreground shadow-sm' : 'hover:bg-primary/5 text-muted-foreground hover:text-foreground'}
                                                        `}
                                                        onClick={() => switchFile(file)}
                                                    >
                                                        <div className="flex items-center flex-1 min-w-0">
                                                            {currentFile === file ? <ChevronRight className="w-3.5 h-3.5 mr-1 flex-shrink-0 animate-in fade-in slide-in-from-left-2" /> : <div className="w-3.5 h-3.5 mr-1" />}
                                                            <span className="truncate">{file}</span>
                                                        </div>
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            className={`
                                                                h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity rounded-full
                                                                ${currentFile === file ? 'hover:bg-primary-foreground/20 text-primary-foreground' : 'text-destructive hover:bg-destructive/10'}
                                                            `}
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                if (confirm(t('Editor.Dialogs.ConfirmDeletePath'))) {
                                                                    deleteFile(file);
                                                                }
                                                            }}
                                                        >
                                                            <Trash2 className="w-3 h-3" />
                                                        </Button>
                                                    </div>
                                                ))}
                                            </div>
                                        </TemplateCard>

                                        {/* 元数据卡片区 */}
                                        <MetadataCard />
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
                        {/* 主编辑视图 */}
                        <div className="flex-1 min-h-0 overflow-hidden relative">
                            <TabsContent value="ast" className="h-full m-0 overflow-hidden outline-none data-[state=active]:animate-in fade-in duration-300">
                                <div className="h-full overflow-auto p-2 pt-0">
                                    <AstEditor />
                                </div>
                            </TabsContent>
                            <TabsContent value="regex" className="h-full m-0 overflow-hidden outline-none data-[state=active]:animate-in fade-in duration-300">
                                <div className="h-full overflow-auto p-2 pt-0">
                                    <RegexEditor />
                                </div>
                            </TabsContent>
                        </div>
                    </main>
                </ResizablePanel>

                <ResizableHandle withHandle />

                {/* 右侧：操作面板侧边栏 */}
                <ResizablePanel defaultSize={20} minSize={10} maxSize={30} className="h-full">
                    <div className="flex flex-col h-full py-2 pr-2 pl-1">
                        <div className="flex flex-col h-full flex-1 min-h-0 rounded-lg border">
                            <TabsContent value="ast" className="flex-1 min-h-0 m-0 overflow-hidden outline-none">
                                <AstSidebar
                                    astController={astController}
                                    onIncrementalExtract={incrementalExtractAst}
                                    translationEntries={astItems as any}
                                    onOpenFile={handleOpenFile}
                                    onDiagnose={handleDiagnose}
                                    onClearDiagnose={handleClearDiagnose}
                                    isDiagnosing={isDiagnosing}
                                    errorItems={errorItems}
                                    hasChecked={hasChecked}
                                    setActiveTab={setActiveTab}
                                    isApplied={isApplied}
                                />
                            </TabsContent>
                            <TabsContent value="regex" className="flex-1 min-h-0 m-0 overflow-hidden outline-none">
                                <RegexSidebar
                                    regexController={regexController}
                                    onIncrementalExtract={incrementalExtractRegex}
                                    onOpenFile={handleOpenFile}
                                    onDiagnose={handleDiagnose}
                                    onClearDiagnose={handleClearDiagnose}
                                    isDiagnosing={isDiagnosing}
                                    errorItems={errorItems}
                                    hasChecked={hasChecked}
                                    setActiveTab={setActiveTab}
                                    isApplied={isApplied}
                                />
                            </TabsContent>
                        </div>
                    </div>
                </ResizablePanel>
            </ResizablePanelGroup>

            <Dialog open={isAddPathDialogOpen} onOpenChange={setIsAddPathDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{t('Editor.Dialogs.PromptNewPath')}</DialogTitle>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="path" className="text-right">
                                {t('Editor.Labels.PathLabel')}
                            </Label>
                            <Input
                                id="path"
                                value={newPathInput}
                                onChange={(e) => setNewPathInput(e.target.value)}
                                placeholder={t('Editor.Labels.PathPlaceholder')}
                                className="col-span-3"
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                        handleAddFile();
                                    }
                                }}
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsAddPathDialogOpen(false)}>{t('Common.Actions.Cancel')}</Button>
                        <Button onClick={handleAddFile}>{t('Common.Actions.Confirm')}</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </Tabs>
    );
};


export const EDITOR_VIEW_TYPE = 'editor-view-type';

export class EditorView extends ItemView {
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
        return EDITOR_VIEW_TYPE;
    }

    getDisplayText() {
        return gt('Editor.Titles.Main');
    }

    getIcon() {
        return "pencil";
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
            React.createElement(ReactEditor)
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