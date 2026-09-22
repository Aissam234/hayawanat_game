import { useState, useRef } from 'react'
import { motion } from 'framer-motion'
import { authApi } from '../../services/api'
import { useAuthStore } from '../../store/authStore'
import { useGameStore } from '../../store/gameStore'
import { toast } from '../../store/toastStore'
import { LogIn, UserPlus } from 'lucide-react'
import { clearSession } from '../../utils/session'

export default function AuthModal({ onClose }: { onClose?: () => void }) {
  const [isLogin, setIsLogin] = useState(true)
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const { setAuth } = useAuthStore()
  const { setSession } = useGameStore()

  const sending = useRef(false)
  const [confirmation, setConfirmation] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (sending.current) return
    if (!username.trim() || !password) return toast.error('يرجى ملء جميع الحقول')

    if (!isLogin && password !== confirmation) return toast.error('كلمتا المرور غير متطابقتين')
    if (new TextEncoder().encode(password).length > 72) return toast.error('كلمة المرور طويلة جداً')
    sending.current = true
    setLoading(true)
    try {
      const res = isLogin
        ? await authApi.login({ username: username.trim(), password })
        : await authApi.register({ username: username.trim(), password })

      useGameStore.getState().reset()
      clearSession()
      localStorage.setItem('hayawanat_guest_uuid', crypto.randomUUID())
      
      setAuth(res.access_token, res.user)
      setSession({
        guestUuid: localStorage.getItem('hayawanat_guest_uuid') || crypto.randomUUID(),
        displayName: res.user.username,
      })
      toast.success(isLogin ? 'تم تسجيل الدخول بنجاح!' : 'تم إنشاء الحساب بنجاح!')
      if (onClose) onClose()
    } catch (e: any) {
      toast.error(e.message || 'حدث خطأ')
    } finally {
      sending.current = false
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-game-bg/90 backdrop-blur-sm" dir="rtl">
      <motion.div
        role="dialog" aria-modal="true" aria-labelledby="auth-title"
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="w-full max-w-sm glass rounded-3xl p-6 border border-game-border relative max-h-[90dvh] overflow-y-auto shadow-2xl"
      >
        <div className="absolute inset-0 bg-gradient-to-br from-game-primary/10 to-transparent pointer-events-none" />
        
        <div className="relative text-center mb-6">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-game-surface border border-game-border shadow-inner mb-4">
            <span className="text-3xl">🦁</span>
          </div>
          <h2 id="auth-title" className="text-2xl font-black text-game-text">حيوانات</h2>
          <p className="text-game-text-muted mt-1 text-sm">يجب تسجيل الدخول للعب وحفظ نقاطك</p>
        </div>

        <form onSubmit={handleSubmit} className="relative space-y-4">
          <div>
            <label htmlFor="auth-username" className="block text-sm font-bold text-game-text mb-1">اسم المستخدم</label>
            <input
              id="auth-username" required minLength={3} maxLength={50} autoComplete="username" disabled={loading}
              type="text"
              value={username}
              onChange={e => setUsername(e.target.value)}
              className="w-full bg-game-surface border border-game-border rounded-xl px-4 py-3 text-game-text focus:outline-none focus:border-game-primary transition-colors text-left"
              dir="ltr"
              placeholder="Username"
            />
          </div>
          <div>
            <label htmlFor="auth-password" className="block text-sm font-bold text-game-text mb-1">كلمة المرور</label>
            <input
              id="auth-password" required minLength={isLogin ? 1 : 8} maxLength={100} autoComplete={isLogin ? "current-password" : "new-password"} disabled={loading}
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="w-full bg-game-surface border border-game-border rounded-xl px-4 py-3 text-game-text focus:outline-none focus:border-game-primary transition-colors text-left"
              dir="ltr"
              placeholder="••••••••"
            />
          </div>

          {!isLogin && <div>
            <label htmlFor="auth-confirm" className="block text-sm font-bold text-game-text mb-1">تأكيد كلمة المرور</label>
            <input id="auth-confirm" required type="password" autoComplete="new-password" disabled={loading} value={confirmation} onChange={e => setConfirmation(e.target.value)} className="w-full bg-game-surface border border-game-border rounded-xl px-4 py-3 text-game-text" />
            <p className="text-xs text-game-text-muted mt-2">8 أحرف على الأقل. احفظ كلمة مرورك؛ استعادتها غير متاحة حالياً.</p>
          </div>}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 mt-2 rounded-xl font-bold text-white bg-gradient-to-l from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 disabled:opacity-50 transition-all shadow-lg flex items-center justify-center gap-2"
          >
            {isLogin ? <LogIn className="w-5 h-5" /> : <UserPlus className="w-5 h-5" />}
            {loading ? 'انتظر...' : isLogin ? 'دخول' : 'حساب جديد'}
          </button>
        </form>

        <div className="relative mt-6 text-center">
          <button
            type="button"
            disabled={loading}
            onClick={() => { setIsLogin(!isLogin); setPassword(''); setConfirmation('') }}
            className="text-sm text-game-primary hover:text-game-primary/80 font-semibold transition-colors"
          >
            {isLogin ? 'لا تملك حساباً؟ سجل الآن' : 'لديك حساب؟ سجل الدخول'}
          </button>
        </div>
      </motion.div>
    </div>
  )
}
