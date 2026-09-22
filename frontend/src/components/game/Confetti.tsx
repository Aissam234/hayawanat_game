import { useEffect, useRef } from 'react'
import { useReducedMotion } from 'framer-motion'

/**
 * Lightweight canvas confetti — no extra library needed.
 * Only renders when there's a winner.
 */
export default function Confetti() {
  const reducedMotion = useReducedMotion()
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    if (reducedMotion) return
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    canvas.width = window.innerWidth
    canvas.height = window.innerHeight

    const COLORS = ['#6366f1', '#a855f7', '#ec4899', '#f59e0b', '#10b981', '#3b82f6']
    const pieces: Array<{
      x: number; y: number; vx: number; vy: number
      color: string; size: number; angle: number; va: number
    }> = []

    for (let i = 0; i < 70; i++) {
      pieces.push({
        x: Math.random() * canvas.width,
        y: -20 - Math.random() * 200,
        vx: (Math.random() - 0.5) * 4,
        vy: 2 + Math.random() * 4,
        color: COLORS[Math.floor(Math.random() * COLORS.length)],
        size: 6 + Math.random() * 8,
        angle: Math.random() * Math.PI * 2,
        va: (Math.random() - 0.5) * 0.2,
      })
    }

    let raf = 0
    const started = performance.now()
    let previous = started
    const draw = (now: number) => {
      const step = Math.min(2, (now - previous) / (1000 / 60))
      previous = now
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      if (now - started >= 3500 || document.hidden) return
      ctx.globalAlpha = Math.min(1, (3500 - (now - started)) / 650)
      for (const p of pieces) {
        ctx.save()
        ctx.translate(p.x, p.y)
        ctx.rotate(p.angle)
        ctx.fillStyle = p.color
        ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size / 2)
        ctx.restore()
        p.x += p.vx * step
        p.y += p.vy * step
        p.angle += p.va * step
        p.vy += 0.05 * step
      }
      if (pieces.some(p => p.y < canvas.height + 50)) {
        raf = requestAnimationFrame(draw)
      }
    }
    raf = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(raf)
  }, [reducedMotion])

  if (reducedMotion) return null
  return (
    <canvas
      aria-hidden="true"
      ref={canvasRef}
      className="fixed inset-0 z-50 pointer-events-none"
      style={{ width: '100vw', height: '100vh' }}
    />
  )
}
