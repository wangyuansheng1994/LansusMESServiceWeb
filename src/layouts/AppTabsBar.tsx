import { Dropdown, Tabs } from 'antd';
import type { TabItem } from '@/stores/tabStore';

export interface AppTabsBarProps {
  tabs: TabItem[];
  activeKey: string;
  onNavigate: (key: string) => void;
  onCloseTab: (key: string) => void;
  onCloseOthers: (key: string) => void;
  onCloseAll: () => void;
}

/**
 * 多标签条（对位老壳 jerichoTab 页签行）：
 * 卡片式可关闭标签 + 右键菜单（关闭其他/关闭全部，对齐 jerichotab 习惯）。
 * 纯展示组件，标签状态在 tabStore，导航由 AppLayout 注入。
 */
export function AppTabsBar({
  tabs,
  activeKey,
  onNavigate,
  onCloseTab,
  onCloseOthers,
  onCloseAll,
}: AppTabsBarProps) {
  const hasClosable = tabs.some((t) => t.closable && !t.pinned);

  /** 标签标题：包右键菜单（关闭其他/关闭全部） */
  const renderTabLabel = (t: TabItem) => (
    <Dropdown
      trigger={['contextMenu']}
      menu={{
        items: [
          {
            key: 'closeOthers',
            label: '关闭其他',
            disabled: t.pinned || !tabs.some((x) => x.closable && !x.pinned && x.key !== t.key),
          },
          { key: 'closeAll', label: '关闭全部', disabled: !hasClosable },
        ],
        onClick: ({ key, domEvent }) => {
          domEvent.stopPropagation();
          if (key === 'closeOthers') {
            onCloseOthers(t.key);
          } else if (key === 'closeAll') {
            onCloseAll();
          }
        },
      }}
    >
      <span>{t.title}</span>
    </Dropdown>
  );

  return (
    <Tabs
      type="editable-card"
      hideAdd
      size="small"
      activeKey={activeKey}
      onChange={onNavigate}
      onEdit={(targetKey, action) => {
        if (action === 'remove') onCloseTab(String(targetKey));
      }}
      items={tabs.map((t) => ({
        key: t.key,
        label: renderTabLabel(t),
        closable: t.closable,
      }))}
      style={{ background: '#fff', padding: '4px 16px 0', marginBottom: 0 }}
    />
  );
}
