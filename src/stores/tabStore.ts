/**
 * 多标签页 store（对位老壳 jerichoTab）。
 *
 * ── 与老壳 main.jsp 的行为对齐 ─────────────────────────────────
 *   - 固定「首页」标签：老壳 initJerichoTab 的第一个 tab（closeable:false，
 *     iframe 指向 ${ctx}/main/main/taskTodo）→ 这里 pinned 且永远排第一
 *   - 菜单点击开新标签：已存在则只激活（老 jerichoTab 同 title 复用）
 *   - 标签保留不重载：老壳 loadOnce:true → 配合 AppLayout 的 keep-alive
 *     渲染（所有标签常驻 DOM、display:none 切换），iframe 不重新加载
 *   - 老壳用户习惯"开一堆不关" → 设上限 + LRU 淘汰（方案 v3.1 §7.5），
 *     防止 iframe 无限堆积导致内存膨胀
 *
 * ── 持久化 ─────────────────────────────────────────────────────
 *   sessionStorage（方案 v3.1 §7.3：标签页状态刷新恢复，对齐 jerichotab
 *   习惯），key 带 `mes:` 前缀与版本号；登出时由 session.ts 显式清除。
 */
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

export interface TabItem {
  /** 路由 key = pathname + search（如 /legacy?src=…&name=…），深链接可还原 */
  key: string;
  title: string;
  closable: boolean;
  /** 首页固定标签：不可关闭、不参与 LRU 淘汰 */
  pinned?: boolean;
  lastActive: number;
}

/** 老壳固定首页：iframe 待办页（main.jsp:75-80） */
export const HOME_TAB_KEY = '/home';

/** 可关闭标签上限（方案 v3.1 §7.5 建议值）；首页不计入 */
export const MAX_CLOSABLE_TABS = 10;

const homeTab = (): TabItem => ({
  key: HOME_TAB_KEY,
  title: '首页',
  closable: false,
  pinned: true,
  lastActive: Date.now(),
});

interface TabState {
  tabs: TabItem[];
  activeKey: string;
  /** 打开（或激活）标签；超出上限时按 LRU 淘汰最旧的可关闭标签 */
  openTab: (tab: { key: string; title: string; closable?: boolean }) => void;
  closeTab: (key: string) => void;
  /** 关闭除 key 与首页外的所有标签 */
  closeOthers: (key: string) => void;
  /** 关闭全部可关闭标签，回到首页 */
  closeAll: () => void;
  setActive: (key: string) => void;
  reset: () => void;
}

export const useTabStore = create<TabState>()(
  persist(
    (set) => ({
      tabs: [homeTab()],
      activeKey: HOME_TAB_KEY,

      openTab: ({ key, title, closable = true }) => {
        const now = Date.now();
        set((state) => {
          const existing = state.tabs.find((t) => t.key === key);
          if (existing) {
            return {
              tabs: state.tabs.map((t) => (t.key === key ? { ...t, title, lastActive: now } : t)),
              activeKey: key,
            };
          }

          let tabs = [...state.tabs, { key, title, closable, lastActive: now }];
          // LRU 淘汰：只动可关闭且不固定的标签，首页永不淘汰
          const closableTabs = tabs.filter((t) => t.closable && !t.pinned);
          if (closableTabs.length > MAX_CLOSABLE_TABS) {
            const evictKey = closableTabs.reduce((oldest, t) =>
              t.lastActive < oldest.lastActive ? t : oldest,
            ).key;
            tabs = tabs.filter((t) => t.key !== evictKey);
          }
          return { tabs, activeKey: key };
        });
      },

      closeTab: (key) => {
        set((state) => {
          const tab = state.tabs.find((t) => t.key === key);
          if (!tab || !tab.closable || tab.pinned) return state;
          const tabs = state.tabs.filter((t) => t.key !== key);
          // 关闭的是活动标签 → 激活右侧邻居，没有就左侧，兜底首页
          let activeKey = state.activeKey;
          if (activeKey === key) {
            const idx = state.tabs.findIndex((t) => t.key === key);
            activeKey = tabs[Math.min(idx, tabs.length - 1)]?.key ?? HOME_TAB_KEY;
          }
          return { tabs, activeKey };
        });
      },

      closeOthers: (key) => {
        set((state) => ({
          tabs: state.tabs.filter((t) => t.pinned || t.key === key),
          activeKey: key,
        }));
      },

      closeAll: () => {
        set((state) => ({
          tabs: state.tabs.filter((t) => t.pinned),
          activeKey: HOME_TAB_KEY,
        }));
      },

      setActive: (key) => {
        set((state) => ({
          activeKey: key,
          tabs: state.tabs.map((t) => (t.key === key ? { ...t, lastActive: Date.now() } : t)),
        }));
      },

      reset: () => set({ tabs: [homeTab()], activeKey: HOME_TAB_KEY }),
    }),
    {
      name: 'mes:tabs:v1',
      storage: createJSONStorage(() => sessionStorage),
      partialize: (state) => ({ tabs: state.tabs, activeKey: state.activeKey }),
      // 老版本/脏数据兜底：恢复出来的数据若缺首页标签则补回
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<TabState>;
        const tabs = Array.isArray(p.tabs) && p.tabs.length > 0 ? p.tabs : [homeTab()];
        const hasHome = tabs.some((t) => t.key === HOME_TAB_KEY);
        return {
          ...current,
          tabs: hasHome ? tabs : [homeTab(), ...tabs],
          activeKey:
            typeof p.activeKey === 'string' && tabs.some((t) => t.key === p.activeKey)
              ? p.activeKey
              : HOME_TAB_KEY,
        };
      },
    },
  ),
);

/** 登出时调用：清 sessionStorage 里的标签状态（全页跳转前执行） */
export function clearTabStorage(): void {
  useTabStore.getState().reset();
  try {
    sessionStorage.removeItem('mes:tabs:v1');
  } catch {
    /* 隐私模式等场景下 sessionStorage 不可写，忽略 */
  }
}
