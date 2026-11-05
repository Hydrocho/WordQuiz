const {test}=require('node:test');
const assert=require('node:assert/strict');
for(const path of ['../../core.js','../dist/core.js']){
 const {cleanItems,awardItem}=require(path);
 test(`${path}: reward chance, capacity, duplicates and reload validation`,()=>{
  let state=cleanItems(null,[1,2,3,4,5]);
  let r=awardItem(state,1,0.49,0);assert.equal(r.item,'reveal');state=r.state;
  r=awardItem(state,1,0,0.5);assert.deepEqual(r.state,state);
  r=awardItem(state,2,0.5,0);assert.equal(r.item,null);state=r.state;
  state=awardItem(state,3,0,0.4).state;state=awardItem(state,4,0,0.9).state;
  assert.deepEqual(state.inventory,['reveal','hint','erase']);
  assert.equal(awardItem(state,5,0,0).state.inventory.length,3);
  assert.deepEqual(cleanItems(JSON.parse(JSON.stringify(state)),[1,2,3,4,5]),state);
  assert.deepEqual(cleanItems({inventory:['bad','hint','hint','erase','reveal'],used:-1,awarded:[1,1,9]},[1]),{inventory:['hint','hint','erase'],used:0,awarded:[1]});
 });
}
