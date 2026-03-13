/**
 * 在线差异对比弹窗
 * 发布更新时直观查看本地文本与云端旧版文本的变化差异
 */
import React, { useEffect, useMemo, useState } from 'react';
import { Button } from '@/src/shadcn';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/src/shadcn/ui/dialog';
import { ScrollArea } from '@/src/shadcn/ui/scroll-area';
import { Badge } from '@/src/shadcn/ui/badge';
import { Input } from '@/src/shadcn/ui/input';
import { Loader2, GitCompare, Plus, Minus, RefreshCw, Search, Filter, ArrowRight } from 'lucide-react';
import { useCloudStore } from '../cloud-store';
import { useGlobalStoreInstance } from '~/utils';
import { t } from '@/src/locales/index';
import { DiffEntry } from '../types';
import { cn } from '@/src/shadcn/lib/utils';
import * as fs from 'fs-extra';

/**
 * 扁平化 JSON 对象为 { "a.b.c": value } 的形式
 */
function flattenObject(obj: any, prefix = ''): Record<string, string> {
    const result: Record<string, string> = {};
    if (obj === null || obj === undefined) return result;

    if (typeof obj !== 'object') {
        result[prefix] = String(obj);
        return result;
    }

    for (const key of Object.keys(obj)) {
        const fullKey = prefix ? `${prefix}.${key}` : key;
        const val = obj[key];

        if (val !== null && typeof val === 'object' && !Array.isArray(val)) {
            Object.assign(result, flattenObject(val, fullKey));
        } else {
            result[fullKey] = typeof val === 'string' ? val : JSON.stringify(val);
        }
    }
    return result;
}

/**
 * 计算两个扁平化 JSON 对象之间的 diff
 */
function computeDiff(localFlat: Record<string, string>, cloudFlat: Record<string, string>): DiffEntry[] {
    const allKeys = new Set([...Object.keys(localFlat), ...Object.keys(cloudFlat)]);
    const entries: DiffEntry[] = [];

    for (const key of allKeys) {
        const inLocal = key in localFlat;
        const inCloud = key in cloudFlat;

        if (inLocal && inCloud) {
            if (localFlat[key] !== cloudFlat[key]) {
                entries.push({ type: 'modified', key, localValue: localFlat[key], cloudValue: cloudFlat[key] });
            }
            // 不展示 unchanged 的条目以减少噪音
        } else if (inLocal && !inCloud) {
            entries.push({ type: 'added', key, localValue: localFlat[key] });
        } else {
            entries.push({ type: 'removed', key, cloudValue: cloudFlat[key] });
        }
    }

    // 排序：modified -> added -> removed
    const order = { modified: 0, added: 1, removed: 2, unchanged: 3 };
    entries.sort((a, b) => order[a.type] - order[b.type] || a.key.localeCompare(b.key));

    return entries;
}

export const DiffViewerDialog: React.FC = () => {
    const i18n = useGlobalStoreInstance.getState().i18n;

    const sourceId = useCloudStore.use.diffDialogSourceId();
    const setSourceId = useCloudStore.use.setDiffDialogSourceId();
    const githubUser = useCloudStore.use.githubUser();
    const repoManifest = useCloudStore.use.repoManifest();

    const userRepo = i18n.settings.shareRepo;
    const isOpen = !!sourceId;

    const [loading, setLoading] = useState(false);
    const [diffEntries, setDiffEntries] = useState<DiffEntry[]>([]);
    const [filterQuery, setFilterQuery] = useState('');
    const [filterType, setFilterType] = useState<'all' | 'added' | 'removed' | 'modified'>('all');

    // manifest 中对应的条目
    const cloudEntry = repoManifest.find(e => e.id === sourceId) || null;

    // 加载 diff
    useEffect(() => {
        if (!isOpen || !sourceId || !cloudEntry || !githubUser) {
            setDiffEntries([]);
            setFilterQuery('');
            return;
        }

        let cancelled = false;
        const loadDiff = async () => {
            setLoading(true);
            try {
                // 1. 读取本地文件
                const filePath = i18n.sourceManager.getSourceFilePath(sourceId);
                if (!filePath || !fs.existsSync(filePath)) {
                    setDiffEntries([]);
                    return;
                }
                const localRaw = fs.readFileSync(filePath, 'utf-8');
                const localParsed = JSON.parse(localRaw);

                // 2. 获取云端文件
                const cloudRes = await i18n.api.github.getFileContent(
                    githubUser.login, userRepo, `plugins/${sourceId}.json`
                );
                if (cancelled) return;

                if (!cloudRes.state || !cloudRes.data?.content) {
                    // 云端不存在，所有本地都是新增
                    const localFlat = flattenObject(localParsed);
                    setDiffEntries(Object.entries(localFlat).map(([key, val]) => ({
                        type: 'added' as const, key, localValue: val
                    })));
                    return;
                }

                const cloudRaw = Buffer.from(cloudRes.data.content, 'base64').toString('utf-8');
                const cloudParsed = JSON.parse(cloudRaw);

                // 3. 计算 diff（仅针对 dict 部分，跳过 metadata）
                const localDict = localParsed?.dict || localParsed;
                const cloudDict = cloudParsed?.dict || cloudParsed;

                const localFlat = flattenObject(localDict);
                const cloudFlat = flattenObject(cloudDict);

                const diff = computeDiff(localFlat, cloudFlat);
                if (!cancelled) setDiffEntries(diff);
            } catch (e) {
                console.error(t('Cloud.Errors.LoadDiffFail'), e);
                if (!cancelled) setDiffEntries([]);
            } finally {
                if (!cancelled) setLoading(false);
            }
        };
        loadDiff();
        return () => { cancelled = true; };
    }, [isOpen, sourceId, cloudEntry?.id, githubUser, userRepo, i18n]);

    // 筛选
    const filteredEntries = useMemo(() => {
        return diffEntries.filter(e => {
            if (filterType !== 'all' && e.type !== filterType) return false;
            if (filterQuery) {
                const q = filterQuery.toLowerCase();
                return e.key.toLowerCase().includes(q)
                    || (e.localValue || '').toLowerCase().includes(q)
                    || (e.cloudValue || '').toLowerCase().includes(q);
            }
            return true;
        });
    }, [diffEntries, filterQuery, filterType]);

    // 统计
    const stats = useMemo(() => ({
        added: diffEntries.filter(e => e.type === 'added').length,
        modified: diffEntries.filter(e => e.type === 'modified').length,
        removed: diffEntries.filter(e => e.type === 'removed').length,
    }), [diffEntries]);

    const handleClose = () => {
        setSourceId(null);
        setDiffEntries([]);
        setFilterQuery('');
        setFilterType('all');
    };

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
            <DialogContent className="max-w-3xl max-h-[80vh] p-0 gap-0 overflow-hidden">
                <DialogHeader className="px-6 py-4 border-b bg-muted/30 shrink-0">
                    <DialogTitle className="flex items-center gap-2 text-base">
                        <GitCompare className="w-4 h-4 text-primary" />
                        {t('Cloud.Titles.DiffViewer')}
                    </DialogTitle>
                    <DialogDescription className="text-xs text-muted-foreground mt-1">
                        {cloudEntry ? `${cloudEntry.title} (${cloudEntry.plugin})` : ''} — {t('Cloud.Tips.VersionCompareDesc')}
                    </DialogDescription>
                </DialogHeader>

                <div className="flex flex-col min-h-0" style={{ height: '60vh' }}>
                    {/* 统计栏 + 筛选 */}
                    <div className="flex items-center justify-between px-4 py-2.5 border-b bg-muted/10 shrink-0">
                        <div className="flex items-center gap-2">
                            {/* 统计标签 */}
                            <button
                                onClick={() => setFilterType(filterType === 'added' ? 'all' : 'added')}
                                className={cn(
                                    "inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full border transition-all cursor-pointer",
                                    filterType === 'added'
                                        ? "bg-green-500/20 border-green-500/40 text-green-700"
                                        : "bg-green-500/10 border-green-500/20 text-green-600 hover:bg-green-500/20"
                                )}
                            >
                                <Plus className="w-3 h-3" />
                                {t('Cloud.Labels.Added')} {stats.added}
                            </button>
                            <button
                                onClick={() => setFilterType(filterType === 'modified' ? 'all' : 'modified')}
                                className={cn(
                                    "inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full border transition-all cursor-pointer",
                                    filterType === 'modified'
                                        ? "bg-amber-500/20 border-amber-500/40 text-amber-700"
                                        : "bg-amber-500/10 border-amber-500/20 text-amber-600 hover:bg-amber-500/20"
                                )}
                            >
                                <RefreshCw className="w-3 h-3" />
                                {t('Cloud.Actions.Update')} {stats.modified}
                            </button>
                            <button
                                onClick={() => setFilterType(filterType === 'removed' ? 'all' : 'removed')}
                                className={cn(
                                    "inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full border transition-all cursor-pointer",
                                    filterType === 'removed'
                                        ? "bg-red-500/20 border-red-500/40 text-red-700"
                                        : "bg-red-500/10 border-red-500/20 text-red-600 hover:bg-red-500/20"
                                )}
                            >
                                <Minus className="w-3 h-3" />
                                {t('Cloud.Labels.Deleted')} {stats.removed}
                            </button>
                            {filterType !== 'all' && (
                                <button
                                    onClick={() => setFilterType('all')}
                                    className="text-[10px] text-muted-foreground hover:text-primary underline ml-1"
                                >
                                    {t('Cloud.Actions.ClearFilters')}
                                </button>
                            )}
                        </div>
                        <div className="relative group w-40">
                            <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground" />
                            <Input
                                placeholder={t('Cloud.Placeholders.SearchDiff')}
                                value={filterQuery}
                                onChange={(e) => setFilterQuery(e.target.value)}
                                className="pl-7 h-7 text-[11px] bg-background border-border/50"
                            />
                        </div>
                    </div>

                    {/* 差异列表 */}
                    <ScrollArea className="flex-1 min-h-0">
                        {loading ? (
                            <div className="flex flex-col items-center justify-center h-40 gap-2">
                                <Loader2 className="w-5 h-5 animate-spin text-primary" />
                                <span className="text-xs text-muted-foreground">{t('Cloud.Status.LoadingDiff')}</span>
                            </div>
                        ) : diffEntries.length === 0 ? (
                            <div className="flex flex-col items-center justify-center h-40 gap-2 text-muted-foreground">
                                <GitCompare className="w-10 h-10 opacity-20" />
                                <p className="text-xs">{t('Cloud.Hints.NoDiff')}</p>
                            </div>
                        ) : filteredEntries.length === 0 ? (
                            <div className="flex flex-col items-center justify-center h-40 gap-2 text-muted-foreground">
                                <Filter className="w-8 h-8 opacity-20" />
                                <p className="text-xs">{t('Cloud.Hints.NoMatchingDiffs')}</p>
                            </div>
                        ) : (
                            <div className="divide-y divide-border/30">
                                {filteredEntries.map((entry, idx) => (
                                    <div
                                        key={idx}
                                        className={cn(
                                            "px-4 py-2.5 transition-colors",
                                            entry.type === 'added' && "bg-green-500/5 hover:bg-green-500/10",
                                            entry.type === 'removed' && "bg-red-500/5 hover:bg-red-500/10",
                                            entry.type === 'modified' && "bg-amber-500/5 hover:bg-amber-500/10",
                                        )}
                                    >
                                        {/* Key 行 */}
                                        <div className="flex items-center gap-2 mb-1">
                                            {entry.type === 'added' && <Plus className="w-3 h-3 text-green-600 shrink-0" />}
                                            {entry.type === 'removed' && <Minus className="w-3 h-3 text-red-600 shrink-0" />}
                                            {entry.type === 'modified' && <RefreshCw className="w-3 h-3 text-amber-600 shrink-0" />}
                                            <code className="text-[11px] font-mono font-semibold text-foreground/80 truncate" title={entry.key}>
                                                {entry.key}
                                            </code>
                                            <Badge
                                                variant="outline"
                                                className={cn(
                                                    "text-[8px] px-1 py-0 h-[14px] uppercase font-bold shrink-0",
                                                    entry.type === 'added' && "bg-green-500/10 border-green-500/30 text-green-600",
                                                    entry.type === 'removed' && "bg-red-500/10 border-red-500/30 text-red-600",
                                                    entry.type === 'modified' && "bg-amber-500/10 border-amber-500/30 text-amber-600",
                                                )}
                                            >
                                                {entry.type === 'added' ? t('Cloud.Labels.Added') : entry.type === 'removed' ? t('Cloud.Labels.Deleted') : t('Cloud.Actions.Update')}
                                            </Badge>
                                        </div>

                                        {/* 值对比 */}
                                        <div className="ml-5 space-y-0.5">
                                            {entry.type === 'modified' && (
                                                <>
                                                    <div className="flex items-start gap-2">
                                                        <span className="text-[9px] text-red-500/80 font-mono font-bold mt-0.5 shrink-0 w-6">{t('Cloud.Labels.Old')}</span>
                                                        <span className="text-[11px] text-red-600/70 line-through break-all leading-relaxed">
                                                            {entry.cloudValue}
                                                        </span>
                                                    </div>
                                                    <div className="flex items-start gap-2">
                                                        <span className="text-[9px] text-green-500/80 font-mono font-bold mt-0.5 shrink-0 w-6">{t('Cloud.Labels.New')}</span>
                                                        <span className="text-[11px] text-green-700/80 font-medium break-all leading-relaxed">
                                                            {entry.localValue}
                                                        </span>
                                                    </div>
                                                </>
                                            )}
                                            {entry.type === 'added' && (
                                                <p className="text-[11px] text-green-700/80 break-all leading-relaxed">
                                                    {entry.localValue}
                                                </p>
                                            )}
                                            {entry.type === 'removed' && (
                                                <p className="text-[11px] text-red-600/70 line-through break-all leading-relaxed">
                                                    {entry.cloudValue}
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </ScrollArea>

                    {/* 底部汇总 */}
                    {!loading && diffEntries.length > 0 && (
                        <div className="px-4 py-2 border-t bg-muted/10 text-[10px] text-muted-foreground flex items-center justify-between shrink-0">
                            <span>
                                {t('Cloud.Labels.TotalDiffs', { count: diffEntries.length })}
                                {filteredEntries.length !== diffEntries.length && t('Cloud.Labels.ShowingCount', { count: filteredEntries.length })}
                            </span>
                            <span className="font-mono">
                                {t('Cloud.Status.Local')} <ArrowRight className="w-3 h-3 inline" /> {t('Cloud.Status.Cloud')}
                            </span>
                        </div>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
};
