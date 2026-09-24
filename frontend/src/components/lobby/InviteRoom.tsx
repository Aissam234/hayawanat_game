import { useState } from 'react'
import { QRCodeSVG } from 'qrcode.react'
export default function InviteRoom({ code }: { code: string }) {
  const [qr, setQr] = useState(false)
  const [message, setMessage] = useState('')
  const url = `${window.location.origin}/?join=${encodeURIComponent(code)}`
  async function share() {
    try {
      if (navigator.share) { await navigator.share({ title: 'لعبة الحيوانات', text: 'انضم إلى غرفتي!', url }); return }
      await navigator.clipboard.writeText(url); setMessage('تم نسخ رابط الدعوة')
    } catch (error) { if (!(error instanceof DOMException && error.name === 'AbortError')) setMessage('انسخ الرابط من الحقل أدناه') }
  }
  return <section className="glass rounded-2xl p-4 text-game-text space-y-3" aria-label="دعوة الأصدقاء">
    <div className="flex gap-2"><button onClick={share} className="rounded-xl bg-indigo-600 p-3 flex-1">🔗 دعوة الأصدقاء</button><button onClick={() => setQr(!qr)} aria-expanded={qr} className="rounded-xl border border-game-border p-3">رمز QR</button></div>
    <input aria-label="رابط الدعوة" readOnly value={url} onFocus={e => e.target.select()} dir="ltr" className="w-full bg-game-surface rounded-lg p-2 text-xs" />
    {qr && <div className="flex justify-center"><QRCodeSVG value={url} size={192} marginSize={4} title="رابط الانضمام إلى الغرفة" /></div>}
    <p className="text-xs text-game-text-muted">يفتح الرابط الغرفة بعد تسجيل الدخول. لا يشارك بيانات حسابك.</p>
    {message && <p role="status" className="text-xs">{message}</p>}
  </section>
}
