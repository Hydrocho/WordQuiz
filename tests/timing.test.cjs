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
  assert.deepEqual(t,{startedAt:null,finishedAt:null,active:null,durations:{1:0}});
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
 const {completionGrade}=require(path);
 test(`${path}: grades exact cutoffs and rejects incomplete or unknown timings`,()=>{
  const ids=[1,2];
  for(const [ms,expected] of [[0,'S'],[420000,'S'],[420001,'A'],[600000,'A'],[600001,'B'],[840000,'B'],[840001,'C'],[1080000,'C'],[1080001,'D']]) {
   assert.equal(completionGrade(ids,{startedAt:1000,finishedAt:1000+ms,durations:{1:0,2:0}},ids),expected);
  }
  assert.equal(completionGrade([1],{startedAt:0,finishedAt:5000,durations:{1:1,2:1}},ids),null);
  assert.equal(completionGrade(ids,{startedAt:0,finishedAt:null,durations:{1:1,2:1}},ids),null);
  assert.equal(completionGrade(ids,{startedAt:0,finishedAt:5000,durations:{1:1}},ids),null);
 });
}
