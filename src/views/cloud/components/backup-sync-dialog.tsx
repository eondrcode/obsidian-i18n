/**
 * 全量云端备份与恢复弹窗
 * 支持一键备份所有本地翻译到 GitHub 仓库、一键从云端恢复全部翻译
 */
import React, { useCallback, useState } from 'react';
import { Button } from '@/src/shadcn';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/src/shadcn/ui/dialog';
import { Progress } from '@/src/shadcn/ui/progress';
import { ScrollArea } from '@/src/shadcn/ui/scroll-area';
import { Badge } from '@/src/shadcn/ui/badge';
import { Loader2, Upload, Download, CheckCircle2, AlertCircle, Cloud, HardDrive, ArrowRight, Package, ArrowLeft } from 'lucide-react';
import { useCloudStore } from '../cloud-store';
import { useGlobalStoreInstance } from '~/utils';
import { t } from '@/src/locales/index';
import { ManifestEntry, BackupProgress, getCloudFilePath } from '../types';
import { cn } from '@/src/shadcn/lib/utils';
import { calculateChecksum } from '@/src/utils/translator/translation';
import { TranslationSource } from '@/src/types';
import * as fs from 'fs-extra';
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

export const BackupSyncTab: React.FC = () => {
    const i18n = useGlobalStoreInstance.getState().i18n;

    const setCurrentTab = useCloudStore.use.setCurrentTab();
    const backupDialogMode = useCloudStore.use.backupDialogMode();
    const backupProgress = useCloudStore.use.backupProgress();
    const setBackupDialogMode = useCloudStore.use.setBackupDialogMode();
    const setBackupProgress = useCloudStore.use.setBackupProgress();
    const githubUser = useCloudStore.use.githubUser();
    const repoManifest = useCloudStore.use.repoManifest();
    const setRepoManifest = useCloudStore.use.setRepoManifest();

    const userRepo = i18n.settings.shareRepo;

    const [logs, setLogs] = useState<string[]>([]);
    const [isRunning, setIsRunning] = useState(false);

    const addLog = (msg: string) => setLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] ${msg}`]);

    // ========== 一键备份 ==========
    const handleBackup = useCallback(async () => {
        if (!githubUser || !userRepo) return;
        setIsRunning(true);
        setLogs([]);
        const username = githubUser.login;

        try {
            const allSources = i18n.sourceManager.getAllSources();
            if (allSources.length === 0) {
                addLog(t('Cloud.Hints.NoLocalSourcesBackup'));
                setBackupProgress({ total: 0, current: 0, currentPlugin: '', phase: 'done' });
                return;
            }

            addLog(t('Cloud.Notices.FoundLocalSources', { count: allSources.length }));
            setBackupProgress({ total: allSources.length, current: 0, currentPlugin: '', phase: 'uploading' });

            // 获取云端 metadata.json
            let manifest: ManifestEntry[] = [];
            let manifestSha = '';
            try {
                const manifestRes = await i18n.api.github.getFileContent(username, userRepo, 'metadata.json');
                if (manifestRes.state && manifestRes.data?.content) {
                    manifestSha = manifestRes.data.sha;
                    const decoded = Buffer.from(manifestRes.data.content, 'base64').toString('utf-8');
                    const parsed = JSON.parse(decoded);
                    if (Array.isArray(parsed)) manifest = parsed;
                }
            } catch { /* 空 manifest */ }

            let uploaded = 0;
            let skipped = 0;

            for (let i = 0; i < allSources.length; i++) {
                const source = allSources[i];
                setBackupProgress({
                    total: allSources.length,
                    current: i,
                    currentPlugin: source.title || source.plugin,
                    phase: 'uploading',
                });

                try {
                    // 读取本地文件内容
                    const filePath = i18n.sourceManager.getSourceFilePath(source.id);
                    if (!filePath || !fs.existsSync(filePath)) {
                        addLog(t('Cloud.Notices.SkipFileNotFound', { title: source.title || source.plugin }));
                        skipped++;
                        continue;
                    }

                    const content = fs.readFileSync(filePath, 'utf-8');
                    const hash = simpleHash(content);

                    // 检查云端是否已有且 hash 一致
                    const existingEntry = manifest.find(e => e.id === source.id);
                    if (existingEntry && existingEntry.hash === hash) {
                        addLog(t('Cloud.Notices.SkipUpToDate', { title: source.title || source.plugin }));
                        skipped++;
                        continue;
                    }

                    // 上传文件
                    const b64 = Buffer.from(content, 'utf-8').toString('base64');
                    const remoteFilePath = getCloudFilePath(source.id, source.type);
                    const uploadRes = await i18n.api.github.uploadFile(
                        username, userRepo, remoteFilePath, b64,
                        t('Cloud.Labels.BackupCommitMsg', { title: source.title, plugin: source.plugin })
                    );
                    if (!uploadRes.state) {
                        addLog(t('Cloud.Errors.UploadFailItem', { title: source.title || source.plugin }));
                        continue;
                    }

                    // 更新 manifest
                    const now = new Date().toISOString();
                    const entryIdx = manifest.findIndex(e => e.id === source.id);
                    const newEntry: ManifestEntry = {
                        id: source.id,
                        plugin: source.plugin,
                        type: source.type,
                        language: i18n.settings.language,
                        version: '',
                        supported_versions: '',
                        title: source.title || t('Cloud.Labels.UnnamedTranslation'),
                        description: '',
                        hash,
                        created_at: existingEntry?.created_at || now,
                        updated_at: now,
                    };

                    // 尝试从文件元数据获取版本号
                    try {
                        const parsed = JSON.parse(content);
                        if (parsed?.metadata?.version) newEntry.version = parsed.metadata.version;
                        if (parsed?.metadata?.supportedVersions) newEntry.supported_versions = parsed.metadata.supportedVersions;
                        if (parsed?.metadata?.description) newEntry.description = parsed.metadata.description;
                    } catch { /* ignore */ }

                    if (entryIdx >= 0) {
                        manifest[entryIdx] = { ...manifest[entryIdx], ...newEntry };
                    } else {
                        manifest.push(newEntry);
                    }

                    // 更新本地源的云端绑定
                    const updatedSource: TranslationSource = {
                        ...source,
                        origin: 'cloud' as const,
                        cloud: { owner: username, repo: userRepo, hash },
                        updatedAt: Date.now(),
                    };
                    i18n.sourceManager.saveSource(updatedSource);

                    uploaded++;
                    addLog(t('Cloud.Notices.UploadSuccessItem', { title: source.title || source.plugin }));
                } catch (e) {
                    addLog(t('Cloud.Errors.ProcessingFailItem', { title: source.title || source.plugin, error: `${e}` }));
                }
            }

            // 写回 manifest
            addLog(t('Cloud.Status.UpdatingIndex'));
            const manifestContent = Buffer.from(JSON.stringify(manifest, null, 4), 'utf-8').toString('base64');
            await i18n.api.github.uploadFile(
                username, userRepo, 'metadata.json', manifestContent,
                t('Cloud.Labels.BulkBackupMsg', { count: uploaded }),
                'main', manifestSha
            );

            setRepoManifest(manifest);
            useGlobalStoreInstance.getState().triggerSourceUpdate();
            setBackupProgress({ total: allSources.length, current: allSources.length, currentPlugin: '', phase: 'done' });
            addLog(t('Cloud.Notices.BackupCompleteStat', { uploaded, skipped }));
            i18n.notice.successPrefix(t('Common.Notices.Success'), t('Cloud.Notices.BackupSuccessCount', { count: uploaded }));
        } catch (error) {
            console.error(t('Cloud.Errors.BackupFail'), error);
            addLog(t('Cloud.Errors.BackupErrorMsg', { error: `${error}` }));
            setBackupProgress({ total: 0, current: 0, currentPlugin: '', phase: 'error', errorMessage: `${error}` });
            i18n.notice.errorPrefix(t('Common.Notices.Failure'), `${error}`);
        } finally {
            setIsRunning(false);
        }
    }, [githubUser, userRepo, i18n, setRepoManifest, setBackupProgress]);

    if (!i18n.settings.shareToken) {
        return <LoginRequired />;
    }

    // ========== 一键恢复 ==========
    const handleRestore = useCallback(async () => {
        if (!githubUser || !userRepo) return;
        if (!confirm(t('Cloud.Dialogs.ConfirmRestoreAll'))) return;

        setIsRunning(true);
        setLogs([]);
        const username = githubUser.login;

        try {
            // 获取 manifest
            addLog(t('Cloud.Hints.FetchingManifest'));
            const manifestRes = await i18n.api.github.getFileContent(username, userRepo, 'metadata.json');
            if (!manifestRes.state || !manifestRes.data?.content) {
                addLog(t('Cloud.Errors.GetManifestFail'));
                setBackupProgress({ total: 0, current: 0, currentPlugin: '', phase: 'error', errorMessage: t('Cloud.Errors.GetManifestFail') });
                return;
            }
            const decoded = Buffer.from(manifestRes.data.content, 'base64').toString('utf-8');
            const manifest: ManifestEntry[] = JSON.parse(decoded);
            if (!Array.isArray(manifest) || manifest.length === 0) {
                addLog(t('Cloud.Hints.NoCloudData'));
                setBackupProgress({ total: 0, current: 0, currentPlugin: '', phase: 'done' });
                return;
            }

            addLog(t('Cloud.Notices.FoundCloudSources', { count: manifest.length }));
            setBackupProgress({ total: manifest.length, current: 0, currentPlugin: '', phase: 'downloading' });

            let restored = 0;
            let skipped = 0;

            for (let i = 0; i < manifest.length; i++) {
                const entry = manifest[i];
                setBackupProgress({
                    total: manifest.length,
                    current: i,
                    currentPlugin: entry.title || entry.plugin,
                    phase: 'downloading',
                });

                try {
                    // 检查本地是否已有且 hash 一致
                    const existingSource = i18n.sourceManager.getSource(entry.id);
                    if (existingSource) {
                        const localPath = i18n.sourceManager.getSourceFilePath(entry.id);
                        if (localPath && fs.existsSync(localPath)) {
                            const localContent = fs.readFileSync(localPath, 'utf-8');
                            const localHash = simpleHash(localContent);
                            if (localHash === entry.hash) {
                                addLog(t('Cloud.Notices.SkipLocalLatest', { title: entry.title || entry.plugin }));
                                skipped++;
                                continue;
                            }
                        }
                    }

                    // 下载文件
                    const fileRes = await i18n.api.github.getFileContent(username, userRepo, getCloudFilePath(entry.id, entry.type));
                    if (!fileRes.state || !fileRes.data?.content) {
                        addLog(t('Cloud.Errors.DownloadFailItem', { title: entry.title || entry.plugin }));
                        continue;
                    }

                    const fileContent = Buffer.from(fileRes.data.content, 'base64').toString('utf-8');
                    const content = JSON.parse(fileContent);

                    // 保存到本地
                    i18n.sourceManager.saveSourceFile(entry.id, content);

                    // 更新或创建元数据
                    const sourceInfo: TranslationSource = {
                        id: entry.id,
                        plugin: entry.plugin,
                        title: entry.title || t('Cloud.Labels.UnnamedTranslation'),
                        type: entry.type,
                        origin: 'cloud',
                        isActive: existingSource?.isActive || false,
                        checksum: calculateChecksum(content),
                        cloud: { owner: username, repo: userRepo, hash: entry.hash },
                        updatedAt: Date.now(),
                        createdAt: existingSource?.createdAt || Date.now(),
                    };
                    i18n.sourceManager.saveSource(sourceInfo);

                    // 如果该插件下没有激活的源，自动激活
                    if (!i18n.sourceManager.getActiveSourceId(entry.plugin)) {
                        i18n.sourceManager.setActive(entry.id, true);
                    }

                    restored++;
                    addLog(t('Cloud.Notices.RestoreSuccessItem', { title: entry.title || entry.plugin }));
                } catch (e) {
                    addLog(t('Cloud.Errors.ProcessingFailItem', { title: entry.title || entry.plugin, error: `${e}` }));
                }
            }

            setRepoManifest(manifest);
            useGlobalStoreInstance.getState().triggerSourceUpdate();
            setBackupProgress({ total: manifest.length, current: manifest.length, currentPlugin: '', phase: 'done' });
            addLog(t('Cloud.Notices.RestoreCompleteStat', { restored, skipped }));
            i18n.notice.successPrefix(t('Common.Notices.Success'), t('Cloud.Notices.RestoreSuccessCount', { count: restored }));
        } catch (error) {
            console.error(t('Cloud.Errors.RestoreFail'), error);
            addLog(t('Cloud.Errors.RestoreErrorMsg', { error: `${error}` }));
            setBackupProgress({ total: 0, current: 0, currentPlugin: '', phase: 'error', errorMessage: `${error}` });
            i18n.notice.errorPrefix(t('Common.Notices.Failure'), `${error}`);
        } finally {
            setIsRunning(false);
        }
    }, [githubUser, userRepo, i18n, setRepoManifest, setBackupProgress]);

    const handleClose = useCallback(() => {
        if (isRunning) return;
        setBackupDialogMode(null);
        setBackupProgress(null);
        setLogs([]);
        setCurrentTab('my');
    }, [isRunning, setBackupDialogMode, setBackupProgress, setCurrentTab]);

    const progressPercent = backupProgress?.total ? Math.round((backupProgress.current / backupProgress.total) * 100) : 0;

    return (
        <div className="flex flex-col h-full min-h-0">
            {/* 顶部导航栏 */}
            <div className="flex items-center justify-between px-1 pb-4 shrink-0">
                <div className="flex items-center gap-3">
                    <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 px-2 gap-1.5 text-muted-foreground hover:text-primary"
                        onClick={handleClose}
                    >
                        <ArrowLeft className="w-4 h-4" />
                        {t('Cloud.Actions.BackToManage')}
                    </Button>
                    <div className="w-[1px] h-5 bg-border/50" />
                    <div className="flex items-center gap-2">
                        <HardDrive className="w-4 h-4 text-primary" />
                        <h2 className="text-sm font-semibold">{t('Cloud.Actions.BackupSync')}</h2>
                    </div>
                </div>
            </div>

            <ScrollArea className="flex-1 min-h-0 border rounded-xl overflow-hidden bg-card">
                <div className="flex flex-col gap-6 p-6 max-w-2xl mx-auto w-full animate-in fade-in slide-in-from-bottom-4 duration-500">

                    {/* 说明区域 */}
                    <div className="text-sm text-muted-foreground bg-muted/30 p-4 rounded-lg border border-border/50">
                        {t('Cloud.Tips.BackupDesc')}
                    </div>

                    {/* 模式选择 (未开始时) */}
                    {!backupDialogMode && !isRunning && (
                        <div className="grid grid-cols-2 gap-4">
                            <button
                                onClick={() => setBackupDialogMode('backup')}
                                className="flex flex-col items-center gap-3 p-6 rounded-xl border-2 border-dashed border-border/60 hover:border-primary/40 hover:bg-primary/5 transition-all group"
                            >
                                <div className="p-3 rounded-full bg-blue-500/10 text-blue-600 group-hover:bg-blue-500/20 transition-colors">
                                    <Upload className="w-6 h-6" />
                                </div>
                                <div className="text-center">
                                    <p className="text-sm font-semibold">{t('Cloud.Tips.BackupToCloud')}</p>
                                    <p className="text-[10px] text-muted-foreground mt-1">{t('Cloud.Tips.LocalToGithub')}</p>
                                </div>
                            </button>
                            <button
                                onClick={() => setBackupDialogMode('restore')}
                                className="flex flex-col items-center gap-3 p-6 rounded-xl border-2 border-dashed border-border/60 hover:border-primary/40 hover:bg-primary/5 transition-all group"
                            >
                                <div className="p-3 rounded-full bg-green-500/10 text-green-600 group-hover:bg-green-500/20 transition-colors">
                                    <Download className="w-6 h-6" />
                                </div>
                                <div className="text-center">
                                    <p className="text-sm font-semibold">{t('Cloud.Tips.RestoreFromCloud')}</p>
                                    <p className="text-[10px] text-muted-foreground mt-1">{t('Cloud.Tips.GithubToLocal')}</p>
                                </div>
                            </button>
                        </div>
                    )}

                    {/* 确认开始 */}
                    {backupDialogMode && !isRunning && !backupProgress && (
                        <div className="space-y-4">
                            <div className={cn(
                                "flex items-center gap-4 p-4 rounded-xl border",
                                backupDialogMode === 'backup'
                                    ? "bg-blue-500/5 border-blue-500/20"
                                    : "bg-green-500/5 border-green-500/20"
                            )}>
                                <div className="flex items-center gap-2 text-sm">
                                    {backupDialogMode === 'backup' ? (
                                        <>
                                            <HardDrive className="w-5 h-5 text-blue-600" />
                                            <span className="font-semibold">{t('Cloud.Labels.LocalTranslation')}</span>
                                            <ArrowRight className="w-4 h-4 text-muted-foreground" />
                                            <Cloud className="w-5 h-5 text-blue-600" />
                                            <span className="font-semibold">{t('Cloud.Tips.GithubRepo')}</span>
                                        </>
                                    ) : (
                                        <>
                                            <Cloud className="w-5 h-5 text-green-600" />
                                            <span className="font-semibold">{t('Cloud.Tips.GithubRepo')}</span>
                                            <ArrowRight className="w-4 h-4 text-muted-foreground" />
                                            <HardDrive className="w-5 h-5 text-green-600" />
                                            <span className="font-semibold">{t('Cloud.Labels.LocalTranslation')}</span>
                                        </>
                                    )}
                                </div>
                            </div>
                            <div className="text-xs text-muted-foreground space-y-1 px-1">
                                {backupDialogMode === 'backup' ? (
                                    <>
                                        <p>{t('Cloud.Tips.BackupStep1')}</p>
                                        <p>{t('Cloud.Tips.BackupStep2')}</p>
                                        <p>{t('Cloud.Tips.BackupStep3')}</p>
                                    </>
                                ) : (
                                    <>
                                        <p>{t('Cloud.Tips.RestoreStep1')}</p>
                                        <p>{t('Cloud.Tips.RestoreStep2')}</p>
                                        <p>{t('Cloud.Tips.RestoreStep3')}</p>
                                    </>
                                )}
                            </div>
                            <div className="flex gap-2">
                                <Button variant="outline" className="flex-1" onClick={() => setBackupDialogMode(null)}>
                                    {t('Common.Actions.Back')}
                                </Button>
                                <Button
                                    className="flex-1"
                                    onClick={backupDialogMode === 'backup' ? handleBackup : handleRestore}
                                >
                                    {backupDialogMode === 'backup' ? (
                                        <><Upload className="w-4 h-4 mr-2" />{t('Cloud.Actions.StartBackup')}</>
                                    ) : (
                                        <><Download className="w-4 h-4 mr-2" />{t('Cloud.Actions.StartRestore')}</>
                                    )}
                                </Button>
                            </div>
                        </div>
                    )}

                    {/* 进度区域 */}
                    {(isRunning || backupProgress) && (
                        <div className="space-y-3">
                            {/* 进度条 */}
                            <div className="space-y-2">
                                <div className="flex items-center justify-between text-xs">
                                    <span className="text-muted-foreground font-medium">
                                        {backupProgress?.phase === 'done'
                                            ? t('Cloud.Status.BackupDone')
                                            : backupProgress?.phase === 'error'
                                                ? t('Cloud.Status.BackupError')
                                                : backupProgress?.phase === 'uploading'
                                                    ? t('Cloud.Status.UploadingCloud')
                                                    : t('Cloud.Status.DownloadingCloud')}
                                    </span>
                                    <span className="font-mono font-semibold text-primary">
                                        {backupProgress?.current}/{backupProgress?.total}
                                    </span>
                                </div>
                                <Progress value={progressPercent} className="h-2" />
                                {backupProgress?.currentPlugin && isRunning && (
                                    <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                                        <Package className="w-3 h-3" />
                                        <span className="truncate">{backupProgress.currentPlugin}</span>
                                    </div>
                                )}
                            </div>

                            {/* 日志 */}
                            <ScrollArea className="h-40 border rounded-lg bg-muted/10">
                                <div className="p-3 space-y-1">
                                    {logs.map((log, i) => (
                                        <p key={i} className="text-[11px] text-muted-foreground font-mono leading-relaxed">
                                            {log}
                                        </p>
                                    ))}
                                </div>
                            </ScrollArea>

                            {/* 完成按钮 */}
                            {!isRunning && backupProgress && (
                                <Button className="w-full" onClick={handleClose}>
                                    <CheckCircle2 className="w-4 h-4 mr-2" />
                                    {t('Cloud.Status.Done')}
                                </Button>
                            )}
                        </div>
                    )}
                </div>
            </ScrollArea>
        </div>
    );
};
