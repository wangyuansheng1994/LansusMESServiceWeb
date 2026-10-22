import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Alert, Layout, Menu, Spin } from 'antd';
import type { MenuProps } from 'antd';
import { BugOutlined, ExperimentOutlined } from '@ant-design/icons';
import type { MenuNode } from '@/api/modules/home';
import { API_V1 } from '@/api/config';

const { Sider } = Layout;

type MenuItem = Required<MenuProps>['items'][number];

/**
 * 菜单图标（对位 menu.jsp）：
 *   L1 直接用 ad_menu.menu_img 全类名（menu.jsp:123/:133，remixicon/MDI）；
 *   L2 用 icon-{menu_img}（menu.jsp:171，FA3，空值回退 circle-arrow-right）；
 *   L3 叶子无图标（label 带 · 前缀，menu.jsp:175）。
 * 图标字体 CSS 在 index.html 引入（icons.min.css + FA3 font-awesome.css），勿删。
 */
function menuIcon(node: MenuNode): ReactNode {
  if (node.level === 1) {
    return node.icon ? <i className={node.icon} aria-hidden /> : undefined;
  }
  if (node.level === 2) {
    return <i className={`icon-${node.icon || 'circle-arrow-right'}`} aria-hidden />;
  }
  return undefined;
}

/** MenuNode → antd Menu item；叶子 key = 菜单 id，点击时查表拿 url */
function toMenuItem(node: MenuNode): MenuItem {
  const hasChildren = (node.children?.length ?? 0) > 0;
  return {
    key: node.id,
    icon: menuIcon(node),
    label: node.level === 3 ? `· ${node.name}` : node.name,
    children: hasChildren ? node.children.map(toMenuItem) : undefined,
  };
}

/** React 侧框架验证页（预览版保留，P0-c 联调验收通过后删除） */
const FRAME_ITEMS: MenuItem[] = [
  {
    key: 'frame-demo',
    icon: <ExperimentOutlined />,
    label: '框架验证（React 页）',
    children: [
      { key: '/demo/customer', label: '客户查询（真接口）' },
      { key: '/demo/errors', label: '错误处理验证', icon: <BugOutlined /> },
    ],
  },
];

/**
 * 菜单搜索过滤（对位老壳 main.jsp:182-187 的 findMenu 搜索框）。
 * 命中节点整棵子树保留；未命中但含命中后代的节点保留作骨架。
 * 名称匹配覆盖中/英/繁三列（ad_menu.menu_name/menu_name_en/menu_name_tc）。
 */
function filterMenuNodes(nodes: MenuNode[], keyword: string): MenuNode[] {
  const k = keyword.trim().toLowerCase();
  if (!k) return nodes;
  const walk = (list: MenuNode[]): MenuNode[] =>
    list
      .map((n) => {
        const name = `${n.name ?? ''}${n.nameEn ?? ''}${n.nameTc ?? ''}`.toLowerCase();
        if (name.includes(k)) return n;
        const children = n.children?.length ? walk(n.children) : [];
        if (children.length > 0) return { ...n, children };
        return null;
      })
      .filter((x): x is MenuNode => x !== null);
  return walk(nodes);
}

export interface AppSiderMenuProps {
  collapsed: boolean;
  onCollapse: (collapsed: boolean) => void;
  loading: boolean;
  error: boolean;
  onRetry: () => void;
  /** 后端 /home 返回的原始菜单树（undefined = 未加载完） */
  menuTree: MenuNode[] | undefined;
  /** 顶栏菜单搜索框的关键字（由 AppLayout 持有，两处同源） */
  keyword: string;
  /** 当前活动标签对应的菜单 id（用于高亮）；React 页/首页为 undefined */
  selectedMenuId?: string;
  /** 菜单项被点击（key 为菜单 id 或 React 路由）；分组/无 URL 由调用方过滤 */
  onMenuClick: (key: string) => void;
}

/**
 * 侧栏菜单：加载态/失败态/树渲染 + 搜索过滤 + 搜索时自动展开。
 * 侧栏独立于文档流（sticky + 定高 + 内部滚动），菜单层级再多也不会撑长页面。
 */
export function AppSiderMenu({
  collapsed,
  onCollapse,
  loading,
  error,
  onRetry,
  menuTree,
  keyword,
  selectedMenuId,
  onMenuClick,
}: AppSiderMenuProps) {
  const [openKeys, setOpenKeys] = useState<string[]>([]);

  const filteredNodes = useMemo(
    () => filterMenuNodes(menuTree ?? [], keyword),
    [menuTree, keyword],
  );
  const searching = keyword.trim().length > 0;

  const menuItems = useMemo<MenuItem[]>(() => {
    if (searching) return filteredNodes.map(toMenuItem); // 搜索时只显示命中的真实菜单
    if (!menuTree?.length) return FRAME_ITEMS;
    return [...menuTree.map(toMenuItem), ...FRAME_ITEMS];
  }, [menuTree, filteredNodes, searching]);

  // 搜索时自动展开全部命中分支；清空后收回
  useEffect(() => {
    if (!searching) {
      setOpenKeys([]);
      return;
    }
    const keys: string[] = [];
    const walk = (nodes: MenuNode[]) =>
      nodes.forEach((n) => {
        if (n.children?.length) {
          keys.push(n.id);
          walk(n.children);
        }
      });
    walk(filteredNodes);
    setOpenKeys(keys);
  }, [searching, filteredNodes]);

  const body = loading ? (
    <div style={{ padding: 24, textAlign: 'center' }}>
      <Spin size="large" tip="正在加载菜单…" />
    </div>
  ) : error ? (
    <div style={{ padding: 16 }}>
      <Alert
        type="error"
        showIcon
        message="菜单加载失败"
        description={`无法连接后端菜单接口（${API_V1}/home），请确认本地 Tomcat 已启动。`}
        action={
          <a onClick={onRetry} style={{ fontSize: 12 }}>
            重试
          </a>
        }
      />
    </div>
  ) : (
    <Menu
      theme="dark"
      mode="inline"
      className="app-sider-menu"
      selectedKeys={selectedMenuId ? [selectedMenuId] : []}
      openKeys={openKeys}
      onOpenChange={(keys) => setOpenKeys(keys as string[])}
      onClick={({ key }) => onMenuClick(String(key))}
      items={menuItems}
    />
  );

  return (
    <Sider
      collapsible
      collapsed={collapsed}
      onCollapse={onCollapse}
      trigger={null}
      theme="dark"
      width={220}
      className="app-sider"
      style={{
        position: 'sticky',
        top: 80,
        height: 'calc(100vh - 80px)',
        overflow: 'auto',
        alignSelf: 'flex-start',
      }}
    >
      {body}
    </Sider>
  );
}
