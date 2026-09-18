import { motion, AnimatePresence } from 'framer-motion'
import { Wifi, WifiOff } from 'lucide-react'

interface Props {
  isConnected: boolean
}

export default function ConnectionStatus({ isConnected }: Props) {
  return (
    <AnimatePresence>
      {!isConnected && (
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          className="fixed top-4 right-4 z-50 flex items-center gap-2 bg-red-500/20 border border-red-500/50 text-red-300 px-4 py-2 rounded-xl text-sm backdrop-blur-sm"
        >
          <WifiOff size={16} className="animate-pulse" />
          <span>جاري إعادة الاتصال…</span>
        </motion.div>
      )}
      {isConnected && (
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          className="fixed top-4 right-4 z-50 flex items-center gap-2 bg-emerald-500/20 border border-emerald-500/50 text-emerald-300 px-4 py-2 rounded-xl text-sm backdrop-blur-sm"
          key="connected"
        >
          <Wifi size={16} />
          <span>متصل</span>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
