const {test}=require('node:test');
const assert=require('node:assert/strict');
const {makeBoard,pick,cleanRecords,dayKey}=require('../dist/core.js');
test('20 cards contain every answer occurrence',()=>{
 for(let n=0;n<100;n++) for(const answer of ['빅뱅우주론','겉보기등급','가가나']) {
  const cards=makeBoard(answer); assert.equal(cards.length,20);
  for(const ch of answer) assert.ok(cards.filter(c=>c===ch).length >= [...answer].filter(c=>c===ch).length);
 }
});
test('wrong choice resets progress; repeated selection cannot reuse a tile',()=>{
 const cards=['성','단','별']; let result=pick('성단',cards,[],0);
 assert.deepEqual(result,{selected:[0],status:'correct'});
 assert.equal(pick('성단',cards,result.selected,0).status,'ignored');
 assert.deepEqual(pick('성단',cards,result.selected,2),{selected:[],status:'wrong'});
 assert.equal(pick('성단',cards,[0],1).status,'complete');
});
test('records deduplicate and reject unknown IDs and malformed values',()=>{
 assert.deepEqual(cleanRecords([1,1,2,99,'2',null],[1,2]),[1,2]);
 assert.deepEqual(cleanRecords({},[1,2]),[]);
});
test('local date key rolls over at midnight',()=>{
 assert.equal(dayKey(new Date(2026,10,5,23,59)),'2026-11-05');
 assert.equal(dayKey(new Date(2026,10,6,0,0)),'2026-11-06');
});
