// A small acoustic-inspired palette: woody mallets, brushed percussion and bells.
// All scheduling uses the audio clock, so mobile timer throttling cannot spoil timing.
export type Sound = 'click' | 'start' | 'question' | 'turn' | 'wrong' | 'finish' | 'win' | 'lose'
type Source = OscillatorNode | AudioBufferSourceNode
export function synthesizeEffect(ctx: BaseAudioContext, sound: Sound, track: (source: Source) => void, volume = 1) {
  const bus = ctx.createGain()
  bus.gain.value = 0.55 * volume
  const compressor = ctx.createDynamicsCompressor()
  compressor.threshold.value = -16; compressor.knee.value = 12; compressor.ratio.value = 4
  compressor.attack.value = 0.003; compressor.release.value = 0.12
  bus.connect(compressor); compressor.connect(ctx.destination)
  const origin = ctx.currentTime + 0.015
  let pending = 0
  function source(node: Source, nodes: AudioNode[], at: number, duration: number) {
    pending++; track(node)
    node.onended = () => {
      node.disconnect(); nodes.forEach(n => n.disconnect())
      if (--pending === 0) { bus.disconnect(); compressor.disconnect() }
    }
    node.start(origin + at); node.stop(origin + at + duration)
  }
  function tone(at: number, hz: number, duration: number, volume: number, type: OscillatorType = 'sine', endHz = hz) {
    const oscillator = ctx.createOscillator(), gain = ctx.createGain()
    oscillator.type = type
    oscillator.frequency.setValueAtTime(hz, origin + at)
    oscillator.frequency.exponentialRampToValueAtTime(endHz, origin + at + duration * 0.75)
    gain.gain.setValueAtTime(0, origin + at)
    gain.gain.linearRampToValueAtTime(volume, origin + at + 0.006)
    gain.gain.exponentialRampToValueAtTime(0.0001, origin + at + duration)
    oscillator.connect(gain); gain.connect(bus)
    source(oscillator, [gain], at, duration)
  }
  function mallet(at: number, hz: number, volume = 0.19, length = 0.30) {
    tone(at, hz, length, volume)
    tone(at, hz * 2.76, 0.06, volume * 0.24)
    tone(at, hz * 5.4, 0.025, volume * 0.09)
  }
  function bell(at: number, hz: number, volume = 0.09) {
    tone(at, hz, 0.62, volume)
    tone(at, hz * 2, 0.26, volume * 0.32)
    tone(at, hz * 3.01, 0.12, volume * 0.12)
  }
  function brush(at: number, volume = 0.045, length = 0.10) {
    const buffer = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * length), ctx.sampleRate)
    const data = buffer.getChannelData(0)
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1
    const noise = ctx.createBufferSource(), filter = ctx.createBiquadFilter(), gain = ctx.createGain()
    noise.buffer = buffer; filter.type = 'bandpass'; filter.frequency.value = 2800; filter.Q.value = 0.6
    gain.gain.setValueAtTime(0, origin + at)
    gain.gain.linearRampToValueAtTime(volume, origin + at + 0.008)
    gain.gain.exponentialRampToValueAtTime(0.0001, origin + at + length)
    noise.connect(filter); filter.connect(gain); gain.connect(bus)
    source(noise, [filter, gain], at, length)
  }
  function drum(at: number, volume = 0.19) { tone(at, 170, 0.15, volume, 'sine', 65); brush(at, 0.025, 0.04) }
  switch (sound) {
    case 'click':
      mallet(0, 880, 0.22, 0.10); tone(0.025, 1174.66, 0.10, 0.065)
      break
    case 'start':
      drum(0); drum(0.18, 0.13); brush(0.30)
      ;[392, 523.25, 659.25, 783.99].forEach((hz, i) => mallet(0.08 + i * 0.115, hz))
      bell(0.49, 1046.5, 0.065)
      break
    case 'question':
      // Soft wooden knock and upward bubble; subtle enough to repeat.
      mallet(0, 620, 0.13, 0.14); tone(0.055, 740, 0.16, 0.07, 'sine', 1040)
      break
    case 'turn':
      mallet(0, 659.25, 0.17); mallet(0.12, 987.77, 0.15)
      bell(0.12, 1318.5, 0.035)
      break
    case 'wrong':
      // A friendly descending "boop", never a harsh buzzer.
      tone(0, 310, 0.24, 0.12, 'triangle', 155)
      mallet(0.16, 196, 0.12, 0.22)
      break
    case 'win':
      drum(0); brush(0.19); drum(0.38, 0.13)
      ;[523.25, 659.25, 783.99, 1046.5].forEach((hz, i) => mallet(i * 0.13, hz, 0.18, 0.36))
      ;[523.25, 659.25, 783.99].forEach(hz => tone(0.53, hz, 0.65, 0.055, 'triangle'))
      bell(0.55, 1568, 0.055); bell(0.74, 2093, 0.04)
      break
    case 'lose':
      mallet(0, 523.25, 0.13); mallet(0.18, 440, 0.12); mallet(0.36, 392, 0.10, 0.45)
      break
    case 'finish':
      mallet(0, 523.25, 0.13); mallet(0.15, 659.25, 0.12); bell(0.31, 783.99, 0.07)
      break
  }
}
