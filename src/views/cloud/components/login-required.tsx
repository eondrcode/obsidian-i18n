import React from 'react';
import { Button } from '@/src/shadcn';
import { ShieldAlert, ArrowRight } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useGlobalStoreInstance } from '~/utils';

interface LoginRequiredProps {
    title?: string;
    description?: string;
}

export const LoginRequired: React.FC<LoginRequiredProps> = ({ title, description }) => {
    const { t } = useTranslation();
    const i18n = useGlobalStoreInstance.getState().i18n;

    const handleGoToSettings = () => {
        const app = i18n.app;
        try {
            // @ts-ignore
            app.setting.open();
            // @ts-ignore
            app.setting.openTabById('i18n');
        } catch (error) {
            console.error('Failed to open settings:', error);
        }
    };

    return (
        <div className="flex flex-col items-center justify-center h-[400px] text-center p-6 space-y-4 max-w-md mx-auto">
            <div className="p-4 rounded-full bg-muted/50 text-muted-foreground ring-1 ring-border">
                <ShieldAlert className="w-10 h-10" />
            </div>
            <div className="space-y-2">
                <h3 className="text-xl font-semibold tracking-tight">
                    {title || t('Cloud.Hints.LoginRequired')}
                </h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                    {description || t('Cloud.Hints.LoginRequiredDesc')}
                </p>
            </div>
            <Button
                onClick={handleGoToSettings}
                className="mt-4 gap-2 px-6 shadow-sm transition-all hover:translate-y-[-1px]"
            >
                {t('Cloud.Hints.GoToSettings')}
                <ArrowRight className="w-4 h-4" />
            </Button>
        </div>
    );
};
