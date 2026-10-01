const fs=require('node:fs'),ts=require('typescript'),path=require('node:path'),Module=require('node:module'),{execFileSync}=require('node:child_process');
require.extensions['.ts']=(m,f)=>m._compile(ts.transpileModule(fs.readFileSync(f,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,esModuleInterop:true}}).outputText,f);
const e=require('../src/features/ai-mode/engine.ts');
const rng=seed=>()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296};
const seeds=Array.from({length:20},(_,i)=>i+1);
function run(engine,difficulty,level,policy='actual'){
 const samples=[],wrong=[],states=[];let success=0,stuck=0,indistinguishable=0;
 const cache=new Map();
 for(const target of engine.getInitialCandidates(level))for(const seed of difficulty==='hard'?[1]:seeds){
  let c=engine.getInitialCandidates(level),asked=[],q=0,w=0,done=false,ambiguous=false;const random=rng(seed);const max=engine.questions.length+c.length+1;
  for(let turn=0;turn<max;turn++){
   const useful=engine.getPossibleQuestions(c,asked);if(c.length>1&&!useful.length)ambiguous=true;
   const key=c.map(a=>a.id).join(',')+'|'+asked.join(',');let act;
   if(policy==='actual'){
    // Cache only deterministic hard actions that do not sample an indistinguishable group.
    if(difficulty==='hard'&&useful.length){act=cache.get(key);if(!act){act=engine.chooseAiAction({candidates:c,asked,difficulty},random);cache.set(key,act)}}
    else act=engine.chooseAiAction({candidates:c,asked,difficulty},random);
   }else{
    let best;
    if(useful.length){if(policy==='balanced')best=useful.sort((a,b)=>engine.evaluateQuestionSplit(c,b).score-engine.evaluateQuestionSplit(c,a).score)[0];else throw Error('Unknown benchmark policy')}
    act=best?{type:'question',questionId:best.id}:{type:'guess',animalId:c[Math.floor(random()*c.length)].id};
   }
   if(act.type==='question'){const question=engine.getQuestion(act.questionId);asked.push(act.questionId);c=engine.filterCandidates(c,question,question.test(target)?'yes':'no');q++}
   else if(act.type==='guess'){if(act.animalId===target.id){done=true;break}w++;c=c.filter(a=>a.id!==act.animalId)}else break;
  }
  if(done)success++;else stuck++;if(ambiguous)indistinguishable++;samples.push(q);wrong.push(w);states.push(q+w+1);
 }
 samples.sort((a,b)=>a-b);
 return {runs:samples.length,successRate:success/samples.length,averageQuestions:samples.reduce((a,b)=>a+b,0)/samples.length,medianQuestions:(samples[Math.floor((samples.length-1)/2)]+samples[Math.floor(samples.length/2)])/2,worstQuestions:Math.max(...samples),worstActions:Math.max(...states),averageActions:states.reduce((a,b)=>a+b,0)/states.length,incorrectGuesses:wrong.reduce((a,b)=>a+b,0),stuck,indistinguishable};
}
const signatures=new Map();for(const a of e.animals){const sig=e.questions.map(q=>+q.test(a)).join('');signatures.set(sig,[...(signatures.get(sig)||[]),{id:a.id,name:a.name_ar}])}
const groups=[...signatures.values()].filter(g=>g.length>1);
const fields=e.questions.map(q=>({id:q.id,yes:e.animals.filter(q.test).length,no:e.animals.filter(a=>!q.test(a)).length}));
if(groups.length)throw Error('Indistinguishable animal groups: '+JSON.stringify(groups));
const report={catalogueVersion:2,animalCount:e.animals.length,questionCount:e.questions.length,seedCount:20,groups,fields,results:{},comparisons:{}};
for(const level of ['easy','medium','hard','random']){
 report.results[level]={};for(const d of ['easy','medium','hard']){report.results[level][d]=run(e,d,level);console.log(level,d,JSON.stringify(report.results[level][d]))}
 report.comparisons[level]={balanced:run(e,'hard',level,'balanced')};
}
fs.writeFileSync(path.resolve(__dirname,'../../docs/AI_BENCHMARK.json'),JSON.stringify(report,null,2)+'\n');console.log('GROUPS',JSON.stringify(groups));console.log('COMPARISONS',JSON.stringify(report.comparisons));
