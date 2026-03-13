import { Checkbox, Label, Input, Button } from '~/shadcn';
import { Save, Settings as SettingsIcon } from 'lucide-react';
import { useState } from 'react';
import { TemplateCard } from './common/template-card';
import { useTranslation } from 'react-i18next';

/** 编辑器设置接口 */
interface Settings {
    realtimeCheck: boolean;
    autoSave: boolean;
    fontSize: number;
    [key: string]: boolean | number;
}

/** SettingsCard 组件 Props */
interface SettingsCardProps {
    initialSettings?: Partial<Settings>;
    onSaveSettings?: (settings: Settings) => void;
}

/**
 * 编辑器设置卡片子组件
 */
const SettingsCard: React.FC<SettingsCardProps> = ({ initialSettings, onSaveSettings }) => {
    const { t } = useTranslation();
    // 局部维护设置状态
    const [settings, setSettings] = useState<Settings>({
        realtimeCheck: true,
        autoSave: true,
        fontSize: 14,
        ...initialSettings
    });

    // 处理设置变更
    const handleSettingChange = (key: keyof Settings, value: boolean | number) => {
        setSettings(prev => ({ ...prev, [key]: value }));
    };

    // 保存设置：触发父组件回调，传递当前设置
    const handleSave = () => {
        onSaveSettings && onSaveSettings(settings);
        // 可添加“保存成功”提示（如Toast）
    };

    return (
        <TemplateCard
            title={t('Editor.Actions.Settings')}
            icon={SettingsIcon}
            className="flex flex-col gap-3 flex-grow"
        >
            <div className="space-y-3">
                {/* 实时语法检查 */}
                <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                        <Checkbox
                            id="setting-realtime"
                            checked={settings.realtimeCheck}
                            onCheckedChange={(checked) => handleSettingChange('realtimeCheck', !!checked)}
                        />
                        <Label
                            htmlFor="setting-realtime"
                            className="text-xs cursor-pointer text-foreground"
                        >
                            {t('Editor.Labels.RealtimeCheck')}
                        </Label>
                    </div>
                </div>
                {/* 自动保存 */}
                <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                        <Checkbox
                            id="setting-autosave"
                            checked={settings.autoSave}
                            onCheckedChange={(checked) => handleSettingChange('autoSave', !!checked)}
                        />
                        <Label
                            htmlFor="setting-autosave"
                            className="text-xs cursor-pointer text-foreground"
                        >
                            {t('Editor.Labels.AutoSave')}
                        </Label>
                    </div>
                </div>
                {/* 字号大小 */}
                <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                        <Label
                            htmlFor="setting-fontsize"
                            className="text-xs cursor-pointer text-foreground"
                        >
                            {t('Editor.Labels.FontSize')}
                        </Label>
                        <span className="text-xs text-muted-foreground">{settings.fontSize}px</span>
                    </div>
                    <Input
                        id="setting-fontsize"
                        className="h-8 text-xs text-foreground"
                        value={settings.fontSize}
                        onChange={(e) => handleSettingChange('fontSize', Number(e.target.value) || 14)}
                        min="12"
                        max="24"
                        type="number"
                    />
                </div>
            </div>
            {/* 保存设置按钮（固定在底部） */}
            <div className="mt-auto pt-3 border-t border-border">
                <Button
                    variant="default"
                    size="sm"
                    className="w-full text-xs gap-1.5"
                    onClick={handleSave}
                >
                    <Save className="h-3.5 w-3.5" />
                    {t('Common.Actions.Save')}
                </Button>
            </div>
        </TemplateCard>
    );
};

export { SettingsCard };