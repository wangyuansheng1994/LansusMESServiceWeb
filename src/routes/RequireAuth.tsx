import { useEffect, type ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '@/api/session';
import { ShellSkeleton } from '@/components/skeletons';

/**
 * 路由守卫。
 *
 * 会话检查策略：
 *  - 首次进入时调 checkSession()，通过 /api/v1/me 读取真实用户与权限
 *  - 未登录 → 跳本地 React 登录页，并在路由 state 中保留来源页面
 *
 * ⚠️ 这里【不做权限判断】，只判断"有没有登录"。
 *    权限是按钮/菜单级的（PermButton / 菜单过滤），
 *    而真正的安全边界在后端 Shiro 的 perms[] 校验。
 */
export function RequireAuth({ children }: { children: ReactNode }) {
  const ready = useAuthStore((s) => s.ready);
  const user = useAuthStore((s) => s.user);
  const checkSession = useAuthStore((s) => s.checkSession);
  const location = useLocation();

  useEffect(() => {
    if (!ready) {
      void checkSession().catch(() => {
        /* 网络类错误不误踢，checkSession 内部已处理未登录情况 */
      });
    }
  }, [ready, checkSession]);

  if (!ready) {
    // 会话校验（/me）期间展示外壳骨架（2026-10-28：替代整屏转圈，形状对位最终布局）
    return <ShellSkeleton />;
  }

  if (!user) {
    // 未登录：本地登录页（走老系统 Shiro 表单登录）
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  return <>{children}</>;
}
