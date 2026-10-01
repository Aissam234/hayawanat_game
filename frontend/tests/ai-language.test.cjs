const fs=require('node:fs'),assert=require('node:assert/strict'),ts=require('typescript'),{performance}=require('node:perf_hooks');
require.extensions['.ts']=(m,f)=>m._compile(ts.transpileModule(fs.readFileSync(f,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,esModuleInterop:true}}).outputText,f);
const a=require('../src/features/ai-mode/arabic.ts'),g=require('../src/features/ai-mode/round.ts'),e=require('../src/features/ai-mode/engine.ts');
const groups={
is_mammal:'هل أنا من الثدييات؟|واش أنا من الثدييات؟|wach ana mn ttadyiyat?|wash ana mn tadyiyat?|هل هو ثديي؟|هل هذا الحيوان من الثدييات؟|واش الثديات؟',
can_swim:'هل أستطيع السباحة؟|واش كنسبح؟|واش كنقدر نعوم؟|واش كيسبح؟|wach kansb7?|wach kan3om?|wach kan9der n3om?|wash kanqder n3om?|wach kanseb7?|هل يستطيع السباحة؟|هل يمكنه السباحة؟|واش كيعوم؟|واش نقدر نسبح؟|هل يسبح؟|واش كنـسبح؟|wach kaysb7?|wach kay3om?',
can_fly:'واش كنطير؟|wach kantir?|هل يستطيع الطيران؟|واش كيطير؟|wach kaytir?|هل يحلق؟|هل يمكنني الطيران؟|هل يطير؟',
has_horns:'هل لدي قرون؟|واش عندي قرون؟|wach 3ndi 9ron?|wash 3endi qron?|هل لديه قرون؟|واش عندو قرون؟|هل له قرن؟',
has_tail:'واش عندي ديل؟|wach 3ndi dil?|wash 3endi dil?|هل لديه ذيل؟|واش عندو دنب؟|هل فيه ذيل؟',
has_fur:'هل عنده فرو؟|هل يغطي جسمه الفرو؟|هل لديه شعر؟|واش عندو وبر؟|هل يغطي جسمي الفرو؟',
habitat_desert:'هل أعيش في الصحراء؟|واش كنعيش فالصحرا؟|wach kanskon f s7ra?|wach kan3ich f s7ra?|wash kan3ish f se7ra?|wach kanskon f sahra?|هل يسكن في الصحراء؟|واش كيسكن فالصحرا؟',
habitat_jungle:'واش كنسكن فالغابة؟|wach kan3ich f lghaba?|wach kanskon f lghaba?|wash kan3ish f ghaba?|هل أعيش في الغابه؟|هل يعيش في لغابة؟|هل يوجد في الغابة؟|واش كيعيش فالغابة؟',
habitat_water:'هل أعيش في الماء؟|wach kan3ich f lma?|wash kan3ish f ma?|واش كاين فالما؟|هل يعيش في المياه؟|واش كنعيش ف الماء؟',
habitat_land:'هل يعيش في البر؟|واش كيعيش فالبر؟|هل أعيش على اليابسة؟',
habitat_arctic:'هل يعيش في القطب؟|هل موطنه المناطق القطبية؟|هل يعيش في المناطق القطبية؟',
habitat_domestic:'واش كنعيش فالدار؟|wach kanskon f ddar?|wash kan3ish f dar?|هل يعيش في البيت؟|هل يسكن في المزرعة؟',
habitat_air:'هل موطنه الجو؟|هل موطنه الهواء؟',
diet_carnivore:'هل أتناول اللحوم؟|واش كناكل اللحم؟|wach kanakol l7em?|wash kanakol le7m?|هل يتغذى على اللحوم؟|هل هو لاحم؟|هل أنا من أكلة اللحوم؟',
diet_herbivore:'واش كناكل العشب؟|wach kanakol l3chb?|هل يأكل النباتات؟|هل أنا عاشب؟|هل أتناول الأعشاب؟',
diet_omnivore:'هل آكل النباتات واللحوم معا؟|واش كناكل اللحم والنباتات؟|wach kanakol l7em w l3chb?',
is_nocturnal:'واش كنخرج بالليل؟|wach kankhrej b lil?|هل ينشط ليلاً؟|هل يتحرك في الليل؟|واش كيخرج فالليل؟',
lives_in_groups:'هل أعيش في مجموعات؟|واش كنعيش مع مجموعة؟|wach kan3ich m3a groupe?|wash kan3ish m3a group?|هل يعيش في قطيع؟|واش كيعيش فمجموعات؟',
is_domestic:'واش أنا حيوان ديال الدار؟|wach ana 7ayawan dial dar?|wash ana hayawan dial ddar?|واش حيوان أليف؟|هل هو مستأنس؟|هل يمكن تربيته في البيت؟',
is_african:'واش حيوان إفريقي؟|wach 7ayawan ifri9i?|wash hayawan afriqi?|هل يعيش في إفريقيا؟|هل موطنه أفريقيا؟|هل هو من أفريقيا؟',
size_small:'هل حجمه صغير؟|واش صغيور؟|هل حيوان صغير؟',size_medium:'هل حجمي متوسط؟|هل هو متوسط الحجم؟|واش وسطاني؟',size_large:'هل حجمه كبير؟|واش كبير؟',size_huge:'هل حجمه ضخم؟|هل هو كبير جدا؟|واش عملاق؟',
};
const cases=[];for(const [id,texts] of Object.entries(groups))for(const text of texts.split('|'))cases.push({text,kind:'understood',parts:[{questionId:id,negated:false}]});
for(const [id,texts] of Object.entries({can_swim:'ما كنسبحش|واش ما كنسبحش؟|wach makansb7ch?|wach ma kansb7ch?|هل لا أستطيع السباحة؟',can_fly:'ما كيطيرش|مكيطيرش|wach makaytirch?|واش مكيطيرش؟',is_domestic:'ماشي حيوان أليف|machi 7ayawan alif|wach machi 7ayawan alif?',diet_carnivore:'ما كناكلش اللحم|makanakolch l7em|wach ma kanakolch le7m?',habitat_water:'wach makan3ichch f lma?|واش ما كنعيشش فالما؟'}))for(const text of texts.split('|'))cases.push({text,kind:'understood',parts:[{questionId:id,negated:true}]});
for(const [text,ids] of [['واش كنسبح وكنطير؟',['can_swim','can_fly']],['هل أنا من الثدييات وأعيش في الماء؟',['is_mammal','habitat_water']],['wach kansb7 w kantir?',['can_swim','can_fly']],['wach kanakol l7em w kanskon f s7ra?',['diet_carnivore','habitat_desert']],['wach makansb7ch w kantir?',['can_swim','can_fly']]])cases.push({text,kind:'understood',parts:ids.map((questionId,i)=>({questionId,negated:text.includes('makansb7ch')&&i===0}))});
for(const text of ['واش كنعيش فالبحر؟','wach kan3ich f lb7er?','هل أنا مائي؟'])cases.push({text,kind:'clarify',choices:['habitat_water','can_swim']});
for(const text of ['واش كناكل اللحم ولا النباتات؟','wach kanakol l7em wla l3chb?','واش كنسبح ولا كنطير؟'])cases.push({text,kind:'clarify',choiceCount:2});
for(const text of ['واش سريع؟','واش سام؟','واش كنعيش فالمغرب؟','wach kay7eb pizza?','هل يسبح في الفضاء؟','wach kansb7 very fast?','واش كناكل النباتات السامة؟','هل لا لا أسبح؟','wach ma kansb7?','wach kansb7 w kantir w kan3om?','wach kanakol l7em w mystery?','هل أعيش في الغابة إذا كنت أسدا؟','<script>alert(1)</script>','9'.repeat(201)])cases.push({text,kind:'clarify',choiceCount:0});
cases.push({text:'واش كنسبحح؟',kind:'clarify',choices:['can_swim']});
let failures=[];for(const c of cases){try{const p=a.interpretArabic(c.text);assert.equal(p.kind,c.kind);if(c.parts)assert.deepEqual(p.parts,c.parts);if(c.choices)assert.deepEqual(p.choices.map(x=>x.questionId),c.choices);if(c.choiceCount!==undefined)assert.equal(p.choices.length,c.choiceCount)}catch(err){failures.push(c.text+': '+err.message)}}
const fresh=()=>g.startRound({difficulty:'medium',animalLevel:'easy',timer:0},null,1000,()=>0);
let state=g.transition(fresh(),{type:'ask-text',text:'واش كنسبح؟',now:1001});state=g.transition(state,{type:'answer-human',now:1002});
for(const text of ['هل أستطيع السباحة؟','wach kan3om?','wach kansb7?']){const next=g.transition({...state,phase:'human'},{type:'ask-text',text,now:1003});assert.equal(next.phase,'human');assert.equal(next.history.length,1);assert.match(next.message,/سبق/)}
for(const c of cases.filter(x=>x.kind==='clarify')){const next=g.transition(fresh(),{type:'ask-text',text:c.text,now:1001});assert.equal(next.phase,'human');assert.equal(next.history.length,0)}
// Same evidence -> same hard decision for all unrelated secret assignments; no RNG in a distinguishable state.
for(const level of ['easy','medium','hard','random']){const candidates=e.getInitialCandidates(level);const action=e.chooseAiAction({candidates,asked:[],difficulty:'hard'},()=>{throw Error('unexpected RNG')});assert.equal(action.type,'question')}
const times=[];for(let warm=0;warm<3;warm++)for(const c of cases)a.interpretArabic(c.text);
for(let i=0;i<20;i++)for(const c of cases){const t=performance.now();a.interpretArabic(c.text);times.push(performance.now()-t)}times.sort((a,b)=>a-b);
console.log(JSON.stringify({languageCases:cases.length,failures,latencyMs:{median:times[Math.floor(times.length*.5)],p95:times[Math.floor(times.length*.95)],max:times.at(-1)}},null,2));
assert.equal(failures.length,0,failures.join('\n'));console.log('PASS language corpus, semantic repetitions, unsupported turns and hard determinism');
