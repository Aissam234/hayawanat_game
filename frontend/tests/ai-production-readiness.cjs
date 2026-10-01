const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..');
const ts=require(root+'/node_modules/typescript');
require.extensions['.ts']=(m,f)=>m._compile(ts.transpileModule(fs.readFileSync(f,'utf8'),{compilerOptions:{module:1,target:7,esModuleInterop:true}}).outputText,f);
const e=require(root+'/src/features/ai-mode/engine.ts');
const rng=seed=>()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);
const signatures=e.animals.map(a=>({id:a.id,name:a.name_ar,properties:Object.fromEntries(e.questions.map(q=>[q.id,q.test(a)]))}));
const groups=new Map();for(const a of signatures){const key=JSON.stringify(a.properties);groups.set(key,[...(groups.get(key)||[]),a])}
const duplicateGroups=[...groups.values()].filter(g=>g.length>1);
const records=[];
for(const difficulty of ['hard','medium','easy']){
 for(const target of e.animals)for(const seed of difficulty==='hard'?[1]:Array.from({length:20},(_,i)=>i+1)){
  let candidates=[...e.animals],asked=[],steps=[],guesses=[],progression=[120],correct=false,stuck=false;
  const random=difficulty==='hard'?()=>{throw Error('Hard unexpectedly sampled RNG')}:rng(seed);
  for(let turn=0;turn<e.questions.length+e.animals.length+1;turn++){
   // Deliberately construct the knowledge boundary: the target is never passed.
   const action=e.chooseAiAction({candidates,asked,difficulty},random);
   if(action.type==='question'){
    assert(!asked.includes(action.questionId));const q=e.getQuestion(action.questionId);
    const answer=q.test(target)?'yes':'no'; // harness alone knows the target
    const before=candidates.length;candidates=e.filterCandidates(candidates,q,answer);
    assert(candidates.some(a=>a.id===target.id));assert(candidates.length<before);
    asked.push(q.id);progression.push(candidates.length);steps.push({questionId:q.id,text:q.text,answer,remaining:candidates.map(a=>a.id)});
   }else if(action.type==='guess'){
    guesses.push(action.animalId);correct=e.validateGuess(action.animalId,target.id);
    if(correct)break;candidates=candidates.filter(a=>a.id!==action.animalId);progression.push(candidates.length);
   }else{stuck=true;break}
  }
  if(!correct)stuck=true;
  records.push({id:target.id,name:target.name_ar,difficulty,seed,questions:asked.length,guesses:guesses.length,finalGuess:guesses.at(-1)??null,correct,wrongGuesses:guesses.length-(correct?1:0),candidateProgression:progression,stuck,...(difficulty==='hard'?{steps,guessIds:guesses}:{})});
 }
 console.log('Completed '+difficulty);
}
const summary={};for(const difficulty of ['easy','medium','hard']){
 const rows=records.filter(r=>r.difficulty===difficulty),q=rows.map(r=>r.questions).sort((a,b)=>a-b);
 summary[difficulty]={runs:rows.length,successRate:rows.filter(r=>r.correct).length/rows.length,averageQuestions:q.reduce((a,b)=>a+b,0)/q.length,medianQuestions:(q[Math.floor((q.length-1)/2)]+q[Math.floor(q.length/2)])/2,minimumQuestions:q[0],worstQuestions:q.at(-1),averageGuesses:rows.reduce((n,r)=>n+r.guesses,0)/rows.length,wrongGuesses:rows.reduce((n,r)=>n+r.wrongGuesses,0),stuck:rows.filter(r=>r.stuck).length};
}
let pairChecks=0;for(let i=0;i<120;i++)for(let j=i+1;j<120;j++){
 const pair=[e.animals[i],e.animals[j]],useful=e.getPossibleQuestions(pair,[]);assert(useful.length);
 const action=e.chooseAiAction({candidates:pair,asked:[],difficulty:'hard'},()=>{throw Error('Pair RNG')});
 assert.equal(action.type,'question');assert.notEqual(e.getQuestion(action.questionId).test(pair[0]),e.getQuestion(action.questionId).test(pair[1]));pairChecks++;
 const used=useful.map(q=>q.id),fallback=e.chooseAiAction({candidates:pair,asked:used,difficulty:'hard'},()=>.99);assert.equal(fallback.type,'guess');assert.equal(fallback.confidence,'uncertain');
}
const report={date:'2026-10-01',animalCount:120,canonicalQuestionCount:e.questions.length,summary,duplicateGroups,pairChecks,signatures,hardAnimals:records.filter(r=>r.difficulty==='hard'),seededRuns:records.filter(r=>r.difficulty!=='hard')};
fs.writeFileSync(path.resolve('AI_PRODUCTION_EVIDENCE.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({summary,duplicateGroups,pairChecks},null,2));
