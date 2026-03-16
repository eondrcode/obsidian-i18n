/**
 * 社区目录 Tab
 * 左右分栏布局：左侧排行榜（可折叠） + 右侧全部翻译库卡片网格
 */
import React, { useCallback, useState, useMemo, useRef, useEffect } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { Input, Button, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/src/shadcn';
import { Search, RefreshCw, Globe, Star, Layers, Github, ExternalLink, Users, ArrowRight, Trophy, ChevronDown, TrendingUp, Palette, Library, Plus, Zap, CircleCheckBig, FileText, ShieldCheck } from 'lucide-react';
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
    const fetchCommunityRegistry = useCloudStore.use.fetchCommunityRegistry();
    const setCurrentTab = useCloudStore.use.setCurrentTab();
    const setTargetRepoAddress = useCloudStore.use.setTargetRepoAddress();

    const [searchQuery, setSearchQuery] = useState('');
    const [filterLanguage, setFilterLanguage] = useState('all');

    // 排行榜折叠状态
    const [reposOpen, setReposOpen] = useState(true);
    const [activeReposOpen, setActiveReposOpen] = useState(true);
    const [pluginReposOpen, setPluginReposOpen] = useState(true);
    const [authorsOpen, setAuthorsOpen] = useState(true);

    const [isRateLimited, setIsRateLimited] = useState(false);

    // 首次挂载自动加载
    React.useEffect(() => {
        if (!communityLoaded && !communityLoading) {
            fetchCommunityRegistry(i18n);
        }
    }, [communityLoaded, communityLoading, fetchCommunityRegistry, i18n]);

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
        return communityRegistry
            .filter((item) => {
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
            })
            .sort((a, b) => {
                // 1. 优先级权重：官方且精选 > 官方 > 精选 > 普通
                const getWeight = (item: RegistryItem) => {
                    if (item.isOfficial && item.isFeatured) return 3;
                    if (item.isOfficial) return 2;
                    if (item.isFeatured) return 1;
                    return 0;
                };

                const weightA = getWeight(a);
                const weightB = getWeight(b);

                if (weightA !== weightB) return weightB - weightA;

                // 2. 权重埃等时，按星标降序
                const statsA = communityStats?.repos?.[a.repoAddress];
                const statsB = communityStats?.repos?.[b.repoAddress];
                const starsA = statsA?.stars || 0;
                const starsB = statsB?.stars || 0;

                if (starsA !== starsB) return starsB - starsA;

                // 3. 最后按活跃度降序
                return (statsB?.activityScore || 0) - (statsA?.activityScore || 0);
            });
    }, [communityRegistry, communityStats, searchQuery, filterLanguage]);





    // 点击查看仓库
    const handleViewRepo = useCallback((address: string) => {
        setTargetRepoAddress(address);

        // 自动添加到已保存列表
        const currentSaved = i18n.settings.cloudRepos || [];
        if (!currentSaved.includes(address)) {
            const newRepos = [...currentSaved, address];
            i18n.settings.cloudRepos = newRepos;
            i18n.saveSettings();
            useCloudStore.getState().setSavedRepos(newRepos); // 同步到 store
        }

        // 清空当前列表，触发 ExploreTab 的自动获取逻辑
        useCloudStore.getState().setTargetManifest([]);

        setCurrentTab('download');
    }, [setTargetRepoAddress, setCurrentTab, i18n]);

    const topAuthors = useMemo(() => {
        return communityStats?.leaderboard?.topAuthors || [];
    }, [communityStats]);

    // 作者称号映射 (从注册索引中提取手动指定的称号)
    const authorBadgeMap = useMemo(() => {
        const map: Record<string, string> = {};
        communityRegistry.forEach(item => {
            if (item.authorBadge) {
                const [owner] = item.repoAddress.split('/');
                map[owner] = item.authorBadge;
            }
        });
        return map;
    }, [communityRegistry]);

    const totalContributors = useMemo(() => {
        if (!communityStats?.repos) return 0;
        // 统计唯一作者
        const authors = new Set<string>();
        Object.entries(communityStats.repos).forEach(([address, stats]: [string, any]) => {
            const authorName = stats.authorName || address.split('/')[0];
            if (authorName) authors.add(authorName);
        });
        // 优先使用接口返回的总数，如果为0或不合理则使用计算值
        const apiTotal = communityStats.summary?.totalContributors || 0;
        return apiTotal > authors.size ? apiTotal : authors.size;
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

    if (!communityLoaded && !isRateLimited) {
        return (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                <Globe className="w-16 h-16 mb-4 opacity-20" />
                <p className="text-sm font-medium">{t_i18n('Cloud.Errors.FetchFail')}</p>
                <Button variant="link" size="sm" onClick={() => fetchCommunityRegistry(i18n)} className="mt-2">
                    {t_i18n('Cloud.Actions.Recheck')}
                </Button>
            </div>
        );
    }

    if (isRateLimited && communityRegistry.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center h-full text-center p-6 space-y-4 max-w-md mx-auto animate-in fade-in duration-500">
                <div className="p-4 rounded-full bg-orange-500/10 text-orange-600 ring-1 ring-orange-500/20">
                    <Globe className="w-10 h-10 opacity-80" />
                </div>
                <div className="space-y-2">
                    <h3 className="text-xl font-bold tracking-tight">
                        {t_i18n('Cloud.Hints.RateLimitTitle')}
                    </h3>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                        {t_i18n('Cloud.Hints.RateLimitDesc')}
                    </p>
                </div>
                <Button
                    onClick={() => {
                        // @ts-ignore
                        i18n.app.setting.open();
                        // @ts-ignore
                        i18n.app.setting.openTabById('i18n');
                    }}
                    className="mt-4 gap-2 px-6 shadow-sm transition-all hover:translate-y-[-1px] bg-orange-500 hover:bg-orange-600 text-white border-none"
                >
                    {t_i18n('Cloud.Hints.RateLimitGuide')}
                    <ArrowRight className="w-4 h-4" />
                </Button>
                <Button variant="ghost" size="sm" onClick={() => fetchCommunityRegistry(i18n)} className="text-xs text-muted-foreground">
                    <RefreshCw className="w-3 h-3 mr-1.5" />
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
                            {/* 活跃仓库榜 (最近高频更新) - 可折叠 */}
                            {topActiveRepos.length > 0 && (
                                <Collapsible open={activeReposOpen} onOpenChange={setActiveReposOpen}>
                                    <div className="rounded-lg border border-border/40 bg-card/60 backdrop-blur-sm shadow-[0_4px_20px_rgb(0,0,0,0.03)] dark:shadow-[0_4px_20px_rgb(0,0,0,0.1)] overflow-hidden transition-all duration-300 hover:border-orange-500/20">
                                        <CollapsibleTrigger className="w-full flex items-center gap-2.5 px-4 py-3 border-b border-border/20 bg-gradient-to-r from-orange-500/5 to-transparent hover:from-orange-500/10 transition-all cursor-pointer select-none">
                                            <div className="p-1 rounded-md bg-orange-500/10">
                                                <TrendingUp className="w-3.5 h-3.5 text-orange-500" />
                                            </div>
                                            <h3 className="text-[12px] font-extrabold text-foreground tracking-tight flex-1 text-left min-w-0 truncate">{t('Cloud.Labels.TopActive')}</h3>
                                            <Badge variant="secondary" className="text-[9px] h-[18px] px-2 bg-orange-500/10 text-orange-600 border-orange-500/20 font-black">
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
                                    <div className="rounded-lg border border-border/40 bg-card/60 backdrop-blur-sm shadow-[0_4px_20px_rgb(0,0,0,0.03)] dark:shadow-[0_4px_20px_rgb(0,0,0,0.1)] overflow-hidden transition-all duration-300 hover:border-green-500/20">
                                        <CollapsibleTrigger className="w-full flex items-center gap-2.5 px-4 py-3 border-b border-border/20 bg-gradient-to-r from-green-500/5 to-transparent hover:from-green-500/10 transition-all cursor-pointer select-none">
                                            <div className="p-1 rounded-md bg-green-500/10">
                                                <Users className="w-3.5 h-3.5 text-green-500" />
                                            </div>
                                            <h3 className="text-[12px] font-extrabold text-foreground tracking-tight flex-1 text-left min-w-0 truncate">{t('Cloud.Labels.TopAuthors')}</h3>
                                            <Badge variant="secondary" className="text-[9px] h-[18px] px-2 bg-green-500/10 text-green-600 border-green-500/20 font-black">
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
                                                            <div className="text-[11px] font-semibold text-foreground truncate leading-tight group-hover:text-primary transition-colors flex items-center gap-1.5">
                                                                {author.name}
                                                                {authorBadgeMap[author.name] && (
                                                                    <Badge variant="outline" className="h-3.5 px-1 text-[8px] border-primary/30 text-primary bg-primary/5 font-black uppercase tracking-tighter shrink-0">
                                                                        {authorBadgeMap[author.name]}
                                                                    </Badge>
                                                                )}
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
                                    <div className="rounded-lg border border-border/40 bg-card/60 backdrop-blur-sm shadow-[0_4px_20px_rgb(0,0,0,0.03)] dark:shadow-[0_4px_20px_rgb(0,0,0,0.1)] overflow-hidden transition-all duration-300 hover:border-yellow-500/20">
                                        <CollapsibleTrigger className="w-full flex items-center gap-2.5 px-4 py-3 border-b border-border/20 bg-gradient-to-r from-yellow-500/5 to-transparent hover:from-yellow-500/10 transition-all cursor-pointer select-none">
                                            <div className="p-1 rounded-md bg-yellow-500/10">
                                                <Star className="w-3.5 h-3.5 text-yellow-500" />
                                            </div>
                                            <h3 className="text-[12px] font-extrabold text-foreground tracking-tight flex-1 text-left min-w-0 truncate">{t('Cloud.Labels.TopStars')}</h3>
                                            <Badge variant="secondary" className="text-[9px] h-[18px] px-2 bg-yellow-500/10 text-yellow-600 border-yellow-500/20 font-black">
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
                                    <div className="rounded-lg border border-border/40 bg-card/60 backdrop-blur-sm shadow-[0_4px_20px_rgb(0,0,0,0.03)] dark:shadow-[0_4px_20px_rgb(0,0,0,0.1)] overflow-hidden transition-all duration-300 hover:border-blue-500/20">
                                        <CollapsibleTrigger className="w-full flex items-center gap-2.5 px-4 py-3 border-b border-border/20 bg-gradient-to-r from-blue-500/5 to-transparent hover:from-blue-500/10 transition-all cursor-pointer select-none">
                                            <div className="p-1 rounded-md bg-blue-500/10">
                                                <Layers className="w-3.5 h-3.5 text-blue-500" />
                                            </div>
                                            <h3 className="text-[12px] font-extrabold text-foreground tracking-tight flex-1 text-left min-w-0 truncate">{t('Cloud.Labels.TopPlugins')}</h3>
                                            <Badge variant="secondary" className="text-[9px] h-[18px] px-2 bg-blue-500/10 text-blue-600 border-blue-500/20 font-black">
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
                                                            <Layers className="w-2.5 h-2.5 text-blue-500" />
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
                        <h2 className="text-[17px] font-extrabold text-foreground tracking-tight">{t('Cloud.Labels.DiscoverTranslations')}</h2>
                        <Badge variant="secondary" className="px-2.5 py-0.5 text-[10px] font-black bg-primary/10 text-primary border-primary/20 shadow-sm gap-1.5 rounded-full uppercase tracking-tighter">
                            <span className="opacity-70">{communityRegistry.length}</span> {t('Cloud.Labels.SubscriptionRepo')}
                        </Badge>
                    </div>

                    {/* 中间：全局社区概要数据 (仅在有数据时显示) */}
                    {communityStats?.summary && (
                        <div className="hidden md:flex items-center gap-4 text-[11px] text-muted-foreground ml-auto mr-4 px-4 py-1.5 rounded-full bg-muted/20 border border-border/40 shadow-sm">
                            <div className="flex items-center gap-1.5" title={t_i18n('Cloud.Labels.TotalTranslations')}>
                                <Layers className="w-3.5 h-3.5 text-blue-500/70" />
                                <span className="font-bold text-foreground/80">{communityStats.summary.totalTranslations}</span> 份翻译
                            </div>
                            <div className="w-[1px] h-3 bg-border/50" />
                            <div className="flex items-center gap-1.5" title={t_i18n('Cloud.Labels.TotalContributors')}>
                                <Users className="w-3.5 h-3.5 text-green-500/70" />
                                <span className="font-bold text-foreground/80">{totalContributors}</span> 位贡献者
                            </div>
                            <div className="w-[1px] h-3 bg-border/50" />
                            <div className="flex items-center gap-1.5" title={t_i18n('Cloud.Labels.TotalStars')}>
                                <Star className="w-3.5 h-3.5 text-yellow-500/70" />
                                <span className="font-bold text-foreground/80">{communityStats.summary.totalStars}</span> 个星标
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
                                className="pl-8 h-8 text-[11px] bg-muted/20 border-border/40 focus:border-primary/40 focus:ring-1 focus:ring-primary/20 shadow-sm transition-all"
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
                                onClick={() => fetchCommunityRegistry(i18n)}
                                disabled={communityLoading}
                            >
                                <RefreshCw className={cn("w-3.5 h-3.5", communityLoading && "animate-spin")} />
                            </Button>
                        </div>
                    </div>
                </div>



                {/* 卡片网格 */}
                <CommunityReposList
                    filteredItems={filteredItems}
                    communityStats={communityStats}
                    handleViewRepo={handleViewRepo}
                    t={t}
                />
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
    const { t: t_i18n } = useTranslation();
    const [owner, repo] = item.repoAddress.split('/');

    return (
        <div className={cn(
            "group flex flex-col overflow-hidden bg-card text-card-foreground rounded-lg border border-border/60 transition-all duration-300 animate-in fade-in h-[196px] relative select-none",
            "hover:shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:hover:shadow-[0_8px_30px_rgb(0,0,0,0.2)] hover:border-primary/40"
        )}>
            {/* 星标：移至右上角绝对定位，对齐内边距 */}
            <div className="absolute top-4 right-4 flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/20 shadow-sm z-10 transition-transform group-hover:scale-105">
                <Star className="w-3 h-3 text-amber-500 fill-amber-500/20" />
                <span className="text-[10px] font-black text-amber-600/90">{stats?.stars || 0}</span>
            </div>

            {/* 内容主干 */}
            <div className="flex flex-col flex-1 p-4 pb-3 min-h-0 space-y-3">
                {/* 头部：头像 + 仓库名 */}
                <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2.5 flex-1 min-w-0">
                        <div className={cn(
                            "flex items-center justify-center w-8 h-8 rounded-lg shrink-0 shadow-sm border border-border/10 transition-colors overflow-hidden",
                            "bg-muted/50 group-hover:bg-muted"
                        )}>
                            {stats?.avatarUrl ? (
                                <img
                                    src={stats.avatarUrl}
                                    className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                                    alt={owner}
                                />
                            ) : (
                                <Layers className="w-4 h-4 text-muted-foreground/60" />
                            )}
                        </div>
                        <div className="min-w-0 flex-1 pr-14">
                            <div className="flex items-center gap-1.5 min-w-0">
                                <h3 className="text-[12px] font-extrabold text-foreground tracking-tight leading-none truncate" title={item.repoAddress}>
                                    {repo}
                                </h3>
                                {item.isOfficial && (
                                    <span title={t('Cloud.Labels.Official')} className="shrink-0 flex items-center">
                                        <ShieldCheck className="w-3.5 h-3.5 text-blue-500 fill-blue-500/10" />
                                    </span>
                                )}
                                {item.isFeatured && (
                                    <span title={t('Cloud.Labels.Featured')} className="shrink-0 flex items-center">
                                        <Zap className="w-3.5 h-3.5 text-orange-500 fill-orange-500/10" />
                                    </span>
                                )}
                            </div>
                            <div className="flex items-center gap-1.5 mt-1">
                                <span className="text-[9px] text-muted-foreground/60 font-bold uppercase tracking-wider truncate">{stats?.authorName || owner}</span>
                                {item.authorBadge && (
                                    <Badge variant="outline" className="h-[14px] px-1 text-[7px] border-primary/20 text-primary/80 bg-primary/5 font-black uppercase tracking-tighter">
                                        {item.authorBadge}
                                    </Badge>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                {/* 标签快读区 */}
                {item.badges && item.badges.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                        {item.badges.map((badge, idx) => (
                            <Badge key={idx} variant="secondary" className="h-[15px] px-1.5 text-[8px] font-bold bg-muted/40 text-muted-foreground/80 border-none rounded">
                                {badge}
                            </Badge>
                        ))}
                    </div>
                )}

                {/* 描述 */}
                <div className="min-h-[34px] max-h-[34px] overflow-hidden">
                    <p className="text-[11px] text-muted-foreground/90 leading-relaxed line-clamp-2" title={stats?.description || ""}>
                        {stats?.description || t('Cloud.Labels.NoDesc')}
                    </p>
                </div>

                {/* 元数据区域 - 增强统计集 */}
                <div className="mt-auto grid grid-cols-2 gap-1.5">
                    <div className="flex items-center justify-between px-2 py-1 rounded bg-muted/20 border border-border/5">
                        <div className="flex items-center gap-1.5 text-[9px] text-muted-foreground/70 font-bold uppercase tracking-tighter">
                            <Globe className="w-2.5 h-2.5 opacity-40" />
                            {stats?.languages?.[0] || 'ZH'}
                        </div>
                        <div className="flex items-center gap-1.5 text-[9px] text-muted-foreground/70 font-bold">
                            <div className="flex items-center gap-1.5" title={t('Cloud.Labels.PublishedResources')}>
                                <Library className="w-2.5 h-2.5 opacity-40 text-blue-500" />
                                <span>{(stats?.pluginCount || 0) + (stats?.themeCount || 0)}</span>
                            </div>
                        </div>
                    </div>
                    <div className="flex items-center justify-between px-2 py-1 rounded bg-muted/20 border border-border/5">
                        <div className="flex items-center gap-1.5 text-[9px] text-muted-foreground/70 font-bold">
                            <TrendingUp className="w-2.5 h-2.5 opacity-40 text-emerald-500" />
                            {stats?.activityScore !== undefined ? Math.round(stats.activityScore * 100) : 0}
                        </div>
                    </div>
                </div>
            </div>

            {/* 操作栏 */}
            <div className="flex border-t border-border/30 h-10 shrink-0 bg-muted/5 group-hover:bg-muted/10 transition-colors">
                <button
                    onClick={onView}
                    className="flex-1 flex items-center justify-center gap-2 text-[11px] font-bold text-primary transition-all active:scale-95 hover:bg-primary/5"
                >
                    <ArrowRight className="w-3.5 h-3.5" />
                    <span className="uppercase tracking-tight">{t('Cloud.Labels.ExploreThisRepo')}</span>
                </button>
                <div className="w-[1px] bg-border/20 my-2" />
                <a
                    href={`https://github.com/${item.repoAddress}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-4 flex items-center justify-center text-muted-foreground/60 hover:text-foreground hover:bg-muted/20 transition-all active:scale-90"
                    title="GitHub"
                >
                    <Github className="w-4 h-4" />
                </a>
            </div>
        </div>
    );
};

// ========== 社区仓库列表组件 (独立封装以确保状态重置) ==========
interface CommunityReposListProps {
    filteredItems: RegistryItem[];
    communityStats: any;
    handleViewRepo: (address: string) => void;
    t: any;
}

const CommunityReposList: React.FC<CommunityReposListProps> = ({
    filteredItems,
    communityStats,
    handleViewRepo,
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

    const rowCount = Math.ceil(filteredItems.length / columns);

    const rowVirtualizer = useVirtualizer({
        count: rowCount,
        getScrollElement: () => parentRef.current,
        estimateSize: useCallback(() => 204, []),
        overscan: 5,
    });

    const virtualItems = rowVirtualizer.getVirtualItems();

    return (
        <ScrollArea className="flex-1 min-h-0" viewportRef={parentRef}>
            <div className="pb-6 pr-4">
                {filteredItems.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 text-muted-foreground bg-muted/10 rounded-xl border border-dashed border-border/40">
                        <Layers className="w-12 h-12 mb-4 opacity-10" />
                        <p className="text-sm font-medium">{t('Cloud.Hints.NoMatchingRepos')}</p>
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
                            const itemsInRow = filteredItems.slice(startIndex, startIndex + columns);

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
                                    {itemsInRow.map((item) => (
                                        <CommunityRepoCard
                                            key={item.repoAddress}
                                            item={item}
                                            stats={communityStats?.repos?.[item.repoAddress]}
                                            onView={() => handleViewRepo(item.repoAddress)}
                                        />
                                    ))}
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </ScrollArea>
    );
};
