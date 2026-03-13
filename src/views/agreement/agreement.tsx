import React, { useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardHeader, CardTitle, CardContent, Button } from '@/src/shadcn';
import { AgreementView } from './agreement-view';
import { agreementData } from './data';

interface AgreementProps {
    view: AgreementView;
}

export const Agreement: React.FC<AgreementProps> = ({ view }) => {
    const { t } = useTranslation();
    const i18n = view.i18n;
    const [isScrolledToBottom, setIsScrolledToBottom] = useState(false);
    const scrollRef = useRef<HTMLDivElement>(null);

    const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
        const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
        if (scrollHeight - scrollTop - clientHeight < 20) {
            setIsScrolledToBottom(true);
        }
    };

    const handleAgree = async () => {
        if (!i18n) return;
        i18n.settings.agreement = true;
        await i18n.saveSettings();

        await i18n.onAgreementAccepted();
    };

    const handleDisagree = async () => {
        if (!i18n) return;
        // @ts-ignore
        await i18n.app.plugins.disablePlugin(i18n.manifest.id);
    };

    return (
        <div className="flex flex-col h-full bg-background p-6 items-center justify-center select-none">
            <Card className="w-full max-w-4xl flex flex-col h-[90vh] shadow-xl border-muted/40 ring-1 ring-border/10">
                <CardHeader className="border-b pb-6 bg-muted/5">
                    <CardTitle className="text-3xl text-center text-primary font-bold tracking-tight">{t('Agreement.Titles.Main')}</CardTitle>
                    <p className="text-center text-sm text-muted-foreground mt-2">{t('Agreement.Hints.Desc')}</p>
                </CardHeader>
                <CardContent className="flex-1 overflow-hidden p-0 relative">
                    <div
                        className="h-full overflow-y-auto p-8 space-y-8 text-sm text-foreground/80 leading-relaxed scroll-smooth"
                        onScroll={handleScroll}
                        ref={scrollRef}
                    >
                        {Array.isArray(agreementData) && agreementData.map((section, idx) => (
                            <section key={idx} className="space-y-3">
                                <h3 className="font-semibold text-base text-foreground">{section.title}</h3>
                                <ul className="list-none space-y-2 pl-2">
                                    {Array.isArray(section.content) && section.content.map((item: string, i: number) => (
                                        <li key={i} className="text-muted-foreground/90 leading-7 text-justify">
                                            {item}
                                        </li>
                                    ))}
                                </ul>
                            </section>
                        ))}

                        <div className="pt-8 pb-4 text-center text-muted-foreground text-xs border-t">
                            <p>{t('Agreement.Hints.End')}</p>
                        </div>
                    </div>

                    {!isScrolledToBottom && (
                        <div className="absolute bottom-6 right-8 bg-primary/90 text-primary-foreground px-4 py-1.5 rounded-full text-xs shadow-lg animate-pulse pointer-events-none backdrop-blur-sm">
                            {t('Agreement.Hints.Scroll')}
                        </div>
                    )}
                </CardContent>
                <div className="p-6 border-t bg-muted/10 flex justify-end space-x-4 items-center">
                    <div className="flex-1 text-xs text-muted-foreground">
                        {isScrolledToBottom ? t('Agreement.Hints.ReadThanks') : t('Agreement.Hints.ReadReminder')}
                    </div>
                    <Button variant="outline" onClick={handleDisagree} className="hover:bg-destructive/10 hover:text-destructive">
                        {t('Agreement.Actions.Disagree')}
                    </Button>
                    <Button
                        onClick={handleAgree}
                        disabled={!isScrolledToBottom}
                        className="min-w-[120px] transition-all duration-300"
                    >
                        {t('Agreement.Actions.Agree')}
                    </Button>
                </div>
            </Card>
        </div>
    );
};
