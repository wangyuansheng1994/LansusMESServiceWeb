import { keepPreviousData, useMutation, useQuery } from '@tanstack/react-query';
import { mdCustomerApi, type MdCustomer, type MdCustomerQuery } from './customer';

const key = {
  all: ['mdCustomer'] as const,
  lookup: (q: MdCustomerQuery) => [...key.all, 'lookup', q] as const,
};

export function useMdCustomerLookup(q: MdCustomerQuery) {
  return useQuery({
    queryKey: key.lookup(q),
    queryFn: ({ signal }) => mdCustomerApi.lookup(q, signal),
    // ★ 翻页/改条件时不闪白：保留上一页数据直到新数据到位
    placeholderData: keepPreviousData,
  });
}

/**
 * 写操作示例。
 * 注意 onError 不写 —— 由 query.ts 的 MutationCache 统一处理，
 * 组件只需要 catch 业务错误（见 DemoPage 里的用法）。
 */
export function useSaveMdCustomer() {
  return useMutation({
    mutationFn: async (_c: MdCustomer) => {
      // 老接口 save 返回的是 JSP 视图（redirect:...），不是 JSON，
      // 所以这里仅作"写操作 + 业务错误处理"的形态演示，不真实调用。
      throw new Error('Demo 未实现：写操作需要后端新增 /api/v1 接口');
    },
  });
}
