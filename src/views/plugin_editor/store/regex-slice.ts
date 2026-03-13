import { StateCreator } from 'zustand';
import { PluginTranslationV1Regex } from '@/src/types';
import { RegexItem, RegexStore, RegexSlice } from '../types';

export const createRegexSlice: StateCreator<RegexStore, [], [], RegexSlice> = (set) => ({
    regexItems: [],

    setRegexItems: (items: RegexItem[]) => {
        set({ regexItems: items });
    },

    addRegexItem: (newItem: RegexItem) => {
        set((state) => {
            const nextId = state.regexItems.length > 0 ? Math.max(...state.regexItems.map(item => item.id)) + 1 : 0;
            return {
                regexItems: [...state.regexItems, { ...newItem, id: nextId }]
            };
        });
    },

    updateRegexItem: (id: number, updates: Partial<PluginTranslationV1Regex>) => {
        set((state) => ({
            regexItems: state.regexItems.map(item =>
                item.id === id ? { ...item, ...updates } : item
            ),
        }));
    },

    updateRegexItems: (items) => {
        set((state) => {
            const updatesMap = new Map(items.map(i => [i.id, i.updates]));
            return {
                regexItems: state.regexItems.map(item => {
                    const updates = updatesMap.get(item.id);
                    return updates ? { ...item, ...updates } : item;
                })
            };
        });
    },

    deleteRegexItem: (id: number) => {
        set((state) => ({
            regexItems: state.regexItems.filter(item => item.id !== id),
        }));
    },

    resetRegexItem: (id: number) => {
        set((state) => ({
            regexItems: state.regexItems.map(item =>
                item.id === id ? { ...item, target: item.source } : item
            ),
        }));
    },

    deleteUntranslatedRegexItems: () => set((state) => ({
        regexItems: state.regexItems.filter(item => item.target && item.target !== item.source && item.target.trim() !== '')
    })),
});
