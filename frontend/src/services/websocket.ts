import { WsEvent } from '../types/game'

const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
const WS_BASE = import.meta.env.VITE_WS_URL || `${protocol}//${window.location.host}`

type EventHandler = (event: WsEvent) => void

export class GameWebSocket {
  private ws: WebSocket | null = null
  private roomCode: string
  private participantId: string
  private handlers: EventHandler[] = []
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null
  private pingTimer: ReturnType<typeof setInterval> | null = null
  private ready = false
  private pendingVoice: { requestId: string; resolve: () => void; reject: (error: Error) => void; timer: ReturnType<typeof setTimeout> } | null = null
  private shouldReconnect = true
  private reconnectAttempts = 0
  private maxReconnectAttempts = 10
  public onConnectionChange?: (connected: boolean) => void

  constructor(roomCode: string, participantId: string, private guestUuid: string) {
    this.roomCode = roomCode.toUpperCase()
    this.participantId = participantId
  }

  connect() {
    this.shouldReconnect = true
    this._connect()
  }

  private _connect() {
    this.ready = false
    if (this.ws) {
      this.ws.onclose = null
      this.ws.close()
    }

    const wsUrl = `${WS_BASE}/ws/${this.roomCode}/${this.participantId}`
    this.ws = new WebSocket(wsUrl)
    const socket = this.ws

    this.ws.onopen = () => {
      if (this.ws !== socket) return
      this.ws?.send(JSON.stringify({ type: 'authenticate', guest_uuid: this.guestUuid }))
    }

    this.ws.onmessage = (evt) => {
      if (this.ws !== socket) return
      try {
        const event = JSON.parse(evt.data) as WsEvent
        if (event.type === 'state_sync') {
          this.ready = true
          this.reconnectAttempts = 0
          this._startPing()
          this.onConnectionChange?.(true)
        }
        if (event.type === 'voice_question_accepted' || event.type === 'voice_question_error') {
          const data = event.data as { request_id: string; message?: string }
          if (this.pendingVoice?.requestId === data.request_id) {
            const pending = this.pendingVoice
            clearTimeout(pending.timer)
            this.pendingVoice = null
            if (event.type === 'voice_question_accepted') pending.resolve()
            else pending.reject(new Error(data.message || 'تعذّر إرسال التسجيل'))
          }
        }
        this.handlers.forEach(h => h(event))
      } catch {
        // ignore parse errors
      }
    }

    this.ws.onclose = (evt) => {
      if (this.ws !== socket) return
      this.ready = false
      this.rejectVoice('انقطع الاتصال؛ تحقّق من سجل الأسئلة بعد إعادة الاتصال')
      this._stopPing()
      this.onConnectionChange?.(false)
      if (this.shouldReconnect && evt.code !== 4001 && evt.code !== 4003) {
        this._scheduleReconnect()
      }
    }

    this.ws.onerror = () => {
      socket.close()
    }
  }

  private _startPing() {
    this._stopPing()
    this.pingTimer = setInterval(() => {
      this.send({ type: 'ping' })
    }, 25000)
  }

  private _stopPing() {
    if (this.pingTimer) {
      clearInterval(this.pingTimer)
      this.pingTimer = null
    }
  }

  private _scheduleReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) return
    const delay = Math.min(1000 * 2 ** this.reconnectAttempts, 30000)
    this.reconnectAttempts++
    this.reconnectTimer = setTimeout(() => this._connect(), delay)
  }

  send(data: object) {
    if (!this.isConnected) return false
    try {
      this.ws!.send(JSON.stringify(data))
      return true
    } catch { return false }
  }

  sendVoiceQuestion(data: { round_id: string; request_id: string; audio_base64: string; mime_type: string; duration_ms: number }) {
    return new Promise<void>((resolve, reject) => {
      if (!this.isConnected || this.pendingVoice) { reject(new Error('الاتصال غير جاهز؛ انتظر ثم حاول مجدداً')); return }
      const timer = setTimeout(() => {
        this.rejectVoice('تعذّر تأكيد الإرسال؛ جارٍ إعادة الاتصال للتحقق من سجل الأسئلة')
        this.ws?.close() // Resync ambiguous delivery; never automatically resend audio.
      }, 15000)
      this.pendingVoice = { requestId: data.request_id, resolve, reject, timer }
      if (!this.send({ type: 'voice_question', data })) this.rejectVoice('تعذّر إرسال التسجيل؛ تحقّق من الاتصال')
    })
  }

  private rejectVoice(message: string) {
    if (!this.pendingVoice) return
    clearTimeout(this.pendingVoice.timer)
    this.pendingVoice.reject(new Error(message))
    this.pendingVoice = null
  }

  on(handler: EventHandler) {
    this.handlers.push(handler)
    return () => {
      this.handlers = this.handlers.filter(h => h !== handler)
    }
  }

  disconnect() {
    this.shouldReconnect = false
    this.ready = false
    this.rejectVoice('انقطع الاتصال؛ تحقّق من سجل الأسئلة بعد إعادة الاتصال')
    this.onConnectionChange?.(false)
    this._stopPing()
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }
    this.ws?.close()
    this.ws = null
  }

  get isConnected() {
    return this.ready && this.ws?.readyState === WebSocket.OPEN
  }
}
