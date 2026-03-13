import React, { memo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
    Button,
    ScrollArea,
    DropdownMenu,
    DropdownMenuTrigger,
    DropdownMenuContent,
    DropdownMenuCheckboxItem,
    DropdownMenuLabel,
    DropdownMenuSeparator
} from '~/shadcn';
import { Library, Settings2 } from 'lucide-react';
import { useThemeEditorStore } from '../store';
import { ThemeStatsCard } from './theme-stats-card';
import { ThemeInsertCard } from './theme-insert-card';
import { QuickActionsCard } from '../../plugin_editor/components/common/quick-actions-card';
import { ThemeLLMCard } from './theme-llm-card';
import { useThemeTranslation } from './use-theme-translation';

interface ThemeSidebarProps {
    onIncrementalExtract?: () => void;
    onOpenFile?: () => void;
    isApplied?: boolean;
}

/**
 * 主题编辑器右侧操作面板
 */
const ThemeSidebar: React.FC<ThemeSidebarProps> = memo(({ onIncrementalExtract, onOpenFile, isApplied }) => {
    const { t } = useTranslation();
    const deleteUntranslatedItems = useThemeEditorStore.use.deleteUntranslatedItems();

    // 视图状态管理
    const [showStats, setShowStats] = useState(true);
    const [showInsert, setShowInsert] = useState(true);
    const [showQuickActions, setShowQuickActions] = useState(true);
    const [showAI, setShowAI] = useState(true);

    const themeTranslationController = useThemeTranslation();

    return (
        <div className="flex flex-col h-full">
            {/* 固定标题栏 */}
            <div className="flex items-center justify-between px-3 py-2 border-b shrink-0 min-h-[36px]">
                <div className="flex items-center text-sm font-semibold gap-1.5">
                    <Library className="w-4 h-4" />
                    <span>{t('Editor.Titles.Sidebar')}</span>
                </div>
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
                            <Settings2 className="w-4 h-4" />
                            <span className="sr-only">{t('Editor.Labels.SidebarViewOptions')}</span>
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-48">
                        <DropdownMenuLabel>{t('Editor.Labels.SidebarShowCards')}</DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        <DropdownMenuCheckboxItem
                            checked={showStats}
                            onCheckedChange={setShowStats}
                        >
                            {t('Editor.Stats.Title')}
                        </DropdownMenuCheckboxItem>
                        <DropdownMenuCheckboxItem
                            checked={showInsert}
                            onCheckedChange={setShowInsert}
                        >
                            {t('Editor.Titles.Insert')}
                        </DropdownMenuCheckboxItem>
                        <DropdownMenuCheckboxItem
                            checked={showQuickActions}
                            onCheckedChange={setShowQuickActions}
                        >
                            {t('Editor.Titles.QuickActions')}
                        </DropdownMenuCheckboxItem>
                        <DropdownMenuCheckboxItem
                            checked={showAI}
                            onCheckedChange={setShowAI}
                        >
                            {t('Editor.Titles.Ai')}
                        </DropdownMenuCheckboxItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>

            {/* 可滚动区域 */}
            <ScrollArea className="flex-1 min-h-0 px-2 pb-2">
                <div className="space-y-4 pb-4">
                    {showStats && (
                        <ThemeStatsCard />
                    )}

                    {showInsert && (
                        <ThemeInsertCard />
                    )}

                    {showQuickActions && (
                        <QuickActionsCard
                            onIncrementalExtract={onIncrementalExtract || (() => { })}
                            onClearUntranslated={deleteUntranslatedItems}
                            onOpenFile={onOpenFile}
                            isApplied={isApplied}
                        />
                    )}

                    {showAI && (
                        <ThemeLLMCard controller={themeTranslationController} />
                    )}
                </div>
            </ScrollArea>
        </div>
    );
});

ThemeSidebar.displayName = 'ThemeSidebar';

export { ThemeSidebar };
