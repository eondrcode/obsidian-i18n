/**
 * 我的翻译页 Tab
 * 重构：直接从 store 中读取 repoManifest（由父组件统一加载），支持编辑（跳回上传页）和删除（修改 manifest 并删除远端文件）
 */
import React, { useCallback, useState, useRef, useEffect, useMemo } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { Button, Input, Label, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, Tabs, TabsList, TabsTrigger, TabsContent, Textarea } from '@/src/shadcn';
import { Trash2, FolderOpen, AlertCircle, Loader2, Edit3, Layers, Clock, Tag, RefreshCw, Search, Globe, Download, Star, Github, FileText, Save, Users, History, Cloud, HardDrive, Upload, Palette, Plus, CheckCircle2, Cpu, Zap, CircleCheckBig, MessageSquareWarning } from 'lucide-react';
import { MarkdownViewer } from './markdown-viewer';
import { useCloudStore } from '../cloud-store';
import { useGlobalStoreInstance } from '~/utils';
import { t } from '@/src/locales/index';

import { ScrollArea } from '@/src/shadcn/ui/scroll-area';
import { SUPPORTED_LANGUAGES } from '@/src/constants/languages';
import { Badge } from '@/src/shadcn/ui/badge';
import { ManifestEntry, getCloudFilePath } from '../types';
import { cn } from '@/src/shadcn/lib/utils';
import { calculateChecksum } from '@/src/utils/translator/translation';
import { TranslationSource } from '@/src/types';
import * as fs from 'fs-extra';
import { LoginRequired } from './login-required';

/** 计算字符串的简单 hash (MD5-like hex)，与 upload-tab 保持一致 */
function simpleHash(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash; // Convert to 32bit integer
    }
    const hex = Math.abs(hash).toString(16).padStart(8, '0');
    return hex.repeat(4); // 填充到 32 字符
}

interface InstalledItem {
    id: string;
    name: string;
    type: 'plugin' | 'theme';
}

export const ManageTab: React.FC = () => {
    const i18n = useGlobalStoreInstance.getState().i18n;
    const sourceUpdateTick = useGlobalStoreInstance((state) => state.sourceUpdateTick);

    // 个人仓库数据（由父组件 CloudViewContent 统一加载，无需再次请求）
    const githubUser = useCloudStore.use.githubUser();
    const repoInitialized = useCloudStore.use.repoInitialized();
    const repoChecking = useCloudStore.use.repoChecking();
    const repoManifest = useCloudStore.use.repoManifest();
    const setRepoManifest = useCloudStore.use.setRepoManifest();
    const myRepoInfo = useCloudStore.use.myRepoInfo();
    const myRepoReadme = useCloudStore.use.myRepoReadme();
    const setMyRepoReadme = useCloudStore.use.setMyRepoReadme();

    const setRepoInitialized = useCloudStore.use.setRepoInitialized();
    const setRepoDataLoaded = useCloudStore.use.setRepoDataLoaded();
    const canCreateRepo = useCloudStore.use.canCreateRepo();
    const repoNameInput = useCloudStore.use.repoNameInput();
    const setRepoNameInput = useCloudStore.use.setRepoNameInput();
    const repoDescriptionInput = useCloudStore.use.repoDescriptionInput();
    const setRepoDescriptionInput = useCloudStore.use.setRepoDescriptionInput();

    // UI 状态控制
    const [deletingId, setDeletingId] = useState<string | null>(null);
    const [filterLanguage, setFilterLanguage] = useState('all');
    const [filterQuery, setFilterQuery] = useState('');
    const [installedItems, setInstalledItems] = useState<InstalledItem[]>([]);
    const [rightTab, setRightTab] = useState<'plugins' | 'readme'>('plugins');
    const [isEditingReadme, setIsEditingReadme] = useState(false);
    const [readmeDraft, setReadmeDraft] = useState('');
    const [isSavingReadme, setIsSavingReadme] = useState(false);
    const [isInitializing, setIsInitializing] = useState(false);

    // 获取已安装的插件和主题
    useEffect(() => {
        const fetchInstalled = async () => {
            const items: InstalledItem[] = [];
            // 插件
            // @ts-ignore
            const manifests = i18n.app.plugins.manifests;
            Object.values(manifests).forEach((m: any) => {
                if (m.id !== i18n.manifest.id) {
                    items.push({ id: m.id, name: m.name, type: 'plugin' });
                }
            });
            // 主题
            try {
                // @ts-ignore
                const basePath = i18n.app.vault.adapter.getBasePath();
                // @ts-ignore
                const exists = await i18n.app.vault.adapter.exists(`${i18n.app.vault.configDir}/themes`);
                if (exists) {
                    // @ts-ignore
                    const themes = await i18n.app.vault.adapter.list(`${i18n.app.vault.configDir}/themes`);
                    for (const folder of themes.folders) {
                        const name = folder.split('/').pop();
                        if (name) {
                            items.push({ id: name, name: name, type: 'theme' });
                        }
                    }
                }
            } catch (e) {
                console.error('Failed to fetch themes', e);
            }
            setInstalledItems(items.sort((a, b) => a.name.localeCompare(b.name)));
        };
        fetchInstalled();
    }, [i18n]);

    const userRepo = i18n.settings.shareRepo;

    // 社区注册相关
    const communityRegistry = useCloudStore.use.communityRegistry();
    const communityStats = useCloudStore.use.communityStats();
    const [isRegistering, setIsRegistering] = useState(false);
    const [hasPendingRegistration, setHasPendingRegistration] = useState(false);
    const [isCheckingPending, setIsCheckingPending] = useState(false);
    const isRegistered = communityStats?.repos[`${githubUser?.login}/${userRepo}`] !== undefined;

    // 跳转至上传 Tab 的 Action
    const setCurrentTab = useCloudStore.use.setCurrentTab();
    const setSelectedPluginId = useCloudStore.use.setSelectedPluginId();
    const setUploadForm = useCloudStore.use.setUploadForm();

    const setSelectedSourceId = useCloudStore.use.setSelectedSourceId();
    const [downloadingId, setDownloadingId] = useState<string | null>(null);

    // 历史回滚
    const setHistoryDialogEntryId = useCloudStore.use.setHistoryDialogEntryId();
    // 备份/恢复

    // 初始化仓库（创建新仓库或使用已有仓库）
    const handleInitRepo = useCallback(async (mode: 'create' | 'use-existing') => {
        let repoName = repoNameInput.trim();
        // 自动提取 repo name (支持 owner/repo 格式输入)
        if (repoName.includes('/')) {
            repoName = repoName.split('/').pop() || '';
        }

        if (!repoName) {
            i18n.notice.errorPrefix(t('Cloud.Errors.InitFailed'), t('Cloud.Hints.RepoNameRequired'));
            return;
        }
        if (!githubUser) {
            i18n.notice.errorPrefix(t('Cloud.Errors.InitFailed'), t('Cloud.Errors.NoGithubUser'));
            return;
        }

        setIsInitializing(true);
        try {
            if (mode === 'create') {
                // 直接创建新仓库
                i18n.notice.successPrefix(t('Cloud.Status.Initializing'), t('Cloud.Status.CreatingRepo'));
                const res = await i18n.api.github.createRepo(repoName);
                if (!res.state) {
                    throw new Error(t('Cloud.Errors.CreateRepoFail'));
                }
                // 等待 GitHub 处理
                await new Promise(resolve => setTimeout(resolve, 2000));
            } else {
                // 使用已有仓库 — 验证其是否存在
                i18n.notice.successPrefix(t('Cloud.Status.Checking'), t('Cloud.Status.VerifyingRepo'));
                const checkRes = await i18n.api.github.checkRepoExists(githubUser.login, repoName);
                if (!checkRes.state) {
                    throw new Error(t('Cloud.Errors.RepoNotExistOnGithub', { repo: `${githubUser.login}/${repoName}` }));
                }
            }

            // 初始化仓库结构（创建 metadata.json）
            i18n.notice.successPrefix(t('Cloud.Status.Initializing'), t('Cloud.Status.InitializingStructure'));
            const initRes = await i18n.api.github.initRepoStructure(githubUser.login, repoName);
            if (!initRes.state) {
                throw new Error(t('Cloud.Errors.InitRepoStructFail'));
            }

            if (mode === 'create') {
                i18n.notice.successPrefix(t('Cloud.Status.Initializing'), t('Cloud.Status.GeneratingReadme'));
                const readmeContent = `# ${repoName}\n\n${repoDescriptionInput.trim() || t('Cloud.Tips.ReadmeDefault')}`;
                const readmeBase64 = Buffer.from(readmeContent, 'utf-8').toString('base64');
                const readmeRes = await i18n.api.github.uploadFile(
                    githubUser.login, repoName, 'README.md', readmeBase64, t('Cloud.Labels.InitReadmeMsg')
                );
                if (!readmeRes.state) {
                    console.warn(t('Cloud.Errors.CreateReadmeFail'), readmeRes.data);
                }
            }

            // 保存仓库名到设置
            i18n.settings.shareRepo = repoName;
            await i18n.saveSettings();

            i18n.notice.successPrefix(t('Cloud.Notices.UploadSuccess'), t('Cloud.Notices.RepoReadyPrefix'));
            setRepoInitialized(true);

            // 触发重新加载 manifest 数据
            await new Promise(resolve => setTimeout(resolve, 1000));
            setRepoDataLoaded(false);
        } catch (error) {
            console.error(t('Cloud.Errors.InitFailed'), error);
            i18n.notice.errorPrefix(t('Cloud.Errors.InitFailed'), `${error}`);
        } finally {
            setIsInitializing(false);
        }
    }, [i18n, githubUser, repoNameInput, repoDescriptionInput, setRepoInitialized, setRepoDataLoaded, t]);

    // 获取并设置是否有待处理的收录申请
    React.useEffect(() => {
        if (!githubUser || !userRepo || isRegistered) return;

        let cancelled = false;
        const checkPending = async () => {
            setIsCheckingPending(true);
            try {
                const registryAddr = 'eondrcode/obsidian-i18n-resources';
                const [registryOwner, registryRepo] = registryAddr.split('/');
                const repoAddress = `${githubUser.login}/${userRepo}`;
                const checkRes = await i18n.api.github.checkHasOpenRegistrationIssue(
                    registryOwner,
                    registryRepo,
                    repoAddress,
                    githubUser.login
                );

                if (!cancelled && checkRes.state && checkRes.hasOpenIssue) {
                    setHasPendingRegistration(true);
                }
            } catch (e) {
                console.error(t('Cloud.Errors.CheckPendingFail'), e);
            } finally {
                if (!cancelled) {
                    setIsCheckingPending(false);
                }
            }
        };

        checkPending();
        return () => { cancelled = true; };
    }, [githubUser, userRepo, isRegistered, i18n]);

    // 注册到社区
    const handleRegisterToCommunity = useCallback(async () => {
        if (!githubUser || !userRepo || isRegistering) return;

        const repoAddress = `${githubUser.login}/${userRepo}`;

        if (isRegistered) {
            i18n.notice.successPrefix(t('Cloud.Status.Registered'), t('Cloud.Hints.RepoAlreadyInCommunity'));
            return;
        }

        if (repoManifest.length === 0) {
            i18n.notice.errorPrefix(t('Cloud.Errors.CannotRegister'), t('Cloud.Hints.PublishBeforeRegister'));
            return;
        }

        setIsRegistering(true);
        try {
            const registryAddr = 'eondrcode/obsidian-i18n-resources';
            if (!registryAddr) {
                throw new Error(t('Cloud.Errors.RegistryAddrMissing'));
            }

            const [registryOwner, registryRepo] = registryAddr.split('/');
            if (!registryOwner || !registryRepo) {
                throw new Error(t('Cloud.Errors.RegistryAddrFormatError'));
            }

            const title = `[Register] ${repoAddress}`;

            // 构建丰富的 Issue 正文
            const repoUrl = `https://github.com/${repoAddress}`;
            const manifestUrl = `https://github.com/${repoAddress}/blob/main/metadata.json`;
            const pluginCount = repoManifest.length;
            const langs = Array.from(new Set(repoManifest.map(m => m.language))).join(', ');

            const body = [
                `## ${t('Cloud.Actions.ApplyForCommunity')}`,
                ``,
                `${t('Cloud.Labels.RegistrationLabel')}`,
                ``,
                `### 📖 ${t('Cloud.Labels.RepoInfo')}`,
                `- **${t('Cloud.Labels.RepoAddress')}**: [${repoAddress}](${repoUrl})`,
                `- **${t('Cloud.Labels.ManifestFile')}**: [metadata.json](${manifestUrl})`,
                `- **${t('Cloud.Labels.TranslationCountLabel')}**: \`${pluginCount}\` ${t('Cloud.Labels.UnitPlugins')}`,
                `- **${t('Cloud.Labels.LanguagesCovered')}**: \`${langs || t('Common.Status.Unknown')}\``,
                ``,
                `### 🛠 ${t('Cloud.Labels.ReviewHelper')}`,
                `> **${t('Cloud.Labels.ReviewerNotes')}**：`,
                `> 1. ${t('Cloud.Labels.ReviewerNote1')}`,
                `> 2. ${t('Cloud.Labels.ReviewerNote2')}`,
                `> 3. ${t('Cloud.Labels.ReviewerNote3')}`,
                `>    - [🔗 ${t('Cloud.Labels.CheckManifestData')}](https://raw.githubusercontent.com/${repoAddress}/main/metadata.json)`,
                ``,
                `---`,
                `*${t('Cloud.Labels.IssueAutoGenerated')}*`
            ].join('\n');

            // 先检查是否已被收录
            const registryRes = await i18n.api.github.getFileContent(registryOwner, registryRepo, 'registry.json');
            if (registryRes.state && registryRes.data?.content) {
                const decoded = Buffer.from(registryRes.data.content, 'base64').toString('utf-8');
                try {
                    const parsed = JSON.parse(decoded);
                    if (Array.isArray(parsed) && parsed.some(item => item.repoAddress === repoAddress)) {
                        i18n.notice.errorPrefix(t('Cloud.Hints.RegistrationIntercept'), t('Cloud.Hints.RepoAlreadyRegistered'));
                        return;
                    }
                } catch (e) {
                    console.error(t('Cloud.Errors.ParseRegistryFail'), e);
                }
            }

            // 先检查是否已经存在正在申请收录的工单
            const checkRes = await i18n.api.github.checkHasOpenRegistrationIssue(registryOwner, registryRepo, repoAddress, githubUser.login);
            if (checkRes.state && checkRes.hasOpenIssue) {
                i18n.notice.errorPrefix(t('Cloud.Hints.RegistrationIntercept'), t('Cloud.Hints.RegistrationPending'));
                return;
            }

            const res = await i18n.api.github.postIssue(title, body, undefined, registryOwner, registryRepo);

            if (res.state) {
                i18n.notice.successPrefix(t('Cloud.Notices.SubmitSuccess'), t('Cloud.Notices.RegistrationSubmittedDesc'));
                setHasPendingRegistration(true);
            } else {
                throw new Error(res.data?.message || t('Common.Notices.Failure'));
            }
        } catch (error) {
            console.error(t('Cloud.Errors.RegisterFail'), error);
            i18n.notice.errorPrefix(t('Common.Notices.Failure'), `${error}`);
        } finally {
            setIsRegistering(false);
        }
    }, [githubUser, userRepo, isRegistering, isRegistered, repoManifest, i18n]);

    // 获取/保存 README
    const handleSaveReadme = useCallback(async () => {
        if (!githubUser || !userRepo) return;
        setIsSavingReadme(true);
        try {
            const username = githubUser.login;
            const content = Buffer.from(readmeDraft, 'utf-8').toString('base64');
            const saveRes = await i18n.api.github.uploadFile(
                username,
                userRepo,
                'README.md',
                content,
                t('Cloud.Labels.UpdateReadmeMsg')
            );
            if (!saveRes.state) {
                throw new Error(saveRes.data?.message || t('Common.Notices.SaveFail'));
            }
            setMyRepoReadme(readmeDraft);
            setIsEditingReadme(false);
            i18n.notice.successPrefix(t('Cloud.Notices.SaveSuccess'), t('Cloud.Notices.ReadmeUpdated'));
        } catch (error) {
            console.error(t('Cloud.Errors.SaveReadmeFail'), error);
            i18n.notice.errorPrefix(t('Common.Notices.SaveFail'), `${error}`);
        } finally {
            setIsSavingReadme(false);
        }
    }, [githubUser, userRepo, readmeDraft, i18n, setMyRepoReadme]);

    // 进入编辑/更新模式
    const handleEdit = useCallback((entry: ManifestEntry) => {
        setSelectedPluginId(entry.plugin);
        setSelectedSourceId(entry.id); // 直接定位到该翻译源
        setUploadForm({
            title: entry.title,
            description: entry.description || '',
            version: entry.version || entry.supported_versions || '',
        });
        setCurrentTab('upload');
    }, [setSelectedPluginId, setSelectedSourceId, setUploadForm, setCurrentTab]);

    // 删除翻译 (彻底从 manifest 和远端文件中移除) 
    const handleDelete = useCallback(async (entry: ManifestEntry) => {
        if (!confirm(t('Cloud.Dialogs.DeleteConfirm', { plugin: entry.plugin, title: entry.title }))) {
            return;
        }

        if (!githubUser) return;
        setDeletingId(entry.id);

        try {
            const username = githubUser.login;

            // (1) 删除实体文件
            const filePath = getCloudFilePath(entry.id, entry.type);
            const delRes = await i18n.api.github.deleteFile(
                username,
                userRepo,
                filePath,
                `${t('Cloud.Labels.RemoveTranslation')}: ${entry.id}`
            );

            if (!delRes.state && delRes.data !== t('Cloud.Notices.NoFile')) {
                console.warn(t('Cloud.Errors.DeleteFileProblem'), delRes);
            }

            // (2) 清理 metadata.json
            let currentManifest: ManifestEntry[] = [];
            const manifestRes = await i18n.api.github.getFileContent(username, userRepo, 'metadata.json');
            if (manifestRes.state && manifestRes.data?.content) {
                const decoded = Buffer.from(manifestRes.data.content, 'base64').toString('utf-8');
                currentManifest = JSON.parse(decoded);
            }

            // 从数组里剔除这一个
            currentManifest = currentManifest.filter(e => e.id !== entry.id);

            // (3) 写回 metadata
            const updateRes = await i18n.api.github.uploadFile(
                username, userRepo,
                'metadata.json',
                Buffer.from(JSON.stringify(currentManifest, null, 2)).toString('base64'),
                `${t('Cloud.Labels.DeleteEntry')}: ${entry.plugin}`
            );

            if (!updateRes.state) {
                throw new Error(`${t('Cloud.Errors.UpdateIndexFail')}: ${updateRes.data?.message || updateRes.data}`);
            }

            // 更新 store 中的 repoManifest（同步到所有 Tab）
            setRepoManifest(currentManifest);
            i18n.notice.successPrefix(t('Common.Notices.Success'), t('Common.Notices.DeleteSuccess'));

        } catch (error) {
            console.error(t('Cloud.Errors.DeleteFail'), error);
            i18n.notice.errorPrefix(t('Common.Notices.Failure'), `${error}`);
        } finally {
            setDeletingId(null);
        }
    }, [githubUser, i18n, userRepo, setRepoManifest]);

    // 拉取云端翻译到本地（在 manage 页面直接处理）
    const handleDownload = useCallback(async (entry: ManifestEntry) => {
        if (!githubUser || !userRepo) return;
        if (downloadingId) return;

        setDownloadingId(entry.id);
        i18n.notice.successPrefix(t('Cloud.Status.Processing'), t('Cloud.Status.Downloading', { title: entry.title }));

        try {
            const username = githubUser.login;
            const fileRes = await i18n.api.github.getFileContentWithFallback(
                username,
                userRepo,
                getCloudFilePath(entry.id, entry.type)
            );

            if (!fileRes.state || !fileRes.data) {
                const errorDetail = fileRes.isRateLimit ? t('Cloud.Hints.RateLimitTitle') : (fileRes.data?.message || fileRes.data || '');
                throw new Error(`${t('Cloud.Errors.DownloadFail')}: ${errorDetail}`);
            }

            // getFileContentWithFallback 会自动解析 JSON 或返回文本
            const content = typeof fileRes.data === 'string' ? JSON.parse(fileRes.data) : fileRes.data;

            const manager = i18n.sourceManager;
            if (!manager) {
                throw new Error(t('Cloud.Errors.InitFailed'));
            }

            // 直接保存/覆盖
            manager.saveSourceFile(entry.id, content);

            // 更新或创建元数据
            const existingSource = manager.getAllSources().find(s => s.id === entry.id);
            if (existingSource) {
                const updatedSource: TranslationSource = {
                    ...existingSource,
                    origin: 'cloud',
                    title: entry.title || existingSource.title,
                    checksum: calculateChecksum(content),
                    cloud: { owner: username, repo: userRepo, hash: entry.hash },
                    updatedAt: Date.now(),
                };
                manager.saveSource(updatedSource);
            } else {
                const sourceInfo: TranslationSource = {
                    id: entry.id,
                    plugin: entry.plugin,
                    title: entry.title || t('Cloud.Labels.UnnamedTranslation'),
                    type: entry.type,
                    origin: 'cloud',
                    isActive: false,
                    checksum: calculateChecksum(content),
                    cloud: { owner: username, repo: userRepo, hash: entry.hash },
                    updatedAt: Date.now(),
                    createdAt: Date.now(),
                };
                manager.saveSource(sourceInfo);

                // 如果该插件下没有激活的源，自动激活
                if (!manager.getActiveSourceId(entry.plugin)) {
                    manager.setActive(entry.id, true);
                }
            }

            // 触发列表状态刷新
            useGlobalStoreInstance.getState().triggerSourceUpdate();
            i18n.notice.successPrefix(t('Common.Notices.Success'), t('Cloud.Notices.DownloadSuccessLocal'));

        } catch (error) {
            console.error(t('Cloud.Errors.DownloadFail'), error);
            i18n.notice.errorPrefix(t('Cloud.Errors.DownloadFail'), `${error}`);
        } finally {
            setDownloadingId(null);
        }
    }, [githubUser, i18n, userRepo, downloadingId]);

    /**
     * 检测某个 manifest 条目的本地更新/修改状态
     * 如果本地文件的内容 simpleHash 等同于 entry.hash，则是上过传且未修改的
     */
    const getUpdateStatus = useCallback((entry: ManifestEntry): 'up_to_date' | 'update_available' | 'not_downloaded' => {
        const manager = i18n.sourceManager;
        if (!manager) return 'not_downloaded';

        const allSources = manager.getAllSources();
        const matchedSource = allSources.find(s => s.id === entry.id);

        if (!matchedSource) return 'not_downloaded';

        // 我们发布到个人的仓库，需要像上传页那样，重新根据源文件路径读取文本算 simpleHash
        try {
            const filePath = manager.getSourceFilePath(matchedSource.id);
            if (!filePath || !fs.existsSync(filePath)) return 'not_downloaded';

            const content = fs.readFileSync(filePath, 'utf-8');
            const localHash = simpleHash(content);
            if (localHash === entry.hash) return 'up_to_date';

            return 'update_available';
        } catch (e) {
            return 'update_available';
        }
    }, [i18n, sourceUpdateTick]);

    if (!i18n.settings.shareToken) {
        return <LoginRequired />;
    }

    // 过滤 manifest 条目
    const filteredEntries = repoManifest.filter((entry) => {
        if (filterLanguage && filterLanguage !== 'all' && entry.language !== filterLanguage) return false;
        if (filterQuery && !entry.plugin.toLowerCase().includes(filterQuery.toLowerCase()) &&
            !entry.title.toLowerCase().includes(filterQuery.toLowerCase())) return false;
        return true;
    });


    // ========== 渲染逻辑 ==========

    if (!i18n.settings.shareToken) {
        return (
            <div className="flex flex-col items-center justify-center h-40 gap-3 text-muted-foreground">
                <AlertCircle className="w-10 h-10 opacity-50" />
                <p className="text-sm">{t('Cloud.Hints.TokenRequired')}</p>
            </div>
        );
    }

    if (repoChecking) {
        return (
            <div className="flex flex-col items-center justify-center h-40 gap-3 text-muted-foreground">
                <Loader2 className="w-6 h-6 animate-spin text-primary" />
                <p className="text-sm">{t('Cloud.Status.LoadingRepo')}</p>
            </div>
        );
    }

    if (!repoInitialized) {
        return (
            <div className="flex flex-col flex-1 h-full min-h-0 w-full animate-in fade-in duration-500">
                <div className="flex-1 overflow-y-auto overflow-x-hidden">
                    <div className="flex flex-col items-center justify-center gap-6 p-4 max-w-md mx-auto py-12">
                        <div className="flex flex-col items-center gap-3 text-center">
                            <div className="p-4 rounded-full bg-primary/10">
                                <FolderOpen className="w-10 h-10 text-primary" />
                            </div>
                            <h3 className="text-lg font-semibold">{t('Cloud.Actions.InitPersonalRepo')}</h3>
                            <p className="text-sm text-muted-foreground leading-relaxed">
                                {t('Cloud.Tips.InitRepoDesc')}
                            </p>
                        </div>

                        {/* 仓库名输入 */}
                        <div className="w-full max-w-xs space-y-2">
                            <Label className="text-xs text-muted-foreground font-medium">{t('Cloud.Labels.RepoName')}</Label>
                            <Input
                                value={repoNameInput}
                                onChange={(e: any) => setRepoNameInput(e.target.value)}
                                placeholder="obsidian-i18n-resources"
                                className="font-mono text-sm"
                            />
                            {githubUser && (
                                <p className="text-[10px] text-muted-foreground">
                                    {t('Cloud.Labels.RepoUrlPrefix')} <span className="font-mono font-medium">{githubUser.login}/{repoNameInput || '...'}</span>
                                </p>
                            )}
                        </div>

                        {/* 仓库简介输入 */}
                        <div className="w-full max-w-xs space-y-2">
                            <Label className="text-xs text-muted-foreground font-medium">{t('Cloud.Labels.RepoDesc')} ({t('Common.Labels.Optional')})</Label>
                            <Textarea
                                value={repoDescriptionInput}
                                onChange={(e: any) => setRepoDescriptionInput(e.target.value)}
                                placeholder={t('Cloud.Tips.ReadmeDefault')}
                                className="text-sm min-h-[80px]"
                            />
                        </div>

                        {/* 操作按钮 — 始终展示两个选项 */}
                        <div className="w-full max-w-xs space-y-3">
                            {/* 选项一：创建新仓库 */}
                            <div className="space-y-1.5">
                                <Button
                                    onClick={() => handleInitRepo('create')}
                                    disabled={isInitializing || !repoNameInput.trim() || !canCreateRepo}
                                    className="w-full h-10 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold shadow-lg shadow-primary/20"
                                >
                                    {isInitializing ? (
                                        <>
                                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                            {t('Cloud.Status.Processing')}
                                        </>
                                    ) : (
                                        <>
                                            <Plus className="w-4 h-4 mr-2" />
                                            {t('Cloud.Actions.CreateNewRepo')}
                                        </>
                                    )}
                                </Button>
                                {!canCreateRepo && (
                                    <div className="flex items-start gap-1.5 px-2 text-[10px] text-amber-600 dark:text-amber-400">
                                        <AlertCircle className="w-3 h-3 mt-0.5 shrink-0" />
                                        <span>{t('Cloud.Errors.NoCreateRepoPerm')} <code className="font-mono bg-muted px-1 rounded">public_repo</code> {t('Cloud.Labels.Permission')}</span>
                                    </div>
                                )}
                            </div>

                            {/* 分隔线 */}
                            <div className="flex items-center gap-3 px-2">
                                <div className="flex-1 h-px bg-border/60" />
                                <span className="text-[10px] text-muted-foreground font-medium">{t('Common.Labels.Or')}</span>
                                <div className="flex-1 h-px bg-border/60" />
                            </div>

                            {/* 选项二：使用已有仓库 */}
                            <div className="space-y-1.5">
                                <Button
                                    variant="outline"
                                    onClick={() => handleInitRepo('use-existing')}
                                    disabled={isInitializing || !repoNameInput.trim()}
                                    className="w-full h-10 font-semibold"
                                >
                                    {isInitializing ? (
                                        <>
                                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                            {t('Cloud.Status.Checking')}
                                        </>
                                    ) : (
                                        <>
                                            <FolderOpen className="w-4 h-4 mr-2" />
                                            {t('Cloud.Actions.UseExistingRepo')}
                                        </>
                                    )}
                                </Button>
                                <p className="text-[10px] text-center text-muted-foreground">
                                    {t('Cloud.Tips.UseExistingDesc')}
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="flex h-full gap-0 overflow-hidden min-h-0 animate-in fade-in duration-500">
            {/* 左侧侧边栏 */}
            <aside className="w-[280px] flex flex-col border-r border-border/20 pr-5 shrink-0 overflow-hidden min-h-0">
                <ScrollArea className="flex-1">
                    <div className="space-y-8 pb-8 pt-4">

                        {repoManifest.length > 0 && (
                            <div className="bg-card border border-border/60 shadow-[0_8px_30px_rgb(0,0,0,0.02)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.15)] rounded-lg overflow-hidden group transition-all duration-300 hover:border-primary/20">
                                {/* GitHub 用户信息 */}
                                <div className="p-5 pb-4 border-b border-border/40 bg-muted/5">
                                    <div className="flex items-center gap-4 mb-4">
                                        <div className="relative">
                                            {githubUser?.avatar_url ? (
                                                <img src={githubUser.avatar_url} className="w-12 h-12 rounded-full border-2 border-background shadow-md object-cover" alt="avatar" />
                                            ) : (
                                                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-primary shadow-inner">
                                                    <Users className="w-6 h-6" />
                                                </div>
                                            )}
                                            <div className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-green-500 border-2 border-background" title="Connected" />
                                        </div>
                                        <div className="flex flex-col min-w-0">
                                            <span className="text-[14px] font-extrabold text-foreground leading-none truncate mb-1" title={githubUser?.name || githubUser?.login}>
                                                {githubUser?.name || githubUser?.login}
                                            </span>
                                            <div className="flex items-center gap-2 text-[10px] text-muted-foreground/70 font-medium">
                                                <span className="flex items-center gap-1"><Users className="w-2.5 h-2.5" />{githubUser?.followers || 0}</span>
                                                <span className="opacity-30">•</span>
                                                <span className="flex items-center gap-1"><FolderOpen className="w-2.5 h-2.5" />{githubUser?.public_repos || 0}</span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* 仓库链接 */}
                                    <div className="flex items-center gap-2 p-2 px-2.5 rounded-lg bg-background/50 border border-border/40 overflow-hidden">
                                        <Github className="w-3.5 h-3.5 text-primary shrink-0 opacity-70" />
                                        <a
                                            href={`https://github.com/${githubUser?.login}/${userRepo}`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="font-bold text-[11px] font-mono truncate hover:text-primary transition-colors text-muted-foreground/90"
                                            title={t('Cloud.Labels.ViewOnGithubTitle', { repo: `${githubUser?.login}/${userRepo}` })}
                                        >
                                            {userRepo}
                                        </a>
                                    </div>
                                </div>

                                {/* 数据统计与操作 */}
                                <div className="p-5 space-y-5">
                                    <div className="grid grid-cols-2 gap-3">
                                        {[
                                            { label: t('Cloud.Labels.StatAssets'), value: repoManifest.length, color: 'text-primary' },
                                            { label: t('Cloud.Labels.StatStars'), value: myRepoInfo?.stargazers_count ?? '-', color: 'text-yellow-600' },
                                            { label: t('Cloud.Labels.StatForks'), value: myRepoInfo?.forks_count ?? '-', color: 'text-blue-600' },
                                            { label: t('Cloud.Labels.StatIssues'), value: myRepoInfo?.open_issues_count ?? '-', color: 'text-red-500/80' }
                                        ].map((stat, i) => (
                                            <div key={i} className="flex flex-col p-2.5 rounded-md bg-muted/20 border border-border/5 transition-all hover:bg-muted/40 hover:border-border/20 group/stat">
                                                <span className="text-[9px] font-bold text-muted-foreground/60 uppercase tracking-widest mb-1 group-hover/stat:text-primary/70">{stat.label}</span>
                                                <span className={cn("text-[13px] font-black tracking-tighter", stat.color)}>{stat.value}</span>
                                            </div>
                                        ))}
                                    </div>

                                    {!isRegistered ? (
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            className="w-full h-9 text-[11px] font-bold tracking-tight gap-2 rounded-lg border-primary/20 bg-primary/5 text-primary hover:bg-primary hover:text-primary-foreground transition-all active:scale-[0.97]"
                                            onClick={handleRegisterToCommunity}
                                            disabled={isRegistering || hasPendingRegistration || isCheckingPending}
                                        >
                                            {isRegistering || isCheckingPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Users className="w-3.5 h-3.5" />}
                                            {hasPendingRegistration ? t('Cloud.Status.Reviewing') : isCheckingPending ? t('Cloud.Status.Fetching') : t('Cloud.Actions.RegisterCommunity')}
                                        </Button>
                                    ) : (
                                        <div className="flex items-center justify-center gap-2 w-full h-9 rounded-lg bg-green-500/5 text-green-600 text-[11px] font-black tracking-tight border border-green-500/10 shadow-sm uppercase">
                                            <CircleCheckBig className="w-3.5 h-3.5" />
                                            {t('Cloud.Status.Registered')}
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        <div className="space-y-3 px-1">
                            <div className="flex items-center gap-2 text-[9px] font-black text-muted-foreground/50 uppercase tracking-[0.2em] mb-4">
                                <Cloud className="w-3 h-3 opacity-60" />
                                <span>{t('Cloud.Labels.CloudActions')}</span>
                            </div>
                            <Button
                                variant="outline"
                                className="w-full justify-between h-10 px-4 group bg-card border-border/60 hover:border-primary/40 hover:bg-primary/5 transition-all active:scale-[0.97]"
                                onClick={() => { setSelectedPluginId(''); setCurrentTab('upload'); }}
                            >
                                <div className="flex items-center gap-3">
                                    <Upload className="w-4 h-4 text-primary opacity-70 group-hover:scale-110 transition-transform" />
                                    <span className="text-[12px] font-extrabold tracking-tight">{t('Cloud.Actions.PublishNew')}</span>
                                </div>
                                <Plus className="w-3.5 h-3.5 text-muted-foreground/30" />
                            </Button>
                            <Button
                                variant="outline"
                                className="w-full justify-between h-10 px-4 group bg-card border-border/60 hover:border-blue-500/40 hover:bg-blue-500/5 transition-all active:scale-[0.97]"
                                onClick={() => setCurrentTab('backup')}
                            >
                                <div className="flex items-center gap-3">
                                    <Cloud className="w-4 h-4 text-blue-500 opacity-70 group-hover:scale-110 transition-transform" />
                                    <span className="text-[12px] font-extrabold tracking-tight">{t('Cloud.Labels.BackupRestore')}</span>
                                </div>
                                <Zap className="w-3.5 h-3.5 text-muted-foreground/30" />
                            </Button>

                            <div className="pt-4 border-t border-border/10 mt-2">
                                <Button
                                    variant="ghost"
                                    className="w-full justify-start h-9 px-3 gap-3 text-muted-foreground/60 hover:text-primary hover:bg-primary/5 transition-all rounded-lg group"
                                    onClick={() => setRepoDataLoaded(false)}
                                >
                                    <RefreshCw className="w-4 h-4 opacity-50 group-hover:rotate-180 group-hover:opacity-100 transition-all duration-500" />
                                    <span className="text-[11px] font-bold">{t('Cloud.Actions.ForceRefresh')}</span>
                                </Button>
                            </div>
                        </div>
                    </div>
                </ScrollArea>
            </aside>

            {/* 右侧主区域 */}
            <main className="flex-1 flex flex-col pt-1 pl-4 overflow-hidden min-h-0 border-l border-border/10">
                <Tabs value={rightTab} onValueChange={(v) => setRightTab(v as 'plugins' | 'readme')} key={sourceUpdateTick} className="flex flex-col h-full min-h-0">
                    {/* 右侧顶部工具栏 */}
                    {repoManifest.length > 0 && (
                        <div className="flex flex-col gap-3 mb-5 mt-1 border border-border/40 rounded-xl bg-card/60 p-3 shadow-sm backdrop-blur-sm">
                            <div className="flex items-center justify-between pb-3 border-b border-border/30">
                                <TabsList className="h-9 p-1 bg-muted/50 border border-border/40 rounded-lg shadow-inner">
                                    <TabsTrigger value="plugins" className="text-xs px-4 h-7 data-[state=active]:bg-background data-[state=active]:shadow-sm rounded-md transition-all">
                                        <Layers className="w-3.5 h-3.5 mr-1.5 text-muted-foreground" />
                                        {t('Cloud.Tabs.Resources')}
                                    </TabsTrigger>
                                    <TabsTrigger value="readme" className="text-xs px-4 h-7 data-[state=active]:bg-background data-[state=active]:shadow-sm rounded-md transition-all">
                                        <FileText className="w-3.5 h-3.5 mr-1.5 text-muted-foreground" />
                                        {t('Cloud.Tabs.Readme')}
                                    </TabsTrigger>
                                </TabsList>
                            </div>

                            <div className="flex items-center justify-between min-h-[32px] px-1">
                                <div className="flex items-center gap-2 text-[13px] font-semibold text-muted-foreground/80">
                                    {rightTab === 'plugins' ? (
                                        <>
                                            <div className="flex items-center justify-center w-6 h-6 rounded bg-primary/10 text-primary shrink-0">
                                                <HardDrive className="w-3.5 h-3.5" />
                                            </div>
                                            <span>{t('Cloud.Labels.PublishedResources')} ({repoManifest.length})</span>
                                        </>
                                    ) : (
                                        <>
                                            <div className="flex items-center justify-center w-6 h-6 rounded bg-primary/10 text-primary shrink-0">
                                                <FileText className="w-3.5 h-3.5" />
                                            </div>
                                            <span>{t('Cloud.Labels.ReadmeCustomPage')}</span>
                                        </>
                                    )}
                                </div>

                                <div className={cn("flex items-center gap-3 shrink-0 transition-opacity", rightTab === 'readme' ? 'opacity-30 pointer-events-none' : 'opacity-100')}>
                                    <div className="relative group w-52 shadow-sm">
                                        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground group-focus-within:text-primary transition-colors" />
                                        <Input
                                            placeholder={t('Cloud.Placeholders.SearchPublished')}
                                            value={filterQuery}
                                            onChange={(e) => setFilterQuery(e.target.value)}
                                            className="pl-8 h-8 text-xs bg-background border-border/60 focus:border-primary/50 transition-all rounded-md"
                                        />
                                    </div>
                                    <Select onValueChange={(val) => {
                                        if (val === 'all') setFilterQuery('');
                                        else setFilterQuery(val);
                                    }}>
                                        <SelectTrigger size="sm" className="w-44 text-xs bg-background border-border/60 rounded-md shadow-sm h-8">
                                            <SelectValue placeholder={t('Common.Filters.All')} />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <ScrollArea className="h-72">
                                                <SelectItem value="all" className="text-[11px]">{t('Common.Filters.All')}</SelectItem>
                                                {installedItems.map((item) => (
                                                    <SelectItem key={item.id} value={item.name} className="text-[11px]">
                                                        <div className="flex items-center gap-2">
                                                            {item.type === 'plugin' ? <Layers className="w-3 h-3 text-muted-foreground/50" /> : <Palette className="w-3 h-3 text-muted-foreground/50" />}
                                                            <span>{item.name}</span>
                                                        </div>
                                                    </SelectItem>
                                                ))}
                                            </ScrollArea>
                                        </SelectContent>
                                    </Select>
                                    <Select value={filterLanguage} onValueChange={setFilterLanguage}>
                                        <SelectTrigger size="sm" className="w-32 text-xs bg-background border-border/60 rounded-md shadow-sm h-8">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="all" className="text-[11px]">{t('Common.Filters.All')}</SelectItem>
                                            {SUPPORTED_LANGUAGES.map((lang) => (
                                                <SelectItem key={lang.value} value={lang.value} className="text-[11px]">
                                                    {lang.label}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    <Badge variant="secondary" className="h-8 px-2.5 font-mono text-[11px] font-bold bg-muted text-muted-foreground border border-border/50 shadow-sm rounded-md hover:bg-muted ml-1">
                                        {filteredEntries.length}
                                    </Badge>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* 翻译资源列表 */}
                    <TabsContent value="plugins" className="flex-1 min-h-0 m-0 outline-none data-[state=active]:flex flex-col relative z-10">
                        <MyTranslationsList
                            filteredEntries={filteredEntries}
                            repoManifest={repoManifest}
                            handleEdit={handleEdit}
                            handleDelete={handleDelete}
                            handleDownload={handleDownload}
                            setHistoryDialogEntryId={setHistoryDialogEntryId}
                            setCurrentTab={setCurrentTab}
                            deletingId={deletingId}
                            downloadingId={downloadingId}
                            getUpdateStatus={getUpdateStatus}
                            t={t}
                        />
                    </TabsContent>

                    {/* 仓库主页(README) */}
                    <TabsContent value="readme" className="flex-1 min-h-0 m-0 outline-none data-[state=active]:flex flex-col relative z-10 bg-card rounded-xl border shadow-sm overflow-hidden">
                        <div className="flex items-center justify-between px-4 py-2 border-b border-border/40 shrink-0 bg-muted/20">
                            <div className="text-xs font-semibold text-muted-foreground flex items-center gap-2">
                                <FileText className="w-4 h-4" />
                                README.md
                            </div>
                            <div>
                                {isEditingReadme ? (
                                    <div className="flex gap-2">
                                        <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => { setIsEditingReadme(false); setReadmeDraft(myRepoReadme || ''); }}>{t('Common.Actions.Cancel')}</Button>
                                        <Button size="sm" className="h-7 text-xs" onClick={handleSaveReadme} disabled={isSavingReadme}>
                                            {isSavingReadme ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <Save className="w-3 h-3 mr-1" />} {t('Common.Actions.Save')}
                                        </Button>
                                    </div>
                                ) : (
                                    <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => { setIsEditingReadme(true); setReadmeDraft(myRepoReadme || ''); }}>
                                        <Edit3 className="w-3 h-3 mr-1" /> {t('Common.Actions.Edit')}
                                    </Button>
                                )}
                            </div>
                        </div>
                        <ScrollArea className="flex-1 min-h-0 bg-background/50">
                            {isEditingReadme ? (
                                <div className="p-4 h-full">
                                    <Textarea
                                        value={readmeDraft}
                                        onChange={(e) => setReadmeDraft(e.target.value)}
                                        className="min-h-[300px] h-full font-mono text-[13px] border-0 focus-visible:ring-0 resize-none rounded-none bg-transparent"
                                        placeholder={t('Cloud.Placeholders.ReadmeEdit')}
                                    />
                                </div>
                            ) : (
                                <div className="p-6">
                                    {myRepoReadme ? (
                                        <MarkdownViewer
                                            content={myRepoReadme}
                                            owner={githubUser?.login}
                                            repo={userRepo}
                                        />
                                    ) : (
                                        <div className="flex flex-col items-center justify-center py-32 text-muted-foreground border-2 border-dashed border-border/40 rounded-xl bg-muted/10 mx-auto max-w-md">
                                            <FileText className="w-12 h-12 mb-4 opacity-20" />
                                            <p className="text-sm font-medium">{t('Cloud.Labels.NoReadmeAdded')}</p>
                                            <p className="text-xs mt-1 text-muted-foreground/60 text-center px-6">{t('Cloud.Labels.NoReadmeAddedDesc')}</p>
                                        </div>
                                    )}
                                </div>
                            )}
                        </ScrollArea>
                    </TabsContent>

                    {/* 编辑与元数据弹窗 (未删除) */}
                </Tabs>
            </main>
        </div>
    );
};

// ========== 个人翻译条目卡片 ==========
interface MyTranslationCardProps {
    entry: ManifestEntry;
    onEdit: () => void;
    onDelete: () => void;
    onDownload: () => void;
    onHistory: () => void;
    isDeleting: boolean;
    isDownloading: boolean;
    updateStatus: 'up_to_date' | 'update_available' | 'not_downloaded';
}

const MyTranslationCard: React.FC<MyTranslationCardProps> = ({ entry, onEdit, onDelete, onDownload, onHistory, isDeleting, isDownloading, updateStatus }) => {
    return (
        <div className={cn(
            "group flex flex-col overflow-hidden bg-card text-card-foreground rounded-lg border border-border/60 transition-all duration-300 animate-in fade-in h-[188px] relative select-none",
            "hover:shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:hover:shadow-[0_8px_30px_rgb(0,0,0,0.2)] hover:border-primary/40",
            updateStatus === 'update_available' && "border-amber-500/20 hover:border-amber-500/40 hover:shadow-amber-500/5",
            updateStatus === 'not_downloaded' && "border-blue-500/20 hover:border-blue-500/40 hover:shadow-blue-500/5",
            updateStatus === 'up_to_date' && "border-green-500/20 hover:border-green-500/40 hover:shadow-green-500/5"
        )}>
            {/* 内容主干 */}
            <div className="flex flex-col flex-1 p-4 pb-3 min-h-0 space-y-3">
                {/* 标题 & 核心状态 */}
                <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                        <div className={cn(
                            "flex items-center justify-center w-9 h-9 rounded-md shrink-0 shadow-sm border border-border/10 transition-colors",
                            "bg-muted/50 group-hover:bg-muted"
                        )}>
                            {entry.type === 'theme' ? (
                                <Palette className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors" />
                            ) : (
                                <Layers className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors" />
                            )}
                        </div>
                        <div className="min-w-0 flex-1">
                            <h3 className="text-[13px] font-semibold text-foreground tracking-tight leading-snug truncate" title={entry.title || entry.plugin}>
                                {entry.title || entry.plugin}
                            </h3>
                            <div className="flex items-center gap-1.5 mt-0.5">
                                <span className="text-[10px] text-muted-foreground/60 font-mono tracking-tighter">v{entry.version}</span>
                                {entry.supported_versions && (
                                    <span className="text-[9px] text-muted-foreground/30 font-mono italic">[{entry.supported_versions}]</span>
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center shrink-0 pt-0.5">
                        {updateStatus === 'up_to_date' && (
                            <div className="p-1 px-2 rounded-sm bg-green-500/5 border border-green-500/10 text-green-600/80 text-[9px] font-bold tracking-tight uppercase flex items-center gap-1">
                                <CircleCheckBig className="w-3 h-3 opacity-70" />
                                {t('Cloud.Status.Uploaded')}
                            </div>
                        )}
                        {updateStatus === 'update_available' && (
                            <div className="p-1 px-2 rounded-sm bg-amber-500/5 border border-amber-500/10 text-amber-600/80 text-[9px] font-bold tracking-tight uppercase animate-pulse flex items-center gap-1">
                                <Zap className="w-3 h-3 opacity-70" />
                                {t('Cloud.Status.Modified')}
                            </div>
                        )}
                        {updateStatus === 'not_downloaded' && (
                            <div className="p-1 px-2 rounded-sm bg-blue-500/5 border border-blue-500/10 text-blue-600/80 text-[9px] font-bold tracking-tight uppercase flex items-center gap-1">
                                <Download className="w-3 h-3 opacity-70" />
                                {t('Cloud.Status.NotDownloaded')}
                            </div>
                        )}
                    </div>
                </div>

                {/* 精简描述 */}
                <div className="min-h-[34px] max-h-[34px] overflow-hidden">
                    <p className="text-[11px] text-muted-foreground/90 leading-relaxed line-clamp-2" title={entry.description || t('Cloud.Labels.UnnamedTranslation')}>
                        {entry.description || t('Cloud.Labels.UnnamedTranslation')}
                    </p>
                </div>

                {/* 元数据区域 */}
                <div className="mt-auto flex items-center justify-between px-2.5 py-1.5 rounded bg-muted/20 border border-border/5">
                    <div className="flex items-center gap-3">
                        <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground/70 font-semibold">
                            <Globe className="w-3 h-3 opacity-50" />
                            {entry.language}
                        </div>
                        <div className="w-[1px] h-2 bg-border/20" />
                        <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground/70 font-semibold">
                            <Clock className="w-3 h-3 opacity-50" />
                            {entry.updated_at ? new Date(entry.updated_at).toLocaleDateString(undefined, { month: '2-digit', day: '2-digit' }) : '-'}
                        </div>
                    </div>

                    <span className="text-[9px] text-muted-foreground/50 font-mono tracking-tight truncate max-w-[80px]">
                        {entry.plugin}
                    </span>
                </div>
            </div>

            {/* 操作栏 */}
            <div className="flex border-t border-border/30 h-10 shrink-0 bg-muted/5 group-hover:bg-muted/10 transition-colors">
                <button
                    onClick={() => updateStatus === 'not_downloaded' ? onDownload() : updateStatus === 'update_available' ? onEdit() : undefined}
                    disabled={updateStatus === 'up_to_date' || isDownloading}
                    className={cn(
                        "flex-1 flex items-center justify-center gap-2 text-[11px] font-bold transition-all active:scale-95 disabled:active:scale-100",
                        updateStatus === 'up_to_date'
                            ? "text-green-600/50 cursor-default"
                            : updateStatus === 'not_downloaded'
                                ? "text-blue-600 hover:text-blue-700 hover:bg-blue-500/5"
                                : "text-amber-600 hover:text-amber-700 hover:bg-amber-500/5"
                    )}
                >
                    {isDownloading ? (
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    ) : updateStatus === 'up_to_date' ? (
                        <CircleCheckBig className="w-3.5 h-3.5" />
                    ) : updateStatus === 'not_downloaded' ? (
                        <Download className="w-3.5 h-3.5" />
                    ) : (
                        <Edit3 className="w-3.5 h-3.5" />
                    )}
                    <span className="uppercase tracking-tight">
                        {isDownloading ? t('Common.Status.Loading') : updateStatus === 'up_to_date' ? t('Cloud.Status.Latest') : updateStatus === 'not_downloaded' ? t('Cloud.Actions.Download') : t('Cloud.Actions.PublishNew')}
                    </span>
                </button>
                <div className="w-[1px] bg-border/20 my-2" />
                <button
                    onClick={onHistory}
                    className="px-3 flex items-center justify-center text-muted-foreground/60 hover:text-primary hover:bg-muted/20 transition-all active:scale-90"
                    title={t('Cloud.Labels.ViewHistory')}
                >
                    <History className="w-4 h-4" />
                </button>
                <div className="w-[1px] bg-border/20 my-2" />
                <button
                    onClick={onDelete}
                    disabled={isDeleting}
                    className="px-4 flex items-center justify-center text-muted-foreground/60 hover:text-destructive hover:bg-destructive/5 transition-all active:scale-90 disabled:opacity-50"
                    title={t('Cloud.Labels.DeleteCloudPkg')}
                >
                    {isDeleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                </button>
            </div>
        </div>
    );
};

// ========== 个人翻译列表组件 (独立封装以确保状态重置) ==========
interface MyTranslationsListProps {
    filteredEntries: ManifestEntry[];
    repoManifest: ManifestEntry[];
    handleEdit: (entry: ManifestEntry) => void;
    handleDelete: (entry: ManifestEntry) => void;
    handleDownload: (entry: ManifestEntry) => void;
    setHistoryDialogEntryId: (id: string | null) => void;
    setCurrentTab: (tab: any) => void;
    deletingId: string | null;
    downloadingId: string | null;
    getUpdateStatus: (entry: ManifestEntry) => 'up_to_date' | 'update_available' | 'not_downloaded';
    t: any;
}

const MyTranslationsList: React.FC<MyTranslationsListProps> = ({
    filteredEntries,
    repoManifest,
    handleEdit,
    handleDelete,
    handleDownload,
    setHistoryDialogEntryId,
    setCurrentTab,
    deletingId,
    downloadingId,
    getUpdateStatus,
    t
}) => {
    const parentRef = useRef<HTMLDivElement>(null);
    const [containerWidth, setContainerWidth] = useState(0);

    useEffect(() => {
        const element = parentRef.current;
        if (!element) return;

        const resizeObserver = new ResizeObserver((entries) => {
            for (let entry of entries) {
                const width = entry.contentRect.width;
                if (width > 0) {
                    setContainerWidth(width);
                }
            }
        });

        resizeObserver.observe(element);
        return () => resizeObserver.disconnect();
    }, []);

    const columns = useMemo(() => {
        const count = Math.floor((containerWidth - 20 + 16) / (320 + 16));
        return Math.max(1, count);
    }, [containerWidth]);

    const rowCount = Math.ceil(filteredEntries.length / columns);

    const rowVirtualizer = useVirtualizer({
        count: rowCount,
        getScrollElement: () => parentRef.current,
        estimateSize: useCallback(() => 204, []),
        overscan: 5,
    });

    const virtualItems = rowVirtualizer.getVirtualItems();

    return (
        <ScrollArea className="flex-1 min-h-0 pr-2" viewportRef={parentRef}>
            {repoManifest.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 gap-3 text-muted-foreground animate-in fade-in duration-700">
                    <div className="p-4 rounded-full bg-primary/5 mb-1">
                        <Layers className="w-12 h-12 opacity-30 text-primary" />
                    </div>
                    <h3 className="text-base font-semibold text-foreground/80">{t('Cloud.Hints.NoPublished')}</h3>
                    <p className="text-xs max-w-xs text-center leading-relaxed px-6 opacity-70">
                        {t('Cloud.Hints.NoPublishedDesc')}
                    </p>
                    <Button
                        variant="outline"
                        size="sm"
                        className="mt-4 shadow-sm hover:bg-primary hover:text-primary-foreground transition-all"
                        onClick={() => setCurrentTab('upload')}
                    >
                        {t('Cloud.Actions.GoPublish')}
                    </Button>
                </div>
            ) : filteredEntries.length === 0 ? (
                <div className="flex flex-col items-center justify-center pt-24 text-muted-foreground">
                    <Search className="w-14 h-14 mb-4 opacity-20" />
                    <p className="text-sm font-medium">{t('Common.Labels.NoPlugins')}</p>
                </div>
            ) : containerWidth === 0 ? (
                <div className="flex items-center justify-center pt-24 text-muted-foreground animate-in fade-in duration-300">
                    <RefreshCw className="w-8 h-8 animate-spin text-primary/30" />
                </div>
            ) : (
                <div
                    className="relative w-full overflow-hidden"
                    style={{
                        height: `${rowVirtualizer.getTotalSize()}px`,
                    }}
                >
                    {virtualItems.map((virtualRow) => {
                        const startIndex = virtualRow.index * columns;
                        const itemsInRow = filteredEntries.slice(startIndex, startIndex + columns);

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
                                    gap: '16px',
                                    paddingBottom: '16px',
                                }}
                            >
                                {itemsInRow.map((entry) => (
                                    <MyTranslationCard
                                        key={entry.id}
                                        entry={entry}
                                        onEdit={() => handleEdit(entry)}
                                        onDelete={() => handleDelete(entry)}
                                        onDownload={() => handleDownload(entry)}
                                        onHistory={() => { setHistoryDialogEntryId(entry.id); setCurrentTab('history'); }}
                                        isDeleting={deletingId === entry.id}
                                        isDownloading={downloadingId === entry.id}
                                        updateStatus={getUpdateStatus(entry)}
                                    />
                                ))}
                            </div>
                        );
                    })}
                </div>
            )}
        </ScrollArea>
    );
};
