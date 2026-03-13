import React, { memo } from 'react';
import { Button } from '@/src/shadcn';
import { FileOutput, Loader2 } from 'lucide-react';
import { TemplateCard } from './template-card';
import { useTranslation } from 'react-i18next';

interface IncrementalExtractCardProps {
    onExtract: () => void;
    isExtracting?: boolean;
    isApplied?: boolean;
}

const IncrementalExtractCard: React.FC<IncrementalExtractCardProps> = memo(({ onExtract, isExtracting, isApplied }) => {
    const { t } = useTranslation();

    return (
        <TemplateCard
            title={t('Editor.Actions.IncrementalExtract')}
            icon={FileOutput}
            className="flex flex-col gap-3"
        >
            <p className="text-[10px] text-muted-foreground leading-relaxed">
                {isApplied ? t('Editor.Actions.IncrementalExtractDisabledTip') : t('Editor.Actions.IncrementalExtractTip')}
            </p>
            <Button
                variant="secondary"
                size="sm"
                onClick={onExtract}
                disabled={isExtracting || isApplied}
                className="text-xs h-8 gap-1.5 text-foreground transition-all duration-200 hover:scale-[1.02] active:scale-95 group w-full mt-1 font-medium"
            >
                {isExtracting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileOutput className="w-3.5 h-3.5" />}
                {t('Editor.Actions.IncrementalExtract')}
            </Button>
        </TemplateCard>
    );
});

IncrementalExtractCard.displayName = 'IncrementalExtractCard';

export { IncrementalExtractCard };
