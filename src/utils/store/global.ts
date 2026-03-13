import { create } from 'zustand'
import { createSelectors } from '~/utils'
import { PluginTranslationV1, ThemeTranslationV1, ValidationOptions } from "src/types";
import I18n from '@/main';

interface GlobalStore {
    i18n: I18n;
    editorPluginTranslation: PluginTranslationV1;
    editorPluginTranslationPath: string;
    // 主题编辑器相关
    editorThemeTranslation: ThemeTranslationV1;
    editorThemeName: string;
    editorThemeDir: string;
    editorThemeTranslationPath: string;
    sourceUpdateTick: number;
    setI18n: (i18n: I18n) => void;
    setEditorPluginTranslation: (translation: PluginTranslationV1) => void;
    setEditorPluginTranslationPath: (path: string) => void;
    setEditorTheme: (translation: ThemeTranslationV1, name: string, dir: string, translationPath: string) => void;
    triggerSourceUpdate: () => void;
}

const useGlobalStoreBase = create<GlobalStore>()((set, get) => {
    return {
        i18n: null as unknown as I18n,
        editorPluginTranslation: {} as PluginTranslationV1,
        editorPluginTranslationPath: '',
        // 主题编辑器相关
        editorThemeTranslation: {} as ThemeTranslationV1,
        editorThemeName: '',
        editorThemeDir: '',
        editorThemeTranslationPath: '',
        sourceUpdateTick: 0,

        setI18n: (i18n) => set({ i18n }),
        setEditorPluginTranslation: (translation) => set({ editorPluginTranslation: translation }),
        setEditorPluginTranslationPath: (path) => set({ editorPluginTranslationPath: path }),
        setEditorTheme: (translation, name, dir, translationPath) => set({
            editorThemeTranslation: translation,
            editorThemeName: name,
            editorThemeDir: dir,
            editorThemeTranslationPath: translationPath,
        }),
        triggerSourceUpdate: () => set((state) => ({ sourceUpdateTick: state.sourceUpdateTick + 1 })),
    }
})


const useGlobalStore = createSelectors(useGlobalStoreBase);

const useGlobalStoreInstance = useGlobalStoreBase;

export { useGlobalStore, useGlobalStoreInstance }
