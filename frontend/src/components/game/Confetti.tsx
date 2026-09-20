import { useEffect, useRef } from 'react'

/**
 * Lightweight canvas confetti — no extra library needed.
 * Only renders when there's a winner.
 */
export default function Confetti() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
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

    for (let i = 0; i < 120; i++) {
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

    let raf: number
    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      for (const p of pieces) {
        ctx.save()
        ctx.translate(p.x, p.y)
        ctx.rotate(p.angle)
        ctx.fillStyle = p.color
        ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size / 2)
        ctx.restore()
        p.x += p.vx
        p.y += p.vy
        p.angle += p.va
        p.vy += 0.05
      }
      if (pieces.some(p => p.y < canvas.height + 50)) {
        raf = requestAnimationFrame(draw)
      }
    }
    draw()
    return () => cancelAnimationFrame(raf)
  }, [])

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 z-50 pointer-events-none"
      style={{ width: '100vw', height: '100vh' }}
    />
  )
}
