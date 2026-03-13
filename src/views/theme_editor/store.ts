import { create } from 'zustand';
import { createSelectors } from '~/utils';
import { ThemeEditorStore } from './types';

// ======================== Zustand Store 定义 ========================
const useThemeEditorStoreBase = create<ThemeEditorStore>()((set, get) => ({
    // ========== 基础状态 ==========
    items: [],
    metadata: null,
    themeName: '',
    themeDir: '',
    translationPath: '',
    isTranslating: false,
    progress: 0,
    processedCount: 0,
    totalCount: 0,
    overwrite: false,

    // ========== 条目操作 ==========
    setItems: (items) => set({ items }),

    addItem: (item) => set((state) => ({
        items: [...state.items, item]
    })),

    updateItem: (id, target) => set((state) => ({
        items: state.items.map(item =>
            item.id === id ? { ...item, target } : item
        )
    })),

    deleteItem: (id) => set((state) => ({
        items: state.items.filter(item => item.id !== id)
    })),

    resetItem: (id) => set((state) => ({
        items: state.items.map(item =>
            item.id === id ? { ...item, target: item.source } : item
        )
    })),

    updateItems: (updates) => set((state) => {
        const updateMap = new Map(updates.map(u => [u.id, u.target]));
        return {
            items: state.items.map(item => {
                const newTarget = updateMap.get(item.id);
                return newTarget !== undefined ? { ...item, target: newTarget } : item;
            })
        };
    }),

    deleteUntranslatedItems: () => set((state) => ({
        items: state.items.filter(item => item.target && item.target !== item.source)
    })),

    // ========== 元信息操作 ==========
    setMetadata: (metadata) => set({ metadata }),

    updateMetadata: (updates) => set((state) => ({
        metadata: state.metadata ? { ...state.metadata, ...updates } : null
    })),

    setThemeInfo: (name, dir, translationPath) => set({
        themeName: name,
        themeDir: dir,
        translationPath,
    }),

    setTranslationStatus: (status) => set((state) => ({
        ...state,
        ...status
    })),
}));

const useThemeEditorStore = createSelectors(useThemeEditorStoreBase);

export { useThemeEditorStore };
