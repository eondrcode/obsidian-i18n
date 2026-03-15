import React, { useState, useCallback } from 'react';
import { Notice } from 'obsidian';
import { useTranslation } from 'react-i18next';
import I18N from 'src/main';
import { Tabs, TabsContent, TabsList, TabsTrigger, Button, Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '~/shadcn';
import { PluginManager } from './plugin-manager';
import { ThemeManager } from './theme-manager';
import { LayoutGrid, Palette, Settings, Cloud, CircleHelp, RefreshCw, Loader2, Coffee } from 'lucide-react';
import Url from 'src/constants/url';
import { WIZARD_VIEW_TYPE } from '../../views';
import { CLOUD_VIEW_TYPE } from '../cloud';

interface ManagerLayoutProps {
    i18n: I18N;
    close: () => void;
}

export const ManagerLayout: React.FC<ManagerLayoutProps> = ({ i18n, close }) => {
    const { t } = useTranslation();
    const app = i18n.app;
    const [isReloading, setIsReloading] = useState(false);

    const handleReloadI18n = useCallback(async () => {
        setIsReloading(true);
        try {
            const currentPluginId = i18n.manifest.id;
            // @ts-ignore
            if (app.plugins.enabledPlugins.has(currentPluginId)) {
                // @ts-ignore
                await app.plugins.disablePlugin(currentPluginId);
                // @ts-ignore
                await app.plugins.enablePlugin(currentPluginId);
                new Notice(t('Manager.Notices.ReloadSuccess'));
            } else {
                new Notice(t('Manager.Errors.PluginNotEnabled'));
                setIsReloading(false);
            }
        } catch (error) {
            new Notice(`${t('Manager.Errors.ReloadFailed')}: ${error}`);
            setIsReloading(false);
        }
    }, [app, i18n.manifest.id, t]);

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
                    </TabsList>

                    {/* 右侧：功能按钮组 */}
                    <div className="flex items-center border rounded-none divide-x bg-background shadow-sm overflow-hidden">
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
                        {/* 刷新 (仅开发模式展示) */}
                        {process.env.DEV_MODE && (
                            <TooltipProvider>
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <Button variant="ghost" className="rounded-none h-9 px-3 hover:bg-muted gap-2 text-xs" onClick={handleReloadI18n} disabled={isReloading}>
                                            {isReloading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                                            <span>{isReloading ? t('Manager.Status.Reloading') : t('Manager.Actions.Reload')}</span>
                                        </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>{t('Manager.Actions.Reload')}</TooltipContent>
                                </Tooltip>
                            </TooltipProvider>
                        )}
                    </div>
                </div>

                {/* Tab 内容区域 */}
                <TabsContent value="plugins" className="flex-1 min-h-0 m-0 focus-visible:ring-0">
                    <PluginManager i18n={i18n} close={close} />
                </TabsContent>

                <TabsContent value="themes" className="flex-1 min-h-0 m-0 focus-visible:ring-0">
                    <ThemeManager i18n={i18n} />
                </TabsContent>
            </Tabs>
        </div>
    );
};
