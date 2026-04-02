import { Component, ReactNode, ErrorInfo } from 'react'
import { AlertTriangle, RotateCcw } from 'lucide-react'

interface Props {
  children: ReactNode
  fallback?: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
  errorInfo: ErrorInfo | null
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, error: null, errorInfo: null }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo)
    this.setState({ error, errorInfo })
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null })
    window.location.reload()
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback
      }

      return (
        <div className="error-boundary">
          <div className="error-boundary-content">
            <div className="error-boundary-icon">
              <AlertTriangle size={48} strokeWidth={1.5} />
            </div>
            <h2 className="error-boundary-title">出错了</h2>
            <p className="error-boundary-desc">
              应用遇到了一个错误，请尝试刷新页面
            </p>
            {this.state.error && (
              <div className="error-boundary-details">
                <code>{this.state.error.message}</code>
              </div>
            )}
            <button className="error-boundary-reset" onClick={this.handleReset}>
              <RotateCcw size={16} strokeWidth={1.5} />
              刷新应用
            </button>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
