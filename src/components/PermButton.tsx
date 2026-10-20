import { Button, type ButtonProps } from 'antd';
import { usePermStore } from '@/stores/permStore';

interface PermButtonProps extends ButtonProps {
  /** 权限码，格式见 stores/permStore.ts 顶部说明 */
  perm: string;
  /** 兜底节点，默认不渲染 */
  fallback?: React.ReactNode;
}

/**
 * 带权限控制的按钮。
 *
 * ⚠️ 前端权限只是体验优化。真正的安全边界在后端 @RequiresPermissions，
 *    否则用户 F12 直接调接口就能绕过。
 */
export function PermButton({ perm, fallback = null, ...rest }: PermButtonProps) {
  const loaded = usePermStore((s) => s.loaded);
  const has = usePermStore((s) => s.has(perm));

  // 权限未加载完 → 先禁用，避免"先显示后消失"的闪烁
  if (!loaded) return <Button {...rest} disabled loading />;
  if (!has) return <>{fallback}</>;
  return <Button {...rest} />;
}
