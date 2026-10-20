import { Component, type ErrorInfo, type ReactNode } from 'react';
import { Button, Result, Typography } from 'antd';
import { reportRenderError } from '@/api/errorReport';

interface Props {
  children: ReactNode;
  /** 用于错误上报时标识出错的路由 */
  routeKey?: string;
}

interface State {
  error: Error | null;
  info: string | null;
}

/**
 * 路由级渲染兜底。
 *
 * 必要性：AntD 6 + React 19 是新组合，图表组件（@ant-design/charts 依赖
 * @ant-design/plots + @ant-design/graphs）历史上出现过 React 19 运行时问题。
 * 一个组件崩掉不应该让整个页面白屏 —— 这对生产系统是硬要求。
 */
export class RouteErrorBoundary extends Component<Props, State> {
  state: State = { error: null, info: null };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    this.setState({ info: info.componentStack ?? null });

    // 渲染崩溃也要能落到后端，否则线上只能靠用户口述
    try {
      reportRenderError({
        routeKey: this.props.routeKey,
        message: error.message,
        stack: info.componentStack ?? '',
      });
    } catch {
      /* 上报失败不能引发二次崩溃 */
    }
  }

  private handleReset = (): void => {
    this.setState({ error: null, info: null });
  };

  render(): ReactNode {
    const { error, info } = this.state;
    if (!error) return this.props.children;

    return (
      <Result
        status="error"
        title="页面渲染出错"
        subTitle="已自动记录该问题，可返回重试或刷新页面。若持续出现请联系管理员。"
        extra={[
          <Button type="primary" key="retry" onClick={this.handleReset}>
            重试
          </Button>,
          <Button key="reload" onClick={() => window.location.reload()}>
            刷新页面
          </Button>,
        ]}
      >
        <Typography.Paragraph type="secondary" style={{ marginBottom: 0 }}>
          路由：{this.props.routeKey ?? '-'}
        </Typography.Paragraph>
        <Typography.Paragraph type="danger" style={{ marginBottom: 0 }}>
          {error.message}
        </Typography.Paragraph>
        {info ? (
          <Typography.Paragraph>
            <details>
              <summary style={{ cursor: 'pointer' }}>技术细节（仅提交给管理员时展开）</summary>
              <pre style={{ maxHeight: 240, overflow: 'auto', fontSize: 12 }}>{info}</pre>
            </details>
          </Typography.Paragraph>
        ) : null}
      </Result>
    );
  }
}
