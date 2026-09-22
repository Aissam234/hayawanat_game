const assert = require('node:assert/strict'), fs = require('node:fs'), vm = require('node:vm'), ts = require('typescript')
const compile = name => ts.transpileModule(fs.readFileSync(`src/services/${name}.ts`, 'utf8'), {compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText
const design = {exports:{}}; vm.runInNewContext(compile('backgroundMusic'),design)
let starts=0,stops=0,playing=false
const ctx={state:'running',currentTime:0,destination:{},createBuffer:(channels,n,rate)=>({duration:n/rate,data:new Float32Array(n),getChannelData(){return this.data}}),
createBufferSource:()=>({connect(){},disconnect(){},start(){starts++},stop(){stops++}}),
createGain:()=>({gain:{setValueAtTime(){},linearRampToValueAtTime(){}},connect(){},disconnect(){}})}
const buffer=design.exports.createMusicLoop(ctx)
let peak=0,energy=0;for(const x of buffer.data){assert(Number.isFinite(x));peak=Math.max(peak,Math.abs(x));energy+=x*x}
assert(buffer.duration>35&&buffer.duration<36);assert(peak<0.7&&peak>0.05);assert(energy>0)
const sandbox={exports:{},require:name=>name.includes('backgroundMusic')?design.exports:{synthesizeEffect(){}},window:{AudioContext:function(){return ctx}},document:{hidden:false,querySelectorAll:()=>playing?[{paused:false,ended:false}]:[]},localStorage:{getItem:()=>null,setItem(){}},performance:{now:()=>1000}}
vm.runInNewContext(compile('gameSounds'),sandbox)
const audio=sandbox.exports
audio.refreshMusic();assert.equal(starts,0)
audio.unlockSounds();assert.equal(starts,1)
audio.refreshMusic();audio.unlockSounds();assert.equal(starts,1)
audio.recordingSounds(true);assert.equal(stops,1)
audio.recordingSounds(false);assert.equal(starts,2)
playing=true;audio.refreshMusic();assert.equal(stops,2)
playing=false;audio.refreshMusic();assert.equal(starts,3)
audio.muteSounds(true);assert.equal(stops,3)
audio.refreshMusic();assert.equal(starts,3)
audio.muteSounds(false);assert.equal(starts,4)
sandbox.document.hidden=true;audio.refreshMusic();assert.equal(stops,4)
sandbox.document.hidden=false;audio.refreshMusic();assert.equal(starts,5)
console.log(`PASS: ${buffer.duration.toFixed(2)}s music loop, peak ${peak.toFixed(3)}, no duplicate loops, mute, voice pause/resume, hidden-page pause/resume`)
