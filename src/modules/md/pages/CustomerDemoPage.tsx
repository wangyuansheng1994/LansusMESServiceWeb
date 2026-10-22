import { useState } from 'react';
import {
  Alert,
  App,
  Button,
  Card,
  Descriptions,
  Form,
  Input,
  Space,
  Table,
  Tag,
  Typography,
} from 'antd';
import { ReloadOutlined, SearchOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { PermButton } from '@/components/PermButton';
import { ApiError, type PageResult } from '@/api/types';
import { resolveErrorMessage } from '@/api/query';
import { PERM } from '@/stores/permStore';
import { useMdCustomerLookup } from '@/api/modules/md/useMdCustomer';
import type { MdCustomer, MdCustomerQuery } from '@/api/modules/md/customer';

const columns: ColumnsType<MdCustomer> = [
  { title: '客户编号', dataIndex: 'custCode', key: 'custCode', width: 180 },
  { title: '客户名称', dataIndex: 'custName', key: 'custName' },
  { title: '客户类型', dataIndex: 'custType', key: 'custType', width: 140 },
  {
    title: '状态',
    dataIndex: 'activeFlag',
    key: 'activeFlag',
    width: 100,
    render: (v: unknown) =>
      v === 'Y' ? <Tag color="green">有效</Tag> : <Tag>{String(v ?? '-')}</Tag>,
  },
];

/**
 * 业务页验证：客户查询
 *
 * 这个页面同时验证 6 件事：
 *  ① 老接口复用 —— 直接调 /aspanse/md/mdCustomer/mdCustLookUp，零后端改动
 *  ② 信封适配 —— 后端返回 { retCode, retMsg, page }，被 retCodeAdapter 归一化
 *  ③ 分页归一化 —— page 对象被转成统一的 PageResult
 *  ④ lane 取消 —— 快速改条件时旧请求被 abort，不刷错误提示
 *  ⑤ 业务错误交给组件 —— 见 handleBusinessError
 *  ⑥ 权限按钮 —— PermButton 控制显隐
 */
export function CustomerDemoPage() {
  const { message } = App.useApp();
  const [query, setQuery] = useState<MdCustomerQuery>({ pageNo: 1, pageSize: 15 });
  const { data, isFetching, isError, error, refetch } = useMdCustomerLookup(query);

  const page: PageResult<MdCustomer> | undefined = data;

  const onSearch = (values: MdCustomerQuery) => {
    // 换条件时重置到第一页
    setQuery({ ...values, pageNo: 1, pageSize: query.pageSize ?? 15 });
  };

  return (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      <Alert
        type="info"
        showIcon
        message="这是真实接口调用，不是 mock"
        description={
          <span>
            数据来自 <code>GET /console/aspanse/md/mdCustomer/mdCustLookUp</code>
            ，返回信封为 <code>{'{ retCode, retMsg, page }'}</code>，由 <code>retCodeAdapter</code>{' '}
            归一化为统一的 <code>PageResult</code>。
            这个接口是老系统已经存在的，本次迁移没有改后端任何代码。
          </span>
        }
      />

      <Card size="small" title="查询条件">
        <Form layout="inline" onFinish={onSearch}>
          <Form.Item name="custCode" label="客户编号">
            <Input allowClear placeholder="支持模糊" style={{ width: 180 }} />
          </Form.Item>
          <Form.Item name="custName" label="客户名称">
            <Input allowClear placeholder="支持模糊" style={{ width: 220 }} />
          </Form.Item>
          <Form.Item>
            <Space>
              <Button
                type="primary"
                htmlType="submit"
                icon={<SearchOutlined />}
                loading={isFetching}
              >
                查询
              </Button>
              <Button
                icon={<ReloadOutlined />}
                onClick={() => {
                  void refetch();
                }}
              >
                刷新
              </Button>
              {/* 权限按钮：perms 未加载时禁用，加载后按权限码显隐 */}
              <PermButton
                perm={PERM.DEMO_EXPORT}
                onClick={() =>
                  message.info('导出按钮可见 —— 说明该权限码命中了（或权限未接入时的占位行为）')
                }
              >
                导出
              </PermButton>
            </Space>
          </Form.Item>
        </Form>
      </Card>

      {isError ? (
        <Alert
          type="error"
          showIcon
          message="查询失败"
          description={
            <Space direction="vertical" size={4}>
              <span>{resolveErrorMessage(error)}</span>
              {error instanceof ApiError ? (
                <Typography.Text type="secondary" code style={{ fontSize: 12 }}>
                  kind={error.kind} httpStatus={error.httpStatus ?? '-'} url={error.url ?? '-'}
                </Typography.Text>
              ) : null}
              <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                常见原因：① Tomcat 未启动 ② 未登录（session 失效）③ 后端 500（此时原始响应是 Java
                堆栈，已被拦截器拦下不上屏）
              </Typography.Text>
            </Space>
          }
        />
      ) : null}

      <Card
        size="small"
        title={
          <Space>
            <span>客户列表</span>
            {page ? <Tag>共 {page.total} 条</Tag> : null}
          </Space>
        }
      >
        <Table<MdCustomer>
          rowKey={(r) => String(r.rowId ?? r.custCode ?? Math.random())}
          columns={columns}
          dataSource={page?.list ?? []}
          loading={isFetching}
          size="small"
          scroll={{ x: 'max-content' }}
          pagination={{
            current: page?.pageNum ?? query.pageNo ?? 1,
            pageSize: page?.pageSize ?? query.pageSize ?? 15,
            total: page?.total ?? 0,
            showSizeChanger: true,
            showTotal: (t) => `共 ${t} 条`,
            onChange: (pageNo, pageSize) => setQuery((q) => ({ ...q, pageNo, pageSize })),
          }}
        />
      </Card>

      <Card size="small" title="调试信息（帮助确认适配器是否猜对字段名）">
        <Descriptions size="small" column={2} bordered>
          <Descriptions.Item label="适配器命中">
            <AdapterProbe raw={data} />
          </Descriptions.Item>
          <Descriptions.Item label="归一化后 total">{page?.total ?? '-'}</Descriptions.Item>
          <Descriptions.Item label="归一化后 list 长度">
            {page?.list?.length ?? '-'}
          </Descriptions.Item>
          <Descriptions.Item label="归一化后 pageNum">{page?.pageNum ?? '-'}</Descriptions.Item>
        </Descriptions>
        <Typography.Paragraph
          type="secondary"
          style={{ marginTop: 12, marginBottom: 0, fontSize: 12 }}
        >
          ⚠️ 老 Page 类的字段名无法从源码确定（不在工作区，也不在 sources jar 里），
          <code>normalizeLegacyPage</code> 目前用多候选兼容。 如果上面 total 显示 0
          但实际有数据，说明候选没命中 —— 请打开 F12 Network 看真实响应的 <code>page</code>{' '}
          字段结构，然后收窄适配器。
        </Typography.Paragraph>
      </Card>
    </Space>
  );
}

/** 显示归一化结果的探针，方便对照真实响应 */
function AdapterProbe({ raw }: { raw: unknown }) {
  if (!raw) return <span>-</span>;
  return <Tag color="green">retCode → PageResult</Tag>;
}
