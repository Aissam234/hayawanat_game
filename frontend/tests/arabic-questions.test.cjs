const fs=require('node:fs'),assert=require('node:assert/strict'),ts=require('typescript');
require.extensions['.ts']=(m,f)=>m._compile(ts.transpileModule(fs.readFileSync(f,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,esModuleInterop:true}}).outputText,f);
const a=require('../src/features/ai-mode/arabic.ts'),g=require('../src/features/ai-mode/round.ts');
let count=0;const test=(name,fn)=>{fn();console.log('PASS '+name);count++};
for(const [text,id,negated] of [
 ['هل يوجد في الغابة؟','habitat_jungle',false],['واش كاين فالما؟','habitat_water',false],['هل له قرون؟','has_horns',false],
 ['واش كيسبح؟','can_swim',false],['هاد الحيوان عندي…. واش كيسبح؟','can_swim',false],
 ['هل يستطيع الطيران؟','can_fly',false],['واش ما كيسبحش؟','can_swim',true],
 ['واش كيعيش فالغابة؟','habitat_jungle',false],['واش عندو قرون؟','has_horns',false],
 ['هل حجمه كبير؟','size_large',false],['واش كياكل اللحم؟','diet_carnivore',false],
 ['هَلْ أَنَا مِنَ الثَّدِيِّيَاتِ؟','is_mammal',false],
 ['واش كنسبح؟','can_swim',false],['هل أستطيع السباحة؟','can_swim',false],
 ['واش ما كنسبحش؟','can_swim',true],['هل لا أستطيع الطيران؟','can_fly',true],
 ['واش ماشي حيوان أليف؟','is_domestic',true],['هل أعيش في الماء؟','habitat_water',false],
 ['واش كنعيش فالغابة؟','habitat_jungle',false],['هل حجمي كبير؟','size_large',false],
 ['واش عندي ديل؟','has_tail',false],['هل لدي قرون؟','has_horns',false],
 ['واش كناكل اللحم؟','diet_carnivore',false],['هل آكل النباتات واللحوم معا؟','diet_omnivore',false],
 ])test(text,()=>{const p=a.interpretArabic(text);assert.equal(p.kind,'understood');assert.deepEqual(p.parts,[{questionId:id,negated}])});
test('two clear clauses are recognized independently',()=>{const p=a.interpretArabic('هل أنا من الثدييات وأستطيع السباحة؟');assert.equal(p.kind,'understood');assert.equal(p.parts.length,2)});
test('diet alternatives require a choice, not an AND assertion',()=>{const p=a.interpretArabic('أنا كناكل اللحم ولا النباتات؟');assert.equal(p.kind,'clarify');assert.deepEqual(p.choices.map(x=>x.questionId),['diet_carnivore','diet_herbivore'])});
for(const text of ['واش كنعيش فالبحر؟','هل أنا مائي؟'])test('clarify '+text,()=>{const p=a.interpretArabic(text);assert.equal(p.kind,'clarify');assert.equal(p.choices.length,2)});
for(const text of ['هل أستطيع السباحة في الفضاء؟','هل أنا أسد؟','أنا حزين','هل آكل النباتات السامة؟','هل لا لا أسبح؟','هل أنا من الثدييات وهل أحب الموسيقى؟','هل لا أسبح ولا أطير ولا آكل النباتات؟','<script>alert(1)</script>','هل أنا من الثدييات إذا كنت طائرا؟','أ'.repeat(201)])test('reject unsupported: '+text.slice(0,40),()=>assert.equal(a.interpretArabic(text).kind,'clarify'));
const fresh=()=>g.startRound({difficulty:'medium',animalLevel:'easy',timer:0},null,1000,()=>0);
test('unrecognized input never consumes turn',()=>{const s=g.transition(fresh(),{type:'ask-text',text:'هل أحب البيتزا؟',now:1001});assert.equal(s.phase,'human');assert.equal(s.history.length,0)});
test('compound creates one turn with two explicit answers',()=>{let s=g.transition(fresh(),{type:'ask-text',text:'هل أنا من الثدييات وأستطيع السباحة؟',now:1001});assert.equal(s.phase,'answering');s=g.transition(s,{type:'answer-human',now:1801});assert.equal(s.phase,'thinking');assert.equal(s.history.length,1);assert.equal(s.humanAsked.length,2);assert.match(s.history[0].reply,/نعم/);assert.equal(s.history[0].reply.split('\n').length,2);assert.equal(s.history[0].text,'هل أنا من الثدييات وأستطيع السباحة؟')});
test('negation answers also explain underlying property',()=>{assert.match(a.replyToMeanings([{questionId:'is_mammal',negated:true}],1),/^لا.*حيوانك من الثدييات/)});
test('already answered phrasing cannot spend another turn',()=>{let s=g.transition(fresh(),{type:'ask-text',text:'هل أنا من الثدييات؟',now:1001});s=g.transition(s,{type:'answer-human',now:1801});s={...s,phase:'human'};s=g.transition(s,{type:'ask-text',text:'واش من الثدييات؟',now:1900});assert.equal(s.phase,'human');assert.equal(s.history.length,1)});
test('interpreter has no secret or network access',()=>{const src=fs.readFileSync('src/features/ai-mode/arabic.ts','utf8').split('export function replyToMeanings')[0];assert(!/humanSecret|aiSecret|fetch\(|WebSocket/.test(src))});
console.log(`${count} Arabic parser/state checks passed`);

for(const text of ['هل يوجد في حديقة الحيوانات ؟','واش كاين فحديقة الحيوانات؟'])test('recognizes zoo without inventing facts',()=>{const p=a.interpretArabic(text);assert.equal(p.kind,'clarify');assert.match(p.message,/حديقة/);assert.equal(p.choices[0].questionId,'is_domestic')});
