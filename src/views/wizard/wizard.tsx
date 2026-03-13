import React, { useMemo, useCallback } from 'react';
import { Card, CardHeader, CardTitle, CardDescription } from '@/src/shadcn';
import { useGlobalStore } from '~/utils';
import { getWizardConfig } from './wizard-config-service';
import { useTranslation } from 'react-i18next';
import {
    PlaySquare, BookOpen, Settings, Cloud, LayoutGrid,
    Users, Github, ListTodo, LucideIcon,
} from 'lucide-react';
import {
    WizardSectionConfig, WizardItemConfig,
    WizardCardItemConfig, WizardActionConfig,
} from '~/types';

// ========== 图标映射 ==========

const ICON_MAP: Record<string, LucideIcon> = {
    PlaySquare,
    BookOpen,
    Settings,
    Cloud,
    LayoutGrid,
    Users,
    Github,
    ListTodo,
};

// ========== 渲染用类型 ==========

type WizardItem =
    | {
        type: 'card';
        icon: React.ReactNode;
        title: string;
        description: string;
        action: () => void;
    }
    | {
        type: 'placeholder';
        text: string;
    };

interface WizardSection {
    title: string;
    items: WizardItem[];
}

// ========== Hook: 配置转渲染数据 ==========

function useWizardSections(): WizardSection[] {
    const { t } = useTranslation();
    const i18n = useGlobalStore(state => state.i18n);
    const config = getWizardConfig();

    /** 将 action 配置转换为回调函数 */
    const resolveAction = useCallback((action: WizardActionConfig): (() => void) => {
        switch (action.type) {
            case 'url':
                return () => window.open(action.value);
            case 'view':
                return () => { i18n?.view.activateView(action.value); };
            case 'settings':
                return () => {
                    if (i18n && i18n.app) {
                        const setting = (i18n.app as any).setting;
                        if (setting) {
                            setting.open();
                            setting.openTabById(i18n.manifest.id);
                        }
                    }
                };
        }
    }, [i18n]);

    /** 将单个 item 配置转换为渲染数据 */
    const resolveItem = useCallback((item: WizardItemConfig): WizardItem => {
        if (item.type === 'placeholder') {
            return { type: 'placeholder', text: t(item.textKey as any) as string };
        }
        const cardItem = item as WizardCardItemConfig;
        const IconComponent = ICON_MAP[cardItem.icon];
        return {
            type: 'card',
            icon: IconComponent ? <IconComponent className="w-6 h-6" /> : null,
            title: t(cardItem.titleKey as any) as string,
            description: t(cardItem.descriptionKey as any) as string,
            action: resolveAction(cardItem.action),
        };
    }, [t, resolveAction]);

    /** 构建 section 标题 */
    const resolveTitle = useCallback((section: WizardSectionConfig): string => {
        let title = t(section.titleKey as any) as string;
        if (section.titleSuffix && section.titleKey2) {
            title += section.titleSuffix + (t(section.titleKey2 as any) as string);
        }
        return title;
    }, [t]);

    return useMemo(() => {
        return config.sections.map((section) => ({
            title: resolveTitle(section),
            items: section.items.map(resolveItem),
        }));
    }, [config, resolveTitle, resolveItem]);
}

// ========== 组件 ==========

export const Wizard: React.FC = () => {
    const { t } = useTranslation();
    const i18n = useGlobalStore(state => state.i18n);
    const sections = useWizardSections();

    return (
        <div className="flex flex-col items-center h-full p-6 space-y-6 bg-background pb-12 overflow-y-auto">

            <div className="text-center space-y-2 mt-2">
                <h1 className="text-2xl font-bold tracking-tight text-primary">Obsidian-I18N</h1>
                <p className="text-sm text-muted-foreground">
                    I18N {t('Wizard.Labels.Ver')} {i18n?.manifest?.version || t('Common.Status.Unknown')}
                </p>
            </div>

            <div className="w-full max-w-3xl space-y-6">
                {sections.map((section, idx) => (
                    <div key={idx} className="space-y-3">
                        <h2 className="text-lg font-semibold tracking-tight">{section.title}</h2>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            {section.items.map((item, itemIdx) => {
                                if (item.type === 'placeholder') {
                                    return (
                                        <div key={itemIdx} className="border-2 border-dashed rounded-lg flex items-center justify-center p-4 text-muted-foreground text-sm opacity-50 h-full">
                                            {item.text}
                                        </div>
                                    );
                                }
                                return (
                                    <div key={itemIdx} onClick={item.action} className="h-full">
                                        <Card className="hover:bg-accent/50 group transition-colors cursor-pointer h-full flex flex-col justify-center">
                                            <CardHeader className="flex flex-row items-center gap-3 space-y-0 p-4">
                                                <div className="text-primary shrink-0 transition-transform group-hover:scale-110">
                                                    {item.icon}
                                                </div>
                                                <div className="space-y-0.5">
                                                    <CardTitle className="text-sm font-medium leading-tight">{item.title}</CardTitle>
                                                    <CardDescription className="text-xs line-clamp-2">{item.description}</CardDescription>
                                                </div>
                                            </CardHeader>
                                        </Card>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};
