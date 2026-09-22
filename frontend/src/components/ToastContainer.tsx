import { AnimatePresence, motion } from 'framer-motion'
import { useToastStore, Toast } from '../store/toastStore'
import { CheckCircle2, AlertCircle, Info, AlertTriangle, X } from 'lucide-react'

const icons = {
  success: <CheckCircle2 className="w-5 h-5 text-green-400" />,
  error: <AlertCircle className="w-5 h-5 text-red-400" />,
  info: <Info className="w-5 h-5 text-blue-400" />,
  warning: <AlertTriangle className="w-5 h-5 text-yellow-400" />
}

export function ToastContainer() {
  const { toasts, removeToast } = useToastStore()

  return (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[100] flex flex-col gap-2 w-full max-w-sm px-4 pointer-events-none">
      <AnimatePresence>
        {toasts.map((t: Toast) => (
          <motion.div
            key={t.id}
            initial={{ opacity: 0, y: -20, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.9 }}
            className="pointer-events-auto flex items-center gap-3 p-4 bg-gray-800/95 border border-gray-700/50 backdrop-blur-md rounded-2xl shadow-xl shadow-black/20 text-gray-100"
          >
            <div className="flex-shrink-0">{icons[t.type]}</div>
            <p className="flex-1 text-sm font-medium">{t.message}</p>
            <button
              onClick={() => removeToast(t.id)}
              className="p-1 hover:bg-gray-700/50 rounded-lg transition-colors text-gray-400 hover:text-gray-200"
            >
              <X className="w-4 h-4" />
            </button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  )
}
