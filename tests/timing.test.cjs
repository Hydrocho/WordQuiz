const {test}=require('node:test');
const assert=require('node:assert/strict');
for (const path of ['../../core.js','../dist/core.js']) {
 const core=require(path);
 test(`${path}: elapsed time includes waiting and survives serialized reload`,()=>{
  let t=core.cleanTiming(null,[1,2]);
  t=core.beginTiming(t,1,1000);
  t=core.finishTiming(t,1,4000,false);
  assert.equal(t.durations[1],3000);
  assert.equal(core.elapsedTiming(t,9000),8000);
  t=core.cleanTiming(JSON.parse(JSON.stringify(t)),[1,2]);
  t=core.beginTiming(t,2,10000);
  t=core.beginTiming(t,2,12000);
  t=core.finishTiming(t,2,15000,true);
  assert.equal(t.durations[2],5000);
  assert.equal(core.elapsedTiming(t,99000),14000);
  assert.deepEqual(core.finishTiming(core.beginTiming(t,1,20000),1,24000,true),t);
 });
 test(`${path}: rejects malformed timing while keeping zero-second completions`,()=>{
  const t=core.cleanTiming({startedAt:'oops',finishedAt:10,active:{id:99,startedAt:5},durations:{1:0,2:-1,3:'100',99:30}},[1,2,3]);
  assert.deepEqual(t,{startedAt:null,finishedAt:null,active:null,durations:{1:0},returnCount:0});
  assert.deepEqual(core.cleanTiming([], [1]).durations,{});
  assert.equal(core.formatDuration(3661000),'01:01:01');
  assert.equal(core.formatDuration(0),'00:00:00');
 });
 test(`${path}: repeated completion does not overwrite first time`,()=>{
  let t=core.beginTiming(core.cleanTiming(null,[1,2]),1,1000);
  t=core.finishTiming(t,1,4000,false);
  t=core.beginTiming(t,1,6000);
  t=core.finishTiming(t,1,10000,false);
  assert.equal(t.durations[1],3000);
  assert.equal(core.elapsedTiming(t,10000),9000);
 });
}

for (const path of ['../../core.js','../dist/core.js']) {
 const {completionGrade,gradeLimits}=require(path);
 test(`${path}: S cutoff rounds minutes for each unit size`,()=>{
  for(const [count,minutes] of [[1,1],[21,7],[22,7],[23,8],[24,8],[25,8],[26,9],[60,20]]) {
   const ids=Array.from({length:count},(_,i)=>i+1);
   const durations=Object.fromEntries(ids.map(id=>[id,0]));
   assert.deepEqual(gradeLimits(count)[0],['S',minutes]);
   assert.equal(completionGrade(ids,{startedAt:0,finishedAt:minutes*60000,durations},ids),'S');
   assert.notEqual(completionGrade(ids,{startedAt:0,finishedAt:minutes*60000+1,durations},ids),'S');
   const limits=gradeLimits(count);
   assert.ok(limits.every(([,value],i)=>i===0||value>limits[i-1][1]));
  }
 });
 test(`${path}: grades exact cutoffs and rejects incomplete or unknown timings`,()=>{
  const ids=Array.from({length:21},(_,i)=>i+1);
  const durations=Object.fromEntries(ids.map(id=>[id,0]));
  for(const [ms,expected] of [[0,'S'],[420000,'S'],[420001,'A'],[600000,'A'],[600001,'B'],[840000,'B'],[840001,'C'],[1080000,'C'],[1080001,'D']]) {
   assert.equal(completionGrade(ids,{startedAt:1000,finishedAt:1000+ms,durations},ids),expected);
  }
  assert.equal(completionGrade([1],{startedAt:0,finishedAt:5000,durations:{1:1,2:1}},ids),null);
  assert.equal(completionGrade(ids,{startedAt:0,finishedAt:null,durations:{1:1,2:1}},ids),null);
  assert.equal(completionGrade(ids,{startedAt:0,finishedAt:5000,durations:{1:1}},ids),null);
 });
}

test('return penalties survive a saved result and affect the grade',()=>{
 const core=require('../../core.js');
 const ids=Array.from({length:21},(_,i)=>i+1);
 const durations=Object.fromEntries(ids.map(id=>[id,1000]));
 const saved=core.cleanTiming({startedAt:0,finishedAt:300000,durations,returnCount:2},ids);
 assert.equal(core.elapsedTiming(saved,900000),660000);
 assert.equal(core.completionGrade(ids,saved,ids),'B');
 assert.equal(saved.durations[1],1000);
});
