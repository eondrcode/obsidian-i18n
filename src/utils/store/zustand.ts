import { StoreApi, UseBoundStore } from "zustand"

/**
 * 扩展 Zustand Store 类型的工具类型
 * 为原始 Store 增加一个 `use` 属性，该属性包含与 Store State 每个键对应的无参选择器钩子
 */
type WithSelectors<S> = S extends { getState: () => infer T } ? S & { use: { [K in keyof T]: () => T[K] } } : never

/**
 * Zustand Store 选择器钩子生成工具
 * 自动为 Zustand store 生成基于 State 字段的专属选择器钩子，挂载到 store.use 下
 * 无需手动编写 `useStore((s) => s.xxx)`，直接使用 `store.use.xxx()` 即可获取对应状态
 * 
 * @template S - 泛型约束：必须是 Zustand 的 UseBoundStore 类型（由 create() 创建的 store）
 * @param {S} _store - 原始的 Zustand store 实例（由 create() 方法返回）
 * @returns {WithSelectors<S>} 扩展后的 store 实例，新增 `use` 属性，包含所有 State 字段的选择器钩子
 */
export const createSelectors = <S extends UseBoundStore<StoreApi<object>>>(_store: S,): WithSelectors<S> => {
    const store = _store as WithSelectors<typeof _store>
    store.use = {}
    for (const k of Object.keys(store.getState())) { ; (store.use as any)[k] = () => store((s) => s[k as keyof typeof s]) }
    return store
}