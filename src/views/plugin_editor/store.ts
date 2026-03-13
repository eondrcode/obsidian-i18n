import { create } from 'zustand';
import { createSelectors } from '.';
import { RegexStore } from './types';
import { createRegexSlice } from './store/regex-slice';
import { createAstSlice } from './store/ast-slice';
import { createMetadataSlice } from './store/metadata-slice';
import { createDictSlice } from './store/dict-slice';


// ======================== Zustand Store 定义 ========================
// 创建 Store（核心）
const useRegexStoreBase = create<RegexStore>()((...a) => ({
    ...createRegexSlice(...a),
    ...createAstSlice(...a),
    ...createMetadataSlice(...a),
    ...createDictSlice(...a),
}));

const useRegexStore = createSelectors(useRegexStoreBase);

export { useRegexStore }; 