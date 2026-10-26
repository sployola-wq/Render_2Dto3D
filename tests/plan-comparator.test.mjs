import test from 'node:test';
import assert from 'node:assert/strict';
import {bindPlanComparator} from '../dist/plan-comparator.js';

class Control extends EventTarget{
  constructor(){super();this.style={};this.attributes={};this.value='50';this.captured=new Set();this.classList={toggle:()=>{}};}
  setAttribute(key,value){this.attributes[key]=value;}
  getBoundingClientRect(){return {left:100,width:400};}
  setPointerCapture(id){this.captured.add(id);}
  hasPointerCapture(id){return this.captured.has(id);}
  releasePointerCapture(id){this.captured.delete(id);}
}
function setup(){
  const state={step:2,compare:false,sourceOnly:false,mode:null,panEnabled:false},controls=Object.fromEntries(['frame','render','line','range','value','originalBadge'].map(n=>[n,new Control()])),buttons=Object.fromEntries(['compare','render','source'].map(n=>[n,new Control()]));
  let source='spatial';
  const comparator=bindPlanComparator({state,...controls,buttons,onCompare(){source='technical';}});
  return {state,...controls,buttons,comparator,get source(){return source;}};
}
function pointer(target,type,x,id=7){const event=new Event(type,{cancelable:true});Object.assign(event,{clientX:x,pointerId:id,button:0});target.dispatchEvent(event);return event;}

test('moving the curtain from the perspective or source view activates an aligned comparison at both extremes',()=>{
  const c=setup();
  c.range.value='0';c.range.dispatchEvent(new Event('input'));
  assert.equal(c.source,'technical');assert.equal(c.state.compare,true);assert.equal(c.render.style.clipPath,'inset(0 0 0 0%)');assert.equal(c.line.hidden,false);
  c.buttons.source.dispatchEvent(new Event('click'));assert.equal(c.render.hidden,true);
  c.range.value='100';c.range.dispatchEvent(new Event('input'));
  assert.equal(c.state.sourceOnly,false);assert.equal(c.render.hidden,false);assert.equal(c.render.style.clipPath,'inset(0 0 0 100%)');assert.equal(c.buttons.compare.attributes['aria-pressed'],'true');
});
test('dragging across a zoomed desk clamps to its frame and releases capture on cancellation',()=>{
  const c=setup();c.comparator.setMode('compare');
  assert.equal(pointer(c.frame,'pointerdown',200).defaultPrevented,true);assert.equal(Number(c.range.value),25);
  pointer(c.frame,'pointermove',600);assert.equal(Number(c.range.value),100);
  pointer(c.frame,'pointermove',50);assert.equal(Number(c.range.value),0);
  pointer(c.frame,'pointercancel',50);assert.equal(c.frame.hasPointerCapture(7),false);
  pointer(c.frame,'pointermove',300);assert.equal(Number(c.range.value),0);
});
test('comparison does not steal measuring, panning, busy or Step 1 pointer gestures',()=>{
  for(const changes of [{mode:'ruler'},{panEnabled:true},{busy:true},{step:1}]){
    const c=setup();c.comparator.setMode('compare');Object.assign(c.state,changes);
    assert.equal(pointer(c.frame,'pointerdown',200).defaultPrevented,false);assert.equal(c.frame.captured.size,0);
  }
});
