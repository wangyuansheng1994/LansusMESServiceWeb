/**
 * 权限 store。
 *
 * ── 现状：老系统已有两层权限，数据模型现成 ─────────────────────
 *   菜单级：Menu.permission                （entity/main/Menu.java:21）
 *   按钮级：AdMenuButton.buttonCode        （entity/base/ad/AdMenuButton.java:16）
 *   配套 Controller/Service/Dao 全都在。
 *
 * ── 设计决策：一次拿全量权限码集合，前端本地判断 ────────────────
 *   不要逐个调 Subject.isPermitted(code) 问后端 —— 一个列表页可能有 10+ 个
 *   按钮，就是 10+ 次网络往返。
 *
 * ── ⚠️ 前端权限只是体验，不是安全边界 ─────────────────────────
 *   这里控制的是"按钮显不显示"。真正的防线是后端 —— 老系统已经用
 *   Shiro 的 perms[...] 在跑（如 /html/act/rest/service/editor/** = perms[act:model:edit]）。
 *   新增的 /api/v1/** 接口必须在后端补 @RequiresPermissions，否则会出现
 *   "前端按钮藏了，用户 F12 直接 POST 接口把数据删了"。
 */
import { create } from 'zustand';

interface PermState {
  perms: Set<string>;
  /** 权限是否已加载完成。未完成时 has() 返回 false，避免"先渲染再隐藏"的闪烁 */
  loaded: boolean;
  setPerms: (codes: string[]) => void;
  reset: () => void;
  has: (code: string) => boolean;
  /** 任意一个命中即可 */
  hasAny: (codes: string[]) => boolean;
  /** 全部命中 */
  hasAll: (codes: string[]) => boolean;
}

export const usePermStore = create<PermState>((set, get) => ({
  perms: new Set<string>(),
  loaded: false,

  setPerms: (codes) => set({ perms: new Set(codes), loaded: true }),
  reset: () => set({ perms: new Set<string>(), loaded: false }),

  has: (code) => get().perms.has(code),
  hasAny: (codes) => codes.some((c) => get().perms.has(c)),
  hasAll: (codes) => codes.every((c) => get().perms.has(c)),
}));

/**
 * 权限码格式待确认 ⚠️
 *
 * Shiro filterChain 里用的是【冒号三段式】：
 *     /html/act/rest/service/editor/** = perms[act:model:edit]
 *
 * 但 AdMenuButton.buttonCode 里实际存什么格式，无法从源码确定 ——
 * SystemAuthorizingRealm 在依赖 jar 里（sources jar 是空的），读不到它
 * 怎么把 buttonCode 组装成权限码。
 *
 * 【开工第一天必须做，5 分钟】：
 *     SELECT button_code, button_name FROM ad_menu_button WHERE ROWNUM <= 30;
 *     SELECT permission FROM ad_menu WHERE permission IS NOT NULL AND ROWNUM <= 30;
 * 拿到真实格式后，下面的常量才能对齐。
 * 猜错的结果是：所有按钮永远不显示，或者永远显示。
 */
export const PERM = {
  /** 占位示例，等确认 buttonCode 格式后替换 */
  DEMO_EXPORT: 'BASE:MD:CUSTOMER:EXPORT',
} as const;
