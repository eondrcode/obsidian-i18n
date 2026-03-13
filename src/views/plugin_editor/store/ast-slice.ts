import { StateCreator } from 'zustand';
import { RegexStore, AstSlice, AstItem } from '../types';

export const createAstSlice: StateCreator<RegexStore, [], [], AstSlice> = (set) => ({
    astItems: [],

    setAstItems: (items: AstItem[]) => set({ astItems: items }),

    addAstItem: (newItem: AstItem) => set((state) => {
        const nextId = state.astItems.length > 0 ? Math.max(...state.astItems.map(item => item.id)) + 1 : 0;
        return {
            astItems: [...state.astItems, { ...newItem, id: nextId }]
        };
    }),

    updateAstItem: (id: number, target: string) => set((state) => ({
        astItems: state.astItems.map(item =>
            item.id === id ? { ...item, target } : item
        ),
    })),

    deleteAstItem: (id: number) => set((state) => ({
        astItems: state.astItems.filter(item => item.id !== id),
    })),

    resetAstItem: (id: number) => set((state) => ({
        astItems: state.astItems.map(item =>
            item.id === id ? { ...item, target: item.source } : item
        ),
    })),

    updateAstItems: (items) => {
        set((state) => {
            const updatesMap = new Map(items.map(i => [i.id, i.updates]));
            return {
                astItems: state.astItems.map(item => {
                    const updates = updatesMap.get(item.id);
                    return updates ? { ...item, ...updates } : item;
                })
            };
        });
    },

    deleteUntranslatedAstItems: () => set((state) => ({
        astItems: state.astItems.filter(item => item.target && item.target !== item.source && item.target.trim() !== '')
    })),
});
