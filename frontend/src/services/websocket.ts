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
  private shouldReconnect = true
  private reconnectAttempts = 0
  private maxReconnectAttempts = 10
  public onConnectionChange?: (connected: boolean) => void

  constructor(roomCode: string, participantId: string) {
    this.roomCode = roomCode.toUpperCase()
    this.participantId = participantId
  }

  connect() {
    this.shouldReconnect = true
    this._connect()
  }

  private _connect() {
    if (this.ws) {
      this.ws.onclose = null
      this.ws.close()
    }

    const wsUrl = `${WS_BASE}/ws/${this.roomCode}/${this.participantId}`
    this.ws = new WebSocket(wsUrl)

    this.ws.onopen = () => {
      this.reconnectAttempts = 0
      this.onConnectionChange?.(true)
      this._startPing()
    }

    this.ws.onmessage = (evt) => {
      try {
        const event = JSON.parse(evt.data) as WsEvent
        this.handlers.forEach(h => h(event))
      } catch {
        // ignore parse errors
      }
    }

    this.ws.onclose = (evt) => {
      this._stopPing()
      this.onConnectionChange?.(false)
      if (this.shouldReconnect && evt.code !== 4001 && evt.code !== 4003) {
        this._scheduleReconnect()
      }
    }

    this.ws.onerror = () => {
      this.ws?.close()
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
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data))
    }
  }

  on(handler: EventHandler) {
    this.handlers.push(handler)
    return () => {
      this.handlers = this.handlers.filter(h => h !== handler)
    }
  }

  disconnect() {
    this.shouldReconnect = false
    this._stopPing()
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }
    this.ws?.close()
    this.ws = null
  }

  get isConnected() {
    return this.ws?.readyState === WebSocket.OPEN
  }
}
