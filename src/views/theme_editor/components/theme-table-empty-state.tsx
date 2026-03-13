import React from 'react';
import { Card } from '~/shadcn';
import { FileX } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export const ThemeTableEmptyState: React.FC = () => {
    const { t } = useTranslation();
    return (
        <div className="flex flex-col items-center justify-center h-full p-8 text-center">
            <FileX className="w-12 h-12 text-muted-foreground/50 mb-4" />
            <h3 className="text-sm font-medium text-muted-foreground mb-1">{t('Editor.Status.Empty')}</h3>
            {/* <p className="text-xs text-muted-foreground/70">
                请先在主题管理器中提取翻译条目
                
            </p> */}
        </div>
    );
};
