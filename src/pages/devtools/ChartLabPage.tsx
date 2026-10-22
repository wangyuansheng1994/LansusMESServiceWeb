import { Alert, Card, Space, Typography } from 'antd';
import ReactECharts from 'echarts-for-react';
import type { EChartsOption } from 'echarts';

const dates = ['2026-10-01', '2026-10-02', '2026-10-03', '2026-10-04', '2026-10-05'];

const lineOption: EChartsOption = {
  tooltip: { trigger: 'axis' },
  legend: { data: ['良品', '不良'] },
  xAxis: { type: 'category', data: dates },
  yAxis: { type: 'value' },
  series: [
    { name: '良品', type: 'line', smooth: true, data: [132, 145, 128, 151, 139] },
    { name: '不良', type: 'line', smooth: true, data: [12, 9, 15, 7, 11] },
  ],
};

const columnOption: EChartsOption = {
  tooltip: {},
  xAxis: { type: 'category', data: ['光刻', '刻蚀', '薄膜', '清洗', '检测'] },
  yAxis: { type: 'value' },
  series: [{ name: '在制数', type: 'bar', data: [320, 280, 410, 190, 240] }],
};

const pieOption: EChartsOption = {
  tooltip: { trigger: 'item' },
  legend: { bottom: 0 },
  series: [
    {
      name: '质量分布',
      type: 'pie',
      radius: ['40%', '70%'],
      data: [
        { name: '合格', value: 78 },
        { name: '返工', value: 14 },
        { name: '报废', value: 8 },
      ],
    },
  ],
};

/**
 * 图表验证页 —— ECharts 6 × React 19 冒烟（方案 v3.1 裁决#5 的默认路线）。
 *
 * 背景：@ant-design/charts 聚合包被裁决#5 明确排除（停更近 10 个月、
 * peer 仅 react>=16.8.4、体积 2274KB vs ECharts 1095KB），2026-10-22 已移除并
 * 换装 echarts@6.1.0 + echarts-for-react@3.0.6（显式支持 React 19）。
 * 老系统本有 ECharts 资源与 26 个 EchartsController 接口，团队更熟。
 *
 * 本页渲染正常 = 裁决#5 默认路线的运行时验证通过。
 * 页面级懒加载分包：图表库只在本页 chunk 里，不进首屏。
 * 后续页面一律走统一 <Chart> 封装（方案 §3.3，P1 沉淀），换实现不改页面。
 */
export function ChartLabPage() {
  return (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      <Alert
        type="info"
        showIcon
        message="ECharts 6 × React 19 冒烟验证（裁决#5 默认路线）"
        description="三个图表正常渲染即通过。如果页面被 ErrorBoundary 兜住或图表空白，先查路由分包与版本锁定，再考虑备选 @ant-design/plots（需另行冒烟）。"
      />

      <Card size="small" title="折线图 —— 模拟良品/不良趋势">
        <ReactECharts option={lineOption} style={{ height: 260 }} notMerge />
      </Card>

      <Card size="small" title="柱状图 —— 模拟工序在制数">
        <ReactECharts option={columnOption} style={{ height: 260 }} notMerge />
      </Card>

      <Card size="small" title="饼图 —— 模拟质量分布">
        <ReactECharts option={pieOption} style={{ height: 260 }} notMerge />
      </Card>

      <Card size="small" title="结论记录">
        <Typography.Paragraph style={{ marginBottom: 0 }}>
          渲染正常 → ECharts 6 路线坐实，结果回填计划书附录 E 对应行；异常 → 登记并评估备选{' '}
          <code>@ant-design/plots</code> 冒烟。
        </Typography.Paragraph>
      </Card>
    </Space>
  );
}
