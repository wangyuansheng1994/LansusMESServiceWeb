/**
 * 首页数据接口（后端 HomeApiController，已随 fanbianyi 恢复）。
 *
 * GET ${adminPath}/api/v1/home → RestResult<HomeData>
 * 一次请求拿当前用户 + 三级菜单树。
 */
import { get } from '@/api/request';

export interface MenuNode {
  id: string;
  name: string;
  nameEn?: string | null;
  nameTc?: string | null;
  /** 老 ad_menu.menu_url：相对路径需补 /console 前缀（规则见 toLegacyUrl） */
  url?: string | null;
  icon?: string | null;
  target?: string | null;
  orderNum?: number | null;
  permission?: string | null;
  remark?: string | null;
  level: number;
  children: MenuNode[];
}

export interface HomeData {
  userCode: string;
  userName?: string | null;
  rowId?: string | null;
  isAdmin: boolean;
  assemblyLine?: string | null;
  menuTree: MenuNode[];
}

export function getHome(): Promise<HomeData> {
  return get<HomeData>('/aspanse/api/v1/home');
}

/**
 * 老 menuUrl → 可打开的同源地址。
 *
 * 规则与老 menu.jsp 完全一致（login/menu.jsp:162）：
 *   含 "://" 的原样使用（外部绝对地址）；
 *   否则前缀 ${ctx}（= /console）。
 * 兼容 menuUrl 带不带前导斜杠两种历史数据。
 */
export function toLegacyUrl(menuUrl: string): string {
  if (menuUrl.includes('://')) return menuUrl;
  return '/console' + (menuUrl.startsWith('/') ? '' : '/') + menuUrl;
}
