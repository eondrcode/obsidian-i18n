import { Button, Input, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, Progress, Checkbox, Badge } from '@/src/shadcn';
import { STYLES } from '@/src/constants/llm-options';
import { SUPPORTED_LANGUAGES } from '@/src/constants/languages';
import { TemplateCard } from '../../plugin_editor/components/common/template-card';
import { Square, Clock, Languages, Sparkles, Layers, Palette, Coins } from 'lucide-react';
import { useThemeTranslation } from './use-theme-translation';
import { useTranslation } from 'react-i18next';

interface Props {
    controller: ReturnType<typeof useThemeTranslation>;
}

const ThemeLLMCard: React.FC<Props> = ({ controller }) => {
    const { t } = useTranslation();
    const { state, actions } = controller;
    const {
        language,
        style,
        batchSize,
        concurrencyLimit,
        overwrite,
        inputError,
        concurrencyError,
        isTranslating,
        progress,
        processedCount,
        totalCount,
        currentBatch,
        totalBatches,
        targetItems,
        timeout,
        timeoutError
    } = state;

    const {
        setLanguage,
        setStyle,
        setBatchSize,
        setConcurrencyLimit,
        setOverwrite,
        handleBatchSizeBlur,
        handleConcurrencyLimitBlur,
        handleTimeoutChange,
        handleTimeoutBlur,
        handleBatchTranslation,
        handleStop
    } = actions;

    return (
        <TemplateCard
            title={t('Editor.Titles.Ai')}
            icon={Sparkles}
            className="flex flex-col gap-4"
        >
            <div className="grid grid-cols-1 gap-3">
                {/* Language Selection */}
                <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                        <Languages className="w-3.5 h-3.5" />
                        {t('Editor.Labels.SelectLang')}
                    </label>
                    <div className="flex gap-2">
                        <Select value={SUPPORTED_LANGUAGES.some(l => l.value === language) ? language : undefined} onValueChange={setLanguage}>
                            <SelectTrigger size="sm" className="w-[110px] text-xs bg-background">
                                <SelectValue placeholder={t('Editor.Labels.SelectLang')} />
                            </SelectTrigger>
                            <SelectContent>
                                {SUPPORTED_LANGUAGES.map(l => (
                                    <SelectItem key={l.value} value={l.value} className="text-xs">
                                        {l.label}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        <Input
                            value={language}
                            onChange={(e) => setLanguage(e.target.value)}
                            placeholder={t('Editor.Labels.CustomLang')}
                            className="h-8 text-xs bg-background flex-1"
                        />
                    </div>
                </div>

                {/* Style Selection */}
                <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                        <Palette className="w-3.5 h-3.5" />
                        {t('Editor.Labels.SelectStyle')}
                    </label>
                    <div className="flex gap-2">
                        <Select value={STYLES.some(s => s.value === style) ? style : undefined} onValueChange={setStyle}>
                            <SelectTrigger size="sm" className="w-[110px] text-xs bg-background">
                                <SelectValue placeholder={t('Editor.Labels.SelectStyle')} />
                            </SelectTrigger>
                            <SelectContent>
                                {STYLES.map(s => (
                                    <SelectItem key={s.value} value={s.value} className="text-xs">
                                        {s.label}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        <Input
                            value={style}
                            onChange={(e) => setStyle(e.target.value)}
                            placeholder={t('Editor.Labels.CustomStyle')}
                            className="h-8 text-xs bg-background flex-1"
                        />
                    </div>
                </div>

                {/* Batch Settings */}
                <div className="grid grid-cols-2 gap-3">
                    <div className="flex flex-col gap-1.5">
                        <label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                            <Layers className="w-3.5 h-3.5" />
                            {t('Editor.Labels.BatchSize')}
                        </label>
                        <Input
                            type="number"
                            min={1}
                            value={batchSize}
                            onChange={setBatchSize}
                            onBlur={handleBatchSizeBlur}
                            className={`h-8 text-xs bg-background ${inputError ? 'border-red-500 focus-visible:ring-red-500' : ''}`}
                        />
                    </div>
                    <div className="flex flex-col gap-1.5">
                        <label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                            <Square className="w-3.5 h-3.5" />
                            {t('Editor.Labels.Concurrency')}
                        </label>
                        <Input
                            type="number"
                            min={1}
                            value={concurrencyLimit}
                            onChange={setConcurrencyLimit}
                            onBlur={handleConcurrencyLimitBlur}
                            className={`h-8 text-xs bg-background ${concurrencyError ? 'border-red-500 focus-visible:ring-red-500' : ''}`}
                        />
                    </div>
                </div>

                {/* Timeout & Overwrite Settings */}
                <div className="grid grid-cols-2 gap-3 items-end">
                    <div className="flex flex-col gap-1.5">
                        <label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                            <Clock className="w-3.5 h-3.5" />
                            {t('Editor.Labels.Timeout')}
                        </label>
                        <Input
                            type="number"
                            min={100}
                            step={1000}
                            value={timeout}
                            onChange={handleTimeoutChange}
                            onBlur={handleTimeoutBlur}
                            className={`h-8 text-xs bg-background ${timeoutError ? 'border-red-500 focus-visible:ring-red-500' : ''}`}
                        />
                    </div>
                    <div className="flex items-center space-x-2 h-8">
                        <Checkbox
                            id="overwrite-mode-theme"
                            checked={overwrite}
                            onCheckedChange={(c) => setOverwrite(c as boolean)}
                        />
                        <label
                            htmlFor="overwrite-mode-theme"
                            className="text-xs font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 text-muted-foreground cursor-pointer"
                        >
                            {t('Editor.Labels.Overwrite')}
                        </label>
                    </div>
                </div>

                {/* Token Estimation */}
                {!isTranslating && targetItems.length > 0 && (
                    <div className="flex items-center justify-between p-2 rounded-md bg-muted/30 border border-border/50 animate-in fade-in slide-in-from-top-1 duration-300">
                        <div className="flex items-center gap-2">
                            <Coins className="w-3.5 h-3.5 text-primary" />
                            <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">{t('Editor.Labels.ExpectedConsumption')}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                            <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4 font-mono">
                                {state.estimation.tokens} Tokens
                            </Badge>
                            <span className="text-[10px] text-muted-foreground/80">
                                ≈ ¥{state.estimation.cost.toFixed(4)}
                            </span>
                        </div>
                    </div>
                )}

                {/* Progress Bar (Visible when translating) */}
                {isTranslating && (
                    <div className="flex flex-col gap-1.5 animate-in fade-in zoom-in duration-300">
                        <div className="flex justify-between text-xs text-muted-foreground">
                            <span>{t('Editor.Status.ProcessingBatch', { current: currentBatch, total: totalBatches })}</span>
                            <span>{processedCount} / {totalCount}</span>
                        </div>
                        <Progress value={progress} className="h-2" />
                    </div>
                )}
            </div>

            <div className="grid grid-cols-1 gap-3 pt-2">
                {isTranslating ? (
                    <Button
                        variant="destructive"
                        size="sm"
                        onClick={handleStop}
                        className="text-xs h-8 gap-1.5 font-medium w-full"
                    >
                        <Square className="w-3.5 h-3.5 fill-current" />
                        {t('Common.Actions.StopTranslate')}
                    </Button>
                ) : (
                    <Button
                        variant="default"
                        size="sm"
                        onClick={handleBatchTranslation}
                        disabled={targetItems.length === 0 || inputError}
                        className="text-xs h-8 gap-1.5 font-medium w-full transition-all duration-200 hover:opacity-90 active:scale-[0.98]"
                    >
                        <Sparkles className="w-3.5 h-3.5" />
                        {targetItems.length > 0 ? t('Editor.Actions.BatchTranslate', { count: targetItems.length }) : t('Common.Notices.NoItemsToTranslate')}
                    </Button>
                )}
            </div>
        </TemplateCard>
    );
};

export { ThemeLLMCard };
