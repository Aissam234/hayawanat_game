// Original 16-bar, 108 BPM loop, synthesized once locally (no streamed music).
// Marimba-like melody, soft bass, offbeat chords and light percussion.
export function createMusicLoop(ctx: BaseAudioContext): AudioBuffer {
  const rate = 22050, beat = 60 / 108, bars = 16
  const buffer = ctx.createBuffer(1, Math.round(bars * 4 * beat * rate), rate)
  const data = buffer.getChannelData(0)
  const hz = (midi: number) => 440 * 2 ** ((midi - 69) / 12)
  function note(at: number, duration: number, frequency: number, volume: number, bright = false) {
    const first = Math.round(at * rate), length = Math.round(duration * rate)
    for (let i = 0; i < length; i++) {
      const t = i / rate, phase = 2 * Math.PI * frequency * t
      const envelope = Math.min(1, t / 0.008) * Math.exp(-t * 5 / duration) * Math.min(1, (duration - t) / 0.025)
      const wave = Math.sin(phase) + (bright ? 0.24 * Math.sin(phase * 2.76) * Math.exp(-t * 30) : 0.14 * Math.sin(phase * 2))
      data[(first + i) % data.length] += wave * volume * envelope
    }
  }
  function drum(at: number, accent: boolean) {
    const first = Math.round(at * rate), length = Math.round(rate * 0.12)
    for (let i = 0; i < length; i++) {
      const t = i / rate
      const sound = accent ? Math.sin(2 * Math.PI * (75 * t + 4 * (1 - Math.exp(-t * 25)))) : Math.sin(i * 123.45) * Math.sin(i * 78.91)
      data[(first + i) % data.length] += sound * (accent ? 0.07 : 0.025) * Math.min(1, t / 0.003) * Math.exp(-t * (accent ? 35 : 65))
    }
  }
  const chords = [[48, 64, 67], [45, 60, 64], [53, 60, 65], [43, 59, 62]]
  const melodies = [[76, 79, 81, 79, 76, 74], [72, 76, 79, 76, 72, 69], [77, 81, 79, 77, 76, 72], [74, 79, 77, 74, 71, 74]]
  const rhythm = [0, 0.75, 1.5, 2, 2.75, 3.5]
  for (let bar = 0; bar < bars; bar++) {
    const chord = chords[bar % 4], start = bar * 4 * beat
    for (let b = 0; b < 4; b++) {
      drum(start + b * beat, b % 2 === 0)
      drum(start + (b + 0.5) * beat, false)
      if (b % 2 === 0) note(start + b * beat, beat * 0.8, hz(chord[0]), 0.085)
      chord.slice(1).forEach(pitch => note(start + (b + 0.5) * beat, beat * 0.45, hz(pitch), 0.025))
    }
    melodies[bar % 4].forEach((pitch, n) => {
      // Leave breathing room in the second half; alternate the phrase ending.
      if (bar >= 8 && n === 3) return
      note(start + rhythm[n] * beat, beat * 0.75, hz(pitch + (bar >= 12 && n === 5 ? 12 : 0)), 0.085, true)
    })
  }
  return buffer
}
