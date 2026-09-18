import { AnimatePresence, motion } from 'framer-motion'
import { AlertTriangle, X } from 'lucide-react'

interface ConfirmModalProps {
  isOpen: boolean
  title: string
  message: string
  confirmText?: string
  cancelText?: string
  isDestructive?: boolean
  onConfirm: () => void
  onCancel: () => void
}

export function ConfirmModal({
  isOpen,
  title,
  message,
  confirmText = 'تأكيد',
  cancelText = 'إلغاء',
  isDestructive = false,
  onConfirm,
  onCancel
}: ConfirmModalProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onCancel}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100]"
          />
          <div className="fixed inset-0 z-[101] flex items-center justify-center p-4 pointer-events-none">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="pointer-events-auto w-full max-w-sm bg-gray-900 border border-gray-800 rounded-3xl p-6 shadow-2xl overflow-hidden"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  {isDestructive && (
                    <div className="p-2 bg-red-500/10 text-red-400 rounded-xl">
                      <AlertTriangle className="w-5 h-5" />
                    </div>
                  )}
                  <h3 className="text-xl font-bold text-gray-100">{title}</h3>
                </div>
                <button
                  onClick={onCancel}
                  className="p-1 hover:bg-gray-800 rounded-lg text-gray-500 hover:text-gray-300 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              
              <p className="text-gray-400 text-base mb-8 leading-relaxed">
                {message}
              </p>

              <div className="flex items-center gap-3">
                <button
                  onClick={onCancel}
                  className="flex-1 py-3 px-4 bg-gray-800 hover:bg-gray-700 text-gray-300 font-medium rounded-2xl transition-colors focus:ring-4 focus:ring-gray-700/50 outline-none"
                >
                  {cancelText}
                </button>
                <button
                  onClick={() => {
                    onConfirm()
                  }}
                  className={`flex-1 py-3 px-4 font-semibold rounded-2xl transition-all focus:ring-4 outline-none ${
                    isDestructive
                      ? 'bg-red-600 hover:bg-red-500 text-white focus:ring-red-600/30'
                      : 'bg-primary-500 hover:bg-primary-400 text-white focus:ring-primary-500/30'
                  }`}
                >
                  {confirmText}
                </button>
              </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  )
}
