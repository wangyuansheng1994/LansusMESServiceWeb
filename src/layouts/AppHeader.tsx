import { Avatar, Button, Dropdown, Input, Layout, Space, Tooltip, Typography } from 'antd';
import {
  FullscreenExitOutlined,
  FullscreenOutlined,
  HistoryOutlined,
  LogoutOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  SearchOutlined,
  UserOutlined,
} from '@ant-design/icons';
import { CONTEXT_PATH } from '@/api/config';

const { Header } = Layout;

export interface AppHeaderProps {
  collapsed: boolean;
  onToggleCollapse: () => void;
  menuKeyword: string;
  onMenuKeywordChange: (value: string) => void;
  onOpenHistory: () => void;
  isFullscreen: boolean;
  onToggleFullscreen: () => void;
  userName: string;
  onLogout: () => void;
}

/**
 * 全宽顶栏（对位老壳 #page-topbar：大 logo + 折叠按钮 + 菜单搜索 + 右侧功能区）。
 * 纯展示组件，所有状态与回调由 AppLayout 注入。
 */
export function AppHeader({
  collapsed,
  onToggleCollapse,
  menuKeyword,
  onMenuKeywordChange,
  onOpenHistory,
  isFullscreen,
  onToggleFullscreen,
  userName,
  onLogout,
}: AppHeaderProps) {
  return (
    <Header
      style={{
        background: '#fff',
        padding: '0 16px',
        height: 80,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderBottom: '1px solid #f0f0f0',
        position: 'sticky',
        top: 0,
        zIndex: 20,
      }}
    >
      <Space size={16} style={{ minWidth: 0 }}>
        {/* 嘉辰 logo（老壳 main.jsp:167-174：img height=80 放在 ~80px 高顶栏里），
            原图 1274x417，按老壳比例 height:64 等比缩放。
            用 CSS 背景而非 <img>：img 元素在 flex/行高环境下的基线对齐会把图顶出顶栏。
            折叠时缩为缩略图（老壳折叠后 logo 全隐藏；经负责人同意 DIY 缩略图：
            同一图片按背景定位裁出 ASPANSE 的 "A" 字形，无新增图片资产） */}
        {collapsed ? (
          <div
            role="img"
            aria-label="嘉辰"
            style={{
              width: 40,
              height: 40,
              flexShrink: 0,
              backgroundImage: `url('${CONTEXT_PATH}/html/assets/images/JC-logo2.jpg')`,
              backgroundSize: '268px 88px',
              backgroundPosition: '-19px -2px',
              backgroundRepeat: 'no-repeat',
            }}
          />
        ) : (
          <div
            role="img"
            aria-label="嘉辰"
            style={{
              width: 196,
              height: 64,
              flexShrink: 0,
              backgroundImage: `url('${CONTEXT_PATH}/html/assets/images/JC-logo2.jpg')`,
              backgroundSize: 'contain',
              backgroundRepeat: 'no-repeat',
              backgroundPosition: 'center',
            }}
          />
        )}
        {/* 侧栏折叠（对位老壳 main.jsp:177 的 vertical-menu-btn） */}
        <Button
          type="text"
          aria-label="折叠菜单"
          icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
          onClick={onToggleCollapse}
        />
        {/* 菜单搜索框（对位老壳 main.jsp:182-187，老壳在顶栏、圆角胶囊形） */}
        <Input
          allowClear
          variant="filled"
          prefix={<SearchOutlined style={{ color: 'rgba(0,0,0,0.35)' }} />}
          placeholder="搜索菜单…"
          value={menuKeyword}
          onChange={(e) => onMenuKeywordChange(e.target.value)}
          style={{ width: 260, borderRadius: 999 }}
        />
      </Space>

      <Space size={4}>
        {/* 系统升级历史（对位老壳 main.jsp:220-224 图标入口） */}
        <Tooltip title="系统升级历史">
          <Button type="text" icon={<HistoryOutlined />} onClick={onOpenHistory} />
        </Tooltip>
        {/* 全屏（对位老壳 main.jsp:227-231） */}
        <Tooltip title={isFullscreen ? '退出全屏' : '全屏'}>
          <Button
            type="text"
            icon={isFullscreen ? <FullscreenExitOutlined /> : <FullscreenOutlined />}
            onClick={onToggleFullscreen}
          />
        </Tooltip>
        <Dropdown
          menu={{
            items: [
              {
                key: 'logout',
                icon: <LogoutOutlined />,
                label: '退出登录',
                onClick: onLogout,
              },
            ],
          }}
        >
          <Space style={{ cursor: 'pointer' }}>
            {/* 用户头像（对位老壳 main.jsp:324 的 avatar-2.jpg），加载失败回退图标 */}
            <Avatar
              size="small"
              src={`${CONTEXT_PATH}/html/assets/images/users/avatar-2.jpg`}
              icon={<UserOutlined />}
            />
            {/* /me 已被后端移除期间，用户显示名从 /home 取（与 menu.jsp 同源） */}
            <Typography.Text>{userName}</Typography.Text>
          </Space>
        </Dropdown>
      </Space>
    </Header>
  );
}
