import { Alert, Card, Space, Typography } from 'antd';
import { Column, Line, Pie } from '@ant-design/charts';

const lineData = [
  { date: '2026-10-01', value: 132, type: '良品' },
  { date: '2026-10-02', value: 145, type: '良品' },
  { date: '2026-10-03', value: 128, type: '良品' },
  { date: '2026-10-04', value: 151, type: '良品' },
  { date: '2026-10-05', value: 139, type: '良品' },
  { date: '2026-10-01', value: 12, type: '不良' },
  { date: '2026-10-02', value: 9, type: '不良' },
  { date: '2026-10-03', value: 15, type: '不良' },
  { date: '2026-10-04', value: 7, type: '不良' },
  { date: '2026-10-05', value: 11, type: '不良' },
];

const columnData = [
  { step: '光刻', value: 320 },
  { step: '刻蚀', value: 280 },
  { step: '薄膜', value: 410 },
  { step: '清洗', value: 190 },
  { step: '检测', value: 240 },
];

const pieData = [
  { type: '合格', value: 78 },
  { type: '返工', value: 14 },
  { type: '报废', value: 8 },
];

/**
 * 图表验证页 —— Phase 0 第一天必须跑通的东西。
 *
 * 为什么单独拿一页出来：
 *   @ant-design/charts@2.6.7 的 peerDependencies 声明是 react >=16.8.4，
 *   所以【安装不会报错】。但它的依赖链是 @ant-design/plots + @ant-design/graphs，
 *   历史上出现过 React 19 的运行时问题（GitHub issue #2809 标题即
 *   "Missing or outdated dependencies and React 19 issues"）。
 *   peer 声明没问题 ≠ 运行时没问题，所以必须实际渲染一次。
 *
 * 如果这里崩了：RouteErrorBoundary 会兜住并显示错误页，不会白屏。
 * 处理方式见 README「图表逃生舱」一节（退回 ECharts）。
 */
export function ChartLabPage() {
  return (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      <Alert
        type="warning"
        showIcon
        message="这是 Phase 0 的最高风险验证项"
        description={
          <span>
            如果下面三个图表能正常渲染，说明 <code>@ant-design/charts@2.6.7</code> 在 React 19
            下可用；如果页面被 ErrorBoundary 兜住或图表空白，就需要启用 ECharts 逃生舱
            （老系统已有 ECharts 3.3.2 / 5.5.1 资源和 26 个 EchartsController 接口）。
          </span>
        }
      />

      <Card size="small" title="折线图 —— 模拟良品/不良趋势">
        <Line
          data={lineData}
          xField="date"
          yField="value"
          colorField="type"
          height={260}
          point={{ size: 4 }}
        />
      </Card>

      <Card size="small" title="柱状图 —— 模拟工序在制数">
        <Column data={columnData} xField="step" yField="value" height={260} />
      </Card>

      <Card size="small" title="饼图 —— 模拟质量分布">
        <Pie data={pieData} angleField="value" colorField="type" height={260} innerRadius={0.5} />
      </Card>

      <Card size="small" title="结论记录">
        <Typography.Paragraph style={{ marginBottom: 0 }}>
          请把结果记到 <code>demo-web/README.md</code> 的验证清单里：
          渲染正常 → 继续用 Ant Design Charts；异常 → 启用 ECharts 逃生舱。
        </Typography.Paragraph>
      </Card>
    </Space>
  );
}
