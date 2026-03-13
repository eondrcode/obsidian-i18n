/**
 * 翻译历史版本与回滚 — 完整页面视图
 * 借助 GitHub Commits API 查看翻译文件的提交历史，支持预览和一键回滚
 */
import React, { useCallback, useEffect, useState } from 'react';
import { Button } from '@/src/shadcn';
import { ScrollArea } from '@/src/shadcn/ui/scroll-area';
import { Badge } from '@/src/shadcn/ui/badge';
import { Card } from '@/src/shadcn';
import { Loader2, RotateCcw, Eye, GitCommit, Clock, User, ChevronRight, AlertCircle, ArrowLeft } from 'lucide-react';
import { useCloudStore } from '../cloud-store';
import { useGlobalStoreInstance } from '~/utils';
import { t } from '@/src/locales/index';
import { CommitEntry, ManifestEntry } from '../types';
import { cn } from '@/src/shadcn/lib/utils';
import { calculateChecksum } from '@/src/utils/translator/translation';
import { TranslationSource } from '@/src/types';
import { LoginRequired } from './login-required';

/** 计算字符串的简单 hash (与 publish-tab 一致) */
function simpleHash(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash;
    }
    const hex = Math.abs(hash).toString(16).padStart(8, '0');
    return hex.repeat(4);
}

export const HistoryTab: React.FC = () => {
    const i18n = useGlobalStoreInstance.getState().i18n;

    const entryId = useCloudStore.use.historyDialogEntryId();
    const setEntryId = useCloudStore.use.setHistoryDialogEntryId();
    const setCurrentTab = useCloudStore.use.setCurrentTab();
    const repoManifest = useCloudStore.use.repoManifest();
    const setRepoManifest = useCloudStore.use.setRepoManifest();
    const githubUser = useCloudStore.use.githubUser();

    const userRepo = i18n.settings.shareRepo;

    // 当前条目
    const entry = repoManifest.find(e => e.id === entryId) || null;

    // 状态
    const [commits, setCommits] = useState<CommitEntry[]>([]);
    const [loading, setLoading] = useState(false);
    const [selectedSha, setSelectedSha] = useState<string | null>(null);
    const [previewContent, setPreviewContent] = useState<string | null>(null);
    const [previewLoading, setPreviewLoading] = useState(false);
    const [rolling, setRolling] = useState(false);

    // 返回管理页
    const handleBack = useCallback(() => {
        setEntryId(null);
        setCurrentTab('my');
    }, [setEntryId, setCurrentTab]);

    // 加载提交历史
    useEffect(() => {
        if (!entry || !githubUser) {
            setCommits([]);
            setSelectedSha(null);
            setPreviewContent(null);
            return;
        }

        let cancelled = false;
        const loadCommits = async () => {
            setLoading(true);
            try {
                const filePath = `plugins/${entry.id}.json`;
                const res = await i18n.api.github.getFileCommits(
                    githubUser.login, userRepo, filePath, 1, 20
                );
                if (!cancelled && res.state && Array.isArray(res.data)) {
                    const mapped: CommitEntry[] = res.data.map((c: any) => ({
                        sha: c.sha,
                        message: c.commit?.message || '',
                        date: c.commit?.author?.date || c.commit?.committer?.date || '',
                        author: c.commit?.author?.name || c.author?.login || t('Common.Status.Unknown'),
                        avatarUrl: c.author?.avatar_url,
                    }));
                    setCommits(mapped);
                }
            } catch (e) {
                console.error(t('Cloud.Errors.FetchCommitsFail'), e);
            } finally {
                if (!cancelled) setLoading(false);
            }
        };
        loadCommits();
        return () => { cancelled = true; };
    }, [entry?.id, githubUser, userRepo, i18n]);

    // 预览指定版本
    const handlePreview = useCallback(async (sha: string) => {
        if (!entry || !githubUser) return;
        setSelectedSha(sha);
        setPreviewContent(null);
        setPreviewLoading(true);
        try {
            const filePath = `plugins/${entry.id}.json`;
            const res = await i18n.api.github.getFileAtCommit(
                githubUser.login, userRepo, filePath, sha
            );
            if (res.state && res.data?.content) {
                const decoded = Buffer.from(res.data.content, 'base64').toString('utf-8');
                try {
                    const parsed = JSON.parse(decoded);
                    setPreviewContent(JSON.stringify(parsed, null, 2));
                } catch {
                    setPreviewContent(decoded);
                }
            } else {
                setPreviewContent(`// ${t('Cloud.Errors.GetFileFail')}`);
            }
        } catch (e) {
            console.error(t('Cloud.Errors.PreviewFail'), e);
            setPreviewContent(`// ${t('Common.Notices.Failure')}`);
        } finally {
            setPreviewLoading(false);
        }
    }, [entry, githubUser, userRepo, i18n]);

    // 回滚到指定版本
    const handleRollback = useCallback(async () => {
        if (!selectedSha || !previewContent || !entry || !githubUser) return;
        if (!confirm(t('Cloud.Dialogs.RollbackConfirm'))) return;

        setRolling(true);
        try {
            const username = githubUser.login;
            const filePath = `plugins/${entry.id}.json`;

            // 1. 将旧版内容重新上传为最新版本
            const b64Content = Buffer.from(previewContent, 'utf-8').toString('base64');
            const uploadRes = await i18n.api.github.uploadFile(
                username, userRepo, filePath, b64Content,
                t('Cloud.Labels.RollbackTranslationMsg', { plugin: entry.plugin, sha: selectedSha.substring(0, 7) })
            );
            if (!uploadRes.state) {
                throw new Error(t('Cloud.Errors.RollbackFail'));
            }

            // 2. 更新 metadata.json
            const newHash = simpleHash(previewContent); // This line was implicitly removed in the instruction, but `newHash` is used below. Re-adding for correctness.
            let manifest: ManifestEntry[] = []; // This line was implicitly removed in the instruction, but `manifest` is used below. Re-adding for correctness.
            // setLoadingText(t_i18n('Cloud.Status.UpdatingIndex')); // This function/variable is not defined in the current scope.
            const manifestRes = await i18n.api.github.getFileContent(username, userRepo, 'metadata.json');
            if (manifestRes.state && manifestRes.data?.content) {
                const decoded = Buffer.from(manifestRes.data.content, 'base64').toString('utf-8');
                const parsed = JSON.parse(decoded);
                if (Array.isArray(parsed)) manifest = parsed;
            }
            const idx = manifest.findIndex(e => e.id === entry.id);
            if (idx >= 0) {
                manifest[idx] = {
                    ...manifest[idx],
                    hash: newHash,
                    updated_at: new Date().toISOString(),
                };
            }
            const manifestContent = Buffer.from(JSON.stringify(manifest, null, 4), 'utf-8').toString('base64');
            await i18n.api.github.uploadFile(
                username, userRepo, 'metadata.json', manifestContent,
                t('Cloud.Labels.UpdateManifestRollbackMsg', { plugin: entry.plugin }),
                'main',
                manifestRes.data?.sha
            );

            // 3. 同步到本地
            try {
                const content = JSON.parse(previewContent);
                i18n.sourceManager.saveSourceFile(entry.id, content);

                const existingSource = i18n.sourceManager.getSource(entry.id);
                if (existingSource) {
                    const updatedSource: TranslationSource = {
                        ...existingSource,
                        checksum: calculateChecksum(content),
                        cloud: { owner: username, repo: userRepo, hash: newHash },
                        updatedAt: Date.now(),
                    };
                    i18n.sourceManager.saveSource(updatedSource);
                }
            } catch { /* 如果本地源不存在则忽略 */ }

            // 4. 更新 store
            setRepoManifest(manifest);
            useGlobalStoreInstance.getState().triggerSourceUpdate();
            i18n.notice.successPrefix(t('Common.Notices.Success'), t('Cloud.Notices.RollbackSuccessLocal'));
            handleBack();
        } catch (error) {
            console.error(t('Cloud.Errors.RollbackFail'), error);
            i18n.notice.errorPrefix(t('Common.Notices.Failure'), `${error}`);
        } finally {
            setRolling(false);
        }
    }, [selectedSha, previewContent, entry, githubUser, userRepo, i18n, setRepoManifest, handleBack]);

    if (!i18n.settings.shareToken) {
        return <LoginRequired />;
    }

    // 如果没有 entryId，显示空状态
    if (!entryId || !entry) {
        return (
            <div className="flex flex-col items-center justify-center h-full gap-4 text-muted-foreground">
                <GitCommit className="w-12 h-12 opacity-20" />
                <p className="text-sm">{t('Cloud.Tips.SelectHistoryEntry')}</p>
                <Button variant="outline" size="sm" onClick={handleBack}>
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    {t('Cloud.Actions.BackToManage')}
                </Button>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full min-h-0">
            {/* 顶部导航栏 */}
            <div className="flex items-center justify-between px-1 pb-4 shrink-0">
                <div className="flex items-center gap-3">
                    <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 px-2 gap-1.5 text-muted-foreground hover:text-primary"
                        onClick={handleBack}
                    >
                        <ArrowLeft className="w-4 h-4" />
                        {t('Common.Actions.Back')}
                    </Button>
                    <div className="w-[1px] h-5 bg-border/50" />
                    <div className="flex items-center gap-2">
                        <GitCommit className="w-4 h-4 text-primary" />
                        <h2 className="text-sm font-semibold">{t('Cloud.Labels.TranslationHistory')}</h2>
                    </div>
                    <Badge variant="outline" className="text-[10px] px-2 py-0 h-[18px] font-medium">
                        {entry.title} ({entry.plugin})
                    </Badge>
                </div>
                {selectedSha && previewContent && !previewLoading && (
                    <Button
                        size="sm"
                        variant="destructive"
                        className="h-8 text-xs px-3 gap-1.5"
                        onClick={handleRollback}
                        disabled={rolling}
                    >
                        {rolling ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                            <RotateCcw className="w-3.5 h-3.5" />
                        )}
                        {rolling ? t('Cloud.Status.RollingBack') : t('Cloud.Labels.RollbackToVersion')}
                    </Button>
                )}
            </div>

            {/* 主内容区：左右分栏 */}
            <div className="flex flex-1 min-h-0 border rounded-xl overflow-hidden bg-card" style={{ maxHeight: 'calc(100% - 48px)' }}>
                {/* 左侧 - 提交时间线 */}
                <div className="w-[320px] border-r flex flex-col shrink-0 overflow-hidden">
                    <div className="px-4 py-2.5 bg-muted/20 border-b text-[11px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5" />
                        {t('Cloud.Labels.Commits')} ({commits.length})
                    </div>
                    <ScrollArea className="flex-1 h-0">
                        {loading ? (
                            <div className="flex flex-col items-center justify-center h-40 gap-2">
                                <Loader2 className="w-5 h-5 animate-spin text-primary" />
                                <span className="text-xs text-muted-foreground">{t('Cloud.Tips.LoadingCommits')}</span>
                            </div>
                        ) : commits.length === 0 ? (
                            <div className="flex flex-col items-center justify-center h-40 gap-2 text-muted-foreground">
                                <AlertCircle className="w-8 h-8 opacity-30" />
                                <span className="text-xs">{t('Cloud.Tips.NoCommits')}</span>
                            </div>
                        ) : (
                            <div className="flex flex-col py-2">
                                {commits.map((commit, idx) => (
                                    <button
                                        key={commit.sha}
                                        onClick={() => handlePreview(commit.sha)}
                                        className={cn(
                                            "group relative flex items-start gap-3 px-4 py-3 text-left transition-all hover:bg-muted/40",
                                            selectedSha === commit.sha && "bg-primary/5 border-l-2 border-l-primary"
                                        )}
                                    >
                                        {/* 时间线连接线 */}
                                        <div className="flex flex-col items-center pt-1 shrink-0">
                                            <div className={cn(
                                                "w-2.5 h-2.5 rounded-full border-2 transition-colors",
                                                selectedSha === commit.sha
                                                    ? "bg-primary border-primary"
                                                    : idx === 0
                                                        ? "bg-green-500 border-green-500"
                                                        : "bg-muted border-border group-hover:border-primary/50"
                                            )} />
                                            {idx < commits.length - 1 && (
                                                <div className="w-[1px] flex-1 bg-border/60 mt-1 min-h-[20px]" />
                                            )}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-[12px] font-semibold text-foreground/90 line-clamp-2 leading-snug">
                                                {commit.message}
                                            </p>
                                            <div className="flex items-center gap-2 mt-1.5">
                                                {commit.avatarUrl && (
                                                    <img src={commit.avatarUrl} className="w-3.5 h-3.5 rounded-full" alt="" />
                                                )}
                                                <span className="text-[10px] text-muted-foreground truncate">
                                                    {commit.author}
                                                </span>
                                                <span className="text-[10px] text-muted-foreground/60">
                                                    {new Date(commit.date).toLocaleDateString(undefined, { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}
                                                </span>
                                            </div>
                                            <code className="text-[9px] text-muted-foreground/40 font-mono mt-0.5 block">
                                                {commit.sha.substring(0, 7)}
                                            </code>
                                        </div>
                                        <ChevronRight className={cn(
                                            "w-3.5 h-3.5 text-muted-foreground/30 mt-1 shrink-0 transition-colors",
                                            selectedSha === commit.sha && "text-primary"
                                        )} />
                                    </button>
                                ))}
                            </div>
                        )}
                    </ScrollArea>
                </div>

                {/* 右侧 - 预览区 */}
                <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
                    <div className="px-4 py-2.5 bg-muted/20 border-b text-[11px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                        <Eye className="w-3.5 h-3.5" />
                        {t('Cloud.Labels.VersionPreview')}
                        {selectedSha && (
                            <Badge variant="outline" className="text-[9px] px-1.5 py-0 h-[16px] font-mono ml-1">
                                {selectedSha.substring(0, 7)}
                            </Badge>
                        )}
                    </div>
                    <ScrollArea className="flex-1 h-0">
                        {!selectedSha ? (
                            <div className="flex flex-col items-center justify-center h-full min-h-[300px] gap-3 text-muted-foreground">
                                <Eye className="w-10 h-10 opacity-20" />
                                <p className="text-xs">{t('Cloud.Labels.SelectCommitToPreview')}</p>
                            </div>
                        ) : previewLoading ? (
                            <div className="flex flex-col items-center justify-center h-full min-h-[300px] gap-2">
                                <Loader2 className="w-5 h-5 animate-spin text-primary" />
                                <span className="text-xs text-muted-foreground">{t('Cloud.Status.LoadingContent')}</span>
                            </div>
                        ) : (
                            <pre className="p-4 text-[11px] font-mono text-foreground/80 leading-relaxed whitespace-pre-wrap break-all">
                                {previewContent}
                            </pre>
                        )}
                    </ScrollArea>
                </div>
            </div>
        </div>
    );
};
