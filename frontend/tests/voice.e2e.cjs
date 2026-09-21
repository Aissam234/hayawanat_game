/* Run against an isolated, migrated backend + production frontend over HTTPS.
   npm install --no-save --package-lock=false playwright
   VOICE_FRONTEND_URL / VOICE_API_URL / CHROME_PATH are configurable.
   Synthetic microphone audio is intentional: this does not record a person. */
const { chromium } = require('playwright')
const assert = require('node:assert/strict')
const crypto = require('node:crypto')
const fs = require('node:fs')
const front = process.env.VOICE_FRONTEND_URL || 'https://localhost:18443'
const back = process.env.VOICE_API_URL || 'http://127.0.0.1:18080'
const results = []
const errors = []
const pass = name => { results.push(name); console.log('PASS:', name) }
const pause = ms => new Promise(resolve => setTimeout(resolve, ms))
async function api(path, body, method = 'POST') {
  const res = await fetch(back + path, { method, headers: { 'Content-Type': 'application/json' }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) })
  const data = await res.json()
  assert.equal(res.status, 200, JSON.stringify(data))
  return data
}
async function setup() {
  const guests = [0,1,2].map(() => crypto.randomUUID())
  const first = await api('/api/rooms/', { display_name: 'المضيف', guest_uuid: guests[0] })
  const code = first.room.code
  const ids = [first.participant.id]
  for (const i of [1,2]) ids.push((await api(`/api/rooms/${code}/join`, { room_code: code, guest_uuid: guests[i], display_name: `لاعب ${i}` })).participant.id)
  await api(`/api/rooms/${code}/settings?guest_uuid=${guests[0]}`, { max_questions: 5 })
  await api(`/api/rounds/${code}/start?guest_uuid=${guests[0]}`, { player1_id: ids[1], player2_id: ids[2] })
  return { code, guests, ids }
}
async function main() {
  const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe',
    args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream', '--autoplay-policy=no-user-gesture-required'] })
  const game = await setup()
  const pages = []
  try {
    for (let i = 0; i < 3; i++) {
      const context = await browser.newContext({ ignoreHTTPSErrors: true, permissions: ['microphone'], viewport: { width: 390, height: 844 }, isMobile: true, deviceScaleFactor: 1 })
      const page = await context.newPage()
      page.on('pageerror', error => errors.push(error.message))
      await page.addInitScript(({ code, id, guest, i }) => {
        localStorage.setItem('hayawanat_session', JSON.stringify({ guestUuid: guest, participantId: id, roomCode: code, displayName: i ? `لاعب ${i}` : 'المضيف' }))
        window.__tracks = []; window.__events = []; window.__sockets = []; window.__urls = new Set()
        const gum = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices)
        navigator.mediaDevices.getUserMedia = async (...args) => {
          const stream = await gum(...args); window.__tracks.push(...stream.getTracks()); return stream
        }
        const Original = window.WebSocket
        window.WebSocket = class extends Original {
          constructor(...args) {
            super(...args); window.__sockets.push(this)
            this.addEventListener('message', e => {
              const event = JSON.parse(e.data)
              if (event.data?.audio) event.data.audio = { present: true }
              window.__events.push(event)
            })
          }
        }
        const create = URL.createObjectURL.bind(URL), revoke = URL.revokeObjectURL.bind(URL)
        URL.createObjectURL = blob => { const url = create(blob); window.__urls.add(url); return url }
        URL.revokeObjectURL = url => { window.__urls.delete(url); revoke(url) }
      }, { code: game.code, id: game.ids[i], guest: game.guests[i], i })
      await page.goto(`${front}/game/${game.code}`)
      await page.waitForFunction(() => window.__events.some(e => e.type === 'state_sync'))
      pages.push(page)
    }
    const [host,p1,p2] = pages
    const record = async (page, ms, auto = false) => {
      await page.getByRole('button', { name: '🎤 سؤال صوتي', exact: true }).click()
      await page.getByRole('button', { name: '🎤 بدء التسجيل', exact: true }).click()
      await page.getByText('🔴 جارٍ التسجيل', { exact: true }).waitFor()
      await pause(ms)
      if (!auto) await page.getByRole('button', { name: '⏹ إيقاف التسجيل', exact: true }).click()
      await page.getByRole('button', { name: '📤 إرسال التسجيل', exact: true }).waitFor()
      assert(await page.evaluate(() => window.__tracks.every(t => t.readyState === 'ended')))
    }
    const play = async (page, label) => {
      const audio = page.locator(`audio[aria-label="${label}"]`).first()
      await audio.waitFor()
      await audio.evaluate(async a => { await a.play() })
      await page.waitForFunction(label => [...document.querySelectorAll('audio')].some(a => a.getAttribute('aria-label') === label && a.currentTime > 0.15 && !a.error), label)
      await audio.evaluate(a => a.pause())
    }
    const send = async page => {
      const before = await page.evaluate(() => window.__events.filter(e => e.type === 'question_submitted').length)
      await page.getByRole('button', { name: '📤 إرسال التسجيل', exact: true }).click()
      await page.waitForFunction(before => window.__events.filter(e => e.type === 'question_submitted').length > before, before)
    }
    const answer = async (page, value) => {
      await page.getByRole('button', { name: value, exact: true }).click()
      await page.getByRole('button', { name: value, exact: true }).waitFor({ state: 'hidden' })
    }
    await record(p1, 5000)
    pass('5-second MediaRecorder recording, preview and microphone cleanup')
    await play(p1, 'معاينة التسجيل')
    assert.equal(await p1.evaluate(() => window.__events.filter(e => e.type === 'question_submitted').length), 0)
    pass('Local preview plays without automatically sending')
    if (process.env.VOICE_SCREENSHOT_DIR) {
      fs.mkdirSync(process.env.VOICE_SCREENSHOT_DIR, { recursive: true })
      await p1.screenshot({ path: `${process.env.VOICE_SCREENSHOT_DIR}/voice-preview.png`, fullPage: true })
    }
    await send(p1)
    await play(p2, 'سؤال صوتي من لاعب 1')
    await play(host, 'سؤال صوتي من لاعب 1')
    pass('Opponent and audience decode/play the real relayed recording')
    assert.equal(await host.getByRole('button', { name: '✅ نعم', exact: true }).count(), 0)
    await answer(p2, '✅ نعم')
    await p2.getByRole('button', { name: '🎤 سؤال صوتي', exact: true }).waitFor()
    pass('Yes answer increments count and switches turn; audience cannot answer')
    await record(p2, 13000, true)
    assert(await p2.getByText('معاينة السؤال · 12 ثوانٍ', { exact: true }).isVisible())
    pass('12-second automatic stop with manual-send preview')
    await send(p2)
    await answer(p1, '🚫 غير صالح')
    await p2.getByRole('button', { name: '🎤 سؤال صوتي', exact: true }).waitFor()
    const invalidCount = await p1.evaluate(() => window.__events.filter(e => e.type === 'answer_submitted').at(-1).data.question_count)
    assert.equal(invalidCount, 1)
    pass('Invalid voice remains in history, does not count, preserves turn')
    await record(p2, 800)
    await send(p2)
    await answer(p1, '❌ لا')
    pass('No answer counts audio and switches turn')
    // Finish max_questions=5 with three written questions.
    for (const [asker, answerer] of [[p1,p2],[p2,p1],[p1,p2]]) {
      await asker.getByRole('button', { name: '✍️ سؤال كتابي', exact: true }).click()
      await asker.locator('textarea').fill('هل حيواني يعيش في الماء؟')
      await asker.getByRole('button', { name: 'إرسال السؤال', exact: true }).click()
      await answer(answerer, '✅ نعم')
    }
    assert.equal(await p2.evaluate(() => window.__events.filter(e => e.type === 'answer_submitted').at(-1).data.question_count), 5)
    await p2.getByRole('button', { name: '🎤 سؤال صوتي', exact: true }).click()
    assert(await p2.getByRole('button', { name: '🎤 بدء التسجيل', exact: true }).isDisabled())
    pass('Three text + two valid voice questions share the five-question limit')
    await p1.reload()
    await p1.getByText('التسجيل غير متوفر بعد إعادة الاتصال أو تفريغ الذاكرة', { exact: true }).first().waitFor()
    assert.equal(await p1.locator('audio').count(), 0)
    pass('Refresh restores metadata with Arabic unavailable-audio fallback')
    // Restore an unlimited fresh round for failure/cleanup scenarios.
    await api(`/api/rounds/${game.code}/cancel?guest_uuid=${game.guests[0]}`)
    await api(`/api/rooms/${game.code}/settings?guest_uuid=${game.guests[0]}`, { max_questions: null })
    await api(`/api/rounds/${game.code}/start?guest_uuid=${game.guests[0]}`, { player1_id: game.ids[1], player2_id: game.ids[2] })
    await p1.getByRole('button', { name: '🎤 سؤال صوتي', exact: true }).click()
    await p1.evaluate(() => { window.__gum = navigator.mediaDevices.getUserMedia; navigator.mediaDevices.getUserMedia = () => Promise.reject(new DOMException('Denied', 'NotAllowedError')) })
    await p1.getByRole('button', { name: '🎤 بدء التسجيل', exact: true }).click()
    await p1.getByRole('alert').filter({ hasText: 'لم يُسمح باستخدام الميكروفون' }).waitFor()
    await p1.getByRole('button', { name: '✍️ سؤال كتابي', exact: true }).click()
    assert(await p1.locator('textarea').isVisible())
    await p1.evaluate(() => { navigator.mediaDevices.getUserMedia = window.__gum })
    pass('Permission-denial error is Arabic and written questions remain available')
    await p1.getByRole('button', { name: '🎤 سؤال صوتي', exact: true }).click()
    await p1.getByRole('button', { name: '🎤 بدء التسجيل', exact: true }).click()
    await p1.getByText('🔴 جارٍ التسجيل', { exact: true }).waitFor()
    await p1.evaluate(() => window.__sockets.at(-1).close())
    await p1.waitForFunction(() => window.__tracks.every(t => t.readyState === 'ended'))
    assert.equal(await p1.locator('audio[aria-label="معاينة التسجيل"]').count(), 0)
    pass('Disconnect during recording stops microphone and discards unsent media')
    await pause(1600)
    await record(p1, 800)
    await p1.getByRole('button', { name: '🗑️ حذف وإعادة التسجيل', exact: true }).click()
    assert.equal(await p1.evaluate(() => window.__urls.size), 0)
    pass('Delete/re-record revokes the preview object URL')
    await p1.evaluate(() => { window.__recorder = window.MediaRecorder; window.MediaRecorder = undefined })
    await p1.getByRole('button', { name: '🎤 بدء التسجيل', exact: true }).click()
    await p1.getByRole('alert').filter({ hasText: 'التسجيل غير مدعوم' }).waitFor()
    await p1.evaluate(() => { window.MediaRecorder = window.__recorder })
    pass('Unsupported MediaRecorder produces a recoverable Arabic error')
    await p1.evaluate(() => { window.__gum2 = navigator.mediaDevices.getUserMedia; navigator.mediaDevices.getUserMedia = () => Promise.reject(new DOMException('Missing', 'NotFoundError')) })
    await p1.getByRole('button', { name: '🎤 بدء التسجيل', exact: true }).click()
    await p1.getByRole('alert').filter({ hasText: 'لم نعثر على ميكروفون' }).waitFor()
    await p1.evaluate(() => { navigator.mediaDevices.getUserMedia = window.__gum2 })
    pass('Missing microphone produces a recoverable Arabic error')
    await record(p1, 800)
    await p1.evaluate(() => {
      const socket = window.__sockets.at(-1), send = socket.send.bind(socket)
      socket.send = text => { const message = JSON.parse(text); if (message.type === 'voice_question') message.data.duration_ms = 13000; send(JSON.stringify(message)) }
    })
    await p1.getByRole('button', { name: '📤 إرسال التسجيل', exact: true }).click()
    await p1.getByRole('alert').filter({ hasText: 'يجب ألا يتجاوز التسجيل 12 ثانية' }).waitFor()
    assert(await p1.getByRole('button', { name: '📤 إرسال التسجيل', exact: true }).isEnabled())
    pass('Backend rejection restores preview with its Arabic error')
    await p1.evaluate(() => {
      const socket = window.__sockets.at(-1), send = socket.send.bind(socket)
      socket.send = text => { if (JSON.parse(text).type === 'voice_question') socket.close(); else send(text) }
    })
    await p1.getByRole('button', { name: '📤 إرسال التسجيل', exact: true }).click()
    await p1.getByRole('button', { name: '📤 إرسال التسجيل', exact: true }).waitFor({ state: 'hidden' })
    await p1.waitForFunction(() => window.__urls.size === 0)
    await pause(1600)
    assert.equal((await api(`/api/rounds/${game.code}/questions?guest_uuid=${game.guests[1]}`, undefined, 'GET')).questions.length, 0)
    pass('Disconnect while sending discards media and does not silently resend')
    await record(p1, 800)
    await api(`/api/guesses/${game.code}/submit?guest_uuid=${game.guests[1]}`, { animal_id: -1 })
    await p1.waitForFunction(() => window.__urls.size === 0)
    assert.equal(await p1.getByRole('button', { name: '📤 إرسال التسجيل', exact: true }).count(), 0)
    pass('Turn change discards unsent preview and revokes its URL')
    await api(`/api/rounds/${game.code}/cancel?guest_uuid=${game.guests[0]}`)
    await api(`/api/rounds/${game.code}/start?guest_uuid=${game.guests[0]}`, { player1_id: game.ids[1], player2_id: game.ids[2] })
    // Deterministic real backend deadline in the test-only DB is set by helper.
    if (process.env.VOICE_EXPIRE_COMMAND) {
      const { execFileSync } = require('node:child_process')
      execFileSync('docker', ['exec', 'hayawanat-voice-api', 'python', '-c',
        `from app.db.session import SessionLocal; from app.models.models import Round,Room; from datetime import datetime,timezone; db=SessionLocal(); r=db.query(Round).join(Room).filter(Room.code=='${game.code}',Round.status=='active').one(); r.timer_duration=4; r.timer_started_at=datetime.now(timezone.utc); db.commit(); db.close()`])
      await p1.reload()
      await p1.getByRole('button', { name: '🎤 سؤال صوتي', exact: true }).click()
      await p1.getByRole('button', { name: '🎤 بدء التسجيل', exact: true }).click()
      await p1.getByText('🔴 جارٍ التسجيل', { exact: true }).waitFor()
      await p1.waitForFunction(() => window.__events.some(e => e.type === 'round_finished'), { timeout: 10000 })
      await p1.waitForFunction(() => window.__tracks.every(t => t.readyState === 'ended'))
      assert.equal(await p1.locator('audio[aria-label="معاينة التسجيل"]').count(), 0)
      pass('Real server deadline ends round and safely cancels in-progress recording')
      await host.getByRole('button', { name: '🔄 إعادة اللعب', exact: true }).click()
      await p1.getByRole('button', { name: '🎤 سؤال صوتي', exact: true }).waitFor()
      pass('Rematch restores playable game UI')
    }
    for (const page of pages) {
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false)
      assert.equal(await page.evaluate(() => window.__sockets.filter(s => s.readyState === 1).length), 1)
    }
    pass('390px mobile layout fits; one WebSocket per client')
    await p1.getByRole('button', { name: '🎤 سؤال صوتي', exact: true }).click()
    await p1.getByRole('button', { name: '🎤 بدء التسجيل', exact: true }).click()
    await p1.getByText('🔴 جارٍ التسجيل', { exact: true }).waitFor()
    await api(`/api/rooms/${game.code}/remove-participant?guest_uuid=${game.guests[0]}&target_id=${game.ids[1]}`)
    await p1.waitForFunction(() => window.__tracks.every(t => t.readyState === 'ended'))
    pass('Removing a recording player stops their microphone')
    assert.deepEqual(errors, [])
    pass('No uncaught browser errors')
  } finally {
    await browser.close()
    fs.writeFileSync(process.env.VOICE_REPORT || 'voice-browser-results.json', JSON.stringify({ results, errors }, null, 2))
  }
}
main().catch(error => { console.error(error); process.exitCode = 1 })
