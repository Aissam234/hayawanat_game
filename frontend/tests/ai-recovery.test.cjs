const fs=require('node:fs'),assert=require('node:assert/strict'),ts=require('typescript');
require.extensions['.ts']=(m,f)=>m._compile(ts.transpileModule(fs.readFileSync(f,'utf8'),{compilerOptions:{module:1,target:7,esModuleInterop:true}}).outputText,f);
const e=require('../src/features/ai-mode/engine.ts'),g=require('../src/features/ai-mode/round.ts'),p=require('../src/features/ai-mode/persistence.ts');
const settings={difficulty:'hard',animalLevel:'random',timer:0};
const fresh=()=>g.startRound(settings,null,1000,()=>0);
let n=0;function test(name,fn){fn();console.log('PASS '+name);n++}
const save=s=>p.decodeSave(JSON.stringify({version:1,round:s,settings:s.settings,draft:'سؤال'}),1010)?.round;
function answer(s,id,value){s=g.transition({...s,phase:'thinking'},{type:'ai-action',action:{type:'question',questionId:id},now:1001});return g.transition(s,{type:'answer-ai',answer:value,now:1002})}
function conflict(){return answer(answer(fresh(),'is_mammal','yes'),'class_bird','yes')}
test('conflicting answers enter review without revealing or scoring',()=>{
 const s=conflict();assert.equal(s.phase,'review');assert.equal(s.candidates.length,0);assert.equal(s.history.length,2);assert.equal(s.winner,null);assert.equal(s.ended,undefined);assert.equal(g.visibleRound(s).own,null);assert.deepEqual(s.scores,{human:0,ai:0});assert.equal(s.pending,undefined);
});
test('correction rebuilds from the full pool, preserves history and resumes human turn',()=>{
 let s=conflict();s=g.transition(s,{type:'correct-answer',index:0,answer:'no',now:1003});
 assert.equal(s.phase,'review');assert(s.candidates.length);assert(s.candidates.every(id=>e.getAnimal(id).animal_class==='bird'));assert.equal(s.history[0].answer,'no');assert.equal(s.history.length,2);assert.deepEqual(s.asked,['is_mammal','class_bird']);
 const resumed=g.transition(s,{type:'resume-review',now:1004});assert.equal(resumed.phase,'human');assert.equal(resumed.started,1000);assert.equal(resumed.humanSecret,s.humanSecret);assert.deepEqual(resumed.scores,s.scores);
});
test('unknown answers release evidence; unresolved conflict cannot resume',()=>{
 const s=conflict();assert.equal(g.transition(s,{type:'resume-review',now:1003}),s);
 const next=g.transition(s,{type:'correct-answer',index:1,answer:'invalid',now:1003});assert(next.candidates.length);assert(next.candidates.every(id=>e.getAnimal(id).is_mammal));
});
test('review and corrected review survive refresh',()=>{
 const s=conflict();assert.deepEqual(save(s),JSON.parse(JSON.stringify(s)));
 const next=g.transition(s,{type:'correct-answer',index:1,answer:'no',now:1003});assert.deepEqual(save(next),JSON.parse(JSON.stringify(next)));
});
test('wrong final AI candidate does not finish, exclusions survive correction',()=>{
 let s={...answer(fresh(),'is_mammal','no'),phase:'thinking',candidates:[3]};
 s=g.transition(s,{type:'ai-action',action:{type:'guess',animalId:3,confidence:'certain'},now:1003,random:()=>0});assert.equal(s.phase,'human');assert.equal(s.candidates.length,0);
 s=g.transition({...s,phase:'thinking'},{type:'ai-action',action:{type:'exhausted'},now:1004});assert.equal(s.phase,'review');assert.equal(g.visibleRound(s).own,null);
 s=g.transition(s,{type:'correct-answer',index:0,answer:'invalid',now:1005});assert(s.candidates.length);assert(!s.candidates.includes(3));
});
test('many incorrect human guesses never end the round',()=>{
 let s=fresh();for(let i=0;i<150;i++){s=g.transition({...s,phase:'human'},{type:'human-guess',animalId:s.aiSecret,now:1001+i});assert.equal(s.phase,'thinking');assert.equal(s.winner,null)}assert.equal(s.history.length,150);assert(save(s));
});
test('timer remains enforced during review and reload',()=>{
 const s={...conflict(),settings:{...settings,timer:20}};
 const next=g.transition(s,{type:'correct-answer',index:0,answer:'no',now:21000});assert.equal(next.phase,'finished');assert.equal(next.reason,'timeout');assert.equal(next.ended,21000);assert.deepEqual(next.scores,s.scores);
 assert.equal(p.decodeSave(JSON.stringify({version:1,round:s,settings:s.settings,draft:''}),21000).round.reason,'timeout');
});
test('corrections cannot alter guesses, human answers or other phases',()=>{
 const s=conflict();assert.equal(g.transition(s,{type:'correct-answer',index:99,answer:'yes',now:1003}),s);
 const f=fresh();assert.equal(g.transition(f,{type:'correct-answer',index:0,answer:'no',now:1003}),f);
 const guess={...s,history:[{side:'ai',kind:'guess',value:3,answer:false}]};assert.equal(g.transition(guess,{type:'correct-answer',index:0,answer:'yes',now:1003}),guess);
 const human={...s,history:[{side:'human',kind:'question',value:'is_mammal',answer:'yes'}]};assert.equal(g.transition(human,{type:'correct-answer',index:0,answer:'no',now:1003}),human);
});
test('candidate rebuild is independent of both secret identities',()=>{
 const s=conflict();assert.deepEqual(g.rebuildCandidates(s),g.rebuildCandidates({...s,humanSecret:99,aiSecret:100}));
 assert(!g.rebuildCandidates.toString().includes('Secret'));
});
test('legacy saves and completed revealed rounds keep their meaning',()=>{
 const old={...fresh(),catalogueVersion:1,pool:e.getInitialCandidates('random',1).map(a=>a.id),candidates:[],phase:'thinking'};
 const next=g.transition(old,{type:'ai-action',action:{type:'exhausted'},now:1002});assert.equal(next.phase,'review');assert(save(next));
 const ended={...old,phase:'finished',reason:'exhausted',ended:1002};assert.equal(save(ended).phase,'finished');
});
console.log(`${n} recovery checks passed`);
