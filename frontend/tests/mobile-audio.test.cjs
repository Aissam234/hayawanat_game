const assert=require('node:assert/strict');
const fs=require('node:fs');
const ts=require('typescript');
(async()=>{
const source=fs.readFileSync('src/services/voiceAudio.ts','utf8');
const js=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022}}).outputText;
const audio=await import('data:text/javascript;base64,'+Buffer.from(js).toString('base64'));
for(const [input,expected] of [['audio/mp4; codecs="mp4a.40.2"','audio/mp4;codecs=mp4a.40.2'],[' Audio/WebM ; codecs="OPUS" ','audio/webm;codecs=opus'],['audio/ogg; codecs=opus','audio/ogg;codecs=opus'],['audio/mp4','audio/mp4']]) assert.equal(audio.normalizeAudioMime(input),expected);
for(const input of ['video/mp4','audio/mp4;codecs=opus','audio/webm;codecs=vorbis','audio/mp4;codecs="mp4a.40.2,avc1"','audio/mp4;codecs=mp4a.40.2;extra=1']) assert.equal(audio.normalizeAudioMime(input),null);
audio.receiveVoiceAudio('safari',{mime_type:'audio/mp4; codecs="mp4a.40.2"',audio_base64:Buffer.from('testbytes').toString('base64')});
assert.ok(audio.getAudioUrl('safari'));audio.clearVoiceAudio();
console.log('PASS: browser MIME variants, unsupported codecs, received clip cache');
})().catch(e=>{console.error(e);process.exitCode=1});
