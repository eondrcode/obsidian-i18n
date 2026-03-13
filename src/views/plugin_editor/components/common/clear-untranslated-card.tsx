import React, { memo } from 'react';
import { Button } from '@/src/shadcn';
import { Trash2 } from 'lucide-react';
import { TemplateCard } from './template-card';
import { useTranslation } from 'react-i18next';

interface ClearUntranslatedCardProps {
    onClear: () => void;
}

const ClearUntranslatedCard: React.FC<ClearUntranslatedCardProps> = memo(({ onClear }) => {
    const { t } = useTranslation();

    return (
        <TemplateCard
            title={t('Editor.Actions.DeleteUntranslated')}
            icon={Trash2}
            className="flex flex-col gap-3"
        >
            <p className="text-[10px] text-muted-foreground leading-relaxed">
                {t('Editor.Actions.DeleteUntranslatedTip')}
            </p>
            <Button
                variant="destructive"
                size="sm"
                onClick={onClear}
                className="text-xs h-8 gap-1.5 transition-all duration-200 hover:scale-[1.02] active:scale-95 group w-full mt-1 font-medium"
            >
                <Trash2 className="w-3.5 h-3.5" />
                {t('Editor.Actions.DeleteUntranslated')}
            </Button>
        </TemplateCard>
    );
});

ClearUntranslatedCard.displayName = 'ClearUntranslatedCard';

export { ClearUntranslatedCard };
