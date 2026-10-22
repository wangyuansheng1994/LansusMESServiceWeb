import { LegacyPage } from '@/pages/LegacyPage';

/**
 * 首页标签（对位老壳的固定「首页」）。
 *
 * 老壳 main.jsp:75-80：initJerichoTab 的第一个 tab 固定为
 *   title: '首页', closeable: false, iframe → ${ctx}/main/main/taskTodo
 * 这里原样复刻：同样的待办页 iframe、同样不可关闭（由 tabStore 的
 * pinned 保证）。待办数据本身是老 JSP 渲染的，后端零改动。
 */
export function HomePage() {
  return <LegacyPage src="/main/main/taskTodo" name="首页" />;
}
