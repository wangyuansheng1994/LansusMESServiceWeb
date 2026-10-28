/**
 * 骨架屏（2026-10-28）：替代加载转圈。
 * 形状对位最终布局——外壳骨架（会话校验 /me 期间整屏）与侧栏菜单骨架（菜单加载期间），
 * shimmer 动画表达加载中；数据到达后无缝替换，避免转圈的突兀与布局跳变。
 */

/** 菜单行文字条宽度（确定性伪随机，避免每次渲染闪烁变化） */
const MENU_BAR_WIDTHS = ['62%', '48%', '70%', '55%', '40%', '66%', '52%', '58%', '45%', '64%'];

/** 侧栏菜单骨架：深色底 + 图标方块/文字条，对位 antd Menu inline 结构 */
export function MenuSkeleton() {
  return (
    <div style={{ padding: '16px 16px' }} aria-label="菜单加载中">
      {MENU_BAR_WIDTHS.map((width, index) => (
        <div
          key={index}
          style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '11px 8px' }}
        >
          <span
            className="sk-line"
            style={{ width: 16, height: 16, flexShrink: 0, borderRadius: 3 }}
          />
          <span className="sk-line" style={{ width, height: 14 }} />
        </div>
      ))}
    </div>
  );
}

/** 外壳整体骨架：会话校验期间整屏对位 AppLayout 的静态轮廓（顶栏 80px + 深色侧栏 220px + 内容卡） */
export function ShellSkeleton() {
  return (
    <div
      aria-label="页面加载中"
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        background: '#f0f2f5',
      }}
    >
      {/* 顶栏 */}
      <div
        style={{
          height: 80,
          background: '#fff',
          borderBottom: '1px solid #e5e7eb',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          padding: '0 24px',
        }}
      >
        <span className="sk-line sk-light" style={{ width: 36, height: 36, borderRadius: 6 }} />
        <span className="sk-line sk-light" style={{ width: 180, height: 16 }} />
        <span style={{ flex: 1 }} />
        <span className="sk-line sk-light" style={{ width: 120, height: 28, borderRadius: 14 }} />
      </div>
      <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
        {/* 侧栏（对位 AppSiderMenu 的深色 220px） */}
        <div style={{ width: 220, flexShrink: 0, background: '#001529', paddingTop: 16 }}>
          <MenuSkeleton />
        </div>
        {/* 内容区 */}
        <div style={{ flex: 1, padding: 16 }}>
          <div style={{ background: '#fff', borderRadius: 8, padding: 24 }}>
            <span
              className="sk-line sk-light"
              style={{ display: 'block', width: 240, height: 20, marginBottom: 20 }}
            />
            <span
              className="sk-line sk-light"
              style={{
                display: 'block',
                width: '100%',
                height: 120,
                marginBottom: 16,
                borderRadius: 8,
              }}
            />
            <span
              className="sk-line sk-light"
              style={{ display: 'block', width: '90%', height: 14, marginBottom: 12 }}
            />
            <span
              className="sk-line sk-light"
              style={{ display: 'block', width: '75%', height: 14 }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
