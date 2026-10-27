/**
 * 会话保活 + 认证。
 *
 * ── 为什么保留 session 而不是换 token ──────────────────────────
 *
 * 这个项目的认证与权限解析在 SystemAuthorizingRealm 里，而它【不在工作区源码里】：
 *   - 全仓库搜不到 SystemAuthorizingRealm.java
 *   - 只在 spring-context-shiro.xml:100 被 <property name="realm" ref="..."/> 引用
 *   - 只在 2 个文件里被 import
 *   - 它的 sources jar 是 1 KB（空的）
 * 也就是说安全层的实现读不到、改不动。换 token 必然形成"两套认证并行"，
 * 登录态/超时/权限缓存在两套系统间对不齐 —— 这是最坏的结果。
 *
 * 而同源反代部署下 cookie 自动携带、自动过期、自动跨标签页共享，
 * session 本身就是一个更安全的 token（HttpOnly 防 XSS，浏览器托管）。
 *
 * ── 真正要补的是 session 缺失的三个配套能力 ────────────────────
 *   ① 心跳保活 —— 后端 session.sessionTimeout=1800000ms(30min)，
 *      用户填长表单时中间无请求会静默过期，提交时跳登录、数据全丢
 *   ② 可见性联动 —— 标签页隐藏时停跳，避免多标签页一起打后端
 *   ③ 登录跳转前保存现场 —— 见 useFormDraft
 */
import { create } from 'zustand';
import { get, post } from './request';
import { ApiError } from './types';
import { setUnauthenticatedHandler } from './query';
import { clearTabStorage } from '@/stores/tabStore';
import { usePermStore } from '@/stores/permStore';
import { ADMIN_PATH, API_V1, appUrl } from './config';

export interface CurrentUser {
  userCode: string;
  userName?: string;
  /** 按钮级权限码集合（来自 ad_menu_button.button_code） */
  perms?: string[];
}

interface AuthState {
  user: CurrentUser | null;
  /** undefined = 未检查；null = 未登录 */
  ready: boolean;
  checking: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  /** 检查会话是否有效（App 启动时调一次） */
  checkSession: () => Promise<boolean>;
  setUser: (u: CurrentUser | null) => void;
}

/** 真实用户与权限接口；心跳使用独立的 session/ping。 */
const ME_API = `${API_V1}/me`;

/** 仅用于兼容未部署 /me 的旧适配层。 */
const FALLBACK_PROBE_API = `${ADMIN_PATH}/md/mdCustomer/mdCustLookUp`;

export const useAuthStore = create<AuthState>((set, getState) => ({
  user: null,
  ready: false,
  checking: false,

  setUser: (u) => set({ user: u }),

  /**
   * 复用桌面登录的自定义 token 和 SystemAuthorizingRealm。
   * 成功后在同一 Shiro Session 下读取真实用户与权限，老 JSP 共享该会话。
   */
  async login(username, password) {
    const body = new URLSearchParams({ loginName: username, password }).toString();

    await post<unknown>(`${API_V1}/auth/login`, body, {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      timeout: 30_000,
    });

    // 登录成功（pw.session.id 已 Set-Cookie），拉用户信息（失败也不阻塞登录流程）
    await getState().checkSession();
  },

  async logout() {
    try {
      await get<string>(`${ADMIN_PATH}/logout`, undefined, { raw: true });
    } catch {
      // 忽略：登出失败也要清本地状态
    }
    set({ user: null });
    // 登出双边清理：标签页状态与权限集一并清掉（老壳退出后重进也只有「首页」）
    clearTabStorage();
    usePermStore.getState().reset();
    window.location.href = appUrl('/login');
  },

  /**
   * 探活。
   * 返回 true 表示会话有效。
   */
  async checkSession() {
    if (getState().checking) return getState().user !== null;
    set({ checking: true });

    try {
      // 优先用新增的 /api/v1/me
      const me = await get<CurrentUser>(ME_API);
      set({ user: me, ready: true, checking: false });
      // 接通权限链：/me 下发的全量权限码写入 permStore（PermButton/usePerm 才有子弹）
      usePermStore.getState().setPerms(me.perms ?? []);
      return true;
    } catch (e) {
      // /api/v1/me 还没实现（404/badResponse）→ 退化为探活老接口
      const notImplemented =
        e instanceof ApiError &&
        (e.kind === 'badResponse' || (e.httpStatus !== undefined && e.httpStatus === 404));

      if (notImplemented) {
        try {
          await get(FALLBACK_PROBE_API, { pageSize: 1 });
          // 能拿到数据说明会话有效，但拿不到用户信息；/me 缺失期间权限集置空（fail-closed）
          usePermStore.getState().setPerms([]);
          set({ user: { userCode: '(未提供 /api/v1/me)' }, ready: true, checking: false });
          return true;
        } catch (probeErr) {
          if (probeErr instanceof ApiError && probeErr.kind === 'unauthenticated') {
            set({ user: null, ready: true, checking: false });
            return false;
          }
          // 其它错误（网络/超时）不判定为未登录，避免误踢
          set({ ready: true, checking: false });
          throw probeErr;
        }
      }

      if (e instanceof ApiError && e.kind === 'unauthenticated') {
        set({ user: null, ready: true, checking: false });
        return false;
      }

      set({ ready: true, checking: false });
      throw e;
    }
  },
}));

// ─────────────────────────────────────────────────────────────
// 心跳保活
// ─────────────────────────────────────────────────────────────

/**
 * ★ 心跳间隔必须远小于后端 session 超时（30min）。
 *   5 分钟一次：任何时刻都至少还有 25 分钟余量。
 */
const HEARTBEAT_MS = 5 * 60_000;
const MAX_BACKOFF_MS = 10 * 60_000;

let timer: number | undefined;
let backoff = HEARTBEAT_MS;
let visibilityBound = false;

async function ping(): Promise<void> {
  try {
    // 专用心跳只续期，不重复读取权限，也不写普通操作审计。
    await get(`${API_V1}/session/ping`);
    backoff = HEARTBEAT_MS; // 成功，恢复正常节奏
  } catch (e) {
    // 心跳失败不弹提示 —— 断网时用户不该被心跳刷屏
    if (e instanceof ApiError && e.kind === 'unauthenticated') {
      useAuthStore.setState({ user: null });
      redirectToLogin('timeout');
      return;
    }
    backoff = Math.min(backoff * 2, MAX_BACKOFF_MS);
  } finally {
    if (timer !== undefined) {
      timer = window.setTimeout(() => void ping(), backoff);
    }
  }
}

export function startHeartbeat(): void {
  stopHeartbeat();
  timer = window.setTimeout(() => void ping(), HEARTBEAT_MS);

  // 可见性联动：切回来立刻验活；隐藏时停跳，避免多标签页一起打后端
  if (!visibilityBound) {
    visibilityBound = true;
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        void ping();
        startHeartbeat();
      } else {
        stopHeartbeat();
      }
    });
  }
}

export function stopHeartbeat(): void {
  if (timer !== undefined) {
    window.clearTimeout(timer);
    timer = undefined;
  }
}

/**
 * 统一跳登录页：停心跳、记住当前路由以便回来；
 * reason=timeout 时登录页显示"登录已超时，请重新登录"（SYS-0001 文案，
 * 老系统无此提示，2026-10-22 经负责人确认补充）。
 */
function redirectToLogin(reason?: 'timeout'): void {
  stopHeartbeat();
  const here = window.location.pathname + window.location.search;
  const next = encodeURIComponent(here);
  const suffix = reason ? `&reason=${reason}` : '';
  window.location.href = `${appUrl('/login')}?redirect=${next}${suffix}`;
}

/** 由 App 注入：收到未登录时跳 React 登录页，并记住当前路由以便回来 */
export function installUnauthenticatedHandler(): void {
  setUnauthenticatedHandler(() => redirectToLogin('timeout'));
}
