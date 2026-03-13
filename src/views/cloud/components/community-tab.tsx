/**
 * 社区目录 Tab
 * 左右分栏布局：左侧排行榜（可折叠） + 右侧全部翻译库卡片网格
 */
import React, { useCallback, useState, useMemo } from 'react';
import { Input, Button, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/src/shadcn';
import { Search, RefreshCw, Globe, Star, Package, ExternalLink, Users, ArrowRight, Trophy, ChevronDown, TrendingUp, Palette, Library } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useCloudStore } from '../cloud-store';
import { useGlobalStoreInstance } from '~/utils';
import { t } from '@/src/locales/index';
import { ManifestEntry, RegistryItem, CommunityRepoStats, LeaderboardAuthorEntry, getCloudFilePath } from '../types';
import { SUPPORTED_LANGUAGES } from '@/src/constants/languages';
import { ScrollArea } from '@/src/shadcn/ui/scroll-area';
import { Badge } from '@/src/shadcn/ui/badge';
import { cn } from '@/src/shadcn/lib/utils';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/src/shadcn/ui/collapsible';

// ========== 排行榜数据类型（用于渲染）==========
interface LeaderboardRepo {
    address: string;
    owner: string;
    repo: string;
    stats: CommunityRepoStats;
}

export const CommunityTab: React.FC = () => {
    const { t: t_i18n } = useTranslation(); // Renamed to avoid conflict with direct 't' import
    const i18n = useGlobalStoreInstance.getState().i18n;

    const communityRegistry = useCloudStore.use.communityRegistry();
    const communityStats = useCloudStore.use.communityStats();
    const communityLoaded = useCloudStore.use.communityLoaded();
    const communityLoading = useCloudStore.use.communityLoading();
    const setCommunityRegistry = useCloudStore.use.setCommunityRegistry();
    const setCommunityStats = useCloudStore.use.setCommunityStats();
    const setCommunityLoaded = useCloudStore.use.setCommunityLoaded();
    const setCommunityLoading = useCloudStore.use.setCommunityLoading();
    const setCurrentTab = useCloudStore.use.setCurrentTab();
    const setTargetRepoAddress = useCloudStore.use.setTargetRepoAddress();

    const [searchQuery, setSearchQuery] = useState('');
    const [filterLanguage, setFilterLanguage] = useState('all');

    // 排行榜折叠状态
    const [reposOpen, setReposOpen] = useState(true);
    const [activeReposOpen, setActiveReposOpen] = useState(true);
    const [pluginReposOpen, setPluginReposOpen] = useState(true);
    const [authorsOpen, setAuthorsOpen] = useState(true);

    // 加载社区数据
    const loadCommunityData = useCallback(async (force = false) => {
        if (communityLoading) return;
        if (communityLoaded && !force) return;

        setCommunityLoading(true);
        try {
            const registryAddr = 'eondrcode/obsidian-i18n-resources';
            if (!registryAddr) return;

            const [owner, repo] = registryAddr.split('/');
            if (!owner || !repo) return;

            // 并发加载 registry.json 和 stats.json
            const [registryRes, statsRes] = await Promise.all([
                i18n.api.github.getFileContent(owner, repo, 'registry.json'),
                i18n.api.github.getFileContent(owner, repo, 'stats.json'),
            ]);

            // 解析 registry.json
            if (registryRes.state && registryRes.data?.content) {
                const decoded = Buffer.from(registryRes.data.content, 'base64').toString('utf-8');
                const parsed = JSON.parse(decoded);
                if (Array.isArray(parsed)) {
                    setCommunityRegistry(parsed);
                }
            }

            // 解析 stats.json
            if (statsRes.state && statsRes.data?.content) {
                const decoded = Buffer.from(statsRes.data.content, 'base64').toString('utf-8');
                const parsed = JSON.parse(decoded);
                if (parsed && typeof parsed === 'object') {
                    setCommunityStats(parsed);
                }
            }

            setCommunityLoaded(true);
        } catch (error) {
            console.error(t_i18n('Cloud.Errors.FetchFail'), error);
        } finally {
            setCommunityLoading(false);
        }
    }, [communityLoading, communityLoaded, i18n, setCommunityRegistry, setCommunityStats, setCommunityLoaded, setCommunityLoading]);

    // 首次挂载自动加载
    React.useEffect(() => {
        if (!communityLoaded && !communityLoading) {
            loadCommunityData();
        }
    }, [communityLoaded, communityLoading, loadCommunityData]);

    // ========== 排行榜数据（优先使用服务端预计算，fallback 到客户端计算）==========
    const topRepos = useMemo<LeaderboardRepo[]>(() => {
        if (!communityStats?.repos) return [];

        // 优先使用预计算的排行榜
        const precomputed = communityStats.leaderboard?.topReposByStars;
        if (precomputed && precomputed.length > 0) {
            return precomputed
                .map((address) => {
                    const stats = communityStats.repos[address];
                    if (!stats) return null;
                    const [owner, repo] = address.split('/');
                    return { address, owner, repo, stats } as LeaderboardRepo;
                })
                .filter(Boolean)
                .slice(0, 5) as LeaderboardRepo[];
        }

        // Fallback: 客户端计算（兼容旧版 stats.json）
        return communityRegistry
            .map((item) => {
                const stats = communityStats.repos[item.repoAddress];
                if (!stats) return null;
                const [owner, repo] = item.repoAddress.split('/');
                return { address: item.repoAddress, owner, repo, stats } as LeaderboardRepo;
            })
            .filter(Boolean)
            .sort((a, b) => (b!.stats.stars ?? 0) - (a!.stats.stars ?? 0))
            .slice(0, 5) as LeaderboardRepo[];
    }, [communityRegistry, communityStats]);



    const topActiveRepos = useMemo<LeaderboardRepo[]>(() => {
        if (!communityStats?.repos) return [];

        // 优先使用预计算的排行榜
        const precomputed = communityStats.leaderboard?.topReposByActivity;
        if (precomputed && precomputed.length > 0) {
            return precomputed
                .map((address) => {
                    const stats = communityStats.repos[address];
                    if (!stats) return null;
                    const [owner, repo] = address.split('/');
                    return { address, owner, repo, stats } as LeaderboardRepo;
                })
                .filter(Boolean)
                .slice(0, 5) as LeaderboardRepo[];
        }

        // Fallback
        return communityRegistry
            .map((item) => {
                const stats = communityStats.repos[item.repoAddress];
                if (!stats) return null;
                const [owner, repo] = item.repoAddress.split('/');
                return { address: item.repoAddress, owner, repo, stats } as LeaderboardRepo;
            })
            .filter(Boolean)
            .sort((a, b) => (b!.stats.activityScore ?? 0) - (a!.stats.activityScore ?? 0))
            .slice(0, 5) as LeaderboardRepo[];
    }, [communityRegistry, communityStats]);

    const topPluginRepos = useMemo<LeaderboardRepo[]>(() => {
        if (!communityStats?.repos) return [];
        return communityRegistry
            .map((item) => {
                const stats = communityStats.repos[item.repoAddress];
                if (!stats) return null;
                const [owner, repo] = item.repoAddress.split('/');
                return { address: item.repoAddress, owner, repo, stats } as LeaderboardRepo;
            })
            .filter(Boolean)
            .sort((a, b) => (b!.stats.pluginCount ?? 0) - (a!.stats.pluginCount ?? 0) || (b!.stats.stars ?? 0) - (a!.stats.stars ?? 0))
            .slice(0, 5) as LeaderboardRepo[];
    }, [communityRegistry, communityStats]);

    // 过滤逻辑
    const filteredItems = useMemo(() => {
        return communityRegistry.filter((item) => {
            const stats = communityStats?.repos?.[item.repoAddress];

            // 搜索过滤
            if (searchQuery) {
                const q = searchQuery.toLowerCase();
                const matchAddress = item.repoAddress.toLowerCase().includes(q);
                const matchDesc = stats?.description?.toLowerCase().includes(q) || false;
                const matchAuthor = stats?.authorName?.toLowerCase().includes(q) || false;
                if (!matchAddress && !matchDesc && !matchAuthor) return false;
            }

            // 语言过滤
            if (filterLanguage && filterLanguage !== 'all') {
                if (!stats?.languages?.includes(filterLanguage)) return false;
            }

            return true;
        });
    }, [communityRegistry, communityStats, searchQuery, filterLanguage]);

    // 点击查看仓库
    const handleViewRepo = useCallback((address: string) => {
        setTargetRepoAddress(address);
        setCurrentTab('download');
        setTimeout(() => { }, 100);
    }, [setTargetRepoAddress, setCurrentTab]);

    const topAuthors = useMemo(() => {
        return communityStats?.leaderboard?.topAuthors || [];
    }, [communityStats]);

    const hasLeaderboardData = communityLoaded && (topRepos.length > 0 || topActiveRepos.length > 0 || topPluginRepos.length > 0 || topAuthors.length > 0);

    // ========== 全局加载 / 失败 / 空态 ==========
    if (communityLoading && !communityLoaded) {
        return (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground animate-in fade-in duration-300">
                <RefreshCw className="w-10 h-10 animate-spin text-primary/50 mb-4" />
                <p className="text-sm font-medium tracking-tight">{t_i18n('Cloud.Labels.FetchingResources')}</p>
            </div>
        );
    }

    if (!communityLoaded) {
        return (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                <Globe className="w-16 h-16 mb-4 opacity-20" />
                <p className="text-sm font-medium">{t_i18n('Cloud.Errors.FetchFail')}</p>
                <Button variant="link" size="sm" onClick={() => loadCommunityData(true)} className="mt-2">
                    {t_i18n('Cloud.Actions.Recheck')}
                </Button>
            </div>
        );
    }

    if (communityRegistry.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground animate-in fade-in duration-700">
                <div className="p-10 rounded-full bg-primary/5 mb-6 ring-1 ring-primary/10">
                    <Users className="w-20 h-20 opacity-20 text-primary" />
                </div>
                <h3 className="text-xl font-bold text-foreground/80 tracking-tight">{t_i18n('Cloud.Labels.NoRegistry')}</h3>
                <p className="text-sm mt-2 text-center text-muted-foreground/60 max-w-[320px] leading-relaxed">
                    {t_i18n('Cloud.Labels.NoRegistryDesc')}
                </p>
            </div>
        );
    }

    return (
        <div className="flex h-full gap-0 overflow-hidden min-h-0 animate-in fade-in duration-500">
            {/* ========== 左侧侧边栏：排行榜 ========== */}
            {hasLeaderboardData && (
                <aside className="w-[300px] flex flex-col border-r border-border/30 pr-2 shrink-0 overflow-hidden min-h-0">
                    <ScrollArea className="flex-1 pr-2.5">
                        <div className="space-y-4 pb-6 pt-1">
                            {/* 侧边栏标题 */}
                            <div className="flex items-center gap-2 text-sm font-semibold text-foreground/80">
                                <TrendingUp className="w-4 h-4 text-primary" />
                                <span>{t('Cloud.Labels.Leaderboard')}</span>
                            </div>
                            {/* 活跃仓库榜 (最近高频更新) - 可折叠 */}
                            {topActiveRepos.length > 0 && (
                                <Collapsible open={activeReposOpen} onOpenChange={setActiveReposOpen}>
                                    <div className="rounded-xl border border-border/50 bg-card/80 backdrop-blur-sm shadow-sm overflow-hidden">
                                        <CollapsibleTrigger className="w-full flex items-center gap-2 px-4 py-2.5 border-b border-border/30 bg-gradient-to-r from-orange-500/5 to-transparent hover:from-orange-500/10 transition-colors cursor-pointer select-none">
                                            <div className="p-1 rounded-md bg-orange-500/10">
                                                <TrendingUp className="w-3.5 h-3.5 text-orange-500" />
                                            </div>
                                            <h3 className="text-[13px] font-bold text-foreground tracking-tight flex-1 text-left min-w-0 truncate">{t('Cloud.Labels.TopActive')}</h3>
                                            <Badge variant="secondary" className="text-[9px] h-[18px] px-1.5 bg-orange-500/10 text-orange-600 border-orange-500/20">
                                                TOP {topActiveRepos.length}
                                            </Badge>
                                            <ChevronDown className={cn(
                                                "w-3.5 h-3.5 text-muted-foreground/50 transition-transform duration-200",
                                                activeReposOpen ? "rotate-0" : "-rotate-90"
                                            )} />
                                        </CollapsibleTrigger>
                                        <CollapsibleContent>
                                            <div className="divide-y divide-border/20">
                                                {topActiveRepos.map((item, index) => (
                                                    <div
                                                        key={item.address}
                                                        className="flex items-center gap-2.5 px-3 py-2 hover:bg-muted/30 transition-colors cursor-pointer group"
                                                        onClick={() => handleViewRepo(item.address)}
                                                    >
                                                        {/* 排名 */}
                                                        <div className="w-5 h-5 flex items-center justify-center shrink-0">
                                                            {index === 0 ? (
                                                                <span className="text-sm" title={t_i18n('Cloud.Labels.Rank1')}>🥇</span>
                                                            ) : index === 1 ? (
                                                                <span className="text-sm" title={t_i18n('Cloud.Labels.Rank2')}>🥈</span>
                                                            ) : index === 2 ? (
                                                                <span className="text-sm" title={t_i18n('Cloud.Labels.Rank3')}>🥉</span>
                                                            ) : (
                                                                <span className="text-[10px] font-bold text-muted-foreground/50 font-mono">{index + 1}</span>
                                                            )}
                                                        </div>
                                                        {/* 头像 */}
                                                        {item.stats.avatarUrl ? (
                                                            <img src={item.stats.avatarUrl} className="w-6 h-6 rounded-md ring-1 ring-border/50 shrink-0 group-hover:scale-105 transition-transform" alt={item.owner} />
                                                        ) : (
                                                            <div className="w-6 h-6 rounded-md bg-muted flex items-center justify-center shrink-0">
                                                                <Library className="w-3 h-3 text-muted-foreground/50" />
                                                            </div>
                                                        )}
                                                        {/* 信息 */}
                                                        <div className="flex-1 min-w-0">
                                                            <div className="text-[11px] font-semibold text-foreground truncate leading-tight group-hover:text-primary transition-colors">
                                                                {item.repo}
                                                            </div>
                                                            <div className="text-[9px] text-muted-foreground/60 truncate">
                                                                {item.stats.authorName || item.owner}
                                                            </div>
                                                        </div>
                                                        {/* Activity */}
                                                        <div className="flex items-center gap-1 text-[10px] font-mono font-bold text-orange-600 shrink-0">
                                                            <TrendingUp className="w-2.5 h-2.5 text-orange-500" />
                                                            {Math.round((item.stats.activityScore || 0) * 100)}
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </CollapsibleContent>
                                    </div>
                                </Collapsible>
                            )}

                            {/* 活跃译者榜单 - 可折叠 */}
                            {topAuthors.length > 0 && (
                                <Collapsible open={authorsOpen} onOpenChange={setAuthorsOpen}>
                                    <div className="rounded-xl border border-border/50 bg-card/80 backdrop-blur-sm shadow-sm overflow-hidden">
                                        <CollapsibleTrigger className="w-full flex items-center gap-2 px-4 py-2.5 border-b border-border/30 bg-gradient-to-r from-green-500/5 to-transparent hover:from-green-500/10 transition-colors cursor-pointer select-none">
                                            <div className="p-1 rounded-md bg-green-500/10">
                                                <Users className="w-3.5 h-3.5 text-green-500" />
                                            </div>
                                            <h3 className="text-[13px] font-bold text-foreground tracking-tight flex-1 text-left min-w-0 truncate">{t('Cloud.Labels.TopAuthors')}</h3>
                                            <Badge variant="secondary" className="text-[9px] h-[18px] px-1.5 bg-green-500/10 text-green-600 border-green-500/20">
                                                TOP {topAuthors.length}
                                            </Badge>
                                            <ChevronDown className={cn(
                                                "w-3.5 h-3.5 text-muted-foreground/50 transition-transform duration-200",
                                                authorsOpen ? "rotate-0" : "-rotate-90"
                                            )} />
                                        </CollapsibleTrigger>
                                        <CollapsibleContent>
                                            <div className="divide-y divide-border/20">
                                                {topAuthors.map((author, index) => (
                                                    <div
                                                        key={author.name}
                                                        className="flex items-center gap-2.5 px-3 py-2 hover:bg-muted/30 transition-colors cursor-pointer group"
                                                        onClick={() => {
                                                            if (author.htmlUrl) {
                                                                window.open(author.htmlUrl, '_blank');
                                                            }
                                                        }}
                                                    >
                                                        {/* 排名 */}
                                                        <div className="w-5 h-5 flex items-center justify-center shrink-0">
                                                            {index === 0 ? (
                                                                <span className="text-sm" title={t_i18n('Cloud.Labels.Rank1')}>🥇</span>
                                                            ) : index === 1 ? (
                                                                <span className="text-sm" title={t_i18n('Cloud.Labels.Rank2')}>🥈</span>
                                                            ) : index === 2 ? (
                                                                <span className="text-sm" title={t_i18n('Cloud.Labels.Rank3')}>🥉</span>
                                                            ) : (
                                                                <span className="text-[10px] font-bold text-muted-foreground/50 font-mono">{index + 1}</span>
                                                            )}
                                                        </div>
                                                        {/* 头像 */}
                                                        {author.avatarUrl ? (
                                                            <img src={author.avatarUrl} className="w-6 h-6 rounded-full ring-1 ring-border/50 shrink-0 group-hover:scale-105 transition-transform" alt={author.name} />
                                                        ) : (
                                                            <div className="w-6 h-6 rounded-full bg-muted flex items-center justify-center shrink-0">
                                                                <Users className="w-3 h-3 text-muted-foreground/50" />
                                                            </div>
                                                        )}
                                                        {/* 信息 */}
                                                        <div className="flex-1 min-w-0">
                                                            <div className="text-[11px] font-semibold text-foreground truncate leading-tight group-hover:text-primary transition-colors">
                                                                {author.name}
                                                            </div>
                                                            <div className="text-[9px] text-muted-foreground/60 truncate flex gap-1 items-center">
                                                                <span>{author.repoCount} {t_i18n('Cloud.Labels.SubscriptionRepo')}</span>
                                                                <span>·</span>
                                                                <span>{author.totalPlugins} {t_i18n('Cloud.Labels.UnitPlugins')}</span>
                                                            </div>
                                                        </div>
                                                        {/* Activity */}
                                                        <div className="flex items-center gap-1 text-[10px] font-mono font-bold text-green-600 shrink-0" title={`综合活跃度: ${Math.round(author.activityScore * 100)}`}>
                                                            <TrendingUp className="w-2.5 h-2.5 text-green-500" />
                                                            {Math.round(author.activityScore * 100)}
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </CollapsibleContent>
                                    </div>
                                </Collapsible>
                            )}

                            {/* 高赞仓库榜 - 可折叠 */}
                            {topRepos.length > 0 && (
                                <Collapsible open={reposOpen} onOpenChange={setReposOpen}>
                                    <div className="rounded-xl border border-border/50 bg-card/80 backdrop-blur-sm shadow-sm overflow-hidden">
                                        <CollapsibleTrigger className="w-full flex items-center gap-2 px-4 py-2.5 border-b border-border/30 bg-gradient-to-r from-yellow-500/5 to-transparent hover:from-yellow-500/10 transition-colors cursor-pointer select-none">
                                            <div className="p-1 rounded-md bg-yellow-500/10">
                                                <Star className="w-3.5 h-3.5 text-yellow-500" />
                                            </div>
                                            <h3 className="text-[13px] font-bold text-foreground tracking-tight flex-1 text-left min-w-0 truncate">{t('Cloud.Labels.TopStars')}</h3>
                                            <Badge variant="secondary" className="text-[9px] h-[18px] px-1.5 bg-yellow-500/10 text-yellow-600 border-yellow-500/20">
                                                TOP {topRepos.length}
                                            </Badge>
                                            <ChevronDown className={cn(
                                                "w-3.5 h-3.5 text-muted-foreground/50 transition-transform duration-200",
                                                reposOpen ? "rotate-0" : "-rotate-90"
                                            )} />
                                        </CollapsibleTrigger>
                                        <CollapsibleContent>
                                            <div className="divide-y divide-border/20">
                                                {topRepos.map((item, index) => (
                                                    <div
                                                        key={item.address}
                                                        className="flex items-center gap-2.5 px-3 py-2 hover:bg-muted/30 transition-colors cursor-pointer group"
                                                        onClick={() => handleViewRepo(item.address)}
                                                    >
                                                        {/* 排名 */}
                                                        <div className="w-5 h-5 flex items-center justify-center shrink-0">
                                                            {index === 0 ? (
                                                                <span className="text-sm" title={t_i18n('Cloud.Labels.Rank1')}>🥇</span>
                                                            ) : index === 1 ? (
                                                                <span className="text-sm" title={t_i18n('Cloud.Labels.Rank2')}>🥈</span>
                                                            ) : index === 2 ? (
                                                                <span className="text-sm" title={t_i18n('Cloud.Labels.Rank3')}>🥉</span>
                                                            ) : (
                                                                <span className="text-[10px] font-bold text-muted-foreground/50 font-mono">{index + 1}</span>
                                                            )}
                                                        </div>
                                                        {/* 头像 */}
                                                        {item.stats.avatarUrl ? (
                                                            <img src={item.stats.avatarUrl} className="w-6 h-6 rounded-md ring-1 ring-border/50 shrink-0 group-hover:scale-105 transition-transform" alt={item.owner} />
                                                        ) : (
                                                            <div className="w-6 h-6 rounded-md bg-muted flex items-center justify-center shrink-0">
                                                                <Library className="w-3 h-3 text-muted-foreground/50" />
                                                            </div>
                                                        )}
                                                        {/* 信息 */}
                                                        <div className="flex-1 min-w-0">
                                                            <div className="text-[11px] font-semibold text-foreground truncate leading-tight group-hover:text-primary transition-colors">
                                                                {item.repo}
                                                            </div>
                                                            <div className="text-[9px] text-muted-foreground/60 truncate">
                                                                {item.stats.authorName || item.owner}
                                                            </div>
                                                        </div>
                                                        {/* Stars */}
                                                        <div className="flex items-center gap-1 text-[10px] font-mono font-bold text-yellow-600 shrink-0">
                                                            <Star className="w-2.5 h-2.5 fill-yellow-500/80 text-yellow-500" />
                                                            {item.stats.stars}
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </CollapsibleContent>
                                    </div>
                                </Collapsible>
                            )}

                            {/* 高产仓库榜 (包含插件最多) - 可折叠 */}
                            {topPluginRepos.length > 0 && (
                                <Collapsible open={pluginReposOpen} onOpenChange={setPluginReposOpen}>
                                    <div className="rounded-xl border border-border/50 bg-card/80 backdrop-blur-sm shadow-sm overflow-hidden">
                                        <CollapsibleTrigger className="w-full flex items-center gap-2 px-4 py-2.5 border-b border-border/30 bg-gradient-to-r from-blue-500/5 to-transparent hover:from-blue-500/10 transition-colors cursor-pointer select-none">
                                            <div className="p-1 rounded-md bg-blue-500/10">
                                                <Package className="w-3.5 h-3.5 text-blue-500" />
                                            </div>
                                            <h3 className="text-[13px] font-bold text-foreground tracking-tight flex-1 text-left min-w-0 truncate">{t('Cloud.Labels.TopPlugins')}</h3>
                                            <Badge variant="secondary" className="text-[9px] h-[18px] px-1.5 bg-blue-500/10 text-blue-600 border-blue-500/20">
                                                TOP {topPluginRepos.length}
                                            </Badge>
                                            <ChevronDown className={cn(
                                                "w-3.5 h-3.5 text-muted-foreground/50 transition-transform duration-200",
                                                pluginReposOpen ? "rotate-0" : "-rotate-90"
                                            )} />
                                        </CollapsibleTrigger>
                                        <CollapsibleContent>
                                            <div className="divide-y divide-border/20">
                                                {topPluginRepos.map((item, index) => (
                                                    <div
                                                        key={item.address}
                                                        className="flex items-center gap-2.5 px-3 py-2 hover:bg-muted/30 transition-colors cursor-pointer group"
                                                        onClick={() => handleViewRepo(item.address)}
                                                    >
                                                        {/* 排名 */}
                                                        <div className="w-5 h-5 flex items-center justify-center shrink-0">
                                                            {index === 0 ? (
                                                                <span className="text-sm" title={t_i18n('Cloud.Labels.Rank1')}>🥇</span>
                                                            ) : index === 1 ? (
                                                                <span className="text-sm" title={t_i18n('Cloud.Labels.Rank2')}>🥈</span>
                                                            ) : index === 2 ? (
                                                                <span className="text-sm" title={t_i18n('Cloud.Labels.Rank3')}>🥉</span>
                                                            ) : (
                                                                <span className="text-[10px] font-bold text-muted-foreground/50 font-mono">{index + 1}</span>
                                                            )}
                                                        </div>
                                                        {/* 头像 */}
                                                        {item.stats.avatarUrl ? (
                                                            <img src={item.stats.avatarUrl} className="w-6 h-6 rounded-md ring-1 ring-border/50 shrink-0 group-hover:scale-105 transition-transform" alt={item.owner} />
                                                        ) : (
                                                            <div className="w-6 h-6 rounded-md bg-muted flex items-center justify-center shrink-0">
                                                                <Library className="w-3 h-3 text-muted-foreground/50" />
                                                            </div>
                                                        )}
                                                        {/* 信息 */}
                                                        <div className="flex-1 min-w-0">
                                                            <div className="text-[11px] font-semibold text-foreground truncate leading-tight group-hover:text-primary transition-colors">
                                                                {item.repo}
                                                            </div>
                                                            <div className="text-[9px] text-muted-foreground/60 truncate">
                                                                {item.stats.authorName || item.owner}
                                                            </div>
                                                        </div>
                                                        {/* Plugins */}
                                                        <div className="flex items-center gap-1 text-[10px] font-mono font-bold text-blue-600 shrink-0">
                                                            <Package className="w-2.5 h-2.5 text-blue-500" />
                                                            {item.stats.pluginCount || 0}
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </CollapsibleContent>
                                    </div>
                                </Collapsible>
                            )}

                            <div className="mt-8 pt-6 border-t border-border/20 text-[10px] text-muted-foreground/60 leading-relaxed italic text-center max-w-[280px] mx-auto">
                                {t('Cloud.Labels.LeaderboardTip')}
                            </div>
                        </div>
                    </ScrollArea>
                </aside>
            )}

            {/* ========== 右侧主内容：全部翻译库 ========== */}
            <main className={cn(
                "flex-1 flex flex-col overflow-hidden min-h-0",
                hasLeaderboardData && "pl-4 border-l border-border/10"
            )}>
                {/* 顶部工具栏 - 单行精简设计 */}
                <div className="flex items-center justify-between mb-5 shrink-0 pt-2 border-b border-border/10 pb-3">
                    {/* 左侧：标题与统计徽章 */}
                    <div className="flex items-center gap-3">
                        <h2 className="text-[15px] font-bold text-foreground tracking-tight">{t('Cloud.Labels.DiscoverTranslations')}</h2>
                        <Badge variant="secondary" className="px-2 py-0.5 text-[10px] font-medium bg-primary/10 text-primary border-primary/20 shadow-sm gap-1">
                            <span className="font-bold">{communityRegistry.length}</span> {t('Cloud.Labels.SubscriptionRepo')}
                        </Badge>
                    </div>

                    {/* 中间：全局社区概要数据 (仅在有数据时显示) */}
                    {communityStats?.summary && (
                        <div className="hidden md:flex items-center gap-4 text-[11px] text-muted-foreground ml-auto mr-4 px-4 py-1.5 rounded-full bg-muted/20 border border-border/40 shadow-sm">
                            <div className="flex items-center gap-1.5" title={t_i18n('Cloud.Labels.TotalTranslations')}>
                                <Package className="w-3.5 h-3.5 text-blue-500/70" />
                                <span className="font-semibold text-foreground/80">{communityStats.summary.totalTranslations}</span> 份翻译
                            </div>
                            <div className="w-[1px] h-3 bg-border/50" />
                            <div className="flex items-center gap-1.5" title={t_i18n('Cloud.Labels.TotalContributors')}>
                                <Users className="w-3.5 h-3.5 text-green-500/70" />
                                <span className="font-semibold text-foreground/80">{communityStats.summary.totalContributors}</span> 位贡献者
                            </div>
                            <div className="w-[1px] h-3 bg-border/50" />
                            <div className="flex items-center gap-1.5" title={t_i18n('Cloud.Labels.TotalStars')}>
                                <Star className="w-3.5 h-3.5 text-yellow-500/70" />
                                <span className="font-semibold text-foreground/80">{communityStats.summary.totalStars}</span> 个星标
                            </div>
                        </div>
                    )}

                    {/* 右侧：过滤与操作组件 */}
                    <div className="flex items-center gap-2">
                        {/* 搜索 */}
                        <div className="relative group w-48">
                            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground group-focus-within:text-primary transition-colors" />
                            <Input
                                placeholder={t_i18n('Cloud.Placeholders.SearchRepo')}
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="pl-8 h-8 text-[11px] bg-muted/20 border-border/40 focus:border-primary/30 shadow-sm"
                            />
                        </div>

                        {/* 语言过滤 */}
                        <Select value={filterLanguage} onValueChange={setFilterLanguage}>
                            <SelectTrigger size="sm" className="w-28 text-[11px] bg-muted/20 border-border/40 shadow-sm">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all" className="text-[11px]">{t_i18n('Common.Filters.All')}</SelectItem>
                                {SUPPORTED_LANGUAGES.map((lang) => (
                                    <SelectItem key={lang.value} value={lang.value} className="text-[11px]">
                                        {lang.label}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>

                        {/* 当前结果计数和刷新合并 */}
                        <div className="flex items-center bg-muted/30 border border-border/40 rounded-md h-8 shadow-sm">
                            <div className="flex items-center justify-center px-2.5 h-full text-[10px] font-mono font-medium text-muted-foreground border-r border-border/40" title="当前筛选结果数">
                                {filteredItems.length}
                            </div>
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-full w-8 rounded-none rounded-r-md hover:bg-muted/50 text-muted-foreground hover:text-foreground"
                                onClick={() => loadCommunityData(true)}
                                disabled={communityLoading}
                            >
                                <RefreshCw className={cn("w-3.5 h-3.5", communityLoading && "animate-spin")} />
                            </Button>
                        </div>
                    </div>
                </div>

                {/* 卡片网格 */}
                <ScrollArea className="flex-1 min-h-0">
                    <div className="pb-6 pr-4">
                        {filteredItems.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-20 text-muted-foreground bg-muted/10 rounded-xl border border-dashed border-border/40">
                                <Package className="w-12 h-12 mb-4 opacity-10" />
                                <p className="text-sm font-medium">{t('Cloud.Hints.NoMatchingRepos')}</p>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 2xl:grid-cols-3 gap-4">
                                {filteredItems.map((item) => (
                                    <CommunityRepoCard
                                        key={item.repoAddress}
                                        item={item}
                                        stats={communityStats?.repos?.[item.repoAddress]}
                                        onView={() => handleViewRepo(item.repoAddress)}
                                    />
                                ))}
                            </div>
                        )}
                    </div>
                </ScrollArea>
            </main>
        </div>
    );
};

// ========== 社区仓库卡片 ==========
interface CommunityRepoCardProps {
    item: RegistryItem;
    stats?: CommunityRepoStats;
    onView: () => void;
}

const CommunityRepoCard: React.FC<CommunityRepoCardProps> = ({ item, stats, onView }) => {
    const { t: t_i18n } = useTranslation(); // Renamed to avoid conflict with direct 't' import
    const [owner, repo] = item.repoAddress.split('/');

    return (
        <div className={cn(
            "group flex flex-col overflow-hidden bg-card text-card-foreground rounded-xl border border-border/50 shadow-sm transition-all duration-200 animate-in fade-in h-full relative",
            "hover:shadow-md hover:border-primary/30",
        )}>
            {/* 内容区 */}
            <div className="flex flex-col flex-1 p-4 pb-3 min-h-0 relative z-10">
                {/* 头部：头像 + 仓库名 */}
                <div className="flex items-start gap-3 mb-2.5">
                    {stats?.avatarUrl ? (
                        <img
                            src={stats.avatarUrl}
                            className="w-10 h-10 rounded-lg ring-1 ring-border shadow-sm object-cover shrink-0 group-hover:scale-105 transition-transform"
                            alt={owner}
                        />
                    ) : (
                        <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary ring-1 ring-primary/20 shrink-0">
                            {stats?.description?.toLowerCase().includes('theme') || stats?.repoName?.toLowerCase().includes('theme') ? (
                                <Palette className="w-5 h-5" />
                            ) : (
                                <Package className="w-5 h-5" />
                            )}
                        </div>
                    )}
                    <div className="flex-1 min-w-0">
                        <div className="text-[10px] text-muted-foreground/60 uppercase font-bold tracking-tight truncate">
                            {stats?.authorName || owner}
                        </div>
                        <h3 className="text-sm font-bold text-foreground leading-tight truncate -mt-0.5" title={item.repoAddress}>
                            {repo}
                        </h3>
                    </div>
                    {/* Star */}
                    {stats?.stars !== undefined && (
                        <Badge variant="outline" className="text-[9px] px-1.5 py-0 h-[18px] bg-yellow-500/10 border-yellow-500/30 text-yellow-600 gap-1 font-mono shrink-0">
                            <Star className="w-2.5 h-2.5 fill-current" />
                            {stats.stars}
                        </Badge>
                    )}
                </div>

                {/* 描述 */}
                <div className="min-h-[40px] max-h-[40px] mb-2 overflow-hidden">
                    {stats?.description ? (
                        <p className="text-[11px] text-muted-foreground/80 line-clamp-2 leading-relaxed h-[34px]" title={stats.description || ""}>
                            {stats.description || t('Cloud.Labels.NoDesc')}
                        </p>
                    ) : (
                        <p className="text-[11px] text-muted-foreground/30 italic">
                            {t('Cloud.Labels.NoDesc')}
                        </p>
                    )}
                </div>

                {/* 标签 */}
                <div className="mt-auto pt-1.5">
                    <div className="flex items-center gap-1.5 flex-wrap">
                        {/* 语言标签 */}
                        {stats?.languages?.map((lang) => (
                            <span key={lang} className="inline-flex items-center gap-1 text-[10px] text-muted-foreground/60 bg-muted/50 px-1.5 py-0.5 rounded uppercase font-medium">
                                <Globe className="w-2.5 h-2.5 shrink-0 opacity-50" />
                                {lang}
                            </span>
                        ))}
                        {/* 翻译数量 */}
                        {stats?.pluginCount !== undefined && (
                            <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground/60 bg-muted/50 px-1.5 py-0.5 rounded font-mono">
                                <Package className="w-2.5 h-2.5 shrink-0 opacity-50" />
                                {stats.pluginCount} {t('Cloud.Labels.UnitPlugins')}
                            </span>
                        )}
                    </div>
                </div>
            </div>

            {/* 底部操作栏 */}
            <div className="flex border-t border-border/30 mt-auto shrink-0 relative z-10">
                <button
                    onClick={onView}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2 text-[11px] font-medium text-muted-foreground hover:bg-primary/5 hover:text-primary transition-colors"
                >
                    <ArrowRight className="w-3.5 h-3.5" />
                    {t('Cloud.Labels.ExploreThisRepo')}
                </button>
                <div className="w-[1px] bg-border/30" />
                <a
                    href={`https://github.com/${item.repoAddress}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center gap-1.5 px-4 py-2 text-[11px] font-medium text-muted-foreground hover:bg-muted/50 hover:text-foreground transition-colors"
                >
                    <ExternalLink className="w-3.5 h-3.5" />
                    GitHub
                </a>
            </div>
        </div>
    );
};
