import React, { useState, useMemo, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useCloudStore } from '../../cloud/cloud-store';
import { ContributorCategory, ContributorEntry } from '../../cloud/types';
import { ScrollArea, Input, Button, Badge, Checkbox, Label, Separator, Card, CardHeader, CardTitle, CardContent, CardDescription, CardFooter, Tabs, TabsList, TabsTrigger, TabsContent } from '~/shadcn';
import { Search, ShieldCheck, Star, Copy, Check, Users, Info, Settings2, RefreshCw, LayoutGrid, Cloud, Loader2, Github, Heart, MessageSquare, TrendingUp, Globe, FileJson, Trophy, GitFork, CircleDot, History, Database, Languages, Zap, Palette, Plus, Trash2, Code, Video, TestTube, ChevronDown } from 'lucide-react';
import { Notice } from 'obsidian';
import { cn } from '~/shadcn/lib/utils';

interface AdminPanelProps {
    i18n: any;
}

const RegistryListItem = ({ item, stats, isTopStar, updateRegistryItem, t }: any) => {
    const [expanded, setExpanded] = useState(false);

    const statusColor = item.isOfficial ? 'bg-amber-500' : (item.isFeatured ? 'bg-amber-400' : 'bg-primary');
    const statusText = item.isOfficial ? t('Manager.Admin.Controls.Official') : (item.isFeatured ? t('Manager.Admin.Controls.Featured') : 'NORMAL');

    return (
        <div className="group relative border rounded-none bg-card/75 text-card-foreground shadow-xs hover:shadow-md hover:bg-muted/20 transition-all duration-300 w-full border-border/50 overflow-hidden backdrop-blur-md flex flex-col mb-2">
            <div className={cn("absolute left-0 top-0 bottom-0 w-[3px] transition-colors duration-300 z-10 bg-opacity-100", statusColor)} />

            <div
                className="flex items-center gap-5 px-4 py-2 min-h-[44px] cursor-pointer select-none"
                onClick={() => setExpanded(!expanded)}
            >
                <div className={cn("px-2.5 py-0.5 text-[9px] uppercase tracking-[0.1em] font-extrabold rounded-none bg-background border border-border shadow-xs flex items-center gap-1.5 shrink-0", statusColor.replace(/bg-/g, 'text-'))}>
                    <span className={cn("w-1.5 h-1.5 rounded-full shadow-sm", statusColor)}></span>
                    {statusText}
                </div>

                <div className="flex items-center gap-2.5 min-w-0 flex-1">
                    <span className="font-bold truncate text-[13.5px] text-foreground/90 group-hover:text-primary transition-colors duration-300 shrink-0 max-w-[40%]">
                        {item.repoAddress.split('/')[1]}
                    </span>
                    <span className="text-[10px] text-muted-foreground/50 shrink-0 font-bold bg-muted/20 px-2 py-0.5 rounded-none">{item.repoAddress.split('/')[0]}</span>
                    {isTopStar && (
                        <span className="text-[10px] text-amber-500 font-bold bg-amber-500/10 border border-amber-500/20 px-1.5 py-0.5 rounded-none shrink-0 flex items-center gap-1">
                            <Trophy className="w-2.5 h-2.5" /> Top 3
                        </span>
                    )}
                </div>

                <div className="flex items-center gap-4 ml-auto shrink-0">
                    <div className="flex items-center gap-4 mr-2 text-muted-foreground/60 hidden md:flex">
                        <div className="flex items-center gap-1.5" title={t('Manager.Admin.Stats.Stars')}><Star className="w-3.5 h-3.5 opacity-70" /><span className="text-[11px] font-mono font-medium">{stats?.stars || 0}</span></div>
                        <div className="flex items-center gap-1.5" title={t('Manager.Admin.Stats.Plugins')}><LayoutGrid className="w-3.5 h-3.5 opacity-70" /><span className="text-[11px] font-mono font-medium">{stats?.pluginCount || 0}</span></div>
                        <div className="flex items-center gap-1.5" title="Translations"><Languages className="w-3.5 h-3.5 opacity-70" /><span className="text-[11px] font-mono font-medium">{stats?.translationCount || 0}</span></div>
                    </div>
                    <Button variant="ghost" size="icon" className="h-7 w-7 rounded-none transition-all pointer-events-none group-hover:bg-primary/5 group-hover:text-primary">
                        <ChevronDown className={cn("w-4 h-4 transition-transform duration-300", expanded && "rotate-180")} />
                    </Button>
                </div>
            </div>

            {expanded && (
                <div className="px-5 py-4 border-t border-border/30 bg-muted/10 animate-in slide-in-from-top-2 duration-200 space-y-4">
                    {/* Compact Extended Stats row */}
                    <div className="flex items-center gap-4 text-[10px] text-muted-foreground/60 p-2 rounded-md bg-background/50 border border-border/40 overflow-x-auto whitespace-nowrap">
                        <div className="flex items-center gap-1.5" title="License"><Github className="w-3 h-3" /> <span className="font-mono">{stats?.license || 'No License'}</span></div>
                        <Separator orientation="vertical" className="h-3" />
                        <div className="flex items-center gap-1.5" title="Repo Size"><Database className="w-3 h-3" /> <span className="font-mono">{(stats?.repoSize ? stats.repoSize / 1024 : 0).toFixed(1)}MB</span></div>
                        <Separator orientation="vertical" className="h-3" />
                        <div className="flex items-center gap-1.5" title="Forks"><GitFork className="w-3 h-3" /> <span className="font-mono">{stats?.forks || 0} Forks</span></div>
                        <Separator orientation="vertical" className="h-3" />
                        <div className="flex items-center gap-1.5" title="Open Issues"><CircleDot className="w-3 h-3" /> <span className="font-mono">{stats?.openIssuesCount || 0} Issues</span></div>
                        <Separator orientation="vertical" className="h-3" />
                        <div className="flex items-center gap-1.5" title="Recent Commits 30d"><TrendingUp className="w-3 h-3 text-blue-500/70" /> <span className="font-mono text-blue-500/70">{stats?.recentCommits30d || 0} Commits (30d)</span></div>
                        <div className="ml-auto flex items-center gap-2 font-bold px-2 py-0.5 rounded-sm bg-primary/10 text-primary">
                            <span>Activity Score: {Math.round((stats?.activityScore || 0) * 100)}%</span>
                        </div>
                    </div>

                    <div className="flex flex-col lg:flex-row gap-6">
                        {/* 左侧：输入配置表单 */}
                        <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                                <Label className="text-[10px] font-black flex items-center gap-1.5 text-muted-foreground/60 uppercase tracking-[0.1em]">
                                    <Users className="w-3 h-3" />
                                    {t('Manager.Admin.Fields.AuthorReputation')}
                                </Label>
                                <Input
                                    value={item.authorBadge || ''}
                                    placeholder={t('Manager.Admin.Fields.AuthorReputationPlaceholder')}
                                    className="h-8 text-[11px] bg-background border-border/60 focus:border-primary/40 focus:bg-background transition-all rounded-md font-medium"
                                    onChange={(e) => updateRegistryItem(item.repoAddress, { authorBadge: e.target.value })}
                                />
                            </div>
                            <div className="space-y-1.5">
                                <Label className="text-[10px] font-black flex items-center gap-1.5 text-muted-foreground/60 uppercase tracking-[0.1em]">
                                    <Heart className="w-3 h-3" />
                                    {t('Manager.Admin.Fields.RegistryBadges')}
                                </Label>
                                <Input
                                    value={JSON.stringify(item.badges || [])}
                                    placeholder={t('Manager.Admin.Fields.RegistryBadgesPlaceholder')}
                                    className="h-8 text-[11px] bg-background font-mono border-border/60 focus:border-primary/40 rounded-md"
                                    onChange={(e) => {
                                        try {
                                            const parsed = JSON.parse(e.target.value);
                                            if (Array.isArray(parsed)) updateRegistryItem(item.repoAddress, { badges: parsed });
                                        } catch (e) { }
                                    }}
                                />
                            </div>
                            <div className="space-y-1.5 md:col-span-2">
                                <Label className="text-[10px] font-black flex items-center gap-1.5 text-muted-foreground/60 uppercase tracking-[0.1em]">
                                    <MessageSquare className="w-3 h-3" />
                                    {t('Manager.Admin.Fields.FeaturedContext')}
                                </Label>
                                <Input
                                    value={item.reason || ''}
                                    placeholder={t('Manager.Admin.Fields.FeaturedContextPlaceholder')}
                                    className="h-8 text-[11px] bg-background border-border/60 focus:border-primary/40 rounded-md"
                                    onChange={(e) => updateRegistryItem(item.repoAddress, { reason: e.target.value })}
                                />
                            </div>
                        </div>

                        <Separator orientation="vertical" className="hidden lg:block h-auto mx-2 opacity-30" />

                        {/* 右侧：开关状态 */}
                        <div className="w-full lg:w-48 shrink-0 flex flex-col justify-center gap-2">
                            <div
                                className={cn(
                                    "flex items-center justify-between p-2.5 rounded-lg border transition-all duration-300 select-none cursor-pointer group/toggle",
                                    item.isOfficial ? "bg-blue-600/10 border-blue-600/30 shadow-inner" : "bg-background border-border/40 hover:bg-muted/50 shadow-sm"
                                )}
                                onClick={(e) => { e.stopPropagation(); updateRegistryItem(item.repoAddress, { isOfficial: !item.isOfficial }); }}
                            >
                                <div className="flex items-center gap-2.5">
                                    <ShieldCheck className={cn("w-4 h-4", item.isOfficial ? "text-blue-600" : "text-muted-foreground/50")} />
                                    <span className={cn("text-[11px] font-bold uppercase", item.isOfficial ? "text-blue-600" : "text-muted-foreground")}>{t('Manager.Admin.Controls.Official')}</span>
                                </div>
                                <Checkbox
                                    id={`off-${item.repoAddress}`}
                                    checked={item.isOfficial || false}
                                    className={cn("h-4 w-4", item.isOfficial ? "border-blue-600/50 data-[state=checked]:bg-blue-600 data-[state=checked]:text-white" : "border-border/60")}
                                    onCheckedChange={(val: boolean) => updateRegistryItem(item.repoAddress, { isOfficial: val })}
                                    onClick={(e) => e.stopPropagation()}
                                />
                            </div>

                            <div
                                className={cn(
                                    "flex items-center justify-between p-2.5 rounded-lg border transition-all duration-300 select-none cursor-pointer group/toggle",
                                    item.isFeatured ? "bg-amber-500/10 border-amber-500/30 shadow-inner" : "bg-background border-border/40 hover:bg-muted/50 shadow-sm"
                                )}
                                onClick={(e) => { e.stopPropagation(); updateRegistryItem(item.repoAddress, { isFeatured: !item.isFeatured }); }}
                            >
                                <div className="flex items-center gap-2.5">
                                    <Zap className={cn("w-4 h-4", item.isFeatured ? "text-amber-500 fill-amber-500" : "text-muted-foreground/50")} />
                                    <span className={cn("text-[11px] font-bold uppercase", item.isFeatured ? "text-amber-600 dark:text-amber-500" : "text-muted-foreground")}>{t('Manager.Admin.Controls.Featured')}</span>
                                </div>
                                <Checkbox
                                    id={`feat-${item.repoAddress}`}
                                    checked={item.isFeatured || false}
                                    className={cn("h-4 w-4", item.isFeatured ? "border-amber-500/50 data-[state=checked]:bg-amber-500 data-[state=checked]:text-white" : "border-border/60")}
                                    onCheckedChange={(val: boolean) => updateRegistryItem(item.repoAddress, { isFeatured: val })}
                                    onClick={(e) => e.stopPropagation()}
                                />
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

const ContributorListItem = ({ contributor, updateContributor, removeContributor, t }: any) => {
    const [expanded, setExpanded] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [name, setName] = useState(contributor.name);
    const [githubUsername, setGithubUsername] = useState(contributor.githubUsername || '');
    const [url, setUrl] = useState(contributor.url || '');
    const [description, setDescription] = useState(contributor.description || '');

    useEffect(() => {
        setName(contributor.name);
        setGithubUsername(contributor.githubUsername || '');
        setUrl(contributor.url || '');
        setDescription(contributor.description || '');
    }, [contributor]);

    const handleSave = () => {
        updateContributor(contributor.name, contributor.category, {
            name,
            githubUsername,
            url,
            description
        });
        setIsEditing(false);
        new Notice(t('Manager.Admin.Controls.Saved', 'Saved changes'));
    };

    return (
        <div className="group relative border rounded-none bg-card/10 text-card-foreground shadow-xs hover:shadow-md hover:bg-muted/10 transition-all duration-300 w-full border-border/50 overflow-hidden backdrop-blur-md flex flex-col mb-1">
            <div
                className="flex items-center gap-4 px-4 py-2 min-h-[44px] cursor-pointer select-none"
                onClick={() => setExpanded(!expanded)}
            >
                {contributor.githubUsername ? (
                    <img src={`https://github.com/${contributor.githubUsername}.png?size=40`} alt={contributor.name} className="w-7 h-7 rounded-md ring-1 ring-border/30 shrink-0" />
                ) : (
                    <div className="w-7 h-7 rounded-md bg-muted flex items-center justify-center text-[11px] font-bold shrink-0">
                        {contributor.name.charAt(0).toUpperCase()}
                    </div>
                )}

                <div className="flex-1 min-w-0 flex items-center gap-2">
                    <span className="text-[12px] font-bold truncate block group-hover:text-primary transition-colors">{contributor.name}</span>
                    {contributor.githubUsername && <span className="text-[9px] text-muted-foreground/50 font-mono bg-muted/40 px-1.5 py-0.5 rounded-sm">@{contributor.githubUsername}</span>}
                </div>

                <div className="flex items-center gap-4 ml-auto shrink-0">
                    <div className="flex items-center gap-4 mr-2 text-muted-foreground/60 hidden md:flex">
                        {contributor.description ? (
                            <span className="text-[10px] truncate max-w-48" title={contributor.description}>{contributor.description}</span>
                        ) : (
                            <span className="text-[10px] italic opacity-50">-</span>
                        )}
                    </div>
                    <Button variant="ghost" size="icon" className="h-7 w-7 rounded-none transition-all pointer-events-none group-hover:bg-primary/5 group-hover:text-primary">
                        <ChevronDown className={cn("w-4 h-4 transition-transform duration-300", expanded && "rotate-180")} />
                    </Button>
                </div>
            </div>

            {expanded && (
                <div className="px-5 py-4 border-t border-border/30 bg-muted/5 animate-in slide-in-from-top-2 duration-200">
                    <div className="flex flex-col gap-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                                <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">{t('Manager.Admin.ContributorsManagement.Name')}</Label>
                                <Input value={name} onChange={e => setName(e.target.value)} className={cn("h-8 text-[11px] bg-background border-border/60 transition-all focus:border-primary/50", isEditing && "shadow-sm")} disabled={!isEditing} />
                            </div>
                            <div className="space-y-1.5">
                                <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">{t('Manager.Admin.ContributorsManagement.Github')}</Label>
                                <Input value={githubUsername} onChange={e => setGithubUsername(e.target.value)} className={cn("h-8 text-[11px] bg-background border-border/60 transition-all focus:border-primary/50", isEditing && "shadow-sm")} disabled={!isEditing} />
                            </div>
                            <div className="space-y-1.5">
                                <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">{t('Manager.Admin.ContributorsManagement.Url')}</Label>
                                <Input value={url} onChange={e => setUrl(e.target.value)} className={cn("h-8 text-[11px] bg-background border-border/60 transition-all focus:border-primary/50", isEditing && "shadow-sm")} disabled={!isEditing} />
                            </div>
                            <div className="space-y-1.5">
                                <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">{t('Manager.Admin.ContributorsManagement.Description')}</Label>
                                <Input value={description} onChange={e => setDescription(e.target.value)} className={cn("h-8 text-[11px] bg-background border-border/60 transition-all focus:border-primary/50", isEditing && "shadow-sm")} disabled={!isEditing} />
                            </div>
                        </div>

                        <div className="flex items-center justify-between border-t border-border/20 pt-4 mt-2">
                            <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 px-3 gap-1.5 text-destructive hover:bg-destructive/10 text-[10px] font-bold"
                                onClick={() => {
                                    removeContributor(contributor.name, contributor.category);
                                    new Notice(t('Manager.Admin.ContributorsManagement.RemoveSuccess', { name: contributor.name }));
                                }}
                            >
                                <Trash2 className="w-3 h-3" />
                                {t('Manager.Admin.ContributorsManagement.Remove')}
                            </Button>

                            {isEditing ? (
                                <div className="flex gap-2">
                                    <Button variant="ghost" size="sm" className="h-7 text-[10px] font-bold" onClick={() => {
                                        setIsEditing(false);
                                        setName(contributor.name);
                                        setGithubUsername(contributor.githubUsername || '');
                                        setUrl(contributor.url || '');
                                        setDescription(contributor.description || '');
                                    }}>Cancel</Button>
                                    <Button variant="default" size="sm" className="h-7 px-3 text-[10px] font-bold" disabled={!name.trim()} onClick={handleSave}>Save Changes</Button>
                                </div>
                            ) : (
                                <Button variant="outline" size="sm" className="h-7 px-3 gap-1.5 text-[10px] font-bold bg-background" onClick={() => setIsEditing(true)}>
                                    <Settings2 className="w-3 h-3" />
                                    Edit Details
                                </Button>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
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

    // 贡献者管理
    const contributors = useCloudStore.use.contributors();
    const contributorsLoaded = useCloudStore.use.contributorsLoaded();
    const fetchContributors = useCloudStore.use.fetchContributors();
    const addContributor = useCloudStore.use.addContributor();
    const removeContributor = useCloudStore.use.removeContributor();
    const updateContributor = useCloudStore.use.updateContributor();
    const pushContributorsToCloud = useCloudStore.use.pushContributorsToCloud();

    useEffect(() => {
        if (!communityLoaded && !communityLoading) {
            fetchCommunityRegistry(i18n);
        }
        if (!contributorsLoaded) {
            fetchContributors(i18n);
        }
    }, [communityLoaded, communityLoading, fetchCommunityRegistry, contributorsLoaded, fetchContributors, i18n]);

    const [activeTab, setActiveTab] = useState('registry');
    const [searchQuery, setSearchQuery] = useState('');
    const [copied, setCopied] = useState(false);

    // 新增贡献者表单
    const [addContributorExpanded, setAddContributorExpanded] = useState(false);
    const [newName, setNewName] = useState('');
    const [newCategory, setNewCategory] = useState<ContributorCategory>('code');
    const [newUrl, setNewUrl] = useState('');
    const [newGithub, setNewGithub] = useState('');
    const [newDesc, setNewDesc] = useState('');

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
        new Notice(t('Manager.Common.Notices.CopySuccess'));
        setTimeout(() => setCopied(false), 2000);
    };

    const handlePushToCloud = async () => {
        const success = await pushRegistryToCloud(i18n);
        if (success) {
            new Notice(t('Manager.Common.Notices.SyncSuccess'));
        } else {
            new Notice(t('Manager.Common.Errors.SyncFailed'));
        }
    };

    return (
        <Tabs defaultValue="registry" value={activeTab} onValueChange={setActiveTab} className="flex-1 min-h-0 flex flex-col w-full h-full bg-background select-none overflow-hidden">
            {/* 顶栏控制区 - 仿照主题/插件页面样式 */}
            <div className="flex flex-col gap-4 py-2 px-4 border-b shrink-0 bg-background">
                <div className="flex items-center justify-between flex-wrap gap-2">
                    <TabsList className="h-9">
                        <TabsTrigger value="registry" className="text-[13px] px-4">{t('Manager.Admin.Management.Title')}</TabsTrigger>
                        <TabsTrigger value="contributors" className="text-[13px] px-4">{t('Manager.Admin.ContributorsManagement.Title')}</TabsTrigger>
                    </TabsList>

                    <div className="flex items-center gap-2">
                        {activeTab === 'registry' && (
                            <>
                                <div className="relative flex-1 min-w-[200px]">
                                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground/70" />
                                    <Input
                                        placeholder={t('Manager.Admin.SearchPlaceholder')}
                                        className="pl-8 h-9 rounded-md border-muted-foreground/20 focus:ring-1 text-[13px] bg-muted/10 shadow-sm transition-colors hover:bg-muted/20"
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                    />
                                </div>
                                <div className="flex items-center rounded-md border border-muted-foreground/20 bg-background shadow-sm h-9 ml-2">
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-9 px-3 gap-1.5 border-r border-muted-foreground/20 hover:bg-primary/5 hover:text-primary group rounded-none rounded-l-md"
                                        onClick={handlePushToCloud}
                                        disabled={isPushing}
                                    >
                                        {isPushing ? <Loader2 className="w-4 h-4 text-muted-foreground/70 group-hover:text-primary animate-spin" /> : <Cloud className="w-4 h-4 text-muted-foreground/70 group-hover:text-primary" />}
                                        <span className="text-[13px] text-muted-foreground/90 group-hover:text-primary hidden lg:inline">{t('Manager.Admin.PushToCloud')}</span>
                                    </Button>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-9 px-3 hover:bg-primary/5 hover:text-primary group rounded-none rounded-r-md"
                                        onClick={handleCopyJson}
                                        title={t('Manager.Admin.ExportJson')}
                                    >
                                        {copied ? <Check className="w-4 h-4 text-green-500" /> : <FileJson className="w-4 h-4 text-muted-foreground/70 group-hover:text-primary" />}
                                    </Button>
                                </div>
                            </>
                        )}
                        {activeTab === 'contributors' && (
                            <div className="flex items-center rounded-md border border-muted-foreground/20 bg-background shadow-sm h-9">
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-9 px-3 gap-1.5 hover:bg-primary/5 hover:text-primary group rounded-md"
                                    onClick={async () => {
                                        const success = await pushContributorsToCloud(i18n);
                                        new Notice(success ? t('Manager.Common.Notices.SyncSuccess') : t('Manager.Common.Errors.SyncFailed'));
                                    }}
                                    disabled={isPushing}
                                >
                                    {isPushing ? <Loader2 className="w-4 h-4 text-muted-foreground/70 group-hover:text-primary animate-spin" /> : <Cloud className="w-4 h-4 text-muted-foreground/70 group-hover:text-primary" />}
                                    <span className="text-[13px] text-muted-foreground/90 group-hover:text-primary hidden lg:inline">{t('Manager.Admin.ContributorsManagement.PushToCloud')}</span>
                                </Button>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            <TabsContent value="registry" className="flex-1 min-h-0 m-0 border-none p-0 data-[state=active]:flex flex-col outline-none">
                <ScrollArea className="flex-1 min-h-0 w-full bg-background">
                    <div className="px-4 py-4 w-full h-full max-w-[1600px] mx-auto space-y-4">
                        <div className="flex items-center justify-between px-1">
                            <h3 className="text-sm font-bold text-foreground/80">{t('Manager.Admin.Management.Title')}</h3>
                            <div className="text-xs font-medium text-muted-foreground/50">
                                {t('Manager.Admin.Management.ShowingStats', { filtered: filteredItems.length, total: communityRegistry.length })}
                            </div>
                        </div>

                        {communityLoading ? (
                            <div className="flex flex-col items-center justify-center py-24 text-muted-foreground bg-muted/5 rounded-2xl border border-dashed text-center">
                                <RefreshCw className="w-10 h-10 animate-spin text-primary/30 mb-4 mx-auto" />
                                <p className="text-[10px] font-black uppercase tracking-widest opacity-40">{t('Manager.Admin.Management.SyncingData')}</p>
                            </div>
                        ) : filteredItems.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-24 text-muted-foreground bg-muted/5 rounded-2xl border border-dashed text-center">
                                <LayoutGrid className="w-12 h-12 opacity-10 mb-4 mx-auto" />
                                <h3 className="text-xs font-black uppercase tracking-wider opacity-30">{t('Manager.Admin.Management.NoData')}</h3>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 gap-2">
                                {filteredItems.map((item) => {
                                    const stats = communityStats?.repos?.[item.repoAddress];
                                    const isTopStar = communityStats?.leaderboard?.topReposByStars.slice(0, 3).includes(item.repoAddress);

                                    return (
                                        <RegistryListItem
                                            key={item.repoAddress}
                                            item={item}
                                            stats={stats}
                                            isTopStar={isTopStar}
                                            updateRegistryItem={updateRegistryItem}
                                            t={t}
                                        />
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </ScrollArea>
            </TabsContent>

            <TabsContent value="contributors" className="flex-1 min-h-0 m-0 border-none p-0 data-[state=active]:flex flex-col outline-none">
                <ScrollArea className="flex-1 min-h-0 w-full bg-background">
                    <div className="px-4 py-4 w-full h-full max-w-[1600px] mx-auto space-y-4">
                        {/* ========== 贡献者管理板块 ========== */}
                        <div className="flex items-center justify-between px-1">
                            <h3 className="text-sm font-bold text-foreground/80">{t('Manager.Admin.ContributorsManagement.Title')}</h3>
                            <Badge variant="secondary" className="text-xs font-mono">{contributors.length}</Badge>
                        </div>

                        {/* 新增表单 */}
                        <div className="group relative border rounded-none bg-card/20 text-card-foreground hover:bg-muted/10 transition-all duration-300 w-full border-border/50 border-dashed overflow-hidden flex flex-col mb-4">
                            <div
                                className="flex items-center gap-3 px-4 py-3 cursor-pointer"
                                onClick={() => setAddContributorExpanded(!addContributorExpanded)}
                            >
                                <div className="p-1 rounded-sm bg-primary/10 text-primary">
                                    <Plus className="w-3 h-3" />
                                </div>
                                <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest">{t('Manager.Admin.ContributorsManagement.AddNew')}</span>
                            </div>

                            {addContributorExpanded && (
                                <div className="px-3 py-3 border-t border-border/30 border-dashed bg-muted/5 animate-in slide-in-from-top-1 duration-200">
                                    <div className="flex flex-col md:flex-row items-center gap-2">
                                        <select
                                            className="h-8 w-full md:w-24 rounded-md border border-border/60 bg-background px-2 text-[11px] focus:outline-none focus:border-primary/50 cursor-pointer"
                                            value={newCategory}
                                            onChange={e => setNewCategory(e.target.value as ContributorCategory)}
                                        >
                                            <option value="code">💻 代码</option>
                                            <option value="video">🎬 视频</option>
                                            <option value="testing">🧪 测试</option>
                                            <option value="suggestion">💬 建议</option>
                                        </select>
                                        <div className="flex-1 flex flex-wrap lg:flex-nowrap items-center gap-2 w-full">
                                            <Input placeholder={t('Manager.Admin.ContributorsManagement.Name')} className="h-8 w-full md:w-28 text-[11px] bg-background border-border/60 focus:border-primary/50 shadow-sm" value={newName} onChange={e => setNewName(e.target.value)} />
                                            <Input placeholder="GitHub ID" className="h-8 w-full md:w-28 text-[11px] bg-background border-border/60 focus:border-primary/50 shadow-sm" value={newGithub} onChange={e => setNewGithub(e.target.value)} />
                                            <Input placeholder="URL" className="h-8 flex-1 min-w-[100px] text-[11px] bg-background border-border/60 focus:border-primary/50 shadow-sm" value={newUrl} onChange={e => setNewUrl(e.target.value)} />
                                            <Input placeholder="Description" className="h-8 w-full lg:w-48 text-[11px] bg-background border-border/60 focus:border-primary/50 shadow-sm" value={newDesc} onChange={e => setNewDesc(e.target.value)} />
                                        </div>
                                        <Button
                                            variant="default"
                                            size="sm"
                                            className="h-8 px-3 ml-auto text-[10px] font-bold shrink-0 mt-2 md:mt-0"
                                            disabled={!newName.trim()}
                                            onClick={() => {
                                                addContributor({
                                                    name: newName.trim(),
                                                    category: newCategory,
                                                    url: newUrl.trim() || undefined,
                                                    githubUsername: newGithub.trim() || undefined,
                                                    description: newDesc.trim() || undefined,
                                                });
                                                setNewName(''); setNewUrl(''); setNewGithub(''); setNewDesc('');
                                                setAddContributorExpanded(false);
                                                new Notice(t('Manager.Admin.ContributorsManagement.AddSuccess', { name: newName.trim() }));
                                            }}
                                        >
                                            <Plus className="w-3.5 h-3.5" />{t('Manager.Admin.ContributorsManagement.Add')}
                                        </Button>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* 已有贡献者列表 */}
                        {contributors.length > 0 && (
                            <div className="space-y-4">
                                {(['code', 'video', 'testing', 'suggestion'] as ContributorCategory[]).map(cat => {
                                    const items = contributors.filter(c => c.category === cat);
                                    if (items.length === 0) return null;
                                    const catConfig: Record<string, { icon: React.ReactNode; label: string; color: string }> = {
                                        code: { icon: <Code className="w-3.5 h-3.5" />, label: '代码贡献者', color: 'text-emerald-500' },
                                        video: { icon: <Video className="w-3.5 h-3.5" />, label: '视频创作者', color: 'text-rose-500' },
                                        testing: { icon: <TestTube className="w-3.5 h-3.5" />, label: '测试贡献者', color: 'text-amber-500' },
                                        suggestion: { icon: <MessageSquare className="w-3.5 h-3.5" />, label: '建议贡献者', color: 'text-violet-500' },
                                    };
                                    const cfg = catConfig[cat];
                                    return (
                                        <div key={cat} className="space-y-2 pb-2">
                                            <div className="flex items-center gap-2 px-1 mb-1">
                                                <span className={cn("flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest", cfg.color)}>
                                                    {cfg.icon}{cfg.label}
                                                </span>
                                                <Badge variant="secondary" className="text-[9px] px-1.5 py-0 h-4 font-mono">{items.length}</Badge>
                                            </div>

                                            <div className="flex flex-col gap-1">
                                                {items.map(c => (
                                                    <ContributorListItem
                                                        key={`${c.category}-${c.name}`}
                                                        contributor={c}
                                                        updateContributor={updateContributor}
                                                        removeContributor={removeContributor}
                                                        t={t}
                                                    />
                                                ))}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </ScrollArea>
            </TabsContent>
        </Tabs>
    );
};
