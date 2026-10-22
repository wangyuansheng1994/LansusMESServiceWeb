import { useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Alert } from 'antd';
import { toLegacyUrl } from '@/api/modules/home';

export interface LegacyPageProps {
  /**
   * 老 menuUrl 原值（不带 /console 前缀），由 toLegacyUrl 统一拼。
   * 多标签 keep-alive 渲染时由 pageRegistry 显式传入——
   * 非活动标签不能用 useSearchParams（会读到当前 URL 而不是自己的）。
   * 不传时回退到 URL 查询串（直接访问 /legacy?src=… 的深链接场景）。
   */
  src?: string | null;
  name?: string | null;
}

/**
 * 老 JSP 页面容器（迁移期核心组件）。
 *
 * 同源 iframe 直接共享 pw.session.id Cookie —— 老 JSP 无需任何改动
 * 就能在 React 外壳里正常打开（方案 v3.1 §2.1）。
 *
 * 路由形态：/legacy?src=<encodeURIComponent(menuUrl)>&name=<菜单名>
 *   - src 传【老 menuUrl 原值】（不带 /console 前缀），由 toLegacyUrl 统一拼，
 *     拼法与老 menu.jsp:162 一致。
 *   - 含 "://" 的外部地址【同样进 iframe】——老壳 menu.jsp:79-92 就是把外链
 *     塞进 jerichoTab 的 iframe 页签；2026-10-21 评审前曾写成整页跳转
 *     （window.location.href），既是渲染期副作用又构成开放重定向，已修正。
 *   - 深链接可还原：刷新 / 收藏 / 分享后同一 URL 重开同一页面。
 *
 * framework-preview 说明：jerichotab 兼容 shim（376 文件/807 处
 * window.parent 调用的兼容层）是 P1 退出标准，本预览版未实现 ——
 * 个别重度依赖父窗口的老页面在外壳内可能有交互降级，属已知限制。
 */
export function LegacyPage({ src: srcProp, name: nameProp }: LegacyPageProps = {}) {
  const [searchParams] = useSearchParams();
  const srcParam = srcProp ?? searchParams.get('src');
  const name = nameProp ?? searchParams.get('name') ?? '老页面';

  const finalSrc = useMemo(() => {
    if (!srcParam) return null;
    try {
      return toLegacyUrl(decodeURIComponent(srcParam));
    } catch {
      return toLegacyUrl(srcParam);
    }
  }, [srcParam]);

  if (!finalSrc) {
    return (
      <Alert
        type="warning"
        showIcon
        message="缺少老页面地址"
        description="请从左侧菜单进入老页面；直接访问 /legacy 需要带 ?src= 参数。"
      />
    );
  }

  return (
    <iframe
      title={name}
      src={finalSrc}
      style={{
        width: '100%',
        height: '100%',
        border: 'none',
        background: '#fff',
        display: 'block',
      }}
    />
  );
}
