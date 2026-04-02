import { useEffect } from 'react'
import { CheckCircle, AlertCircle, XCircle, Info, X } from 'lucide-react'
import { useAppStore } from '@/stores/appStore'

const iconMap = {
  success: CheckCircle,
  error: XCircle,
  warning: AlertCircle,
  info: Info,
}

const classMap = {
  success: 'toast-success',
  error: 'toast-error',
  warning: 'toast-warning',
  info: 'toast-info',
}

export function Toast() {
  const { toast, hideToast } = useAppStore()

  useEffect(() => {
    if (!toast) return

    const timer = setTimeout(() => {
      hideToast()
    }, toast.duration || 3000)

    return () => clearTimeout(timer)
  }, [toast, hideToast])

  if (!toast) return null

  const Icon = iconMap[toast.type]
  const toastClass = classMap[toast.type]

  return (
    <div className={`toast-container ${toast.visible ? 'visible' : ''}`}>
      <div className={`toast ${toastClass}`}>
        <Icon size={18} strokeWidth={1.5} />
        <span className="toast-message">{toast.message}</span>
        <button className="toast-close" onClick={hideToast}>
          <X size={14} strokeWidth={1.5} />
        </button>
      </div>
    </div>
  )
}
