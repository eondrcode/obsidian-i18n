import { StateCreator } from 'zustand';
import { RegexStore, DictSlice } from '../types';

export const createDictSlice: StateCreator<
    RegexStore,
    [],
    [],
    DictSlice
> = (set, get) => ({
    dictData: {},
    currentFile: 'main.js',
    searchQuery: '',
    sourceCache: {},

    setDictData: (data) => set({ dictData: data }),
    setSearchQuery: (query) => set({ searchQuery: query }),
    setSourceCache: (file, code) => set(state => ({ sourceCache: { ...state.sourceCache, [file]: code } })),

    setCurrentFile: (file) => {
        const { currentFile, astItems, regexItems, dictData } = get();

        // 1. 保存当前进度到原文件
        if (currentFile && dictData[currentFile]) {
            dictData[currentFile] = {
                ast: astItems.map(item => ({ type: item.type, name: item.name, source: item.source, target: item.target })),
                regex: regexItems.map(item => ({ source: item.source, target: item.target }))
            };
        }

        // 2. 切换到新文件
        set({ currentFile: file, dictData: { ...dictData } });

        // 3. 将新文件的数据分发到 astItems 和 regexItems (交由外部 useEffect 联动或者直接在这里调用)
        const nextFileData = dictData[file] || { ast: [], regex: [] };
        get().setAstItems(nextFileData.ast.map((item, index) => ({
            id: index,
            type: item.type,
            name: item.name,
            source: item.source,
            target: item.target,
        })));
        get().setRegexItems(nextFileData.regex.map((item, index) => ({
            id: index,
            source: item.source,
            target: item.target
        })));
    },

    addFile: (file) => {
        const { dictData } = get();
        if (dictData[file]) return; // 如果已存在，不重复添加

        const newData = { ...dictData };
        newData[file] = { ast: [], regex: [] };

        set({ dictData: newData });
        // 自动切换到新添加的文件
        get().setCurrentFile(file);
    },

    deleteFile: (file) => {
        const { dictData, currentFile } = get();
        if (!dictData[file]) return;

        const newData = { ...dictData };
        delete newData[file];

        set({ dictData: newData });

        // 如果删除的是当前正在编辑的文件，切换回 main.js 或第一个可用文件
        if (currentFile === file) {
            const nextFile = newData['main.js'] ? 'main.js' : Object.keys(newData)[0] || '';
            if (nextFile) {
                // 注意：这里不需要保存旧数据了，因为文件已删除
                set({ currentFile: nextFile });
                const nextData = newData[nextFile] || { ast: [], regex: [] };
                get().setAstItems(nextData.ast.map((item, index) => ({ ...item, id: index })));
                get().setRegexItems(nextData.regex.map((item, index) => ({ ...item, id: index })));
            }
        }
    },

    syncFileDictInfo: (file, newAstItems, newRegexItems) => {
        set((state) => {
            const newData = { ...state.dictData };
            newData[file] = {
                ast: newAstItems.map(item => ({ type: item.type, name: item.name, source: item.source, target: item.target })),
                regex: newRegexItems.map(item => ({ source: item.source, target: item.target }))
            };
            return { dictData: newData };
        });
    }
});
