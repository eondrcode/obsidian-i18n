// 导入依赖：UI组件、图标、Card子组件
import React, { useState } from 'react';
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
} from '@/src/shadcn';
import { useRegexStore } from '../../store';
import { RegexStatsCard } from '../..';
import { RegexInsertCard } from './regex-insert-card';
import { RegexLLMCard } from './regex-llm-card';
import { QuickActionsCard } from '../common/quick-actions-card';
import { DiagnoseCard } from '../common/diagnose-card';
import { RegexValidationCard } from './regex-validation-card';
import { useRegexTranslation } from './use-regex-translation';
import { Library, Settings2 } from 'lucide-react';
import { DiagnoseError } from '../../types';

interface Props {
    regexController?: ReturnType<typeof useRegexTranslation>;
    activeTab?: string;
    onTabChange?: (value: string) => void;
    onIncrementalExtract?: () => void;
    onOpenFile?: () => void;
    onDiagnose?: () => void;
    onClearDiagnose?: () => void;
    onRestoreAllErrors?: () => void;
    isDiagnosing?: boolean;
    errorItems?: DiagnoseError[];
    hasChecked?: boolean;
    setActiveTab?: (tab: string) => void;
    isApplied?: boolean;
    onJumpError?: (error: DiagnoseError) => void;
}

/**
 * RegexSidebar 容器组件：整合所有Card子组件
 */
const RegexSidebar: React.FC<Props> = ({
    regexController,
    activeTab,
    onTabChange,
    onIncrementalExtract,
    onOpenFile,
    onDiagnose,
    isDiagnosing,
    errorItems,
    hasChecked,
    setActiveTab,
    onClearDiagnose,
    onRestoreAllErrors,
    isApplied,
    onJumpError
}) => {
    const { t } = useTranslation();

    // Lifted State (Received via props, fallback to local for safety)
    const localController = useRegexTranslation();
    const activeController = regexController || localController;

    // View State Management
    const [showStats, setShowStats] = useState(true);
    const [showValidation, setShowValidation] = useState(true);
    const [showInsert, setShowInsert] = useState(true);
    const [showQuickActions, setShowQuickActions] = useState(true);
    const [showLLM, setShowLLM] = useState(true);

    return (
        <div className="flex flex-col w-full h-full">
            {/* 固定标题栏 - 与左侧标题栏对齐 */}
            <div className="flex items-center justify-between px-3 py-2 border-b shrink-0">
                <div className="flex items-center text-sm font-semibold gap-1.5">
                    <Library className="w-4 h-4" />
                    <span>{t('Editor.Titles.Sidebar')}</span>
                </div>
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
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
                            checked={showValidation}
                            onCheckedChange={setShowValidation}
                        >
                            {t('Editor.Titles.Regex')}
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
                            checked={showLLM}
                            onCheckedChange={setShowLLM}
                        >
                            {t('Editor.Titles.Ai')}
                        </DropdownMenuCheckboxItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>

            {/* 可滚动的卡片区域 */}
            <ScrollArea className="flex-1 min-h-0 px-2 pb-2">
                <div className="space-y-4 pb-4">
                    {showStats && (
                        <RegexStatsCard />
                    )}

                    {showValidation && (
                        <RegexValidationCard />
                    )}

                    {showInsert && (
                        <RegexInsertCard />
                    )}

                    {showQuickActions && (
                        <QuickActionsCard
                            onIncrementalExtract={onIncrementalExtract || (() => { })}
                            onClearUntranslated={useRegexStore.use.deleteUntranslatedRegexItems()}
                            onOpenFile={onOpenFile}
                            isApplied={isApplied}
                        />
                    )}
                    <DiagnoseCard
                        onDiagnose={onDiagnose!}
                        onClear={onClearDiagnose!}
                        onRestoreAllErrors={onRestoreAllErrors}
                        isDiagnosing={isDiagnosing!}
                        errorItems={errorItems || []}
                        hasChecked={hasChecked}
                        setActiveTab={setActiveTab}
                        onJumpError={onJumpError}
                    />
                    {showLLM && (
                        <RegexLLMCard controller={activeController} />
                    )}
                </div>
            </ScrollArea>
        </div>
    );
};

export { RegexSidebar };