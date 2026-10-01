const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..');
const ts=require(root+'/node_modules/typescript');
const proposed=false,overlay={};
require.extensions['.ts']=(m,f)=>m._compile(ts.transpileModule(overlay[f.replaceAll('\\','/')]??fs.readFileSync(f,'utf8'),{compilerOptions:{module:1,target:7,esModuleInterop:true}}).outputText,f);
const a=require(root+'/src/features/ai-mode/arabic.ts'),g=require(root+'/src/features/ai-mode/round.ts'),e=require(root+'/src/features/ai-mode/engine.ts');
const source=fs.readFileSync(root+'/tests/ai-language.test.cjs','utf8');
const cases=Function(source.slice(source.indexOf('const groups='),source.indexOf('let failures='))+'return cases;')();
const extra={is_predator:['هل أنا مفترس؟','واش كنعتبر مفترس؟','wach yo3tabar moftaris?','Wach yo3tabar moftaris ?','مفترس ؟','واش كيفترس؟'],is_nocturnal:['هل أنشط ليلاً؟','واش كيخرج بالليل؟'],can_swim:['wash kansb7?','wash kan3om?','wash kan9der n3om?','واش كيقدر يسبح؟'],can_fly:['wash kantir?'],has_horns:['wach 3endi qron?','wash 3ndi 9ron?'],has_tail:['wach 3endi dil?'],habitat_desert:['wach kan3ich f se7ra?'],habitat_jungle:['wach kanskon f ghaba?'],diet_carnivore:['wach kanakol le7m?'],is_domestic:['wach ana hayawan dial dar?'],legs_4:['واش عندي 4 رجلي؟']};
for(const [id,phrases] of Object.entries(extra))for(const text of phrases)if(!cases.some(c=>c.text===text))cases.push({text,kind:'understood',parts:[{questionId:id,negated:false}]});
for(const text of ['واش ذكي؟','واش ماشي حيوان أليف؟'])if(!cases.some(c=>c.text===text))cases.push(text.includes('ماشي')?{text,kind:'understood',parts:[{questionId:'is_domestic',negated:true}]}:{text,kind:'clarify',choiceCount:0});
const results=cases.map(c=>{const actual=a.interpretArabic(c.text);let error=null;try{assert.equal(actual.kind,c.kind);if(c.parts)assert.deepEqual(actual.parts,c.parts);if(c.choices)assert.deepEqual(actual.choices.map(x=>x.questionId),c.choices);if(c.choiceCount!==undefined)assert.equal(actual.choices.length,c.choiceCount)}catch(err){error=err.message}return {...c,actual,pass:!error,error}});
const fresh=()=>g.startRound({difficulty:'hard',animalLevel:'random',timer:0},null,1000,()=>0);
const tests=[];function test(name,fn){try{fn();tests.push({name,pass:true})}catch(err){tests.push({name,pass:false,error:err.message})}}
test('unsupported wording never spends a turn',()=>{for(const c of cases.filter(c=>c.kind==='clarify')){const s=g.transition(fresh(),{type:'ask-text',text:c.text,now:1001});assert.equal(s.phase,'human');assert.equal(s.history.length,0)}});
test('four swimming phrasings share one turn',()=>{let s=g.transition(fresh(),{type:'ask-text',text:'واش كنسبح؟',now:1001});s=g.transition(s,{type:'answer-human',now:1002});for(const text of ['هل أستطيع السباحة؟','wach kan3om?','wach kansb7?']){const next=g.transition({...s,phase:'human'},{type:'ask-text',text,now:1003});assert.equal(next.history.length,1);assert.equal(next.phase,'human')}});
test('selected negative clarification preserves the meaning through answer',()=>{
 const parsed=a.interpretArabic('واش ماشي ثديياات؟');assert.equal(parsed.kind,'clarify');assert.deepEqual(parsed.choices,[{questionId:'is_mammal',negated:true}]);
 let s=g.transition(fresh(),{type:'ask',questionId:parsed.choices[0].questionId,negated:parsed.choices[0].negated,now:1001});s=g.transition(s,{type:'answer-human',now:1002});assert.match(s.message,/^لا/);
 const ui=overlay[(root+'/src/features/ai-mode/AiPage.tsx')]??fs.readFileSync(root+'/src/features/ai-mode/AiPage.tsx','utf8');assert(ui.includes('negated:part.negated'));
});
const report={proposed,utterances:results.length,uniqueUtterances:new Set(results.map(c=>c.text)).size,passed:results.filter(c=>c.pass).length,failures:results.filter(c=>!c.pass),tests,results};
assert.equal(report.failures.length,0,JSON.stringify(report.failures));assert(tests.every(t=>t.pass),JSON.stringify(tests));console.log(`PASS ${report.utterances} language cases and clarification/repeat/unsupported regressions`);
