import { useEffect, useRef, useState } from 'react'
import { authApi } from '../../services/api'
import { useAuthStore } from '../../store/authStore'
import { useGameStore } from '../../store/gameStore'
import { clearSession } from '../../utils/session'

interface GoogleIdentity {
  initialize: (options: { client_id: string; callback: (response: { credential: string }) => void; auto_select: boolean }) => void
  renderButton: (element: HTMLElement, options: { type: string; theme: string; size: string; width: number; locale: string; text: string }) => void
}
declare global { interface Window { google?: { accounts: { id: GoogleIdentity } } } }
let loadingScript: Promise<void> | undefined
function loadGoogle() {
  if (window.google?.accounts.id) return Promise.resolve()
  if (!loadingScript) loadingScript = new Promise<void>((resolve, reject) => {
    const script = document.createElement('script')
    script.src = 'https://accounts.google.com/gsi/client'
    script.async = true
    script.onload = () => resolve()
    script.onerror = () => { script.remove(); loadingScript = undefined; reject(new Error('تعذّر تحميل Google؛ تحقق من الاتصال أو تابع كضيف')) }
    document.head.appendChild(script)
  })
  return loadingScript
}

export default function AuthModal({ onClose }: { onClose: () => void }) {
  const button = useRef<HTMLDivElement>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [ready, setReady] = useState(false)
  useEffect(() => {
    let disposed = false
    let sending = false
    const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID
    if (!clientId) { setError('تسجيل الدخول عبر Google غير جاهز حالياً؛ يمكنك اللعب كضيف'); return }
    loadGoogle().then(() => {
      if (disposed || !button.current || !window.google) return
      window.google.accounts.id.initialize({ client_id: clientId, auto_select: false, callback: async response => {
        if (disposed || sending) return
        sending = true; setBusy(true); setError('')
        try {
          const result = await authApi.google(response.credential)
          if (disposed) return
          // A different account never inherits the previous guest's room secret.
          useGameStore.getState().reset()
          clearSession()
          localStorage.setItem('hayawanat_guest_uuid', crypto.randomUUID())
          useAuthStore.getState().setAuth(result.access_token, result.user)
          onClose()
        } catch (err) {
          if (!disposed) setError(err instanceof Error ? err.message : 'تعذّر تسجيل الدخول')
        } finally {
          sending = false
          if (!disposed) setBusy(false)
        }
      } })
      window.google.accounts.id.renderButton(button.current, { type: 'standard', theme: 'filled_black', size: 'large',
        width: Math.min(300, button.current.clientWidth || 280), locale: 'ar', text: 'signin_with' })
      setReady(true)
    }).catch(err => { if (!disposed) setError(err.message) })
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose() }
    document.addEventListener('keydown', escape)
    return () => { disposed = true; document.removeEventListener('keydown', escape) }
  }, [onClose])

  return <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-game-bg/90 backdrop-blur-sm" dir="rtl">
    <section role="dialog" aria-modal="true" aria-labelledby="auth-title" className="w-full max-w-sm glass rounded-3xl p-6 border border-game-border text-center space-y-5">
      <div className="text-4xl">🐾</div>
      <h2 id="auth-title" className="text-xl font-black text-game-text">احفظ نقاطك مع حسابك</h2>
      <p className="text-sm text-game-text-muted">سجّل الدخول عبر Google للاحتفاظ بانتصاراتك بين الغرف والأجهزة. يمكنك أيضاً اللعب كضيف.</p>
      <div ref={button} className={`flex justify-center min-h-11 ${busy ? 'pointer-events-none opacity-50' : ''}`} />
      {(!ready || busy) && !error && <p role="status" className="text-sm text-game-text-muted">{busy ? 'جارٍ تسجيل الدخول…' : 'جارٍ تحميل Google…'}</p>}
      {error && <p role="alert" className="text-sm text-red-400">{error}</p>}
      <button autoFocus onClick={onClose} className="min-h-12 w-full rounded-xl border border-game-border text-game-text font-bold">المتابعة كضيف</button>
      <p className="text-xs text-game-text-muted">نقاط الضيف تخص الغرفة الحالية فقط؛ النقاط السابقة لا تُنقل إلى الحساب.</p>
    </section>
  </div>
}
