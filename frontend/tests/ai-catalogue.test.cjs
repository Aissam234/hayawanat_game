const fs=require('node:fs'),assert=require('node:assert/strict'),path=require('node:path');
const root=path.resolve(__dirname,'..');const ts=require(path.join(root,'node_modules/typescript'));
require.extensions['.ts']=(m,f)=>m._compile(ts.transpileModule(fs.readFileSync(f,'utf8'),{compilerOptions:{module:1,target:7,esModuleInterop:true}}).outputText,f);
const e=require(path.join(root,'src/features/ai-mode/engine.ts')),a=require(path.join(root,'src/features/ai-mode/arabic.ts')),g=require(path.join(root,'src/features/ai-mode/round.ts')),p=require(path.join(root,'src/features/ai-mode/persistence.ts')),search=require(path.join(root,'src/features/ai-mode/animalSearch.ts'));
let count=0;const test=(name,fn)=>{fn();console.log('PASS '+name);count++};
test('120 unique identities; 40 animals in each pool',()=>{assert.equal(e.animals.length,120);for(const field of ['id','name_ar','scientific_name'])assert.equal(new Set(e.animals.map(a=>a[field])).size,120);for(const level of ['easy','medium','hard'])assert.equal(e.getInitialCandidates(level).length,40)});
test('all supported signatures are unique',()=>assert.equal(new Set(e.animals.map(a=>e.questions.map(q=>+q.test(a)).join(''))).size,120));
test('schema, references, mass thresholds and biological consistency',()=>{for(const animal of e.animals){assert(animal.aliases.length);assert(animal.source_urls.every(u=>u.startsWith('https://')));assert.equal(animal.has_feathers,animal.animal_class==='bird');if(animal.has_feathers)assert(animal.has_wings);if(animal.can_fly)assert(animal.has_wings);assert.equal(animal.is_mammal,animal.animal_class==='mammal');assert.equal(animal.is_african,animal.regions.includes('africa'));assert.equal(animal.size,animal.typical_mass_kg<10?'small':animal.typical_mass_kg<100?'medium':animal.typical_mass_kg<1000?'large':'huge');for(const q of e.questions)assert.equal(typeof q.test(animal),'boolean',`${animal.id} ${q.id}`)}});
test('reviewed exceptions cannot regress',()=>{assert(e.getAnimal(1).can_swim);assert(e.getAnimal(3).can_fly);assert(!e.getAnimal(18).can_swim);assert(!e.getAnimal(26).lays_eggs);assert(!e.getAnimal(30).lays_eggs);assert(e.getAnimal(54).has_wings&&!e.getAnimal(54).can_fly);for(const id of [75,76])assert(e.getAnimal(id).is_mammal&&e.getAnimal(id).lays_eggs);assert.equal(e.getAnimal(45).humps,1);assert.equal(e.getAnimal(46).humps,2);assert.equal(e.getAnimal(114).diet,'detritivore')});
const examples=[['هل عندي أجنحة؟','has_wings'],['واش عندو جناحين؟','has_wings'],['wach 3ndi jn7a?','has_wings'],['هل لديه ريش؟','has_feathers'],['wach 3ndi rich?','has_feathers'],['واش كيبيض؟','lays_eggs'],['هل يضع البيض؟','lays_eggs'],['واش عندو حراشف؟','has_scales'],['هل هو طائر؟','class_bird'],['هل من الزواحف؟','class_reptile'],['هل هو حشرة؟','class_insect'],['wach 3ndi 4 rjlin?','legs_4'],['هل عنده أشواك؟','has_spines'],['هل لديه جراب؟','has_pouch'],['هل عنده سنامين؟','humps_2'],['هل يعيش في آسيا؟','region_asia'],['هل موطنه أوروبا؟','region_europe'],['هل يأكل مواد متحللة؟','diet_detritivore']];
for(const [text,id] of examples)test(text,()=>{const result=a.interpretArabic(text);assert.equal(result.kind,'understood',JSON.stringify(result));assert.deepEqual(result.parts,[{questionId:id,negated:false}])});
test('new property negation and compound questions',()=>{assert.deepEqual(a.interpretArabic('واش ماشي طائر؟').parts,[{questionId:'class_bird',negated:true}]);assert.equal(a.interpretArabic('هل لديه أجنحة وهل يبيض؟').parts.length,2)});
test('nonsensical property combinations remain unsupported',()=>{for(const text of ['هل يعيش في أجنحة؟','هل لديه آسيا؟','هل يستطيع قرون؟'])assert.equal(a.interpretArabic(text).kind,'clarify')});
test('Darija, spelling and scientific-name search',()=>{assert(search.matchesAnimal(e.getAnimal(28),'فكرون'));assert(search.matchesAnimal(e.getAnimal(1),'9ett'));assert(search.matchesAnimal(e.getAnimal(75),'Ornithorhynchus'));assert(search.matchesAnimal(e.getAnimal(4),'ارنب'));assert(!search.matchesAnimal(e.getAnimal(4),'زرافة'))});
const settings={difficulty:'hard',animalLevel:'easy',timer:0};
const fresh=g.startRound(settings,null,1000,()=>0);
const old={...fresh,catalogueVersion:undefined,pool:e.getInitialCandidates('easy',1).map(a=>a.id),candidates:e.getInitialCandidates('easy',1).map(a=>a.id)};
const encode=round=>JSON.stringify({version:1,settings,draft:'مسودة',round});
test('v1 active saves retain original pool, scores and animal facts',()=>{const restored=p.decodeSave(encode({...old,scores:{human:3,ai:2}}),1001);assert(restored);assert.equal(restored.round.pool.length,15);assert.equal(restored.round.scores.human,3);let s=g.transition(restored.round,{type:'ask',questionId:'can_swim',now:1002});s=g.transition(s,{type:'answer-human',now:1003});assert.equal(s.history[0].answer,'no');assert.equal(e.getCatalogueAnimal(1,1).name_ar,'قطة');assert.equal(e.getAnimal(1).name_ar,'قطة منزلية')});
test('v1 pending answer, AI question and finished state still restore',()=>{let s=g.transition(old,{type:'ask',questionId:'can_swim',now:1001});assert(p.decodeSave(encode(s),1002));s=g.transition(s,{type:'answer-human',now:1003});s=g.transition(s,{type:'ai-action',action:{type:'question',questionId:'has_tail'},now:1004});assert.equal(p.decodeSave(encode(s),1005).round.pending,'has_tail');const won=g.transition(old,{type:'human-guess',animalId:old.humanSecret,now:1001});assert.equal(p.decodeSave(encode(won),1002).round.scores.human,1)});
test('legacy rounds reject new questions, rematch upgrades without losing score',()=>{for(const event of [{type:'ask-text',text:'هل عنده ريش؟'},{type:'ask',questionId:'has_feathers'}]){const s=g.transition(old,{...event,now:1001});assert.equal(s.phase,'human');assert.equal(s.history.length,0)}assert.equal(e.questionsForCatalogue(1).length,24);const next=g.startRound(settings,{...old,scores:{human:3,ai:2}},2000,()=>0);assert.equal(next.catalogueVersion,2);assert.equal(next.pool.length,40);assert.deepEqual(next.scores,{human:3,ai:2});assert(p.decodeSave(encode(next),2001))});
test('v2 round restores exactly; unknown catalogue version is rejected',()=>{assert.deepEqual(p.decodeSave(encode(fresh),1001).round,fresh);assert.equal(p.decodeSave(encode({...fresh,catalogueVersion:999}),1001),null)});


// Compare the optimised selection against the independent direct-tree evaluator.
test('matrix lookahead preserves direct-tree scoring on pools and evidence branches',()=>{
 for(const level of ['easy','medium','hard','random']){
  const pool=e.getInitialCandidates(level);
  for(const first of [null,...e.questions.slice(0,12)]){
   for(const answer of ['yes','no']){
    const candidates=first?e.filterCandidates(pool,first,answer):pool,asked=first?[first.id]:[];
    const expected=e.getPossibleQuestions(candidates,asked).map(q=>({q,two:e.evaluateLookahead(candidates,asked,q),one:e.evaluateQuestionSplit(candidates,q).expectedRemaining})).sort((a,b)=>a.two-b.two||a.one-b.one)[0]?.q.id;
    assert.equal(e.chooseBestQuestion(candidates,asked)?.id,expected,level+' '+first?.id+' '+answer);
   }
  }
 }
});
const {performance}=require('node:perf_hooks');const timings=[];
for(let i=0;i<15;i++){const start=performance.now();e.chooseBestQuestion(e.animals,[]);if(i>=5)timings.push(performance.now()-start)}
timings.sort((a,b)=>a-b);console.log('Hard 120-animal opening latency ms',JSON.stringify({median:timings[5],max:timings[9]}));

console.log(`${count} catalogue-v2 checks passed`);

// Screenshot regressions: preserve the semantic distinction from diet and danger.
for(const text of ['مفترس ؟','Wach yo3tabar moftaris ?','واش مفترس؟','هل يعتبر مفترساً؟','هل هو حيوان مفترس؟','واش كيعتبر مفترس؟','هل يعتبر من الحيوانات المفترسة؟','هاد الحيوان عندي… مفترس؟','wach howa moftares?','واش هو moftaris؟']) {
 test('predator '+text,()=>assert.deepEqual(a.interpretArabic(text).parts,[{questionId:'is_predator',negated:false}]));
}
for(const text of ['واش ماشي مفترس؟','هل لا يعتبر مفترس؟','wach machi moftaris?','wach mayo3tabarch moftaris?']) {
 test('negated predator '+text,()=>assert.deepEqual(a.interpretArabic(text).parts,[{questionId:'is_predator',negated:true}]));
}
test('predation is independent of primary diet and danger',()=>{
 for(const id of [1,11,13,25,40,66,95,108,116])assert.equal(e.answerHumanQuestion('is_predator',id),'yes');
 for(const id of [5,12,31,51,57,113,114,115,120])assert.equal(e.answerHumanQuestion('is_predator',id),'no');
 assert.equal(e.answerHumanQuestion('diet_carnivore',31),'yes');
 assert.equal(e.answerHumanQuestion('diet_carnivore',13),'no');
 assert.match(a.meaningLabel({questionId:'is_predator',negated:false}),/الحشرات/);
 assert.match(a.replyToMeanings([{questionId:'is_predator',negated:true}],11),/^لا/);
 for(const text of ['هل مفترس وخطير؟','هل يعتبر يسبح؟','هل لا لا يعتبر مفترس؟','wach moftaris mystery?'])assert.equal(a.interpretArabic(text).kind,'clarify');
 assert(e.animals.every(x=>typeof x.is_predator==='boolean'));
});
test('predator pending and answered rounds survive refresh; aliases do not spend another turn',()=>{
 let s=g.transition(fresh,{type:'ask-text',text:'مفترس ؟',now:1001});
 assert.equal(s.phase,'answering');
 assert.deepEqual(p.decodeSave(encode(s),1002).round,s);
 s=g.transition(s,{type:'answer-human',now:1003});
 assert.equal(s.history[0].answer,'yes');
 assert.deepEqual(p.decodeSave(encode(s),1004).round,JSON.parse(JSON.stringify(s)));
 const repeat=g.transition({...s,phase:'human'},{type:'ask-text',text:'Wach yo3tabar moftaris ?',now:1005});
 assert.equal(repeat.phase,'human');assert.equal(repeat.history.length,1);assert.match(repeat.message,/سبق/);
 const legacy=g.transition(old,{type:'ask-text',text:'مفترس؟',now:1001});
 assert.equal(legacy.phase,'human');assert.equal(legacy.history.length,0);
});
console.log(`${count} total catalogue checks including predator regressions passed`);
