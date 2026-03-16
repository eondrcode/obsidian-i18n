import React, { useState, useCallback, useEffect } from 'react';
import { Notice } from 'obsidian';
import { useTranslation } from 'react-i18next';
import I18N from 'src/main';
import { Tabs, TabsContent, TabsList, TabsTrigger, Button, Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '~/shadcn';
import { useCloudStore } from '../cloud/cloud-store';
import { PluginManager } from './plugin-manager';
import { ThemeManager } from './theme-manager';
import {
    LayoutGrid, Palette, Settings, Cloud, CircleHelp, RefreshCw,
    Loader2, Coffee, Zap, ShieldAlert, AlertTriangle
} from 'lucide-react';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '~/shadcn';
import Url from 'src/constants/url';
import { WIZARD_VIEW_TYPE } from '../../views';
import { CLOUD_VIEW_TYPE } from '../cloud';
import { DevDebugCard } from './dev-debug-card';
import { AdminPanel } from './components/admin-panel';

interface ManagerLayoutProps {
    i18n: I18N;
    close: () => void;
}

export const ManagerLayout: React.FC<ManagerLayoutProps> = ({ i18n, close }) => {
    const { t } = useTranslation();
    const app = i18n.app;
    const [isAutoRunning, setIsAutoRunning] = useState(false);
    const [showAutoConfirm, setShowAutoConfirm] = useState(false);

    // 管理员状态
    const isAdmin = useCloudStore.use.isAdmin();
    const githubUser = useCloudStore.use.githubUser();
    const fetchGithubUser = useCloudStore.use.fetchGithubUser();

    // 自动检测管理员身份
    useEffect(() => {
        if (i18n.settings.shareToken && !githubUser) {
            fetchGithubUser(i18n);
        }
    }, [i18n.settings.shareToken, githubUser, fetchGithubUser, i18n]);

    const handleSmartAuto = useCallback(async () => {
        setShowAutoConfirm(false);
        setIsAutoRunning(true);
        try {
            await i18n.autoManager.runSmartAuto();
        } finally {
            setIsAutoRunning(false);
        }
    }, [i18n.autoManager]);

    return (
        <div className="flex flex-col h-full bg-background overflow-hidden">
            <Tabs defaultValue={i18n.settings.managerTab || 'plugins'} onValueChange={(val) => { i18n.settings.managerTab = val; i18n.saveSettings(); }} className="flex flex-col h-full gap-0"   >
                {/* 顶部工具栏：左侧 Tab 切换 + 右侧功能按钮 */}
                <div className="flex items-center justify-between px-4 py-2 border-b shrink-0">
                    {/* 左侧：Tab 切换器 */}
                    <TabsList className="h-9 p-1 bg-muted/50 border rounded-none shadow-inner">
                        <TabsTrigger className="h-7 text-xs data-[state=active]:shadow-sm gap-1.5 px-3 rounded-none" value="plugins">
                            <LayoutGrid className="w-3.5 h-3.5" />
                            {t('Manager.Labels.Plugins')}
                        </TabsTrigger>
                        <TabsTrigger className="h-7 text-xs data-[state=active]:shadow-sm gap-1.5 px-3 rounded-none" value="themes">
                            <Palette className="w-3.5 h-3.5" />
                            {t('Manager.Labels.Themes')}
                        </TabsTrigger>
                        {isAdmin && (
                            <TabsTrigger className="h-7 text-xs data-[state=active]:shadow-sm gap-1.5 px-3 rounded-none" value="admin">
                                <ShieldAlert className="w-3.5 h-3.5" />
                                {t('Manager.Labels.Admin')}
                            </TabsTrigger>
                        )}
                    </TabsList>

                    {/* 右侧：功能按钮组 */}
                    <div className="flex items-center border rounded-none divide-x bg-background shadow-sm overflow-hidden">
                        <TooltipProvider>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <Button
                                        variant="ghost"
                                        className="rounded-none h-9 px-3 hover:bg-muted gap-2 text-xs text-yellow-600 dark:text-yellow-500 font-bold"
                                        onClick={() => setShowAutoConfirm(true)}
                                        disabled={isAutoRunning}
                                    >
                                        {isAutoRunning ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4 fill-current" />}
                                        <span>{isAutoRunning ? t('Manager.Status.Running') : t('Manager.Actions.Apply')}</span>
                                    </Button>
                                </TooltipTrigger>
                                <TooltipContent>一键自动化处理全部翻译</TooltipContent>
                            </Tooltip>
                        </TooltipProvider>

                        {/* 自动化确认弹窗 */}
                        <Dialog open={showAutoConfirm} onOpenChange={setShowAutoConfirm}>
                            <DialogContent className="sm:max-w-[420px] border-amber-500/20 shadow-2xl shadow-amber-500/10">
                                <DialogHeader>
                                    <div className="flex items-center gap-2 text-amber-500 mb-2">
                                        <AlertTriangle className="w-5 h-5" />
                                        <DialogTitle className="text-base font-black uppercase tracking-tight">
                                            {t('Manager.Dialogs.AutoWarningTitle')}
                                        </DialogTitle>
                                    </div>
                                    <DialogDescription className="text-xs leading-relaxed font-medium">
                                        {t('Manager.Dialogs.AutoWarningDesc')}
                                    </DialogDescription>
                                </DialogHeader>
                                <DialogFooter className="gap-2 sm:gap-0 mt-4">
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-9 px-4 text-[10px] font-black uppercase tracking-wider opacity-60 hover:opacity-100"
                                        onClick={() => setShowAutoConfirm(false)}
                                    >
                                        {t('Common.Actions.Cancel')}
                                    </Button>
                                    <Button
                                        variant="default"
                                        size="sm"
                                        className="h-9 px-6 bg-amber-500 hover:bg-amber-600 text-white border-none shadow-lg shadow-amber-500/20 text-[10px] font-black uppercase tracking-wider"
                                        onClick={handleSmartAuto}
                                    >
                                        {t('Common.Actions.Confirm')}
                                    </Button>
                                </DialogFooter>
                            </DialogContent>
                        </Dialog>

                        <TooltipProvider>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <Button variant="ghost" className="rounded-none h-9 px-3 hover:bg-muted gap-2 text-xs" onClick={() => window.open(Url.SPONSOR)}>
                                        <Coffee className="w-4 h-4" />
                                        <span>{t('Manager.Actions.Sponsor')}</span>
                                    </Button>
                                </TooltipTrigger>
                                <TooltipContent>{t('Manager.Actions.Sponsor')}</TooltipContent>
                            </Tooltip>
                        </TooltipProvider>

                        <TooltipProvider>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <Button variant="ghost" className="rounded-none h-9 px-3 hover:bg-muted gap-2 text-xs" onClick={() => { i18n.view.activateView(WIZARD_VIEW_TYPE); }}>
                                        <CircleHelp className="w-4 h-4" />
                                        <span>{t('Manager.Actions.Help')}</span>
                                    </Button>
                                </TooltipTrigger>
                                <TooltipContent>{t('Manager.Actions.HelpDoc')}</TooltipContent>
                            </Tooltip>
                        </TooltipProvider>

                        <TooltipProvider>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <Button variant="ghost" className="rounded-none h-9 px-3 hover:bg-muted gap-2 text-xs" onClick={() => {
                                        i18n.view.activateView(CLOUD_VIEW_TYPE);
                                    }}>
                                        <Cloud className="w-4 h-4" />
                                        <span>{t('Manager.Actions.Cloud')}</span>
                                    </Button>
                                </TooltipTrigger>
                                <TooltipContent>{t('Manager.Actions.Cloud')}</TooltipContent>
                            </Tooltip>
                        </TooltipProvider>

                        <TooltipProvider>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <Button variant="ghost" className="rounded-none h-9 px-3 hover:bg-muted gap-2 text-xs" onClick={() => {
                                        // @ts-ignore
                                        app.setting.open();
                                        // @ts-ignore
                                        app.setting.openTabById(i18n.manifest.id);
                                    }}>
                                        <Settings className="w-4 h-4" />
                                        <span>{t('Manager.Actions.Settings')}</span>
                                    </Button>
                                </TooltipTrigger>
                                <TooltipContent>{t('Manager.Actions.Settings')}</TooltipContent>
                            </Tooltip>
                        </TooltipProvider>
                    </div>
                </div>

                {/* Tab 内容区域 */}
                <TabsContent value="plugins" className="flex-1 min-h-0 m-0 focus-visible:ring-0">
                    <PluginManager i18n={i18n} close={close} />
                </TabsContent>

                <TabsContent value="themes" className="flex-1 min-h-0 m-0 focus-visible:ring-0">
                    <ThemeManager i18n={i18n} />
                </TabsContent>

                {isAdmin && (
                    <TabsContent value="admin" className="flex-1 min-h-0 m-0 focus-visible:ring-0 overflow-hidden">
                        <AdminPanel i18n={i18n} />
                    </TabsContent>
                )}
            </Tabs>
        </div>
    );
};
