const assert = require('node:assert/strict')
const fs = require('node:fs')
const vm = require('node:vm')
const ts = require('typescript')
let count = 0, time = 1000, playing = false
const storage = new Map()
const context = { state: 'running', currentTime: 0, destination: {},
  createOscillator: () => { count++; return { frequency: {}, connect() {}, disconnect() {}, start() {}, stop() { this.onended?.() } } },
  createGain: () => ({ gain: { setValueAtTime() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {} }, connect() {}, disconnect() {} }) }
const sandbox = { exports: {}, require: () => ({ synthesizeEffect: (ctx, sound, track) => { const node = ctx.createOscillator(); node.addEventListener = () => {}; track(node) } }), window: { AudioContext: function() { return context } },
  document: { hidden: false, querySelectorAll: () => playing ? [{ paused: false, ended: false }] : [] },
  localStorage: { getItem: k => storage.get(k), setItem: (k,v) => storage.set(k,v) }, performance: { now: () => time += 1000 } }
const source = fs.readFileSync('src/services/gameSounds.ts', 'utf8')
vm.runInNewContext(ts.transpileModule(source, {compilerOptions: {module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022}}).outputText, sandbox)
const sound = sandbox.exports
sound.playSound('start'); assert.equal(count,0)
sound.unlockSounds(); sound.playSound('start'); assert.equal(count,1)
sound.muteClicks(true); sound.playSound('finish'); assert.equal(count,1); assert.equal(storage.get('hayawanat_clicks_muted'),'1')
sound.muteClicks(false); sound.recordingSounds(true); sound.playSound('question'); assert.equal(count,1)
sound.recordingSounds(false); playing=true; sound.playSound('turn'); assert.equal(count,1)
playing=false; sandbox.document.hidden=true; sound.playSound('wrong'); assert.equal(count,1)
sandbox.document.hidden=false; sound.playSound('finish'); assert.equal(count,2)
console.log('PASS: gesture unlock, mute persistence, recording/playback suppression, hidden page suppression, event patterns')
