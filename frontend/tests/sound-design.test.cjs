// Uses Chrome's real OfflineAudioContext to render each effect without speakers.
const { chromium } = require('playwright')
const ts = require('typescript')
const fs = require('node:fs')
const assert = require('node:assert/strict')
;(async () => {
  const code = ts.transpileModule(fs.readFileSync('src/services/soundDesign.ts', 'utf8'), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS }
  }).outputText
  const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe' })
  try {
    const page = await browser.newPage()
    const results = await page.evaluate(async code => {
      const module = { exports: {} }; new Function('exports', code)(module.exports)
      const results = []
      for (const name of ['click', 'start', 'question', 'turn', 'wrong', 'finish', 'win', 'lose']) {
        const ctx = new OfflineAudioContext(1, 96000, 48000)
        let sources = 0, ended = 0
        module.exports.synthesizeEffect(ctx, name, node => { sources++; node.addEventListener('ended', () => ended++) })
        const buffer = await ctx.startRendering(), samples = buffer.getChannelData(0)
        let peak = 0, energy = 0, last = 0
        samples.forEach((x, i) => { peak = Math.max(peak, Math.abs(x)); energy += x*x; if (Math.abs(x) > 0.0001) last = i })
        results.push({ name, peak, rms: Math.sqrt(energy/samples.length), duration: last/48000, sources, ended })
      }
      return results
    }, code)
    for (const result of results) {
      assert(result.peak > 0.01 && result.peak < 0.8, JSON.stringify(result))
      assert(result.duration > 0.05 && result.duration < 1.6, JSON.stringify(result))
      assert.equal(result.sources, result.ended)
      console.log(`PASS ${result.name}: ${result.duration.toFixed(2)}s, peak ${result.peak.toFixed(3)}, ${result.sources} layers cleaned up`)
    }
  } finally { await browser.close() }
})().catch(error => { console.error(error); process.exitCode = 1 })
