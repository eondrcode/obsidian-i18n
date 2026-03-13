/**
 * 下载页 Tab
 * 重构：通过输入仓库地址获取翻译列表
 */
import React, { useCallback, useState, useRef } from 'react';
import { Input, Button, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, Tabs, TabsList, TabsTrigger, TabsContent } from '@/src/shadcn';
import { Search, RefreshCw, Download, ExternalLink, User, Package, Globe, Tag, Info, History, X, Clock, Plus, Bookmark, ChevronRight, Star, FileText, MessageSquareWarning, TrendingUp, Palette } from 'lucide-react';
import { Notice } from 'obsidian';
import { useTranslation } from 'react-i18next';
import { useCloudStore } from '../cloud-store';
import { useGlobalStoreInstance } from '~/utils';
import { t } from '@/src/locales/index';
import { ManifestEntry, getCloudFilePath } from '../types';
import { SUPPORTED_LANGUAGES } from '~/constants/languages';
import { ScrollArea } from '~/shadcn/ui/scroll-area';
import { TranslationSource } from '~/types';
import { Badge } from '~/shadcn/ui/badge';
import { cn } from '~/shadcn/lib/utils';
import { calculateChecksum } from '~/utils';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

type UpdateStatus = 'not_downloaded' | 'up_to_date' | 'update_available' | 'fork_available';

export const ExploreTab: React.FC = () => {
    const { t: t_i18n } = useTranslation();
    const i18n = useGlobalStoreInstance.getState().i18n;
    const sourceUpdateTick = useGlobalStoreInstance((state) => state.sourceUpdateTick);

    const targetRepoAddress = useCloudStore.use.targetRepoAddress();
    const setTargetRepoAddress = useCloudStore.use.setTargetRepoAddress();
    const targetManifest = useCloudStore.use.targetManifest();
    const setTargetManifest = useCloudStore.use.setTargetManifest();
    const targetRepoStars = useCloudStore.use.targetRepoStars();
    const setTargetRepoStars = useCloudStore.use.setTargetRepoStars();
    const targetRepoReadme = useCloudStore.use.targetRepoReadme();
    const setTargetRepoReadme = useCloudStore.use.setTargetRepoReadme();

    const savedRepos = useCloudStore.use.savedRepos();
    const setSavedRepos = useCloudStore.use.setSavedRepos();
    const addSavedRepo = useCloudStore.use.addSavedRepo();
    const removeSavedRepo = useCloudStore.use.removeSavedRepo();

    const [filterLanguage, setFilterLanguage] = useState(i18n.settings.language || 'zh-cn');
    const [filterQuery, setFilterQuery] = useState('');
    const [isFetching, setIsFetching] = useState(false);
    const [downloadingId, setDownloadingId] = useState<string | null>(null);
    const [rightTab, setRightTab] = useState<'plugins' | 'readme' | 'updates'>('plugins');

    const outdatedSources = useCloudStore.use.outdatedSources();
    const setOutdatedSources = useCloudStore.use.setOutdatedSources();
    const isCheckingUpdates = useCloudStore.use.isCheckingUpdates();
    const setIsCheckingUpdates = useCloudStore.use.setIsCheckingUpdates();

    /**
     * 核心逻辑：检查所有已订阅仓库的更新
     */
    const handleCheckAllUpdates = useCallback(async () => {
        if (isCheckingUpdates || savedRepos.length === 0) return;

        setIsCheckingUpdates(true);
        const manager = i18n.sourceManager;
        const allLocalSources = manager.getAllSources();
        const foundOutdated: any[] = [];

        try {
            // 并发检查所有订阅的仓库
            await Promise.all(savedRepos.map(async (address) => {
                const [owner, repo] = address.split('/');
                try {
                    const res = await i18n.api.github.getFileContent(owner, repo, 'metadata.json');
                    if (res.state && res.data?.content) {
                        const decoded = Buffer.from(res.data.content, 'base64').toString('utf-8');
                        const remoteManifest: ManifestEntry[] = JSON.parse(decoded);

                        // 比对本地已安装的来自该仓库的翻译
                        remoteManifest.forEach(remoteEntry => {
                            const local = allLocalSources.find(s =>
                                s.id === remoteEntry.id &&
                                s.cloud?.owner === owner &&
                                s.cloud?.repo === repo
                            );

                            if (local && local.cloud?.hash !== remoteEntry.hash) {
                                foundOutdated.push({
                                    sourceId: local.id,
                                    pluginId: local.plugin,
                                    title: remoteEntry.title || local.title,
                                    currentVersion: local.cloud?.hash.substring(0, 7) || 'unknown',
                                    newVersion: remoteEntry.hash.substring(0, 7),
                                    repoAddress: address,
                                    newHash: remoteEntry.hash
                                });
                            }
                        });
                    }
                } catch (e) {
                    console.error(t_i18n('Cloud.Tips.CheckFailRepo', { address }), e);
                }
            }));

            setOutdatedSources(foundOutdated);
            if (foundOutdated.length > 0) {
                i18n.notice.infoPrefix(t('Cloud.Notices.CheckComplete'), t('Cloud.Notices.FoundUpdates', { count: foundOutdated.length }));
            } else {
                i18n.notice.successPrefix(t('Cloud.Notices.CheckComplete'), t('Cloud.Notices.AllUpToDate'));
            }
        } catch (error) {
            console.error(t('Cloud.Tips.CheckFail'), error);
        } finally {
            setIsCheckingUpdates(false);
        }
    }, [i18n, savedRepos, isCheckingUpdates, setOutdatedSources, setIsCheckingUpdates, t]);

    /**
     * 一键更新所有待更新项
     */
    const handleUpdateAll = useCallback(async () => {
        if (outdatedSources.length === 0 || downloadingId) return;

        const confirm = window.confirm(t('Cloud.Dialogs.ConfirmUpdateAll', { count: outdatedSources.length }));
        if (!confirm) return;

        let successCount = 0;
        for (const item of outdatedSources) {
            setDownloadingId(item.sourceId);
            try {
                const [owner, repo] = item.repoAddress.split('/');
                const manager = i18n.sourceManager;
                const existing = manager.getSource(item.sourceId);
                const fileRes = await i18n.api.github.getFileContent(owner, repo, getCloudFilePath(item.sourceId, existing?.type || 'plugin'));
                if (fileRes.state && fileRes.data?.content) {
                    const content = JSON.parse(Buffer.from(fileRes.data.content, 'base64').toString('utf-8'));

                    if (existing) {
                        manager.saveSourceFile(existing.id, content);
                        manager.saveSource({
                            ...existing,
                            checksum: calculateChecksum(content),
                            cloud: {
                                ...existing.cloud!,
                                hash: item.newHash,
                            },
                            updatedAt: Date.now(),
                        });
                        successCount++;
                    }
                }
            } catch (e) {
                new Notice(t_i18n('Cloud.Errors.AddFail'));
                console.error(`${t_i18n('Cloud.Errors.UpdateFail', '', { title: item.title })}`, e);
            }
        }

        setDownloadingId(null);
        setOutdatedSources([]); // 清空已处理列表
        i18n.notice.successPrefix(t_i18n('Cloud.Notices.UpdateComplete'), t_i18n('Cloud.Notices.UpdateSuccessCount', '', { count: successCount }));
    }, [i18n, outdatedSources, downloadingId, setOutdatedSources, t_i18n]);

    /**
     * 检测某个 manifest 条目的本地下载/更新状态
     * 通过比对 id + cloud.owner + cloud.repo 定位本地翻译源，再比对 hash
     */
    const getUpdateStatus = useCallback((entry: ManifestEntry): UpdateStatus => {
        const manager = i18n.sourceManager;
        if (!manager) return 'not_downloaded';

        const parts = targetRepoAddress.trim().split('/');
        if (parts.length !== 2) return 'not_downloaded';
        const [owner, repo] = parts;

        // 在所有本地源中查找匹配的云端翻译（不再限定 origin === 'cloud'）
        const allSources = manager.getAllSources();
        const matchedSource = allSources.find(s => s.id === entry.id);

        if (!matchedSource) return 'not_downloaded';
        if (matchedSource.origin === 'local' || matchedSource.cloud?.owner !== owner || matchedSource.cloud?.repo !== repo) return 'fork_available';
        if (matchedSource.cloud?.hash !== entry.hash) return 'update_available';
        return 'up_to_date';
    }, [i18n, targetRepoAddress, sourceUpdateTick]);

    // 初始化加载资源站列表
    React.useEffect(() => {
        if (i18n.settings.cloudRepos) {
            setSavedRepos(i18n.settings.cloudRepos);
        }
    }, [i18n.settings.cloudRepos, setSavedRepos]);

    // 持久化资源站列表
    const persistRepos = useCallback((repos: string[]) => {
        i18n.settings.cloudRepos = repos;
        i18n.saveSettings();
    }, [i18n]);



    // 获取仓库的 manifest
    const handleFetchManifest = useCallback(async (addressOverride?: string) => {
        const addressToFetch = addressOverride || targetRepoAddress;

        if (!addressToFetch.trim()) {
            i18n.notice.errorPrefix(t_i18n('Cloud.Errors.FetchFail'), t_i18n('Cloud.Placeholders.Repo'));
            return;
        }

        // 解析 owner/repo
        const parts = addressToFetch.trim().split('/');
        if (parts.length !== 2) {
            i18n.notice.errorPrefix(t_i18n('Cloud.Errors.FetchFail'), t_i18n('Cloud.Hints.RepoFormatTip'));
            return;
        }

        const [owner, repo] = parts;
        const normalizedAddress = `${owner}/${repo}`;
        const githubUser = useCloudStore.getState().githubUser;
        const userRepo = i18n.settings.shareRepo;

        // 禁止在探索页面查询自己的仓库，自己的翻译包应在“管理 (My Translations)”页操作
        if (githubUser?.login && userRepo && normalizedAddress.toLowerCase() === `${githubUser.login}/${userRepo}`.toLowerCase()) {
            i18n.notice.errorPrefix(t_i18n('Cloud.Labels.AccessLimit'), t_i18n('Cloud.Hints.NoSelfExplore'));
            return;
        }

        setIsFetching(true);
        try {
            // 将 getRawContent 换成 getFileContent 以获取更实时的内容（API 节点比 Raw 节点更新更快）
            const res = await i18n.api.github.getFileContent(owner, repo, 'metadata.json');
            if (res.state && res.data?.content) {
                // 解码 Base64 内容
                const decoded = Buffer.from(res.data.content, 'base64').toString('utf-8');
                const parsed = JSON.parse(decoded);

                if (Array.isArray(parsed)) {
                    setTargetManifest(parsed);

                    // 如果是新地址，添加到保存列表
                    if (!savedRepos.includes(normalizedAddress)) {
                        const newRepos = [...savedRepos, normalizedAddress];
                        addSavedRepo(normalizedAddress);
                        persistRepos(newRepos);
                    }

                    if (parsed.length === 0) {
                        i18n.notice.successPrefix(t_i18n('Cloud.Notices.FetchSuccess'), t_i18n('Cloud.Tips.NoTranslations'));
                    } else {
                        i18n.notice.successPrefix(t_i18n('Cloud.Notices.FetchSuccess'), t_i18n('Cloud.Tips.FoundTranslations', '', { count: parsed.length }));
                    }
                } else {
                    new Notice(t_i18n('Cloud.Errors.RepoNotExist', '', { address: addressToFetch }));
                    return;
                }
            } else {
                setTargetManifest([]);
                i18n.notice.errorPrefix(t_i18n('Cloud.Errors.FetchFail'), t_i18n('Cloud.Tips.ManifestNotFound'));
            }

            // [新增] 异步无阻塞获取仓库星标数
            i18n.api.github.getRepoInfo(owner, repo).then(repoRes => {
                if (repoRes.state && repoRes.data) {
                    setTargetRepoStars(repoRes.data.stargazers_count);
                } else {
                    setTargetRepoStars(null);
                }
            }).catch(() => setTargetRepoStars(null));

            // [新增] 异步获取 README.md
            i18n.api.github.getFileContent(owner, repo, 'README.md').then(readmeRes => {
                if (readmeRes.state && readmeRes.data?.content) {
                    const decoded = Buffer.from(readmeRes.data.content, 'base64').toString('utf-8');
                    setTargetRepoReadme(decoded);
                } else {
                    setTargetRepoReadme(null);
                }
            }).catch(() => setTargetRepoReadme(null));

        } catch (error: any) {
            console.error(t_i18n('Cloud.Tips.FetchFailManifest'), error);
            new Notice(t_i18n('Cloud.Errors.FetchFail') + `: ${error}`);
            setTargetManifest([]);
            setTargetRepoStars(null);
            setTargetRepoReadme(null);
            setRightTab('plugins');
        } finally {
            setIsFetching(false);
        }
    }, [targetRepoAddress, i18n, setTargetManifest, addSavedRepo, savedRepos, persistRepos, setTargetRepoStars, setTargetRepoReadme, t_i18n]);

    const handleQuickLoad = useCallback((address: string) => {
        if (address !== targetRepoAddress) {
            setTargetManifest([]);
            setTargetRepoStars(null);
            setTargetRepoReadme(null);
            setRightTab('plugins');
        }
        setTargetRepoAddress(address);
        // 直接触发获取逻辑，不再依赖 DOM 点击，避开 Shadow DOM 限制
        handleFetchManifest(address);
    }, [targetRepoAddress, setTargetRepoAddress, handleFetchManifest, setTargetManifest, setTargetRepoStars, setTargetRepoReadme]);

    const handleRemoveRepo = useCallback((e: React.MouseEvent, address: string) => {
        e.stopPropagation();
        removeSavedRepo(address);
        const newRepos = savedRepos.filter(h => h !== address);
        persistRepos(newRepos);
        new Notice(t_i18n('Cloud.Notices.RepoUnsubscribed'));
    }, [removeSavedRepo, savedRepos, persistRepos, t_i18n]);

    // 过滤 manifest 条目
    const filteredEntries = targetManifest.filter((entry) => {
        if (filterLanguage && entry.language !== filterLanguage) return false;
        if (filterQuery && !entry.plugin.toLowerCase().includes(filterQuery.toLowerCase()) &&
            !entry.title.toLowerCase().includes(filterQuery.toLowerCase())) return false;
        return true;
    });

    // 下载翻译（支持更新已存在的翻译源）
    const handleDownload = useCallback(async (entry: ManifestEntry) => {
        const parts = targetRepoAddress.trim().split('/');
        if (parts.length !== 2) return;
        if (downloadingId) return; // 防止并发下载
        const [owner, repo] = parts;

        setDownloadingId(entry.id);
        try {
            // 1. 获取翻译文件内容 (使用 getFileContent 绕开 Raw 节点的 CDN 缓存)
            const fileRes = await i18n.api.github.getFileContent(owner, repo, getCloudFilePath(entry.id, entry.type));
            if (!fileRes.state || !fileRes.data?.content) {
                throw new Error(t_i18n('Cloud.Errors.DownloadFail'));
            }

            // 解码 Base64 内容并解析为对象（避免 saveSourceFile 再次 stringify 导致双重序列化）
            const rawContent = Buffer.from(fileRes.data.content, 'base64').toString('utf-8');
            const content = JSON.parse(rawContent);
            const manager = i18n.sourceManager;
            if (!manager) {
                throw new Error(t_i18n('Cloud.Status.Fetching')); // Or something more appropriate
            }

            // 2. 检查是否已存在同一云端条目（考虑到本地新建的翻译可能还没绑定 cloud，只校验 id）
            const existingSource = manager.getAllSources().find(s => s.id === entry.id);

            if (existingSource) {
                // 如果 owner 不一致，触发 fork 覆盖确认。如果本地源没有 cloud 信息，也视作被覆盖
                const isSameOwner = existingSource.cloud?.owner === owner && existingSource.cloud?.repo === repo;
                if (!isSameOwner) {
                    const confirmMsg = t_i18n('Cloud.Dialogs.ConfirmOverwrite', '', {
                        owner: existingSource.cloud?.owner || t_i18n('Cloud.Status.Local'),
                        newOwner: owner
                    });
                    if (!window.confirm(confirmMsg)) {
                        setDownloadingId(null);
                        return;
                    }
                }
                // === 更新模式 ===
                manager.saveSourceFile(existingSource.id, content);
                const updatedSource: TranslationSource = {
                    ...existingSource,
                    origin: 'cloud',
                    title: entry.title || existingSource.title,
                    checksum: calculateChecksum(content),
                    cloud: {
                        owner,
                        repo,
                        hash: entry.hash,
                    },
                    updatedAt: Date.now(),
                };
                manager.saveSource(updatedSource);
                i18n.notice.successPrefix(t_i18n('Cloud.Notices.UpdateSuccess'), t_i18n('Cloud.Tips.UpdatedItem', '', { title: updatedSource.title }));
            } else {
                // === 新建模式 ===
                const sourceId = entry.id;
                manager.saveSourceFile(sourceId, content);

                const sourceInfo: TranslationSource = {
                    id: sourceId,
                    plugin: entry.plugin,
                    title: entry.title || t_i18n('Common.Status.Unknown'),
                    type: entry.type,
                    origin: 'cloud',
                    isActive: false,
                    checksum: calculateChecksum(content),
                    cloud: {
                        owner,
                        repo,
                        hash: entry.hash,
                    },
                    updatedAt: Date.now(),
                    createdAt: Date.now(),
                };

                manager.saveSource(sourceInfo);

                if (!manager.getActiveSourceId(entry.plugin)) {
                    manager.setActive(sourceId, true);
                    i18n.notice.successPrefix(t_i18n('Cloud.Notices.DownloadSuccess'), t_i18n('Cloud.Tips.AddedAndActive', '', { title: sourceInfo.title }));
                } else {
                    i18n.notice.successPrefix(t_i18n('Cloud.Notices.DownloadSuccess'), t_i18n('Cloud.Tips.AddedSource', '', { title: sourceInfo.title }));
                }
            }

        } catch (error) {
            console.error(t_i18n('Cloud.Errors.DownloadFail'), error);
            i18n.notice.errorPrefix(t_i18n('Cloud.Errors.DownloadFail'), `${error}`);
        } finally {
            setDownloadingId(null);
        }
    }, [i18n, targetRepoAddress, downloadingId, t_i18n]);

    return (
        <div className="flex h-full gap-0 overflow-hidden min-h-0 animate-in fade-in duration-500">
            {/* 左侧侧边栏：源管理 */}
            <aside className="w-[300px] flex flex-col border-r border-border/30 pr-4 shrink-0 overflow-hidden min-h-0">
                <ScrollArea className="flex-1">
                    <div className="space-y-6 pb-6 pt-1">
                        <div className="flex flex-col gap-3">
                            <div className="flex items-center gap-2 text-sm font-semibold text-foreground/80">
                                <Bookmark className="w-4 h-4 text-primary" />
                                <span>{t_i18n('Cloud.Labels.ResourceCenter')}</span>
                            </div>

                            <div className="flex gap-2">
                                <div className="relative group flex-1">
                                    <Globe className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                                    <Input
                                        placeholder={t_i18n('Cloud.Placeholders.SearchRepo')}
                                        value={targetRepoAddress}
                                        onChange={(e) => setTargetRepoAddress(e.target.value)}
                                        className="pl-8 font-mono text-xs h-9 border-border/60 focus:border-primary/50 w-full"
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter') {
                                                e.preventDefault();
                                                handleFetchManifest();
                                            }
                                        }}
                                    />
                                </div>
                                <Button
                                    onClick={() => handleFetchManifest()}
                                    disabled={isFetching || !targetRepoAddress}
                                    className="h-9 px-4 shrink-0 shadow-sm transition-all"
                                >
                                    {isFetching ? <RefreshCw className="w-4 h-4 animate-spin" /> : t_i18n('Cloud.Actions.Add')}
                                </Button>
                            </div>


                        </div>

                        {/* 已固定的资源站列表 */}
                        {savedRepos.length > 0 && (
                            <div className="space-y-3">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2 text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                                        <Bookmark className="w-3 h-3 text-primary/60" />
                                        <span>{t_i18n('Cloud.Labels.SubscriptionList')}</span>
                                    </div>
                                    <span className="text-[9px] font-medium opacity-40 px-1.5 py-0.5 bg-muted rounded">
                                        {savedRepos.length}
                                    </span>
                                </div>

                                <div className="flex flex-col gap-2">
                                    {savedRepos.map((address) => {
                                        const [owner, repo] = address.split('/');
                                        const isActive = targetRepoAddress === address && targetManifest.length > 0;
                                        const hasUpdate = outdatedSources.some(s => s.repoAddress === address);

                                        return (
                                            <div
                                                key={address}
                                                className={cn(
                                                    "group relative flex items-center gap-3 p-2.5 rounded-lg border transition-all cursor-pointer",
                                                    isActive
                                                        ? "bg-primary/5 border-primary/40 shadow-sm ring-1 ring-primary/20"
                                                        : "bg-muted/20 border-border/40 hover:bg-muted/50 hover:border-border/60"
                                                )}
                                                onClick={() => handleQuickLoad(address)}
                                            >
                                                <div className={cn(
                                                    "flex items-center justify-center w-7 h-7 rounded-md shrink-0 transition-colors",
                                                    isActive ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground group-hover:bg-muted-foreground/10"
                                                )}>
                                                    <Globe className="w-3.5 h-3.5" />
                                                </div>

                                                <div className="flex-1 min-w-0">
                                                    <div className="text-[9px] text-muted-foreground/70 truncate uppercase font-bold tracking-tight flex items-center gap-1.5">
                                                        {owner}
                                                        {hasUpdate && <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />}
                                                    </div>
                                                    <div className="text-[11px] font-semibold text-foreground truncate -mt-0.5">
                                                        {repo}
                                                    </div>
                                                </div>

                                                <button
                                                    className="p-1 px-1.5 rounded-md hover:bg-destructive/10 hover:text-destructive opacity-0 group-hover:opacity-100 transition-all font-mono"
                                                    onClick={(e) => handleRemoveRepo(e, address)}
                                                    title={t_i18n('Cloud.Actions.Unsubscribe')}
                                                >
                                                    <X className="w-3 h-3" />
                                                </button>

                                                {isActive && (
                                                    <div className="absolute top-2 right-2 flex h-1.5 w-1.5">
                                                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                                                        <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-primary"></span>
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}

                        <div className="pt-4 border-t border-border/20 text-[10px] text-muted-foreground/60 leading-relaxed italic">
                            {t_i18n('Cloud.Tabs.Explore')}
                        </div>
                    </div>
                </ScrollArea>
            </aside>

            {/* 右侧主内容：翻译列表与 README 切换 */}
            <main className="flex-1 flex flex-col pt-1 pl-4 overflow-hidden min-h-0 border-l border-border/10">
                <Tabs value={rightTab} onValueChange={(v) => setRightTab(v as any)} className="flex-1 flex flex-col overflow-hidden">
                    {/* 顶部工具栏 (优化为上下两行结构) */}
                    <div className="flex flex-col gap-3 mb-5 mt-1 border border-border/40 rounded-xl bg-card/60 p-3 shadow-sm backdrop-blur-sm">
                        {/* 第一行：主要导航与全局操作 */}
                        <div className="flex items-center justify-between pb-3 border-b border-border/30">
                            <TabsList className="h-9 p-1 bg-muted/50 border border-border/40 rounded-lg shadow-inner">
                                <TabsTrigger value="plugins" className="text-xs px-4 h-7 data-[state=active]:bg-background data-[state=active]:shadow-sm rounded-md transition-all">
                                    <Package className="w-3.5 h-3.5 mr-1.5 text-muted-foreground" />
                                    {t_i18n('Cloud.Tabs.Browse')}
                                </TabsTrigger>
                                <TabsTrigger value="readme" className="text-xs px-4 h-7 data-[state=active]:bg-background data-[state=active]:shadow-sm rounded-md transition-all" disabled={targetManifest.length === 0}>
                                    <FileText className="w-3.5 h-3.5 mr-1.5 text-muted-foreground" />
                                    {t_i18n('Cloud.Tabs.Readme')}
                                </TabsTrigger>
                                <TabsTrigger value="updates" className="text-xs px-4 h-7 data-[state=active]:bg-background data-[state=active]:shadow-sm relative rounded-md transition-all">
                                    <RefreshCw className={cn("w-3.5 h-3.5 mr-1.5 text-muted-foreground", isCheckingUpdates && "animate-spin")} />
                                    {t_i18n('Cloud.Tabs.Updates')}
                                    {outdatedSources.length > 0 && (
                                        <span className="absolute -top-1 -right-1 flex h-3 w-3">
                                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                                            <span className="relative inline-flex rounded-full h-3 w-3 bg-amber-500 text-[8px] flex items-center justify-center text-white font-bold">
                                                {outdatedSources.length}
                                            </span>
                                        </span>
                                    )}
                                </TabsTrigger>
                            </TabsList>
                            <Button
                                onClick={handleCheckAllUpdates}
                                disabled={isCheckingUpdates || savedRepos.length === 0}
                                size="sm"
                                className="h-9 px-4 shrink-0 shadow-sm hover:shadow-md transition-all group rounded-lg"
                            >
                                {isCheckingUpdates ? (
                                    <RefreshCw className="w-4 h-4 animate-spin mr-2" />
                                ) : (
                                    <TrendingUp className="w-4 h-4 mr-2 opacity-80 group-hover:scale-110 transition-transform" />
                                )}
                                <span className="font-semibold text-xs tracking-wide">{t_i18n('Cloud.Actions.CheckAllUpdates')}</span>
                                {outdatedSources.length > 0 && (
                                    <span className="ml-2 px-1.5 py-0.5 rounded-full bg-background/20 text-white text-[10px] font-bold animate-pulse">
                                        {outdatedSources.length}
                                    </span>
                                )}
                            </Button>
                        </div>

                        {/* 第二行：当前上下文与过滤搜索 */}
                        <div className="flex items-center justify-between min-h-[32px] px-1">
                            {/* 左侧：仓库上下文状态 */}
                            <div className="flex items-center gap-2 text-[13px] font-semibold text-muted-foreground/80">
                                {rightTab === 'updates' ? (
                                    <div className="flex items-center gap-2 px-2 py-1 rounded-md bg-amber-500/10 text-amber-600 border border-amber-500/20">
                                        <TrendingUp className="w-4 h-4" />
                                        <span>{t_i18n('Cloud.Labels.PendingUpdates')}</span>
                                    </div>
                                ) : targetManifest.length > 0 ? (
                                    <div className="flex items-center gap-2.5">
                                        <div className="flex items-center justify-center w-6 h-6 rounded bg-primary/10 text-primary shrink-0">
                                            <Globe className="w-3.5 h-3.5" />
                                        </div>
                                        <a
                                            href={`https://github.com/${targetRepoAddress}`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="max-w-[200px] truncate text-foreground/90 hover:text-primary hover:underline transition-colors decoration-primary/30 underline-offset-4"
                                            title={t_i18n('Cloud.Labels.ViewOnGithub', { repo: targetRepoAddress })}
                                        >
                                            {targetRepoAddress}
                                        </a>
                                        {targetRepoStars !== null && (
                                            <Badge variant="outline" className="ml-1 px-1.5 py-0 h-5 bg-yellow-500/10 border-yellow-500/30 text-yellow-600 gap-1 font-mono shadow-sm">
                                                <Star className="w-2.5 h-2.5 fill-current" />
                                                {targetRepoStars}
                                            </Badge>
                                        )}
                                    </div>
                                ) : (
                                    <div className="flex items-center gap-2 px-2 py-1 opacity-60">
                                        <Search className="w-4 h-4" />
                                        <span className="text-xs tracking-wide">{t_i18n('Cloud.Labels.WaitingFetch')}</span>
                                    </div>
                                )}
                            </div>

                            {/* 右侧：搜索过滤（仅在 plugins 标签下起作用） */}
                            <div className={cn("flex items-center gap-3 shrink-0 transition-opacity", rightTab !== 'plugins' ? 'opacity-30 pointer-events-none' : 'opacity-100')}>
                                <div className="relative group w-56 shadow-sm">
                                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground group-focus-within:text-primary transition-colors" />
                                    <Input
                                        placeholder={t_i18n('Cloud.Placeholders.SearchPlugins')}
                                        value={filterQuery}
                                        onChange={(e) => setFilterQuery(e.target.value)}
                                        disabled={targetManifest.length === 0}
                                        className="pl-8 h-8 text-xs bg-background border-border/60 focus:border-primary/50 transition-all rounded-md"
                                    />
                                </div>
                                <Select value={filterLanguage} onValueChange={setFilterLanguage} disabled={targetManifest.length === 0}>
                                    <SelectTrigger size="sm" className="w-32 text-xs bg-background border-border/60 rounded-md shadow-sm">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
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

                    {/* 翻译列表 Tab Content */}
                    <TabsContent value="plugins" className="flex-1 min-h-0 m-0 outline-none data-[state=active]:flex flex-col relative z-10 animate-in fade-in slide-in-from-bottom-2 duration-300">
                        <ScrollArea className="flex-1 min-h-0">
                            <div className="pb-6 pr-4">
                                {isFetching ? (
                                    <div className="flex flex-col items-center justify-center pt-32 text-muted-foreground animate-in fade-in duration-300">
                                        <RefreshCw className="w-10 h-10 animate-spin text-primary/50 mb-4" />
                                        <p className="text-sm font-medium tracking-tight">{t_i18n('Cloud.Labels.FetchingResources')}</p>
                                    </div>
                                ) : targetManifest.length === 0 ? (
                                    <div className="flex flex-col items-center justify-center pt-32 text-muted-foreground animate-in fade-in duration-700">
                                        <div className="p-10 rounded-full bg-primary/5 mb-6 ring-1 ring-primary/10">
                                            <Package className="w-20 h-20 opacity-20 text-primary" />
                                        </div>
                                        <h3 className="text-xl font-bold text-foreground/80 tracking-tight">{t_i18n('Cloud.Labels.DiscoverTranslations')}</h3>
                                        <p className="text-sm mt-2 text-center text-muted-foreground/60 max-w-[320px] leading-relaxed">
                                            {t_i18n('Cloud.Tips.DiscoverDesc')}
                                        </p>
                                    </div>
                                ) : filteredEntries.length === 0 ? (
                                    <div className="flex flex-col items-center justify-center pt-32 text-muted-foreground">
                                        <Search className="w-14 h-14 mb-4 opacity-20" />
                                        <p className="text-sm font-medium">{t_i18n('Cloud.Tips.NoMatchesInRepo')}</p>
                                        <Button variant="link" size="sm" onClick={() => { setFilterQuery(''); setFilterLanguage('zh-cn'); }} className="mt-2 text-primary/60">
                                            {t_i18n('Cloud.Actions.ClearFilters')}
                                        </Button>
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-1 md:grid-cols-2 2xl:grid-cols-3 gap-4">
                                        {filteredEntries.map((entry) => (
                                            <ManifestEntryCard
                                                key={entry.id}
                                                entry={entry}
                                                onDownload={() => handleDownload(entry)}
                                                isDownloading={downloadingId === entry.id}
                                                updateStatus={getUpdateStatus(entry)}
                                                repoAddress={targetRepoAddress}
                                            />
                                        ))}
                                    </div>
                                )}
                            </div>
                        </ScrollArea>
                    </TabsContent>

                    {/* README 介绍 Tab Content */}
                    <TabsContent value="readme" className="flex-1 min-h-0 m-0 outline-none data-[state=active]:flex flex-col relative z-10 animate-in fade-in slide-in-from-bottom-2 duration-300 bg-card rounded-xl border shadow-sm">
                        <ScrollArea className="flex-1 min-h-0">
                            <div className="p-6">
                                {isFetching ? (
                                    <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
                                        <RefreshCw className="w-8 h-8 animate-spin opacity-50 mb-3" />
                                        <p className="text-sm">{t_i18n('Cloud.Labels.PleaseWait')}</p>
                                    </div>
                                ) : targetRepoReadme ? (
                                    <MarkdownViewer content={targetRepoReadme} />
                                ) : (
                                    <div className="flex flex-col items-center justify-center py-32 text-muted-foreground border-2 border-dashed border-border/40 rounded-xl bg-muted/10 mx-auto max-w-md">
                                        <FileText className="w-12 h-12 mb-4 opacity-20" />
                                        <p className="text-sm font-medium">{t_i18n('Cloud.Tips.NoReadme')}</p>
                                        <p className="text-xs mt-1 text-muted-foreground/60 text-center px-6">{t_i18n('Cloud.Tips.NoReadmeDesc')}</p>
                                    </div>
                                )}
                            </div>
                        </ScrollArea>
                    </TabsContent>

                    {/* 更新管理 Tab Content */}
                    <TabsContent value="updates" className="flex-1 min-h-0 m-0 outline-none data-[state=active]:flex flex-col relative z-10 animate-in fade-in slide-in-from-bottom-2 duration-300">
                        <div className="flex items-center justify-between mb-4 px-1">
                            <div>
                                <h3 className="text-sm font-bold text-foreground">{t_i18n('Cloud.Labels.PendingUpdates')} ({outdatedSources.length})</h3>
                                <p className="text-[11px] text-muted-foreground mt-1">{t_i18n('Cloud.Labels.PendingUpdates')}</p>
                            </div>
                            <div className="flex items-center gap-2">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={handleCheckAllUpdates}
                                    disabled={isCheckingUpdates}
                                    className="h-8 text-xs"
                                >
                                    <RefreshCw className={cn("w-3.5 h-3.5 mr-2", isCheckingUpdates && "animate-spin")} />
                                    {t_i18n('Cloud.Actions.Recheck')}
                                </Button>
                                <Button
                                    size="sm"
                                    onClick={handleUpdateAll}
                                    disabled={outdatedSources.length === 0 || downloadingId !== null}
                                    className="h-8 text-xs bg-amber-500 hover:bg-amber-600 text-white border-none shadow-sm shadow-amber-500/20"
                                >
                                    <Download className="w-3.5 h-3.5 mr-2" />
                                    {t_i18n('Cloud.Actions.UpdateAll')}
                                </Button>
                            </div>
                        </div>

                        <ScrollArea className="flex-1 min-h-0 bg-muted/10 rounded-xl border border-dashed border-border/60">
                            <div className="p-4">
                                {outdatedSources.length === 0 ? (
                                    <div className="flex flex-col items-center justify-center py-32 text-muted-foreground">
                                        <div className="w-16 h-16 rounded-full bg-green-500/10 flex items-center justify-center mb-4">
                                            <TrendingUp className="w-8 h-8 text-green-500/60" />
                                        </div>
                                        <p className="text-sm font-bold text-foreground/70">{t_i18n('Cloud.Notices.AllUpToDate')}</p>
                                        <p className="text-xs mt-1 opacity-60">{t_i18n('Cloud.Tips.AllLatestDesc')}</p>
                                    </div>
                                ) : (
                                    <div className="space-y-3">
                                        {outdatedSources.map((item) => (
                                            <div
                                                key={item.sourceId}
                                                className="flex items-center justify-between p-3.5 bg-card rounded-lg border border-amber-500/20 shadow-sm group hover:border-amber-500/40 transition-all"
                                            >
                                                <div className="flex items-center gap-4 flex-1 min-w-0">
                                                    <div className="w-10 h-10 rounded-lg bg-amber-500/10 flex items-center justify-center shrink-0">
                                                        <Package className="w-5 h-5 text-amber-500" />
                                                    </div>
                                                    <div className="min-w-0 pr-4">
                                                        <h4 className="text-[13px] font-bold truncate">{item.title}</h4>
                                                        <div className="flex items-center gap-2 mt-1">
                                                            <span className="text-[10px] text-muted-foreground font-mono bg-muted px-1.5 py-0.5 rounded">{item.pluginId}</span>
                                                            <div className="flex items-center gap-1.5 text-[10px] text-amber-600/80 font-mono">
                                                                <span className="opacity-60">{item.currentVersion}</span>
                                                                <ChevronRight className="w-3 h-3 opacity-40" />
                                                                <span className="font-bold underline decoration-wavy underline-offset-2">{item.newVersion}</span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>

                                                <div className="flex items-center gap-3">
                                                    <div className="text-right hidden sm:block">
                                                        <div className="text-[10px] text-muted-foreground font-medium truncate max-w-[120px]">{t_i18n('Cloud.Labels.SourceFrom')}</div>
                                                        <div className="text-[11px] font-bold text-foreground/80 truncate max-w-[120px]">{item.repoAddress}</div>
                                                    </div>
                                                    <Button
                                                        size="sm"
                                                        variant="ghost"
                                                        className="h-8 group-hover:bg-amber-500 group-hover:text-white transition-all text-amber-600"
                                                        onClick={async () => {
                                                            const entry = targetManifest.find(e => e.id === item.sourceId) || {
                                                                id: item.sourceId,
                                                                plugin: item.pluginId,
                                                                title: item.title,
                                                                hash: item.newHash,
                                                                version: 'unknown',
                                                                language: 'unknown',
                                                                repo: item.repoAddress
                                                            } as any;
                                                            // 临时切换 repo 地址以满足 handleDownload 的闭包
                                                            const oldAddr = targetRepoAddress;
                                                            setTargetRepoAddress(item.repoAddress);
                                                            await handleDownload(entry);
                                                            setTargetRepoAddress(oldAddr);
                                                            setOutdatedSources(outdatedSources.filter(s => s.sourceId !== item.sourceId));
                                                        }}
                                                        disabled={downloadingId === item.sourceId}
                                                    >
                                                        {downloadingId === item.sourceId ? (
                                                            <RefreshCw className="w-3 h-3 animate-spin" />
                                                        ) : (
                                                            <Download className="w-3.5 h-3.5" />
                                                        )}
                                                        <span className="ml-2">{t_i18n('Cloud.Actions.Update')}</span>
                                                    </Button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </ScrollArea>
                    </TabsContent>
                </Tabs>
            </main>
        </div>
    );
};

// ========== Markdown 渲染组件 ==========
const MarkdownViewer = ({ content }: { content: string }) => {
    return (
        <div className="markdown-container">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {content}
            </ReactMarkdown>
        </div>
    );
};

// ========== 翻译条目卡片 ==========
interface ManifestEntryCardProps {
    entry: ManifestEntry;
    onDownload: () => void;
    isDownloading: boolean;
    updateStatus: UpdateStatus;
    repoAddress: string;
}

const ManifestEntryCard: React.FC<ManifestEntryCardProps> = ({ entry, onDownload, isDownloading, updateStatus, repoAddress }) => {
    const { t: t_i18n } = useTranslation();
    /** 构造 GitHub Issue 反馈链接 */
    const handleReportIssue = useCallback(() => {
        const title = encodeURIComponent(t_i18n('Cloud.Labels.ReportIssue') + `: ${entry.title} (${entry.plugin})`);
        const body = encodeURIComponent(
            t_i18n('Cloud.Labels.IssueTemplateBody', '', {
                plugin: entry.plugin,
                version: entry.version,
                language: entry.language,
                id: entry.id
            })
        );
        const url = `https://github.com/${repoAddress}/issues/new?title=${title}&body=${body}`;
        window.open(url);
    }, [entry, repoAddress]);

    return (
        <div className={cn(
            "group flex flex-col overflow-hidden bg-card text-card-foreground rounded-xl border shadow-sm transition-all duration-200 animate-in fade-in h-full relative",
            "hover:shadow-md",
            updateStatus === 'update_available'
                ? "border-amber-400/60 hover:border-amber-500/80 ring-1 ring-amber-400/20"
                : updateStatus === 'fork_available'
                    ? "border-purple-400/50 hover:border-purple-500/80 ring-1 ring-purple-400/20"
                    : updateStatus === 'up_to_date'
                        ? "border-green-400/40 hover:border-green-500/50 ring-1 ring-green-400/5 hover:ring-green-400/10"
                        : "border-border/50 hover:border-primary/30",
        )}>
            {/* 内容区：我们自己控制精确的 Padding */}
            <div className="flex flex-col flex-1 p-3.5 pb-2.5 min-h-0 relative z-10">
                {/* 第一行：标题 + 版本 Badge */}
                <div className="flex items-start justify-between gap-2 mb-1.5">
                    <div className="flex items-center gap-2.5 flex-1 min-w-0">
                        {/* 标题前缀图标：动态着色区分插件与主题 */}
                        <div className={cn(
                            "flex items-center justify-center w-6 h-6 rounded-md shrink-0 shadow-sm ring-1",
                            entry.type === 'theme'
                                ? "bg-sky-500/10 text-sky-600 ring-sky-500/20"
                                : "bg-emerald-500/10 text-emerald-600 ring-emerald-500/20"
                        )}>
                            {entry.type === 'theme' ? (
                                <Palette className="w-3.5 h-3.5" />
                            ) : (
                                <Package className="w-3.5 h-3.5" />
                            )}
                        </div>
                        <h3 className="text-[13.5px] font-bold text-foreground leading-tight truncate pr-1" title={entry.title}>
                            {entry.title}
                        </h3>
                    </div>
                    {/* 右侧状态标签组 (移除冗余的类型 Badge) */}
                    <div className="flex items-center gap-1.5 shrink-0">
                        {updateStatus === 'up_to_date' && (
                            <Badge variant="outline" className="text-[9px] px-1.5 py-0 h-[18px] bg-green-500/10 border-green-500/30 text-green-600">
                                {t_i18n('Cloud.Status.UpToDate')}
                            </Badge>
                        )}
                        {updateStatus === 'fork_available' && (
                            <Badge variant="outline" className="text-[9px] px-1.5 py-0 h-[18px] bg-purple-500/10 border-purple-500/30 text-purple-600 animate-pulse">
                                {t_i18n('Cloud.Status.ForkAvailable')}
                            </Badge>
                        )}
                        {updateStatus === 'update_available' && (
                            <Badge variant="outline" className="text-[9px] px-1.5 py-0 h-[18px] bg-amber-500/10 border-amber-500/30 text-amber-600 animate-pulse">
                                {t_i18n('Cloud.Status.UpdateAvailable')}
                            </Badge>
                        )}
                        <Badge variant="outline" className="text-[9px] px-1.5 py-0 h-[18px] font-mono bg-primary/5 border-primary/20 text-primary/80">
                            v{entry.version}
                        </Badge>
                    </div>
                </div>

                {/* 描述区域：固定高度占位，不管是否有内容都占据相同空间 */}
                <div className="min-h-[44px] max-h-[44px] mt-1.5 mb-1.5 overflow-hidden">
                    {entry.description ? (
                        <p className="text-[11px] text-muted-foreground/70 line-clamp-2 leading-relaxed" title={entry.description}>
                            {entry.description}
                        </p>
                    ) : (
                        <p className="text-[11px] text-muted-foreground/30 italic">
                            {t_i18n('Common.Status.Unknown')}
                        </p>
                    )}
                </div>

                {/* 元数据标签：推到底部，紧贴操作栏上面 */}
                <div className="mt-auto pt-1.5 border-t border-border/10">
                    <div className="flex items-center gap-1.5 flex-wrap">
                        <span className={cn(
                            "inline-flex items-center gap-1 text-[10px] bg-muted/50 px-1.5 py-0.5 rounded font-mono truncate max-w-[140px]",
                            entry.type === 'theme' ? "text-sky-600/80" : "text-emerald-600/80"
                        )} title={`${entry.type === 'theme' ? t_i18n('Common.Labels.Themes') : t_i18n('Common.Labels.Plugins')}: ${entry.plugin}`}>
                            {entry.type === 'theme' ? (
                                <Palette className="w-3 h-3 shrink-0 opacity-70" />
                            ) : (
                                <Package className="w-3 h-3 shrink-0 opacity-70" />
                            )}
                            {entry.plugin}
                        </span>
                        <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground/60 bg-muted/50 px-1.5 py-0.5 rounded uppercase">
                            <Globe className="w-3 h-3 shrink-0 opacity-50" />
                            {entry.language}
                        </span>
                        {entry.updated_at && (
                            <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground/60 bg-muted/50 px-1.5 py-0.5 rounded cursor-default" title={`${t_i18n('Common.Labels.UpdatePrefix')} ${new Date(entry.updated_at).toLocaleString()}`}>
                                <Clock className="w-3 h-3 shrink-0 opacity-50" />
                                {new Date(entry.updated_at).toLocaleDateString(undefined, { month: '2-digit', day: '2-digit' })}
                            </span>
                        )}
                    </div>
                </div>
            </div>

            {/* 底部操作栏：下载 + 反馈 */}
            <div className="flex border-t border-border/30 mt-auto shrink-0 relative z-10">
                <button
                    onClick={onDownload}
                    disabled={isDownloading || updateStatus === 'up_to_date'}
                    className={cn(
                        "flex-1 flex items-center justify-center gap-1.5 py-2 text-[11px] font-medium transition-colors disabled:opacity-70",
                        updateStatus === 'up_to_date'
                            ? "text-green-600/70 cursor-not-allowed bg-green-500/5 hover:bg-green-500/5"
                            : updateStatus === 'update_available'
                                ? "text-amber-600 hover:bg-amber-500/10 hover:text-amber-700"
                                : updateStatus === 'fork_available'
                                    ? "text-purple-600 hover:bg-purple-500/10 hover:text-purple-700"
                                    : "text-muted-foreground hover:bg-primary/5 hover:text-primary"
                    )}
                >
                    {isDownloading
                        ? <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        : <Download className="w-3.5 h-3.5" />
                    }
                    {updateStatus === 'up_to_date' ? t_i18n('Cloud.Status.UpToDate') : updateStatus === 'update_available' ? t_i18n('Cloud.Actions.Update') : updateStatus === 'fork_available' ? t_i18n('Cloud.Actions.Overwrite') : t_i18n('Cloud.Actions.Download')}
                </button>
                <div className="w-[1px] bg-border/30" />
                <button
                    onClick={handleReportIssue}
                    className="flex items-center justify-center gap-1.5 px-4 py-2 text-[11px] font-medium text-muted-foreground hover:bg-orange-500/5 hover:text-orange-600 transition-colors"
                    title={t('Cloud.Labels.ReportIssue')}
                >
                    <MessageSquareWarning className="w-3.5 h-3.5" />
                    {t('Cloud.Labels.Feedback')}
                </button>
            </div>
        </div>
    );
};
