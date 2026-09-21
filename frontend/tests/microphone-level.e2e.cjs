// Local-only browser test. Uses a synthetic oscillator, never a person's mic.
// Run with Playwright installed and the app/API running on localhost.
const { chromium } = require('playwright')
const assert = require('node:assert/strict')
const crypto = require('node:crypto')
const fs = require('node:fs')
const front = process.env.VOICE_FRONTEND_URL || 'http://localhost:5173'
const back = process.env.VOICE_API_URL || 'http://localhost:8000'
async function api(path, body) {
  const response = await fetch(back + path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, ...(body ? { body: JSON.stringify(body) } : {}) })
  assert.equal(response.status, 200, await response.clone().text())
  return response.json()
}
async function run() {
  const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe' })
  const guests = [crypto.randomUUID(), crypto.randomUUID()]
  const created = await api('/api/rooms/', { display_name: 'Meter test host', guest_uuid: guests[0] })
  const code = created.room.code
  const joined = await api(`/api/rooms/${code}/join`, { room_code: code, display_name: 'Meter test opponent', guest_uuid: guests[1] })
  const ids = [created.participant.id, joined.participant.id]
  await api(`/api/rounds/${code}/start?guest_uuid=${guests[0]}`, { player1_id: ids[0], player2_id: ids[1] })
  const errors = []
  try {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 } })
    const page = await context.newPage()
    page.on('pageerror', error => errors.push(error.message))
    await page.addInitScript(({ guest, id, code }) => {
      localStorage.setItem('hayawanat_session', JSON.stringify({ guestUuid: guest, participantId: id, roomCode: code, displayName: 'Meter test host' }))
      const Native = window.AudioContext
      window.__meterContexts = []; window.__streams = []; window.__sources = []; window.__gumCalls = 0
      window.AudioContext = class extends Native {
        constructor(...args) { super(...args); window.__meterContexts.push(this) }
      }
      window.__workingAudioContext = window.AudioContext
      navigator.mediaDevices.getUserMedia = async () => {
        window.__gumCalls++
        const context = new Native()
        const oscillator = context.createOscillator(), gain = context.createGain(), output = context.createMediaStreamDestination()
        gain.gain.value = 0
        oscillator.frequency.value = 440
        oscillator.connect(gain); gain.connect(output); oscillator.start()
        await context.resume()
        window.__gain = gain
        window.__streams.push(output.stream); window.__sources.push(context)
        return output.stream
      }
    }, { guest: guests[0], id: ids[0], code })
    await page.goto(`${front}/game/${code}`)
    await page.getByRole('button', { name: '🎤 سؤال صوتي', exact: true }).click()
    const start = () => page.getByRole('button', { name: '🎤 بدء التسجيل', exact: true }).click()
    const stop = () => page.getByRole('button', { name: '⏹ إيقاف التسجيل', exact: true }).click()
    const closed = () => page.waitForFunction(() => window.__meterContexts.every(c => c.state === 'closed'))
    const meter = page.getByRole('meter', { name: 'مستوى الميكروفون' })
    await start()
    await meter.waitFor()
    await page.getByText('الصوت منخفض؛ اقترب من الميكروفون', { exact: true }).waitFor()
    assert.equal(await meter.getAttribute('aria-valuenow'), '0')
    console.log('PASS: silence displays an empty meter and Arabic quiet-input hint')
    await page.evaluate(() => { window.__gain.gain.value = 0.08 })
    await page.getByText('الميكروفون يلتقط الصوت', { exact: true }).waitFor()
    const normal = Number(await meter.getAttribute('aria-valuenow'))
    assert(normal > 30 && normal < 80)
    assert.equal(await page.evaluate(() => window.__gumCalls), 1)
    console.log('PASS: real Web Audio samples drive the meter; no additional microphone request')
    if (process.env.METER_SCREENSHOT) await page.screenshot({ path: process.env.METER_SCREENSHOT, fullPage: true })
    await page.evaluate(() => { window.__gain.gain.value = 1 })
    await page.getByText('الصوت مرتفع جداً؛ ابتعد قليلاً', { exact: true }).waitFor()
    assert(Number(await meter.getAttribute('aria-valuenow')) > normal)
    console.log('PASS: louder input increases the level and shows the high-input hint')
    await stop()
    await page.getByRole('button', { name: '📤 إرسال التسجيل', exact: true }).waitFor()
    await closed()
    assert.equal(await meter.count(), 0)
    assert(await page.evaluate(() => window.__streams.every(s => s.getTracks().every(t => t.readyState === 'ended'))))
    await page.locator('audio[aria-label="معاينة التسجيل"]').evaluate(a => a.play())
    await page.waitForFunction(() => document.querySelector('audio')?.currentTime > 0.1)
    await page.locator('audio').evaluate(a => a.pause())
    console.log('PASS: stop closes meter context and mic tracks; recorded preview still plays')
    await page.getByRole('button', { name: '🗑️ حذف وإعادة التسجيل', exact: true }).click()
    await start()
    await meter.waitFor()
    await page.getByRole('button', { name: '✍️ سؤال كتابي', exact: true }).click()
    await closed()
    console.log('PASS: switching to text during recording cleans up the meter')
    await page.getByRole('button', { name: '🎤 سؤال صوتي', exact: true }).click()
    await page.evaluate(() => { window.AudioContext = class { constructor() { throw new Error('Unavailable for test') } } })
    await start()
    await page.getByText('مؤشر الصوت غير متاح؛ يمكنك متابعة التسجيل', { exact: true }).waitFor()
    await page.evaluate(() => { window.__gain.gain.value = 0.08 })
    await page.waitForTimeout(500)
    await stop()
    await page.getByRole('button', { name: '📤 إرسال التسجيل', exact: true }).waitFor()
    console.log('PASS: analyser failure does not break recording or preview')
    await page.getByRole('button', { name: '🗑️ حذف وإعادة التسجيل', exact: true }).click()
    await page.evaluate(() => { window.AudioContext = window.__workingAudioContext })
    await start()
    await meter.waitFor()
    await page.getByRole('button', { name: '📤 إرسال التسجيل', exact: true }).waitFor({ timeout: 16000 })
    await closed()
    console.log('PASS: 12-second automatic stop closes meter resources')
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false)
    assert.deepEqual(errors, [])
    await page.evaluate(() => Promise.all(window.__sources.map(c => c.close())))
    console.log('PASS: mobile-width layout fits and no uncaught browser errors')
  } finally {
    await browser.close()
    await api(`/api/rounds/${code}/cancel?guest_uuid=${guests[0]}`).catch(() => {})
    await api(`/api/rooms/${code}/close?guest_uuid=${guests[0]}`).catch(() => {})
  }
}
run().catch(error => { console.error(error); process.exitCode = 1 })
