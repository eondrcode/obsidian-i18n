/**
 * 上传页 Tab
 * 重构：个人仓库模式 — 直接 commit 到用户自己的仓库
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import * as fs from 'fs-extra';
import { PluginManifest } from 'obsidian';
import { Button, Input, Label, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, Textarea } from '@/src/shadcn';
import { Upload, FileCheck, FileX, Info, Package, Globe, Tag, MessageSquare, AlertCircle, Plus, CheckCircle2, Loader2, RefreshCcw, Send, FolderOpen, GitCompare, ArrowLeft, Palette, Captions, Languages, Rocket, History as HistoryIcon, FileType, ArrowUpCircle, CloudUpload } from 'lucide-react';
import { ScrollArea } from '@/src/shadcn/ui/scroll-area';
import { useCloudStore } from '../cloud-store';
import { useGlobalStoreInstance } from '~/utils';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/src/shadcn/ui/card';
import { Badge } from '@/src/shadcn/ui/badge';
import { cn } from '@/src/shadcn/lib/utils';
import { ManifestEntry, getCloudFilePath } from '../types';
import { DiffViewerDialog } from './diff-viewer-dialog';
import { t } from '@/src/locales/index';
import { LoginRequired } from './login-required';

/** 计算字符串的简单 hash (MD5-like hex) */
function simpleHash(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash; // Convert to 32bit integer
    }
    // Output hex string
    const hex = Math.abs(hash).toString(16).padStart(8, '0');
    return hex.repeat(4); // Fill to 32 chars
}

export const PublishTab: React.FC = () => {
    const i18n = useGlobalStoreInstance.getState().i18n;
    const app = useGlobalStoreInstance.getState().i18n.app;
    const sourceUpdateTick = useGlobalStoreInstance((state) => state.sourceUpdateTick);

    const uploadType = useCloudStore.use.uploadType();
    const selectedPluginId = useCloudStore.use.selectedPluginId();
    const selectedSourceId = useCloudStore.use.selectedSourceId();
    const uploadForm = useCloudStore.use.uploadForm();
    const localFiles = useCloudStore.use.localFiles();
    const isLoading = useCloudStore.use.isLoading();
    const repoInitialized = useCloudStore.use.repoInitialized();
    const repoChecking = useCloudStore.use.repoChecking();
    const githubUser = useCloudStore.use.githubUser();

    const setUploadType = useCloudStore.use.setUploadType();
    const setSelectedPluginId = useCloudStore.use.setSelectedPluginId();
    const setSelectedSourceId = useCloudStore.use.setSelectedSourceId();
    const setUploadForm = useCloudStore.use.setUploadForm();
    const setLocalFiles = useCloudStore.use.setLocalFiles();
    const resetUploadForm = useCloudStore.use.resetUploadForm();
    const setRepoInitialized = useCloudStore.use.setRepoInitialized();
    const repoManifest = useCloudStore.use.repoManifest();
    const setRepoManifest = useCloudStore.use.setRepoManifest();
    const setRepoDataLoaded = useCloudStore.use.setRepoDataLoaded();
    const canCreateRepo = useCloudStore.use.canCreateRepo();
    const repoNameInput = useCloudStore.use.repoNameInput();
    const setRepoNameInput = useCloudStore.use.setRepoNameInput();
    const repoDescriptionInput = useCloudStore.use.repoDescriptionInput();
    const setRepoDescriptionInput = useCloudStore.use.setRepoDescriptionInput();

    const userRepo = i18n.settings.shareRepo;

    const [isUploading, setIsUploading] = useState(false);

    const setCurrentTab = useCloudStore.use.setCurrentTab();

    // 获取插件列表 - 仅显示有翻译源(meta.json)的插件
    // @ts-ignore
    const plugins: PluginManifest[] = useMemo(() => {
        // @ts-ignore
        const allPlugins = Object.values(app.plugins.manifests) as PluginManifest[];

        return allPlugins.filter((p: PluginManifest) => {
            if (p.id === 'i18n') return false;
            return i18n.sourceManager.hasAnySources(p.id);
        });
    }, [app, i18n.settings.language, i18n.sourceManager, sourceUpdateTick]);

    // 获取主题列表 - 仅显示有翻译源的主题
    const themes = useMemo(() => {
        try {
            // @ts-ignore
            const basePath = require('path').normalize(app.vault.adapter.getBasePath());
            const themesDir = require('path').join(basePath, '.obsidian', 'themes');

            if (!fs.existsSync(themesDir)) return [];

            const entries = fs.readdirSync(themesDir, { withFileTypes: true });
            return entries.filter(e => {
                if (!e.isDirectory()) return false;
                return i18n.sourceManager.hasAnySources(e.name);
            }).map(e => ({ id: e.name, name: e.name })); // 统一输出格式 { id, name }
        } catch (e) {
            console.error(t('Cloud.Errors.FetchFail'), e);
            return [];
        }
    }, [app, i18n.sourceManager, sourceUpdateTick]);

    // 当前选择的目标列表
    const targets = uploadType === 'plugin' ? plugins : themes;

    // 该插件/主题下所有翻译源
    const pluginSources = useMemo(() => {
        if (!selectedPluginId) return [];
        return i18n.sourceManager.getSourcesForPlugin(selectedPluginId);
    }, [selectedPluginId, i18n.sourceManager, sourceUpdateTick]);

    // 检测云端是否已存在该翻译源（以 source.id 为键）
    const cloudEntry = useMemo(() => {
        if (!selectedSourceId) return null;
        return repoManifest.find(e => e.id === selectedSourceId);
    }, [selectedSourceId, repoManifest]);

    const isUpdateMode = !!cloudEntry;

    // 差异对比
    const setDiffDialogSourceId = useCloudStore.use.setDiffDialogSourceId();



    // 计算本地文件内容的 hash
    const localHash = useMemo(() => {
        if (!selectedSourceId) return '';
        const filePath = i18n.sourceManager.getSourceFilePath(selectedSourceId);
        if (filePath && fs.existsSync(filePath)) {
            try {
                const content = fs.readFileSync(filePath, 'utf-8');
                return simpleHash(content);
            } catch (e) {
                return '';
            }
        }
        return '';
    }, [selectedSourceId, i18n.sourceManager]);

    const isSameAsCloud = useMemo(() => {
        if (!cloudEntry || !localHash) return false;
        return cloudEntry.hash === localHash;
    }, [cloudEntry, localHash]);

    // 检测翻译源文件（以 selectedSourceId 为准）
    useEffect(() => {
        if (!selectedSourceId) {
            setLocalFiles([]);
            return;
        }

        const sourceManager = i18n.sourceManager;
        const source = sourceManager.getSource(selectedSourceId);
        const sourcePath = sourceManager.getSourceFilePath(selectedSourceId);

        if (source && sourcePath && fs.existsSync(sourcePath)) {
            const stats = fs.statSync(sourcePath);
            setLocalFiles([{
                path: sourcePath,
                language: i18n.settings.language,
                exists: true,
                lastModified: stats.mtime,
                size: stats.size,
            }]);
            // 自动填充版本号和描述（从翻译文件的 metadata 中读取）
            let fileDescription = '';
            let fileVersion = '';
            try {
                const fileContent = fs.readJsonSync(sourcePath);
                if (fileContent?.metadata?.description) {
                    fileDescription = fileContent.metadata.description;
                }
                if (fileContent?.metadata?.supportedVersions || fileContent?.metadata?.version) {
                    fileVersion = fileContent.metadata.supportedVersions || fileContent.metadata.version;
                }
            } catch { /* ignore */ }
            setUploadForm({
                version: fileVersion,
                title: source.title,
                description: fileDescription
            });
        } else {
            setLocalFiles([{
                path: '',
                language: i18n.settings.language,
                exists: false,
            }]);
        }
    }, [selectedSourceId, i18n.settings.language, i18n.sourceManager]);

    // ========== 上传翻译（新流程） ========== 
    const handleUpload = useCallback(async () => {
        if (!uploadForm.title.trim()) {
            i18n.notice.errorPrefix(t('Cloud.Errors.UploadFailed'), t('Cloud.Hints.TitleEmpty'));
            return;
        }

        const localFile = localFiles[0];
        if (!localFile?.exists) {
            i18n.notice.errorPrefix(t('Cloud.Errors.UploadFailed'), t('Cloud.Errors.LocalFileMissing'));
            return;
        }

        if (!githubUser) {
            i18n.notice.errorPrefix(t('Cloud.Errors.UploadFailed'), t('Cloud.Errors.NoGithubUser'));
            return;
        }

        setIsUploading(true);
        try {
            const fileContent = fs.readFileSync(localFile.path, 'utf-8');
            const username = githubUser.login;
            const uid = githubUser.id;

            // 1. 获取源ID和计算 hash
            const source = i18n.sourceManager.getSource(selectedSourceId);
            if (!source?.id) {
                throw new Error(t('Cloud.Errors.InvalidSourceConfig'));
            }
            const entryId = source.id;
            const hash = simpleHash(fileContent);

            // 2. 上传翻译文件
            const filePath = getCloudFilePath(entryId, source.type);
            const b64Content = Buffer.from(fileContent, 'utf-8').toString('base64');
            const commitMessage = t(isUpdateMode ? 'Cloud.Labels.UpdateTranslationMsg' : 'Cloud.Labels.AddTranslationMsg', { title: uploadForm.title, plugin: selectedPluginId });

            i18n.notice.successPrefix(t('Cloud.Status.Processing'), t('Cloud.Status.UploadingFile'));
            const uploadRes = await i18n.api.github.uploadFile(
                username, userRepo, filePath, b64Content, commitMessage
            );
            if (!uploadRes.state) {
                throw new Error(`${t('Cloud.Errors.UploadFileFail')}: ${uploadRes.data?.message || uploadRes.data}`);
            }

            // 3. 读取当前 metadata.json，追加新条目
            // Assuming `setLoadingText` and `t_i18n` are defined elsewhere or need to be added.
            // For now, I'll use the existing `i18n.notice.successPrefix` and `t`.
            i18n.notice.successPrefix(t('Cloud.Status.Processing'), t('Cloud.Status.UpdatingIndex'));
            let manifest: ManifestEntry[] = [];
            let manifestSha: string | undefined;
            try {
                // 使用 getFileContent 获取最新内容（避免 getRawContent 的 5 分钟 CDN 缓存导致覆盖旧数据）
                const manifestRes = await i18n.api.github.getFileContent(username, userRepo, 'metadata.json');
                if (manifestRes.state && manifestRes.data?.content) {
                    manifestSha = manifestRes.data.sha; // 获取当前文件的 SHA
                    const decoded = Buffer.from(manifestRes.data.content, 'base64').toString('utf-8');
                    const parsed = JSON.parse(decoded);
                    if (Array.isArray(parsed)) {
                        manifest = parsed;
                    }
                }
            } catch {
                // manifest 不存在或为空，使用空数组
            }

            const now = new Date().toISOString();
            const newEntry: ManifestEntry = {
                id: entryId,
                plugin: selectedPluginId,
                language: i18n.settings.language,
                version: uploadForm.version,
                supported_versions: uploadForm.version,
                title: uploadForm.title,
                description: uploadForm.description || '',
                hash: hash,
                created_at: now,
                updated_at: now,
                type: source.type,
            };

            // 查找是否已经存在同 id 的条目
            const existingIndex = manifest.findIndex(e => e.id === entryId);
            if (existingIndex >= 0) {
                // 如果存在，只更新涉及到修改的字段（保留 id, created_at 及其他未变更属性）
                manifest[existingIndex] = {
                    ...manifest[existingIndex],
                    version: uploadForm.version,
                    supported_versions: uploadForm.version,
                    title: uploadForm.title,
                    description: uploadForm.description || '',
                    hash: hash,
                    updated_at: now,
                };
                // 如果之前因为Bug导致了多条同 ID 的脏数据，顺便把它们也清理掉以防后患
                manifest = manifest.filter((e, index) => e.id !== entryId || index === existingIndex);
            } else {
                manifest.push(newEntry);
            }

            // 4. 更新 metadata.json
            i18n.notice.successPrefix(t('Cloud.Status.Processing'), t('Cloud.Status.UpdatingIndex'));
            const manifestContent = Buffer.from(
                JSON.stringify(manifest, null, 4), 'utf-8'
            ).toString('base64');

            const manifestRes = await i18n.api.github.uploadFile(
                username, userRepo, 'metadata.json', manifestContent,
                t('Cloud.Labels.UpdateManifestMsg', { plugin: selectedPluginId }),
                'main',
                manifestSha
            );

            if (!manifestRes.state) {
                throw new Error(`${t('Cloud.Errors.UpdateManifestFail')}: ${manifestRes.data?.message || manifestRes.data}`);
            }

            // 5. 更新本地实体源的云端绑定
            const updatedSource = {
                ...source,
                origin: 'cloud' as const,
                cloud: {
                    owner: username,
                    repo: userRepo,
                    hash: hash
                },
                updatedAt: Date.now()
            };
            i18n.sourceManager.saveSource(updatedSource);

            // 6. 更新 UI 状态
            setRepoManifest(manifest);
            i18n.notice.successPrefix(t('Cloud.Notices.UploadSuccess'), t('Cloud.Notices.UploadCompleteDesc'));

        } catch (error) {
            console.error(t('Cloud.Errors.UploadFailed'), error);
            i18n.notice.errorPrefix(t('Cloud.Errors.UploadFailed'), `${error}`);
        } finally {
            setIsUploading(false);
        }
    }, [uploadForm, localFiles, selectedPluginId, selectedSourceId, i18n, githubUser, userRepo, setRepoManifest, t]);

    const formatFileSize = (bytes?: number) => {
        if (!bytes) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    };



    // 顶部导航栏结构
    const renderHeader = () => (
        <div className="flex items-center justify-between px-1 pb-4 shrink-0 ">
            <div className="flex items-center gap-3">
                <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 px-2 gap-1.5 text-muted-foreground hover:text-primary"
                    onClick={() => setCurrentTab('my')}
                >
                    <ArrowLeft className="w-4 h-4" />
                    {t('Cloud.Actions.BackToManage')}
                </Button>
                <div className="w-[1px] h-5 bg-border/50" />
                <div className="flex items-center gap-2">
                    <Upload className="w-4 h-4 text-primary" />
                    <h2 className="text-sm font-semibold">{t('Cloud.Actions.PublishToCloud')}</h2>
                </div>
            </div>
        </div>
    );

    // ========== Token 未配置 ==========
    if (!i18n.settings.shareToken) {
        return (
            <div className="flex flex-col flex-1 h-full min-h-0 w-full animate-in fade-in duration-500">
                {renderHeader()}
                <LoginRequired />
            </div>
        );
    }

    // ========== 仓库检查中 ==========
    if (repoChecking) {
        return (
            <div className="flex flex-col flex-1 h-full min-h-0 w-full animate-in fade-in duration-500">
                {renderHeader()}
                <div className="flex-1 flex flex-col items-center justify-center gap-4 text-muted-foreground p-6">
                    <Loader2 className="w-8 h-8 animate-spin text-primary" />
                    <p className="text-sm">{t('Cloud.Status.Checking')}</p>
                </div>
            </div>
        );
    }

    // ========== 仓库未初始化 ==========
    if (!repoInitialized) {
        return (
            <div className="flex flex-col flex-1 h-full min-h-0 w-full animate-in fade-in duration-500">
                {renderHeader()}
                <div className="flex-1 flex flex-col items-center justify-center gap-4 text-muted-foreground p-6">
                    <FolderOpen className="w-10 h-10 opacity-50" />
                    <p className="text-sm">{t('Cloud.Hints.RepoNotInit')}</p>
                    <Button
                        variant="outline"
                        size="sm"
                        className="mt-4 shadow-sm hover:bg-primary hover:text-primary-foreground transition-all"
                        onClick={() => setCurrentTab('my')}
                    >
                        {t('Cloud.Actions.BackToManage')}
                    </Button>
                </div>
            </div>
        );
    }

    return (
        <div className="flex flex-col flex-1 h-full min-h-0 w-full animate-in fade-in duration-500">
            {renderHeader()}
            <div className="flex flex-col flex-1 min-h-0 overflow-y-auto overflow-x-hidden">
                <div className="flex flex-col gap-6 p-4 max-w-2xl mx-auto pb-20 w-full">
                    {/* 仓库状态提示 */}
                    <div className="flex items-center gap-2 p-3 rounded-lg bg-green-500/5 border border-green-500/20 text-xs text-green-600 dark:text-green-400">
                        <CheckCircle2 className="w-4 h-4" />
                        <span>{t('Cloud.Notices.RepoReadyPrefix')}</span>
                        <span className="font-mono font-medium">{githubUser?.login}/{userRepo}</span>
                    </div>

                    {/* 第一步：选择翻译类型 */}
                    <section className="space-y-3">
                        <div className="flex items-center gap-2 mb-1">
                            <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-bold">1</div>
                            <Label className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">{t('Cloud.Steps.SelectType')}</Label>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            {/* 插件卡片 */}
                            <button
                                onClick={() => setUploadType('plugin')}
                                className={cn(
                                    "flex flex-col items-center justify-center gap-3 p-4 rounded-xl border-2 transition-all relative overflow-hidden",
                                    uploadType === 'plugin'
                                        ? "border-primary bg-primary/5 shadow-sm ring-2 ring-primary/20"
                                        : "border-border/60 bg-card hover:bg-accent/50 hover:border-border"
                                )}
                            >
                                <div className={cn(
                                    "p-3 rounded-full transition-colors",
                                    uploadType === 'plugin' ? "bg-primary text-primary-foreground shadow-md" : "bg-muted text-muted-foreground"
                                )}>
                                    <Package className="w-6 h-6" />
                                </div>
                                <div className="text-center space-y-1">
                                    <div className="font-semibold">{t('Cloud.Labels.UploadTypePlugin')}</div>
                                    <div className="text-[10px] text-muted-foreground">{t('Cloud.Labels.UploadTypePluginDesc')}</div>
                                </div>
                                {uploadType === 'plugin' && (
                                    <div className="absolute top-3 right-3 text-primary">
                                        <CheckCircle2 className="w-5 h-5 animate-in zoom-in" />
                                    </div>
                                )}
                            </button>

                            {/* 主题卡片 */}
                            <button
                                onClick={() => setUploadType('theme')}
                                className={cn(
                                    "flex flex-col items-center justify-center gap-3 p-4 rounded-xl border-2 transition-all relative overflow-hidden",
                                    uploadType === 'theme'
                                        ? "border-primary bg-primary/5 shadow-sm ring-2 ring-primary/20"
                                        : "border-border/60 bg-card hover:bg-accent/50 hover:border-border"
                                )}
                            >
                                <div className={cn(
                                    "p-3 rounded-full transition-colors",
                                    uploadType === 'theme' ? "bg-primary text-primary-foreground shadow-md" : "bg-muted text-muted-foreground"
                                )}>
                                    <Palette className="w-6 h-6" />
                                </div>
                                <div className="text-center space-y-1">
                                    <div className="font-semibold">{t('Cloud.Labels.UploadTypeTheme')}</div>
                                    <div className="text-[10px] text-muted-foreground">{t('Cloud.Labels.UploadTypeThemeDesc')}</div>
                                </div>
                                {uploadType === 'theme' && (
                                    <div className="absolute top-3 right-3 text-primary">
                                        <CheckCircle2 className="w-5 h-5 animate-in zoom-in" />
                                    </div>
                                )}
                            </button>
                        </div>
                    </section>

                    {/* 第二步：选择目标 */}
                    <section className="space-y-3 animate-in fade-in slide-in-from-bottom-2 duration-500">
                        <div className="flex items-center gap-2 mb-1">
                            <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-bold">2</div>
                            <Label className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                                {t('Cloud.Steps.SelectTarget', { type: uploadType === 'plugin' ? t('Common.Labels.Plugins') : t('Common.Labels.Themes') })}
                            </Label>
                        </div>
                        <Card className="border-border/50 shadow-sm overflow-hidden transition-all hover:shadow-md hover:border-primary/20">
                            <CardHeader className="pb-3 bg-muted/30">
                                <div className="flex items-center gap-2">
                                    {uploadType === 'plugin' ? <Package className="w-4 h-4 text-primary" /> : <Palette className="w-4 h-4 text-primary" />}
                                    <CardTitle className="text-sm font-medium">
                                        {t('Cloud.Labels.Target', { type: uploadType === 'plugin' ? t('Common.Labels.Plugins') : t('Common.Labels.Themes') })}
                                    </CardTitle>
                                </div>
                            </CardHeader>
                            <CardContent className="pt-4">
                                <Select value={selectedPluginId} onValueChange={setSelectedPluginId}>
                                    <SelectTrigger size="sm" className="w-full bg-background border-border/60">
                                        <SelectValue placeholder={t('Cloud.Placeholders.SelectTarget', { type: uploadType === 'plugin' ? t('Common.Labels.Plugins') : t('Common.Labels.Themes') })} />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {targets.map((target) => (
                                            <SelectItem key={target.id} value={target.id}>
                                                <div className="flex items-center justify-between w-full gap-2">
                                                    <span>{target.name}</span>
                                                    <span className="text-[10px] bg-muted px-1.5 py-0.5 rounded text-muted-foreground">{target.id}</span>
                                                </div>
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                {targets.length === 0 && (
                                    <div className="mt-3 flex items-start gap-2 p-3 rounded-md bg-amber-500/5 border border-amber-500/20 text-xs text-amber-600 dark:text-amber-400">
                                        <AlertCircle className="w-3.5 h-3.5 mt-0.5" />
                                        <p>{t('Cloud.Hints.NoLocalSourcesTip', { type: uploadType === 'plugin' ? t('Common.Labels.Plugins') : t('Common.Labels.Themes') })}</p>
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    </section>

                    {/* 第三步：选择翻译源 */}
                    {selectedPluginId && (
                        <section className="space-y-3 animate-in fade-in slide-in-from-bottom-2 duration-500">
                            <div className="flex items-center gap-2 mb-1">
                                <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-bold">3</div>
                            <Label className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">{t('Cloud.Steps.SelectSource')}</Label>
                        </div>
                            <Card className="border-border/50 shadow-sm overflow-hidden transition-all hover:shadow-md hover:border-primary/20">
                                <CardHeader className="pb-3 bg-muted/30">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <Globe className="w-4 h-4 text-primary" />
                                            <CardTitle className="text-sm font-medium">{t('Cloud.Labels.Source')}</CardTitle>
                                        </div>
                                        <Badge variant="outline" className="text-[10px] font-mono">
                                            {pluginSources.length} {t('Cloud.Labels.UnitPlugins')}
                                        </Badge>
                                    </div>
                                    <CardDescription className="text-[11px] mt-1">
                                        {t('Cloud.Tips.SelectSourceDesc')}
                                    </CardDescription>
                                </CardHeader>
                                <CardContent className="pt-4">
                                    {pluginSources.length === 0 ? (
                                        <div className="flex items-start gap-2 p-3 rounded-md bg-amber-500/5 border border-amber-500/20 text-xs text-amber-600 dark:text-amber-400">
                                            <AlertCircle className="w-3.5 h-3.5 mt-0.5" />
                                            <p>{t('Cloud.Hints.NoSourcesForTarget', { type: uploadType === 'plugin' ? t('Common.Labels.Plugins') : t('Common.Labels.Themes') })}</p>
                                        </div>
                                    ) : (
                                        <div className="flex flex-col gap-2">
                                            {pluginSources.map((source) => {
                                                const isInCloud = repoManifest.some(e => e.id === source.id);
                                                const isSelected = selectedSourceId === source.id;
                                                return (
                                                    <button
                                                        key={source.id}
                                                        onClick={() => setSelectedSourceId(source.id)}
                                                        className={cn(
                                                            "group w-full flex items-center gap-3 p-3 rounded-lg border text-left transition-all",
                                                            isSelected
                                                                ? "bg-primary/5 border-primary/40 ring-1 ring-primary/20 shadow-sm"
                                                                : "bg-muted/20 border-border/40 hover:bg-muted/50 hover:border-border/60"
                                                        )}
                                                    >
                                                        <div className={cn(
                                                            "flex items-center justify-center w-8 h-8 rounded-md shrink-0 transition-colors",
                                                            isSelected ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                                                        )}>
                                                            <FileCheck className="w-4 h-4" />
                                                        </div>
                                                        <div className="flex-1 min-w-0">
                                                            <div className="flex items-center gap-2">
                                                                <span className={cn("text-[13px] font-semibold truncate", isSelected ? "text-primary" : "text-foreground")}>
                                                                    {source.title}
                                                                </span>
                                                                {isInCloud && (
                                                                    <Badge variant="outline" className="text-[9px] px-1.5 py-0 h-[16px] bg-blue-500/10 border-blue-500/30 text-blue-600 shrink-0">
                                                                        {t('Cloud.Status.Published')}
                                                                    </Badge>
                                                                )}
                                                            </div>
                                                            <div className="flex items-center gap-2 mt-0.5">
                                                                <span className="text-[10px] text-muted-foreground/60 font-mono truncate max-w-[180px]" title={source.id}>
                                                                    {source.id.substring(0, 8)}...
                                                                </span>
                                                                <span className={cn(
                                                                    "text-[9px] px-1 py-0 rounded uppercase font-bold",
                                                                    source.origin === 'local' ? "bg-green-500/10 text-green-600" : "bg-blue-500/10 text-blue-600"
                                                                )}>
                                                                    {source.origin === 'local' ? t('Cloud.Status.Local') : t('Cloud.Status.Cloud')}
                                                                </span>
                                                            </div>
                                                        </div>
                                                        {isSelected && (
                                                            <CheckCircle2 className="w-4 h-4 text-primary shrink-0" />
                                                        )}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    )}
                                </CardContent>
                            </Card>
                        </section>
                    )}

                    {/* 第四步：核对本地文件 */}
                    {selectedSourceId && (
                        <section className="space-y-3 animate-in fade-in slide-in-from-bottom-2 duration-500">
                            <div className="flex items-center justify-between mb-1">
                                <div className="flex items-center gap-2">
                                    <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-bold">4</div>
                                    <Label className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                                        {t('Cloud.Steps.CheckFiles')}
                                    </Label>
                                </div>
                                {isUpdateMode ? (
                                    <Badge variant="secondary" className="bg-blue-500/10 text-blue-600 border-blue-500/20 hover:bg-blue-500/20 flex items-center gap-1 py-0.5 text-[10px]">
                                        <RefreshCcw className="w-3 h-3" />
                                        {t('Cloud.Status.UpdateAvailable')}
                                    </Badge>
                                ) : (
                                    <Badge variant="secondary" className="bg-green-500/10 text-green-600 border-green-500/20 hover:bg-green-500/20 flex items-center gap-1 py-0.5 text-[10px]">
                                        <Send className="w-3 h-3" />
                                        {t('Cloud.Status.Cloud')}
                                    </Badge>
                                )}
                            </div>
                            <Card className={cn(
                                "border-border/50 shadow-sm overflow-hidden transition-all",
                                localFiles[0]?.exists
                                    ? (isUpdateMode ? "bg-blue-500/5 border-blue-500/20" : "bg-green-500/5 border-green-500/20")
                                    : "bg-red-500/5 border-red-500/20"
                            )}>
                                <CardContent className="p-4">
                                    {localFiles.map((file) => (
                                        <div key={file.path} className="flex items-start gap-4">
                                            <div className={cn(
                                                "mt-1 p-2 rounded-lg",
                                                file.exists ? "bg-green-100 text-green-600 dark:bg-green-950/50" : "bg-red-100 text-red-600 dark:bg-red-950/50"
                                            )}>
                                                {file.exists ? <FileCheck className="w-5 h-5" /> : <FileX className="w-5 h-5" />}
                                            </div>
                                            <div className="flex-1 space-y-1">
                                                <div className="flex items-center justify-between">
                                                    <h4 className="text-sm font-bold">
                                                        {file.exists ? t('Cloud.Status.Uploaded') : t('Cloud.Status.NotDownloaded')}
                                                    </h4>
                                                    {file.exists && (
                                                        <span className="text-[10px] font-medium bg-green-500/10 text-green-600 px-2 py-0.5 rounded-full border border-green-500/20 uppercase">
                                                            {t('Cloud.Status.Ready')}
                                                        </span>
                                                    )}
                                                </div>
                                                <p className="text-xs text-muted-foreground break-all">
                                                    {file.exists ? file.path : `${t('Cloud.Notices.NoFile')}: ${file.language}.json`}
                                                </p>
                                                {file.exists && file.lastModified && (
                                                    <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2">
                                                        <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                                                            <Tag className="w-3 h-3" />
                                                            <span>{file.language.toUpperCase()}</span>
                                                        </div>
                                                        <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                                                            <Info className="w-3 h-3" />
                                                            <span>{formatFileSize(file.size)}</span>
                                                        </div>
                                                        <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                                                            <Globe className="w-3 h-3" />
                                                            <span>{t('Common.Labels.Mtime')}: {file.lastModified.toLocaleString(i18n.settings.language, { dateStyle: 'medium', timeStyle: 'short' })}</span>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </CardContent>
                            </Card>
                        </section>
                    )}

                    {/* 第五步：完善发布信息 */}
                    {selectedSourceId && (
                        <section className="space-y-3 animate-in fade-in slide-in-from-bottom-2 duration-500">
                            <div className="flex items-center gap-2 mb-1">
                                <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-bold">5</div>
                                <Label className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">{t('Cloud.Steps.CompleteInfo')}</Label>
                            </div>
                            <Card className="border-border/50 shadow-sm transition-all hover:shadow-md hover:border-primary/20">
                                <CardContent className="p-5 space-y-4">
                                    <div className="space-y-2">
                                        <Label className="text-xs text-muted-foreground font-medium flex items-center gap-1.5">
                                            <Captions className="w-3.5 h-3.5" />
                                            {t('Cloud.Labels.TranslationTitle')}
                                        </Label>
                                        <Input
                                            value={uploadForm.title}
                                            onChange={(e: any) => setUploadForm({ ...uploadForm, title: e.target.value })}
                                            placeholder={t('Cloud.Placeholders.RepoName')}
                                            className="bg-muted/30 focus:bg-background transition-colors"
                                        />
                                        <p className="text-[10px] text-muted-foreground">{t('Cloud.Tips.ReadmeDefault')}</p>
                                    </div>

                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <Label className="text-xs text-muted-foreground font-medium flex items-center gap-1.5">
                                                <Tag className="w-3.5 h-3.5" />
                                                {t('Cloud.Labels.Version')}
                                            </Label>
                                            <Input
                                                value={uploadForm.version}
                                                onChange={(e: any) => setUploadForm({ ...uploadForm, version: e.target.value })}
                                                placeholder="1.0.0"
                                                className="bg-muted/30 focus:bg-background transition-colors font-mono"
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label className="text-xs text-muted-foreground font-medium flex items-center gap-1.5">
                                                <Languages className="w-3.5 h-3.5" />
                                                {t('Cloud.Labels.Language')}
                                            </Label>
                                            <Input
                                                value={i18n.settings.language}
                                                disabled
                                                className="bg-muted/50 text-muted-foreground font-medium"
                                            />
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        <Label className="text-xs text-muted-foreground font-medium flex items-center gap-1.5">
                                            <Info className="w-3.5 h-3.5" />
                                            {t('Cloud.Labels.Description')} ({t('Common.Labels.Optional')})
                                        </Label>
                                        <Textarea
                                            value={uploadForm.description}
                                            onChange={(e: any) => setUploadForm({ ...uploadForm, description: e.target.value })}
                                            placeholder={t('Cloud.Tabs.Readme')}
                                            className="min-h-[100px] bg-muted/30 focus:bg-background transition-colors resize-none"
                                        />
                                    </div>
                                </CardContent>
                            </Card>
                        </section>
                    )}

                    {/* 第六步：核对并发布 */}
                    {selectedSourceId && (
                        <section className="space-y-3 animate-in fade-in slide-in-from-bottom-2 duration-500 pb-8">
                            <div className="flex items-center gap-2 mb-1">
                                <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-bold">6</div>
                                <Label className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">{t('Cloud.Steps.VerifyAndPublish')}</Label>
                            </div>

                            <Card className={cn(
                                "border-border shadow-sm overflow-hidden",
                                isUpdateMode ? "bg-blue-500/[0.02]" : "bg-green-500/[0.02]"
                            )}>
                                <CardHeader className="py-4 border-b bg-muted/10">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            {isUpdateMode ? (
                                                <HistoryIcon className="w-5 h-5 text-blue-500" />
                                            ) : (
                                                <Rocket className="w-5 h-5 text-primary" />
                                            )}
                                            <div>
                                                <CardTitle className="text-[15px] font-bold">
                                                    {isUpdateMode ? t('Cloud.Actions.UpdateTranslation') : t('Cloud.Titles.NewPublish')}
                                                </CardTitle>
                                                <CardDescription className="text-[10px]">
                                                    {isUpdateMode ? t('Cloud.Dialogs.ConfirmUpdate') : t('Cloud.Notices.UploadCompleteDesc')}
                                                </CardDescription>
                                            </div>
                                        </div>
                                        {isUpdateMode && (
                                            <Badge variant="outline" className="bg-blue-500/10 text-blue-600 border-blue-500/30 font-bold uppercase">
                                                {t('Common.Actions.Update')}
                                            </Badge>
                                        )}
                                    </div>
                                </CardHeader>
                                <CardContent className="p-0">
                                    {/* 本地文件信息 */}
                                    <div className="p-4 bg-muted/5 space-y-3">
                                        <div className="grid grid-cols-2 gap-6">
                                            <div className="space-y-1">
                                                <div className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">{t('Cloud.Labels.LocalFile')}</div>
                                                <div className="flex items-center gap-2">
                                                    <div className="w-1.5 h-1.5 rounded-full bg-green-500" />
                                                    <span className="text-xs font-mono truncate max-w-[150px]" title={localFiles[0]?.path}>
                                                        {localFiles[0]?.path.split(/[\\/]/).pop()}
                                                    </span>
                                                </div>
                                            </div>
                                            <div className="space-y-1">
                                                <div className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">{t('Cloud.Labels.FileSize')}</div>
                                                <div className="text-xs font-mono">{formatFileSize(localFiles[0]?.size)}</div>
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-2 pt-1">
                                            <div className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">{t('Cloud.Labels.ContentHash')}</div>
                                            <div className="text-[10px] font-mono text-muted-foreground/50 bg-muted/30 px-1.5 py-0.5 rounded truncate">
                                                {localHash}
                                            </div>
                                        </div>

                                        {/* 状态比对看板 */}
                                        {cloudEntry && (
                                            <div className={cn(
                                                "mt-2 p-3 rounded-lg border-l-4 flex items-center justify-between",
                                                isSameAsCloud
                                                    ? "bg-green-500/5 border-l-green-500 text-green-600"
                                                    : "bg-amber-500/5 border-l-amber-500 text-amber-600"
                                            )}>
                                                <div className="flex items-center gap-2">
                                                    {isSameAsCloud ? (
                                                        <>
                                                            <CheckCircle2 className="w-4 h-4" />
                                                            <span className="text-xs font-medium">{t('Cloud.Status.SyncWithCloud')}</span>
                                                        </>
                                                    ) : (
                                                        <>
                                                            <AlertCircle className="w-4 h-4" />
                                                            <span className="text-xs font-medium">{t('Cloud.Status.CloudDifferent')}</span>
                                                        </>
                                                    )}
                                                </div>
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    className="h-7 text-[10px] gap-1 hover:bg-background/80"
                                                    onClick={() => setDiffDialogSourceId(selectedSourceId)}
                                                >
                                                    <FileType className="w-3 h-3" />
                                                    {t('Cloud.Actions.ViewDiff')}
                                                </Button>
                                            </div>
                                        )}
                                    </div>

                                    {/* 发布按钮区域 */}
                                    <div className="p-5 bg-background">
                                        <Button
                                            onClick={handleUpload}
                                            disabled={isUploading || (isUpdateMode && isSameAsCloud)}
                                            className={cn(
                                                "w-full h-12 gap-2 text-base font-bold shadow-xl transition-all active:scale-95",
                                                isUpdateMode
                                                    ? "bg-blue-600 hover:bg-blue-700 shadow-blue-500/20"
                                                    : "bg-primary hover:bg-primary/90 shadow-primary/20",
                                                (isUpdateMode && isSameAsCloud) && "opacity-50 grayscale cursor-not-allowed"
                                            )}
                                        >
                                            {isUploading ? (
                                                <>
                                                    <Loader2 className="w-5 h-5 animate-spin" />
                                                    {isUpdateMode ? t('Cloud.Actions.Update') : t('Cloud.Actions.Add')}...
                                                </>
                                            ) : (
                                                <>
                                                    {isUpdateMode ? <ArrowUpCircle className="w-5 h-5" /> : <CloudUpload className="w-5 h-5" />}
                                                    {isUpdateMode ? (isSameAsCloud ? t('Cloud.Status.UpToDate') : t('Cloud.Actions.Update')) : t('Cloud.Actions.Add')}
                                                </>
                                            )}
                                        </Button>
                                        <p className="text-[10px] text-center text-muted-foreground mt-3">
                                            {t('Cloud.Tips.PublishNoticePrefix')} <span className="underline decoration-dotted">{githubUser?.login}/{userRepo}</span> {t('Cloud.Tips.PublishNoticeSuffix')}
                                        </p>
                                    </div>
                                </CardContent>
                            </Card>
                        </section>
                    )}
                </div>
            </div>
            <DiffViewerDialog />
        </div>
    );
};
