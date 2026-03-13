import { StateCreator } from 'zustand';
import { PluginTranslationV1Metadata } from '@/src/types';
import { RegexStore, MetadataSlice } from '../types';

export const createMetadataSlice: StateCreator<RegexStore, [], [], MetadataSlice> = (set) => ({
    metadata: null,

    setMetadata: (metadata: PluginTranslationV1Metadata) => {
        set({ metadata });
    },

    updateMetadata: (updates: Partial<PluginTranslationV1Metadata>) => {
        set((state) => ({
            metadata: state.metadata ? { ...state.metadata, ...updates } : null
        }));
    },
});
