const fs=require('node:fs'),assert=require('node:assert/strict'),ts=require('typescript');
require.extensions['.ts']=(m,f)=>m._compile(ts.transpileModule(fs.readFileSync(f,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,esModuleInterop:true}}).outputText,f);
const e=require('../src/features/ai-mode/engine.ts');let checks=0;
// Every distinguishable pair is resolved by a question, independent of RNG.
for(let i=0;i<e.animals.length;i++)for(let j=i+1;j<e.animals.length;j++){
 const candidates=[e.animals[i],e.animals[j]],useful=e.getPossibleQuestions(candidates,[]);
 const action=e.chooseAiAction({candidates,asked:[],difficulty:'hard'},()=>.7);
 assert.equal(action.type,useful.length?'question':'guess');if(action.type==='question')assert.notEqual(e.getQuestion(action.questionId).test(candidates[0]),e.getQuestion(action.questionId).test(candidates[1]));if(action.type==='guess')assert.equal(action.confidence,'uncertain');checks++;
}
for(const q of e.questions){const m=e.evaluateQuestionSplit(e.animals,q);assert.equal(m.expectedRemaining,(m.yes*m.yes+m.no*m.no)/e.animals.length);assert(m.entropy>=0&&m.entropy<=1);checks++}
// Check the actual function signatures, not only the ReasoningState type.
const source=fs.readFileSync('src/features/ai-mode/engine.ts','utf8');const ast=ts.createSourceFile('engine.ts',source,ts.ScriptTarget.Latest,true);
for(const name of ['chooseAiAction','chooseBestQuestion','evaluateLookahead','evaluateQuestionSplit','pickBestGuess']){
 let found=false;function visit(n){if((ts.isFunctionDeclaration(n)||ts.isVariableDeclaration(n))&&n.name?.getText(ast)===name){found=true;const text=n.getText(ast);assert(!/aiSecret|humanSecret|\bRound\b|localStorage|fetch|WebSocket/.test(text),name)}ts.forEachChild(n,visit)}visit(ast);assert(found);checks++;
}
// Distinctiveness is not used as posterior probability; unknown-prior fallback samples the full group.
const c=[e.getAnimal(6),e.getAnimal(15)];assert.equal(e.pickBestGuess(c,()=>0).id,6);assert.equal(e.pickBestGuess(c,()=>.999).id,15);assert(!/candidateConfidence/.test(source));
console.log(`PASS ${checks} pairwise/scoring/architecture checks plus uniform tie guessing`);
