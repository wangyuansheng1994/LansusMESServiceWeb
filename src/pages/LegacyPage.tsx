import { useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Alert, Spin, Typography } from 'antd';
import { toLegacyUrl } from '@/api/modules/home';

/**
 * 老 JSP 页面容器（迁移期核心组件）。
 *
 * 同源 iframe 直接共享 pw.session.id Cookie —— 老 JSP 无需任何改动
 * 就能在 React 外壳里正常打开（方案 v3.1 §2.1）。
 *
 * 路由形态：/legacy?src=<encodeURIComponent(menuUrl)>&name=<菜单名>
 *   - src 传【老 menuUrl 原值】（不带 /console 前缀），由 toLegacyUrl 统一拼，
 *     拼法与老 menu.jsp:162 一致（含 :// 的原样用）。
 *   - 深链接可还原：刷新 / 收藏 / 分享后同一 URL 重开同一页面。
 *
 * framework-preview 说明：jerichotab 兼容 shim（376 文件/807 处
 * window.parent 调用的兼容层）是 P1 退出标准，本预览版未实现 ——
 * 个别重度依赖父窗口的老页面在外壳内可能有交互降级，属已知限制。
 */
export function LegacyPage() {
  const [searchParams] = useSearchParams();
  const srcParam = searchParams.get('src');
  const name = searchParams.get('name') ?? '老页面';

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

  // 含 :// 的外部地址：老系统行为是整页打开，这里保持整页跳转而不是 iframe 嵌入
  if (finalSrc.includes('://')) {
    window.location.href = finalSrc;
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: 80 }}>
        <Spin size="large" tip="正在打开外部页面…" />
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <Typography.Text type="secondary" style={{ marginBottom: 8, fontSize: 12 }}>
        旧版页面（JSP · iframe 嵌入）：{name}
      </Typography.Text>
      <iframe
        title={name}
        src={finalSrc}
        style={{
          flex: 1,
          width: '100%',
          minHeight: 'calc(100vh - 160px)',
          border: '1px solid #f0f0f0',
          borderRadius: 4,
          background: '#fff',
        }}
      />
    </div>
  );
}
