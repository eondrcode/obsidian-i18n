import React, { useState, useMemo, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useCloudStore } from '../../cloud/cloud-store';
import { ScrollArea, Input, Button, Badge, Checkbox, Label, Separator, Card, CardHeader, CardTitle, CardContent, CardDescription, CardFooter } from '~/shadcn';
import { Search, ShieldCheck, Star, Copy, Check, Users, Info, Settings2, RefreshCw, LayoutGrid, Cloud, Loader2, Github, Heart, MessageSquare, TrendingUp, Globe, FileJson, Trophy, GitFork, CircleDot, History, Database, Languages, Zap, Palette } from 'lucide-react';
import { Notice } from 'obsidian';

interface AdminPanelProps {
    i18n: any;
}

const LanguageDistributionChart: React.FC<{ data: Record<string, number> }> = ({ data }) => {
    const { t } = useTranslation();
    const total = Object.values(data).reduce((acc, cur) => acc + cur, 0);
    const sortedData = Object.entries(data)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 8); // 只取前 8 个

    return (
        <Card className="border-none shadow-none bg-transparent py-0 gap-4">
            <CardHeader className="px-0 py-0 flex-row items-baseline justify-between space-y-0">
                <CardTitle className="text-[10px] font-black uppercase tracking-wider text-muted-foreground/60">{t('Manager.Dashboard.LanguageDistribution.Title')}</CardTitle>
                <div className="text-[10px] font-medium text-primary/80">{t('Manager.Dashboard.LanguageDistribution.TotalTranslations', { count: total })}</div>
            </CardHeader>
            <CardContent className="px-0 space-y-4">
                <div className="h-2 w-full flex rounded-full overflow-hidden bg-muted/30 border border-border/5 shadow-inner">
                    {sortedData.map(([lang, count], i) => (
                        <div
                            key={lang}
                            style={{ width: `${(count / total) * 100}%` }}
                            className={`h-full transition-all duration-1000 delay-${i * 100} hover:brightness-110 cursor-help ${i === 0 ? "bg-blue-500" :
                                i === 1 ? "bg-amber-500" :
                                    i === 2 ? "bg-emerald-500" :
                                        i === 3 ? "bg-purple-500" :
                                            i === 4 ? "bg-rose-500" :
                                                i === 5 ? "bg-cyan-500" :
                                                    i === 6 ? "bg-indigo-500" : "bg-slate-400"
                                }`}
                            title={`${lang}: ${count}`}
                        />
                    ))}
                </div>
                <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
                    {sortedData.map(([lang, count], i) => (
                        <div key={lang} className="flex items-center justify-between group">
                            <div className="flex items-center gap-1.5 min-w-0">
                                <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${i === 0 ? "bg-blue-500" :
                                    i === 1 ? "bg-amber-500" :
                                        i === 2 ? "bg-emerald-500" :
                                            i === 3 ? "bg-purple-500" :
                                                i === 4 ? "bg-rose-500" :
                                                    i === 5 ? "bg-cyan-500" :
                                                        i === 6 ? "bg-indigo-500" : "bg-slate-400"
                                    }`} />
                                <span className="text-[10px] font-bold truncate opacity-60 group-hover:opacity-100 transition-opacity uppercase">{lang}</span>
                            </div>
                            <span className="text-[10px] font-mono opacity-40 group-hover:opacity-70">{Math.round((count / total) * 100)}%</span>
                        </div>
                    ))}
                </div>
            </CardContent>
        </Card>
    );
};

export const AdminPanel: React.FC<AdminPanelProps> = ({ i18n }) => {
    const { t } = useTranslation();
    const communityRegistry = useCloudStore.use.communityRegistry();
    const communityStats = useCloudStore.use.communityStats();
    const communityLoaded = useCloudStore.use.communityLoaded();
    const communityLoading = useCloudStore.use.communityLoading();
    const isPushing = useCloudStore.use.isPushing();
    const fetchCommunityRegistry = useCloudStore.use.fetchCommunityRegistry();
    const pushRegistryToCloud = useCloudStore.use.pushRegistryToCloud();
    const updateRegistryItem = useCloudStore.use.updateRegistryItem();

    useEffect(() => {
        if (!communityLoaded && !communityLoading) {
            fetchCommunityRegistry(i18n);
        }
    }, [communityLoaded, communityLoading, fetchCommunityRegistry, i18n]);

    const [searchQuery, setSearchQuery] = useState('');
    const [copied, setCopied] = useState(false);

    const filteredItems = useMemo(() => {
        if (!searchQuery) return communityRegistry;
        const q = searchQuery.toLowerCase();
        return communityRegistry.filter(item =>
            item.repoAddress.toLowerCase().includes(q) ||
            (item.authorBadge || '').toLowerCase().includes(q)
        );
    }, [communityRegistry, searchQuery]);

    const handleCopyJson = () => {
        const json = JSON.stringify(communityRegistry, null, 2);
        navigator.clipboard.writeText(json);
        setCopied(true);
        new Notice(t('Manager.Notices.CopySuccess') || 'Registry JSON 已复制到剪贴板');
        setTimeout(() => setCopied(false), 2000);
    };

    const handlePushToCloud = async () => {
        const success = await pushRegistryToCloud(i18n);
        if (success) {
            new Notice(t('Manager.Notices.SyncSuccess') || '中心库注册表同步成功！');
        } else {
            new Notice(t('Manager.Errors.SyncFailed') || '同步失败，请检查网络或 Token 权限');
        }
    };

    return (
        <div className="flex flex-col h-full bg-background no-scrollbar select-none">
            {/* 顶部工具栏 - 更专业的 Dashboard Header */}
            <div className="px-6 py-4 border-b bg-gradient-to-b from-muted/30 to-background flex flex-col md:flex-row md:items-end justify-between gap-4 shrink-0 box-border">
                <div className="flex items-start gap-3">
                    <div className="mt-1 p-2 rounded-xl bg-primary/10 text-primary border border-primary/20 shadow-inner">
                        <TrendingUp className="w-5 h-5" />
                    </div>
                    <div>
                        <div className="flex items-center gap-2 mb-0.5">
                            <h2 className="text-xl font-black tracking-tighter text-foreground/90 uppercase">{t('Manager.Dashboard.Title')}</h2>
                            <Badge variant="outline" className="h-4 px-1 border-primary/30 text-primary/80 bg-primary/5 text-[8px] font-black uppercase">{t('Manager.Dashboard.AdminControl')}</Badge>
                        </div>
                        <p className="text-[10px] text-muted-foreground/70 font-medium">{t('Manager.Dashboard.Subtitle')}</p>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <div className="relative group">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground group-focus-within:text-primary transition-colors" />
                        <Input
                            placeholder={t('Manager.Dashboard.SearchPlaceholder')}
                            className="pl-9 h-9 w-56 lg:w-72 bg-background/40 border-border/40 hover:bg-background/60 focus:bg-background/80 transition-all rounded-lg text-[10px] font-bold tracking-tight uppercase"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>
                    <div className="flex items-center gap-2">
                        <Button
                            variant="default"
                            size="sm"
                            className="h-9 px-4 gap-2 bg-primary hover:opacity-90 text-primary-foreground border-none shadow-md shadow-primary/20 transition-all rounded-lg font-bold text-[10px] uppercase tracking-wider"
                            onClick={handlePushToCloud}
                            disabled={isPushing}
                        >
                            {isPushing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Cloud className="w-3.5 h-3.5" />}
                            <span>{t('Manager.Dashboard.PushToCloud')}</span>
                        </Button>
                        <Button
                            variant="outline"
                            size="icon"
                            className="h-9 w-9 border-border/40 bg-background/40 hover:bg-background rounded-lg transition-all"
                            onClick={handleCopyJson}
                            title={t('Manager.Dashboard.ExportJson')}
                        >
                            {copied ? <Check className="w-3.5 h-3.5 text-green-500" /> : <FileJson className="w-3.5 h-3.5" />}
                        </Button>
                    </div>
                </div>
            </div>

            <ScrollArea className="flex-1">
                <div className="p-6 space-y-6 max-w-[1600px] mx-auto">
                    {/* 全局概览面板 */}
                    {!communityLoading && communityStats && (
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 animate-in fade-in slide-in-from-top-4 duration-700">
                            {/* 左侧：核心指标 */}
                            <div className="lg:col-span-2 grid grid-cols-2 sm:grid-cols-5 gap-2">
                                {[
                                    { label: t('Manager.Dashboard.Stats.Repos'), value: communityStats.summary.totalRepos, icon: Github, color: 'text-blue-500', bg: 'bg-blue-500/10' },
                                    { label: t('Manager.Dashboard.Stats.Stars'), value: communityStats.summary.totalStars, icon: Star, color: 'text-amber-500', bg: 'bg-amber-500/10' },
                                    { label: t('Manager.Dashboard.Stats.Contribs'), value: communityStats.summary.totalContributors, icon: Users, color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
                                    { label: t('Manager.Dashboard.Stats.Plugins'), value: communityStats.summary.totalPlugins, icon: LayoutGrid, color: 'text-purple-500', bg: 'bg-purple-500/10' },
                                    { label: t('Manager.Dashboard.Stats.Translations'), value: communityStats.summary.totalTranslations || Object.values(communityStats.summary.languageDistribution).reduce((a, b) => a + b, 0), icon: Languages, color: 'text-rose-500', bg: 'bg-rose-500/10' },
                                ].map((stat: any) => (
                                    <Card key={stat.label} className="border-border/40 bg-card/40 hover:bg-card hover:shadow-lg hover:shadow-primary/5 transition-all duration-300 group py-0 rounded-xl">
                                        <CardHeader className="p-3 pb-0 flex-row items-center justify-between space-y-0">
                                            <div className={`w-7 h-7 ${stat.bg} ${stat.color} rounded-lg flex items-center justify-center group-hover:scale-110 transition-transform`}>
                                                <stat.icon className="w-3.5 h-3.5" />
                                            </div>
                                        </CardHeader>
                                        <CardContent className="p-3 pt-1">
                                            <CardDescription className="text-[8px] font-black uppercase tracking-widest text-muted-foreground/50 mb-0.5 whitespace-nowrap overflow-hidden text-ellipsis">{stat.label}</CardDescription>
                                            <CardTitle className="text-lg font-black tracking-tight">{stat.value ? stat.value.toLocaleString() : '0'}</CardTitle>
                                        </CardContent>
                                    </Card>
                                ))}

                                <Card className="col-span-full border-border/40 bg-gradient-to-br from-primary/5 to-transparent py-0 rounded-xl">
                                    <CardContent className="p-5 flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <div className="p-2.5 rounded-full bg-primary/10 text-primary border border-primary/5">
                                                <Trophy className="w-5 h-5" />
                                            </div>
                                            <div>
                                                <CardTitle className="text-xs font-black uppercase tracking-tight">{t('Manager.Dashboard.Leaderboard.Title')}</CardTitle>
                                                <CardDescription className="text-[9px] font-medium uppercase tracking-wider opacity-60">{t('Manager.Dashboard.Leaderboard.Subtitle')}</CardDescription>
                                            </div>
                                        </div>
                                        <div className="flex -space-x-2 overflow-hidden p-1">
                                            {communityStats.leaderboard.topAuthors.slice(0, 10).map((author) => (
                                                <div key={author.name} className="relative group/avatar">
                                                    <img
                                                        className="inline-block h-8 w-8 rounded-full ring-2 ring-background grayscale hover:grayscale-0 transition-all cursor-pointer"
                                                        src={author.avatarUrl}
                                                        alt={author.name}
                                                    />
                                                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-popover text-popover-foreground text-[8px] font-bold rounded shadow-lg opacity-0 group-hover/avatar:opacity-100 transition-opacity pointer-events-none whitespace-nowrap border z-10 uppercase tracking-tighter">
                                                        {author.name} • {author.totalPlugins}P • {Math.round(author.activityScore * 100)}%
                                                    </div>
                                                </div>
                                            ))}
                                            {communityStats.leaderboard.topAuthors.length > 10 && (
                                                <div className="flex items-center justify-center h-8 w-8 rounded-full bg-muted ring-2 ring-background text-[8px] font-bold text-muted-foreground">
                                                    +{communityStats.leaderboard.topAuthors.length - 10}
                                                </div>
                                            )}
                                        </div>
                                    </CardContent>
                                </Card>
                            </div>

                            {/* 右侧：统计图表 */}
                            <Card className="p-5 border-border/40 bg-card/40 shadow-inner py-4 rounded-xl">
                                <LanguageDistributionChart data={communityStats.summary.languageDistribution} />
                            </Card>
                        </div>
                    )}

                    {/* 仓库列表部分 */}
                    <div className="space-y-4">
                        <div className="flex items-center justify-between px-1">
                            <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/40">{t('Manager.Dashboard.Management.Title')}</h3>
                            <div className="text-[9px] font-medium text-muted-foreground/30 uppercase tracking-wider">
                                {t('Manager.Dashboard.Management.ShowingStats', { filtered: filteredItems.length, total: communityRegistry.length })}
                            </div>
                        </div>

                        {communityLoading ? (
                            <div className="flex flex-col items-center justify-center py-24 text-muted-foreground bg-muted/5 rounded-2xl border border-dashed text-center">
                                <RefreshCw className="w-10 h-10 animate-spin text-primary/30 mb-4 mx-auto" />
                                <p className="text-[10px] font-black uppercase tracking-widest opacity-40">{t('Manager.Dashboard.Management.SyncingData')}</p>
                            </div>
                        ) : filteredItems.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-24 text-muted-foreground bg-muted/5 rounded-2xl border border-dashed text-center">
                                <LayoutGrid className="w-12 h-12 opacity-10 mb-4 mx-auto" />
                                <h3 className="text-xs font-black uppercase tracking-wider opacity-30">{t('Manager.Dashboard.Management.NoData')}</h3>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 gap-4">
                                {filteredItems.map((item) => {
                                    const stats = communityStats?.repos?.[item.repoAddress];
                                    const isTopStar = communityStats?.leaderboard?.topReposByStars.slice(0, 3).includes(item.repoAddress);

                                    return (
                                        <Card key={item.repoAddress} className="border-border/40 bg-card/40 hover:bg-card hover:shadow-xl hover:shadow-primary/5 transition-all duration-500 hover:border-primary/40 group overflow-hidden py-0 rounded-xl">
                                            <CardContent className="relative p-5">
                                                {/* 背景光晕 */}
                                                <div className="absolute -top-24 -right-24 w-64 h-64 bg-primary/5 rounded-full blur-[100px] opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />

                                                <div className="flex flex-col lg:flex-row gap-6">
                                                    {/* 仓库核心态势 */}
                                                    <div className="w-full lg:w-72 shrink-0">
                                                        <div className="flex items-start gap-4 mb-5">
                                                            <div className={`w-12 h-12 rounded-xl ${item.isOfficial ? 'bg-amber-500/10 text-amber-500 border-amber-500/20' : 'bg-primary/10 text-primary border-primary/20'} flex items-center justify-center border shadow-sm group-hover:scale-105 transition-transform shrink-0`}>
                                                                <Github className="w-6 h-6" />
                                                            </div>
                                                            <div className="min-w-0">
                                                                <div className="flex items-center gap-2 flex-wrap mb-0.5">
                                                                    <h3 className="text-base font-black tracking-tight truncate leading-tight">{item.repoAddress.split('/')[1]}</h3>
                                                                    {isTopStar && <span title="Top 3 Stars"><Trophy className="w-3.5 h-3.5 text-amber-500" /></span>}
                                                                </div>
                                                                <div className="flex items-center gap-2">
                                                                    <p className="text-[10px] text-muted-foreground/60 font-bold uppercase tracking-wide truncate">{item.repoAddress.split('/')[0]}</p>
                                                                    <span className="text-[9px] opacity-20">•</span>
                                                                    <p className="text-[9px] font-mono text-muted-foreground/40">{stats?.license || t('Manager.Dashboard.Management.NoLicense')}</p>
                                                                </div>
                                                            </div>
                                                        </div>

                                                        {/* 深度统计图表网格 */}
                                                        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-2 gap-2 mb-4">
                                                            <div className="p-2.5 rounded-xl bg-muted/30 border border-border/5 group/stat">
                                                                <div className="flex items-center justify-between mb-0.5">
                                                                    <div className="flex items-center gap-1.5 text-muted-foreground/50">
                                                                        <Star className="w-3 h-3 group-hover/stat:text-amber-500 transition-colors" />
                                                                        <span className="text-[9px] font-black uppercase tracking-wider">{t('Manager.Dashboard.Stats.Stars')}</span>
                                                                    </div>
                                                                    <div className="flex items-center gap-1 text-[8px] opacity-30">
                                                                        <GitFork className="w-2.5 h-2.5" />
                                                                        <span>{stats?.forks || 0}</span>
                                                                    </div>
                                                                </div>
                                                                <p className="text-base font-black tracking-tighter">{stats?.stars.toLocaleString() || 0}</p>
                                                            </div>
                                                            <div className="p-2.5 rounded-xl bg-muted/30 border border-border/5 group/stat">
                                                                <div className="flex items-center justify-between mb-0.5">
                                                                    <div className="flex items-center gap-1.5 text-muted-foreground/50">
                                                                        <TrendingUp className="w-3 h-3 group-hover/stat:text-blue-500 transition-colors" />
                                                                        <span className="text-[9px] font-black uppercase tracking-wider whitespace-nowrap">{t('Manager.Dashboard.Stats.Commits30d')}</span>
                                                                    </div>
                                                                    <div className="flex items-center gap-1 text-[8px] opacity-30">
                                                                        <CircleDot className="w-2.5 h-2.5" />
                                                                        <span>{stats?.openIssuesCount || 0}</span>
                                                                    </div>
                                                                </div>
                                                                <p className="text-base font-black tracking-tighter">{stats?.recentCommits30d || 0}</p>
                                                            </div>
                                                            <div className="p-2.5 rounded-xl bg-muted/30 border border-border/5 group/stat">
                                                                <div className="flex items-center justify-between mb-0.5">
                                                                    <div className="flex items-center gap-1.5 text-muted-foreground/50">
                                                                        <LayoutGrid className="w-3 h-3 group-hover/stat:text-purple-500 transition-colors" />
                                                                        <span className="text-[9px] font-black uppercase tracking-wider">{t('Manager.Dashboard.Stats.Plugins')}</span>
                                                                    </div>
                                                                    <div className="flex items-center gap-1 text-[8px] opacity-40 font-bold text-primary/60">
                                                                        <Languages className="w-2.5 h-2.5" />
                                                                        <span>{stats?.translationCount || 0}</span>
                                                                    </div>
                                                                </div>
                                                                <div className="flex items-baseline gap-2">
                                                                    <div className="flex items-center gap-1.5">
                                                                        <span className="text-base font-black tracking-tighter">{stats?.pluginCount || 0}</span>
                                                                        <span className="text-[8px] text-muted-foreground/40 font-bold uppercase tracking-widest">{t('Manager.Labels.Plugins')}</span>
                                                                    </div>
                                                                    {stats?.themeCount !== undefined && stats.themeCount > 0 && (
                                                                        <div className="flex items-center gap-1.5 border-l border-border/10 pl-2">
                                                                            <span className="text-sm font-black tracking-tighter text-purple-500/80">{stats.themeCount}</span>
                                                                            <span className="text-[8px] text-muted-foreground/40 font-bold uppercase tracking-widest">{t('Manager.Labels.Themes')}</span>
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            </div>
                                                            <div className="p-2.5 rounded-xl bg-muted/30 border border-border/5 group/stat">
                                                                <div className="flex items-center justify-between mb-0.5">
                                                                    <div className="flex items-center gap-1.5 text-muted-foreground/50">
                                                                        <History className="w-3 h-3 group-hover/stat:text-emerald-500 transition-colors" />
                                                                        <span className="text-[9px] font-black uppercase tracking-wider">{t('Manager.Dashboard.Stats.LastUpdate')}</span>
                                                                    </div>
                                                                    <div className="flex items-center gap-1 text-[8px] opacity-30">
                                                                        <Database className="w-2.5 h-2.5" />
                                                                        <span>{(stats?.repoSize ? stats.repoSize / 1024 : 0).toFixed(1)}M</span>
                                                                    </div>
                                                                </div>
                                                                <p className="text-[10px] font-black uppercase tracking-tight mt-1 whitespace-nowrap overflow-hidden text-ellipsis">
                                                                    {stats?.lastPushedAt ? new Date(stats.lastPushedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : '-'}
                                                                </p>
                                                            </div>
                                                        </div>

                                                        <div className="space-y-1.5 px-1">
                                                            <div className="flex items-center justify-between text-[9px] font-black uppercase text-muted-foreground/40 tracking-widest leading-none">
                                                                <span>{t('Manager.Dashboard.Stats.ActivityIndex')}</span>
                                                                <span className="text-primary/70">{Math.round((stats?.activityScore || 0) * 100)}%</span>
                                                            </div>
                                                            <div className="h-1 w-full bg-muted/50 rounded-full overflow-hidden shadow-inner">
                                                                <div
                                                                    className="h-full bg-gradient-to-r from-primary/40 to-primary shadow-[0_0_8px_rgba(var(--primary),0.5)] transition-all duration-1000 ease-out"
                                                                    style={{ width: `${(stats?.activityScore || 0) * 100}%` }}
                                                                />
                                                            </div>
                                                        </div>
                                                    </div>

                                                    <Separator orientation="vertical" className="hidden lg:block h-auto mx-1 opacity-30" />

                                                    {/* 管理编辑域 */}
                                                    <div className="flex-1 space-y-4 flex flex-col justify-center">
                                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                            <div className="space-y-1.5">
                                                                <Label className="text-[9px] font-black flex items-center gap-1.5 text-muted-foreground/60 uppercase tracking-[0.1em]">
                                                                    <Users className="w-3 h-3" />
                                                                    {t('Manager.Dashboard.Fields.AuthorReputation')}
                                                                </Label>
                                                                <Input
                                                                    value={item.authorBadge || ''}
                                                                    placeholder={t('Manager.Dashboard.Fields.AuthorReputationPlaceholder')}
                                                                    className="h-9 text-[10px] bg-muted/20 border-border/60 focus:border-primary/40 focus:bg-background/80 transition-all rounded-lg font-bold uppercase tracking-wide"
                                                                    onChange={(e) => updateRegistryItem(item.repoAddress, { authorBadge: e.target.value })}
                                                                />
                                                            </div>
                                                            <div className="space-y-1.5">
                                                                <Label className="text-[9px] font-black flex items-center gap-1.5 text-muted-foreground/60 uppercase tracking-[0.1em]">
                                                                    <Heart className="w-3 h-3" />
                                                                    {t('Manager.Dashboard.Fields.RegistryBadges')}
                                                                </Label>
                                                                <Input
                                                                    value={JSON.stringify(item.badges || [])}
                                                                    placeholder={t('Manager.Dashboard.Fields.RegistryBadgesPlaceholder')}
                                                                    className="h-9 text-[9px] bg-muted/20 font-mono border-border/60 focus:border-primary/40 rounded-lg"
                                                                    onChange={(e) => {
                                                                        try {
                                                                            const parsed = JSON.parse(e.target.value);
                                                                            if (Array.isArray(parsed)) updateRegistryItem(item.repoAddress, { badges: parsed });
                                                                        } catch (e) { }
                                                                    }}
                                                                />
                                                            </div>
                                                        </div>

                                                        <div className="space-y-1.5">
                                                            <Label className="text-[9px] font-black flex items-center gap-1.5 text-muted-foreground/60 uppercase tracking-[0.1em]">
                                                                <MessageSquare className="w-3 h-3" />
                                                                {t('Manager.Dashboard.Fields.FeaturedContext')}
                                                            </Label>
                                                            <Input
                                                                value={item.reason || ''}
                                                                placeholder={t('Manager.Dashboard.Fields.FeaturedContextPlaceholder')}
                                                                className="h-9 text-[10px] bg-muted/20 border-border/60 focus:border-primary/40 rounded-lg"
                                                                onChange={(e) => updateRegistryItem(item.repoAddress, { reason: e.target.value })}
                                                            />
                                                        </div>
                                                    </div>

                                                    {/* 决策操作单元 */}
                                                    <div className="w-full lg:w-48 shrink-0 flex flex-col gap-2 justify-center">
                                                        <div
                                                            className={`flex items-center justify-between p-3 rounded-xl border transition-all duration-300 select-none cursor-pointer group/toggle ${item.isOfficial ? 'bg-blue-600/5 border-blue-600/40 shadow-sm shadow-blue-600/10' : 'bg-muted/10 border-border/40 hover:bg-muted/20'}`}
                                                            onClick={() => updateRegistryItem(item.repoAddress, { isOfficial: !item.isOfficial })}
                                                        >
                                                            <div className="flex items-center gap-2.5">
                                                                <div className={`p-2 rounded-lg transition-all ${item.isOfficial ? 'bg-blue-600/20 text-blue-600 scale-105 shadow-sm' : 'bg-muted/40 text-muted-foreground'}`}>
                                                                    <ShieldCheck className="w-4 h-4" />
                                                                </div>
                                                                <div>
                                                                    <p className="text-[10px] font-black uppercase tracking-tight">{t('Manager.Dashboard.Controls.Official')}</p>
                                                                    <p className="text-[7px] uppercase font-bold text-muted-foreground/40 tracking-tighter">{t('Manager.Dashboard.Controls.VerifiedNode')}</p>
                                                                </div>
                                                            </div>
                                                            <Checkbox
                                                                id={`off-${item.repoAddress}`}
                                                                checked={item.isOfficial || false}
                                                                className={item.isOfficial ? "border-blue-600/50 data-[state=checked]:bg-blue-600 transition-all scale-100" : "scale-100 transition-all"}
                                                                onCheckedChange={(val: boolean) => updateRegistryItem(item.repoAddress, { isOfficial: val })}
                                                                onClick={(e) => e.stopPropagation()}
                                                            />
                                                        </div>

                                                        <div
                                                            className={`flex items-center justify-between p-3 rounded-xl border transition-all duration-300 select-none cursor-pointer group/toggle ${item.isFeatured ? 'bg-amber-600/5 border-amber-600/40 shadow-sm shadow-amber-600/10' : 'bg-muted/10 border-border/40 hover:bg-muted/20'}`}
                                                            onClick={() => updateRegistryItem(item.repoAddress, { isFeatured: !item.isFeatured })}
                                                        >
                                                            <div className="flex items-center gap-2.5">
                                                                <div className={`p-2 rounded-lg transition-all ${item.isFeatured ? 'bg-amber-600/20 text-amber-600 scale-105 shadow-sm' : 'bg-muted/40 text-muted-foreground'}`}>
                                                                    <Zap className={`w-4 h-4 ${item.isFeatured ? 'fill-current' : ''}`} />
                                                                </div>
                                                                <div>
                                                                    <p className="text-[10px] font-black uppercase tracking-tight">{t('Manager.Dashboard.Controls.Featured')}</p>
                                                                    <p className="text-[7px] uppercase font-bold text-muted-foreground/40 tracking-tighter">{t('Manager.Dashboard.Controls.HighlightedContent')}</p>
                                                                </div>
                                                            </div>
                                                            <Checkbox
                                                                id={`feat-${item.repoAddress}`}
                                                                checked={item.isFeatured || false}
                                                                className={item.isFeatured ? "border-amber-600/50 data-[state=checked]:bg-amber-600 transition-all scale-100" : "scale-100 transition-all"}
                                                                onCheckedChange={(val: boolean) => updateRegistryItem(item.repoAddress, { isFeatured: val })}
                                                                onClick={(e) => e.stopPropagation()}
                                                            />
                                                        </div>
                                                    </div>
                                                </div>
                                            </CardContent>
                                        </Card>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </div>
            </ScrollArea>
        </div>
    );
};
