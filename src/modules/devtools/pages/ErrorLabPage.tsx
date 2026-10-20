import { useState } from 'react';
import { Alert, Button, Card, Descriptions, Space, Tag, Typography, message } from 'antd';
import { ApiError } from '@/api/types';
import { get } from '@/api/request';
import { resolveErrorMessage } from '@/api/query';

interface ProbeResult {
  label: string;
  ok: boolean;
  detail: string;
}

/**
 * 错误处理验证页。
 *
 * 这些不是"演示效果"，而是验收项 —— 每一条都对应后端一个真实行为，
 * 必须逐条验证通过，否则线上就是用户看见堆栈或者看见白屏。
 */
export function ErrorLabPage() {
  const [results, setResults] = useState<ProbeResult[]>([]);
  const [busy, setBusy] = useState<string | null>(null);

  const push = (r: ProbeResult) => setResults((prev) => [r, ...prev]);

  /** 统一的探针执行器：把 ApiError 分类结果记录下来 */
  const probe = async (label: string, fn: () => Promise<unknown>) => {
    setBusy(label);
    try {
      await fn();
      push({ label, ok: true, detail: '请求成功（未触发错误分支）' });
    } catch (e) {
      if (e instanceof ApiError) {
        push({
          label,
          ok: false,
          detail: `kind=${e.kind}  httpStatus=${e.httpStatus ?? '-'}  code=${e.code ?? '-'}  → 提示「${resolveErrorMessage(e)}」`,
        });
      } else {
        push({ label, ok: false, detail: `非 ApiError：${String(e)}` });
      }
    } finally {
      setBusy(null);
    }
  };

  return (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      <Alert
        type="warning"
        showIcon
        message="这些是验收项，不是演示"
        description="每一条都对应后端一个真实行为。全部通过，才说明错误处理设计成立。"
      />

      <Card size="small" title="① 业务错误（信封 result:false / retCode!=='0'）">
        <Space wrap>
          <Button
            loading={busy === '业务错误'}
            onClick={() =>
              void probe('业务错误', () =>
                // 故意传一个不存在的路径，让后端返回非 JSON，走 badResponse
                get('/aspanse/__not_exist__/probe'),
              )
            }
          >
            触发业务错误
          </Button>
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            期望：kind=business，组件自己弹 Modal（不抢全局 toast）
          </Typography.Text>
        </Space>
      </Card>

      <Card size="small" title="② 后端 500（关键：后端返回的是纯文本 Java 堆栈）">
        <Space wrap>
          <Button
            loading={busy === '500 堆栈'}
            onClick={() =>
              void probe('500 堆栈', () =>
                get('/aspanse/md/mdCustomer/mdCustLookUp', { pageSize: 'NOT_A_NUMBER' }),
              )
            }
          >
            触发 500
          </Button>
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            期望：kind=server，提示「系统异常，请联系管理员」，
            <strong>界面上绝不出现 Java 堆栈</strong>
          </Typography.Text>
        </Space>
      </Card>

      <Card size="small" title="③ 网络不可达">
        <Space wrap>
          <Button
            loading={busy === '网络不可达'}
            onClick={() =>
              void probe('网络不可达', () =>
                // 指向一个不存在的端口，制造 ERR_NETWORK
                get('http://127.0.0.1:59999/probe', undefined, { baseURL: '' }),
              )
            }
          >
            触发网络错误
          </Button>
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            期望：kind=network，提示「网络连接失败」
          </Typography.Text>
        </Space>
      </Card>

      <Card size="small" title="④ 超时（模拟慢接口）">
        <Space wrap>
          <Button
            loading={busy === '超时'}
            onClick={() =>
              void probe('超时', () =>
                get('/aspanse/md/mdCustomer/mdCustLookUp', undefined, { timeout: 1 }),
              )
            }
          >
            触发超时（1ms 超时）
          </Button>
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            期望：kind=timeout，提示「请求超时」而不是「失败」
          </Typography.Text>
        </Space>
      </Card>

      <Card size="small" title="⑤ 主动取消（必须静默，不能提示）">
        <Space wrap>
          <Button
            loading={busy === '取消静默'}
            onClick={() =>
              void probe('取消静默', async () => {
                const ctrl = new AbortController();
                const p = get('/aspanse/md/mdCustomer/mdCustLookUp', undefined, {
                  signal: ctrl.signal,
                });
                ctrl.abort(); // 立即取消
                return p;
              })
            }
          >
            触发取消
          </Button>
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            期望：kind=canceled，<strong>不弹任何提示</strong>（表格快速翻页就是这种）
          </Typography.Text>
        </Space>
      </Card>

      <Card size="small" title="⑥ 未登录（session 失效）">
        <Space wrap>
          <Button
            danger
            onClick={() => {
              message.warning('即将跳转到后端登录页，回来后当前路由会保留在 ?redirect= 参数里');
              window.location.href = '/console/aspanse/login';
            }}
          >
            跳转登录页（真实行为）
          </Button>
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            期望：清掉 <code>pw.session.id</code> 后任意请求应被识别为 unauthenticated 并自动跳登录
          </Typography.Text>
        </Space>
      </Card>

      <Card
        size="small"
        title="验证结果"
        extra={
          <Button size="small" onClick={() => setResults([])} disabled={!results.length}>
            清空
          </Button>
        }
      >
        {results.length === 0 ? (
          <Typography.Text type="secondary">点击上面的按钮触发，结果会记录在这里。</Typography.Text>
        ) : (
          <Space direction="vertical" size={8} style={{ width: '100%' }}>
            {results.map((r, i) => (
              <Descriptions key={`${r.label}-${i}`} size="small" column={1} bordered>
                <Descriptions.Item label={r.label}>
                  <Tag color={r.ok ? 'green' : 'red'}>{r.ok ? '成功' : '已捕获'}</Tag>
                  <Typography.Text code style={{ fontSize: 12 }}>
                    {r.detail}
                  </Typography.Text>
                </Descriptions.Item>
              </Descriptions>
            ))}
          </Space>
        )}
      </Card>
    </Space>
  );
}
