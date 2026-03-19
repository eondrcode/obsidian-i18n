/**
 * 云端翻译管理视图入口
 */
import React from 'react';
import { ItemView, WorkspaceLeaf } from 'obsidian';
import { Root, createRoot } from 'react-dom/client';

import I18N from '@/src/main';
import { Button, Tabs, TabsContent, TabsList, TabsTrigger, Card } from '~/shadcn';
import { Cloud, Download, Upload, FolderOpen, RefreshCw, User, UserCheck, LogOut, ChevronDown, Users } from 'lucide-react';
import { useGlobalStoreInstance } from '~/utils';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/src/shadcn/ui/dropdown-menu';

import { useTranslation } from 'react-i18next';
import { t } from '@/src/locales/index';

import { useCloudStore } from './cloud-store';
import { ExploreTab } from './components/explore-tab';
import { PublishTab } from './components/publish-tab';
import { ManageTab } from './components/manage-tab';
import { CommunityTab } from './components/community-tab';
import { HistoryTab } from './components/history-dialog';
import { BackupSyncTab } from './components/backup-sync-dialog';
import { mountReactView } from '~/utils';

// 视图类型
export const CLOUD_VIEW_TYPE = 'i18n-cloud-view';

// React 组件
const CloudViewContent: React.FC = () => {
    const { t } = useTranslation();
    const i18n = useGlobalStoreInstance.getState().i18n;

    const currentTab = useCloudStore.use.currentTab();
    const setCurrentTab = useCloudStore.use.setCurrentTab();
    const reset = useCloudStore.use.reset();

    const repoDataLoaded = useCloudStore.use.repoDataLoaded();
    const repoChecking = useCloudStore.use.repoChecking();
    const repoInitialized = useCloudStore.use.repoInitialized();
    const githubUser = useCloudStore.use.githubUser();
    const isForking = useCloudStore.use.isForking();
    const refreshVersion = useCloudStore.use.refreshVersion();

    const setRepoDataLoaded = useCloudStore.use.setRepoDataLoaded();
    const setRepoChecking = useCloudStore.use.setRepoChecking();
    const setRepoInitialized = useCloudStore.use.setRepoInitialized();
    const setRepoManifest = useCloudStore.use.setRepoManifest();
    const setMyRepoInfo = useCloudStore.use.setMyRepoInfo();
    const setMyRepoReadme = useCloudStore.use.setMyRepoReadme();
    const setRepoNameInput = useCloudStore.use.setRepoNameInput();
    const fetchGithubUser = useCloudStore.use.fetchGithubUser();

    // 仓库初始化逻辑 — 只在视图首次挂载（或 reset 后）执行一次
    React.useEffect(() => {
        if (repoDataLoaded) return;

        const token = i18n.settings.shareToken;
        if (!token) return;

        const userRepo = i18n.settings.shareRepo;
        // 同步输入框初始值
        setRepoNameInput(userRepo || 'obsidian-i18n-resources');

        let cancelled = false;

        const init = async () => {
            setRepoChecking(true);
            try {
                // 1. 获取/刷新用户信息 (使用 Store 统一动作)
                await fetchGithubUser(i18n);
                if (cancelled) return;

                const user = useCloudStore.getState().githubUser;
                if (!user) return;

                // 3. 如果未配置仓库名，直接标记未初始化
                if (!userRepo) {
                    setRepoInitialized(false);
                    return;
                }

                // 4. 检查仓库是否存在
                const repoRes = await i18n.api.github.checkRepoExists(user.login, userRepo);
                if (cancelled) return;
                setRepoInitialized(repoRes.state);

                // 异步获取仓库详情 (不阻塞其他逻辑)
                if (repoRes.state && repoRes.data && typeof repoRes.data.stargazers_count === 'number') {
                    setMyRepoInfo({
                        stargazers_count: repoRes.data.stargazers_count,
                        watchers_count: repoRes.data.watchers_count || 0,
                        forks_count: repoRes.data.forks_count || 0,
                        open_issues_count: repoRes.data.open_issues_count || 0,
                        created_at: repoRes.data.created_at || '',
                        updated_at: repoRes.data.updated_at || '',
                        size: repoRes.data.size || 0,
                        description: repoRes.data.description || '',
                    });
                } else {
                    setMyRepoInfo(null);
                }

                // 异步获取 README.md (不阻塞其他逻辑)
                i18n.api.github.getFileContent(user.login, userRepo, 'README.md').then(readmeRes => {
                    if (!cancelled && readmeRes.state && readmeRes.data?.content) {
                        const decoded = Buffer.from(readmeRes.data.content, 'base64').toString('utf-8');
                        setMyRepoReadme(decoded);
                    } else {
                        if (!cancelled) setMyRepoReadme(null);
                    }
                }).catch(() => {
                    if (!cancelled) setMyRepoReadme(null);
                });

                // 5. 如果仓库存在，读取 metadata.json (可选校验)
                if (repoRes.state) {
                    try {
                        const res = await i18n.api.github.getFileContentWithFallback(user.login, userRepo, 'metadata.json');
                        if (!cancelled && res.state && res.data) {
                            const parsed = res.data;
                            if (Array.isArray(parsed)) {
                                setRepoManifest(parsed);
                            }
                        }
                    } catch {
                        if (!cancelled) setRepoManifest([]);
                    }
                }
            } catch (error) {
                console.error(t('Cloud.Errors.FetchFail'), error);
            } finally {
                if (!cancelled) {
                    setRepoChecking(false);
                    setRepoDataLoaded(true);
                }
            }
        };

        init();
        return () => { cancelled = true; };
    }, [repoDataLoaded, i18n, refreshVersion]);

    return (
        <div className="flex flex-col h-full w-full bg-background font-sans overflow-hidden">
            {/* Tab 内容区 */}
            <Tabs value={currentTab} onValueChange={(v) => setCurrentTab(v as 'community' | 'download' | 'upload' | 'my' | 'history' | 'backup')} className="flex-1 flex flex-col min-h-0 overflow-hidden" >
                {/* 顶部导航栏 */}
                <div className="flex items-center justify-between px-6 py-3 bg-card/50 backdrop-blur sticky top-0 z-20">
                    <div className="flex items-center gap-6">
                        {/* 导航 Tabs */}
                        <TabsList className="bg-muted/50 p-1 rounded-lg border border-border/50">
                            <TabsTrigger
                                value="community"
                                className="data-[state=active]:bg-background data-[state=active]:text-primary data-[state=active]:shadow-sm transition-all duration-200 px-4 py-1.5"
                            >
                                <div className="flex items-center gap-2">
                                    <Users className="w-3.5 h-3.5" />
                                    <span>{t('Cloud.Tabs.Community')}</span>
                                </div>
                            </TabsTrigger>
                            <TabsTrigger
                                value="download"
                                className="data-[state=active]:bg-background data-[state=active]:text-primary data-[state=active]:shadow-sm transition-all duration-200 px-4 py-1.5"
                            >
                                <div className="flex items-center gap-2">
                                    <Download className="w-3.5 h-3.5" />
                                    <span>{t('Cloud.Tabs.Explore')}</span>
                                </div>
                            </TabsTrigger>
                            <TabsTrigger
                                value="my"
                                className="data-[state=active]:bg-background data-[state=active]:text-primary data-[state=active]:shadow-sm transition-all duration-200 px-4 py-1.5"
                            >
                                <div className="flex items-center gap-2">
                                    <FolderOpen className="w-3.5 h-3.5" />
                                    <span>{t('Cloud.Tabs.Manage')}</span>
                                </div>
                            </TabsTrigger>
                        </TabsList>
                    </div>

                    <div className="flex items-center gap-4">
                        {/* GitHub 用户状态 — 带下拉菜单 */}
                        {!i18n.settings.shareToken ? (
                            <div
                                onClick={() => {
                                    // @ts-ignore
                                    i18n.activeSettingTab = 'share';
                                    // @ts-ignore
                                    i18n.app.setting.open();
                                    // @ts-ignore
                                    i18n.app.setting.openTabById("i18n");
                                }}
                                className="flex items-center gap-2 px-2 py-1.5 rounded-xl bg-orange-500/10 border border-orange-500/20 shadow-sm hover:shadow-md hover:bg-orange-500/20 hover:border-orange-500/30 transition-all cursor-pointer group"
                                title={t('Cloud.Hints.TokenRequired')}
                            >
                                <div className="w-7 h-7 rounded-lg bg-orange-500/10 flex items-center justify-center text-orange-600 ring-1 ring-orange-500/20 shadow-[0_2px_4px_rgba(0,0,0,0.05)]">
                                    < User className="w-4 h-4" />
                                </div>
                                <div className="flex flex-col pr-1 justify-center whitespace-nowrap">
                                    <span className="font-bold text-[13px] text-foreground/90 leading-none">
                                        {['community', 'download'].includes(currentTab) ? t('Cloud.Status.GuestMode') : t('Cloud.Status.Unauthorized')}
                                    </span>
                                </div>
                            </div>
                        ) : repoChecking ? (
                            <div className="flex items-center gap-3 px-3 py-1.5 rounded-xl bg-muted/20 border border-border/40 text-xs shadow-sm">
                                <div className="flex items-center gap-2 text-muted-foreground">
                                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                                    <span className="whitespace-nowrap">{t('Cloud.Status.Checking')}</span>
                                </div>
                            </div>
                        ) : (
                            <div className="flex items-center gap-2 px-2 py-1.5 rounded-xl bg-muted/20 border border-border/40 shadow-sm hover:shadow-md hover:bg-muted/40 hover:border-border/60 transition-all cursor-default group overflow-hidden">
                                <div className="flex items-center gap-2">
                                    {githubUser?.avatar_url ? (
                                        <img
                                            src={githubUser!.avatar_url}
                                            className="w-7 h-7 rounded-lg ring-1 ring-border shadow-[0_2px_4px_rgba(0,0,0,0.05)] group-hover:scale-[1.02] transition-transform object-cover"
                                            alt="avatar"
                                        />
                                    ) : (
                                        <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center text-primary ring-1 ring-primary/20 shadow-[0_2px_4px_rgba(0,0,0,0.05)]">
                                            <User className="w-4 h-4" />
                                        </div>
                                    )}
                                    <div className="flex flex-col pr-1 justify-center whitespace-nowrap">
                                        <span className="font-bold text-[13px] text-foreground/90 leading-none">
                                            {githubUser?.login || t('Common.Labels.GithubUser')}
                                        </span>
                                    </div>
                                </div>

                                {/* 悬停展开操作区 (Hover Extension) */}
                                <div className="flex items-center gap-1 max-w-0 opacity-0 group-hover:max-w-[80px] group-hover:opacity-100 group-hover:pl-2 group-hover:ml-1 group-hover:border-l group-hover:border-border/40 transition-all duration-300 overflow-hidden">
                                    <button
                                        onClick={() => reset()}
                                        className="flex shrink-0 items-center justify-center w-6 h-6 rounded-md hover:bg-primary/10 text-muted-foreground hover:text-primary transition-colors cursor-pointer"
                                        title={t('Common.Actions.Refresh')}
                                    >
                                        <RefreshCw className="w-3.5 h-3.5" />
                                    </button>
                                    <button
                                        onClick={async () => {
                                            i18n.settings.shareToken = '';
                                            i18n.settings.shareRepo = '';
                                            await i18n.saveSettings();
                                            reset();
                                        }}
                                        className="flex shrink-0 items-center justify-center w-6 h-6 rounded-md text-destructive/70 hover:bg-destructive/10 hover:text-destructive transition-colors cursor-pointer"
                                        title={t('Cloud.Actions.Logout')}
                                    >
                                        <LogOut className="w-3.5 h-3.5" />
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* 内容展示区 */}
                <div className="flex-1 overflow-hidden relative bg-muted/5 flex flex-col min-h-0">
                    {/* 装饰背景元素 */}
                    <div className="absolute top-0 left-0 w-full h-[300px] bg-gradient-to-b from-primary/5 to-transparent pointer-events-none" />

                    <TabsContent value="community" className="flex-1 min-h-0 m-0 p-6 data-[state=active]:flex flex-col relative z-10 animate-in fade-in slide-in-from-bottom-2 duration-300">
                        <CommunityTab />
                    </TabsContent>
                    <TabsContent value="download" className="flex-1 min-h-0 m-0 p-6 data-[state=active]:flex flex-col relative z-10 animate-in fade-in slide-in-from-bottom-2 duration-300">
                        <ExploreTab />
                    </TabsContent>
                    <TabsContent value="my" className="flex-1 min-h-0 m-0 p-6 data-[state=active]:flex flex-col relative z-10 animate-in fade-in slide-in-from-bottom-2 duration-300">
                        <ManageTab />
                    </TabsContent>
                    <TabsContent value="upload" className="flex-1 min-h-0 m-0 p-6 data-[state=active]:flex flex-col relative z-10 animate-in fade-in slide-in-from-bottom-2 duration-300">
                        <PublishTab />
                    </TabsContent>
                    <TabsContent value="history" className="flex-1 min-h-0 m-0 p-6 data-[state=active]:flex flex-col relative z-10 animate-in fade-in slide-in-from-bottom-2 duration-300">
                        <HistoryTab />
                    </TabsContent>
                    <TabsContent value="backup" className="flex-1 min-h-0 m-0 p-6 data-[state=active]:flex flex-col relative z-10 animate-in fade-in slide-in-from-bottom-2 duration-300">
                        <BackupSyncTab />
                    </TabsContent>
                </div >
            </Tabs >

        </div >
    );
};

// Obsidian View 类
export class CloudView extends ItemView {
    i18n: I18N;
    root: Root | null = null;
    shadowRoot: ShadowRoot | null = null;

    constructor(leaf: WorkspaceLeaf, i18n: I18N) {
        super(leaf);
        this.i18n = i18n;
    }

    getViewType(): string {
        return CLOUD_VIEW_TYPE;
    }

    getDisplayText(): string {
        return t('Cloud.Labels.CloudCentral');
    }

    getIcon(): string {
        return 'cloud';
    }

    async onOpen() {
        const { root, shadowRoot } = mountReactView(
            this.contentEl,
            this.i18n,
            <CloudViewContent />
        );
        this.root = root;
        this.shadowRoot = shadowRoot;
    }

    async onClose() {
        // 重置 store
        useCloudStore.getState().reset();

        // 卸载 React
        this.root?.unmount();
        if (this.shadowRoot) {
            this.shadowRoot.innerHTML = '';
        }
    }
}
