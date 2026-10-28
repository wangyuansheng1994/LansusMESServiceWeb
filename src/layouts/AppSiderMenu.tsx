import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Alert, Layout, Menu } from 'antd';
import { MenuSkeleton } from '@/components/skeletons';
import type { MenuProps } from 'antd';
import { BugOutlined, ExperimentOutlined } from '@ant-design/icons';
import type { MenuNode } from '@/api/modules/home';
import { API_V1 } from '@/api/config';

const { Sider } = Layout;

type MenuItem = Required<MenuProps>['items'][number];

/**
 * 菜单图标（对位 menu.jsp 的【实际渲染效果】，2026-10-28 修正）：
 *   只有 L1 渲染 ad_menu.menu_img 全类名图标（remixicon/MDI，icons.min.css 提供）。
 *   L2/L3 不渲染任何图标 —— 老系统虽写了 icon-*（FA3 类名），但 menu.jsp 只加载
 *   FA4.6（无 icon-* 类），这些 <i> 从未渲染出来：L2 的折叠箭头来自 metismenu
 *   has-arrow CSS（新壳由 antd 自带展开箭头对位），L3 只有「·名字」。
 *   曾给 L2/L3 渲染 icon-{menu_img} 回退 circle-arrow-right，导致多出箭头图标
 *   与空占位（负责人实测反馈），与老系统视觉不符，故移除。
 */
function menuIcon(node: MenuNode): ReactNode {
  if (node.level === 1) {
    // 无图标也传入等宽占位节点（1em×1em 与真图标同宽，antd 附加的右侧间距一致），
    // 确保一级菜单文字对齐——menu_img 为空的菜单（如「图谱管理」id=45，库值为空串）
    // 在老页也只有空槽无图标；数据侧补配图标后占位自动被真图标替换。
    return node.icon ? (
      <i className={node.icon} aria-hidden />
    ) : (
      <span aria-hidden style={{ display: 'inline-block', width: '1em', height: '1em' }} />
    );
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
    <MenuSkeleton />
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
