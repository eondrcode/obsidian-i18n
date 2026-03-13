import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription } from '@/src/shadcn';
import { FileSearch } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export const ASTTableEmptyState = () => {
    const { t } = useTranslation();
    return (
        <div className="flex h-full w-full items-center justify-center p-10 bg-muted/10">
            <Empty>
                <EmptyHeader>
                    <EmptyMedia variant="icon"><FileSearch /></EmptyMedia>
                </EmptyHeader>
                <EmptyTitle>{t('Editor.Table.EmptyStateAst')}</EmptyTitle>
                <EmptyDescription>
                    {t('Editor.Table.EmptyState')}
                </EmptyDescription>
            </Empty>
        </div>
    );
};
