import test from 'node:test';
import assert from 'node:assert/strict';
import {fitImageSize,bindFileDrop} from '../dist/workspace-ui.js';

test('whole-sheet fit preserves portrait, landscape and panoramic proportions within both desk edges',()=>{
  for(const [w,h,deskW,deskH] of [[749,1280,1800,750],[1280,749,900,500],[2400,200,600,700],[200,2400,320,300]]){
    const fit=fitImageSize(w,h,deskW,deskH);
    assert.ok(fit.width<=deskW+1e-8&&fit.height<=deskH+1e-8);
    assert.ok(Math.abs(fit.width/fit.height-w/h)<1e-8);
    assert.ok(Math.abs(fit.width-deskW)<1e-8||Math.abs(fit.height-deskH)<1e-8);
  }
  assert.equal(fitImageSize(100,100,0,500),null);
  assert.equal(fitImageSize(100,NaN,500,500),null);
});
class Desk extends EventTarget {
  constructor(){super();const classes=new Set();this.classList={add:c=>classes.add(c),remove:c=>classes.delete(c),contains:c=>classes.has(c)};}
}
function drag(target,type,transfer){const event=new Event(type,{cancelable:true});Object.defineProperty(event,'dataTransfer',{value:transfer});target.dispatchEvent(event);return event;}

test('file drops on the desk import every file once and do not flicker between canvas layers',()=>{
  const target=new Desk(),received=[];
  const files=[new File(['a'],'plano.png'),new File(['b'],'detalle.pdf')];
  const transfer={types:['Files'],files,dropEffect:'none'};
  bindFileDrop(target,{onFiles:f=>received.push(f)});
  drag(target,'dragenter',transfer);drag(target,'dragenter',transfer);drag(target,'dragleave',transfer);
  assert.equal(target.classList.contains('dragging'),true);
  assert.equal(drag(target,'dragover',transfer).defaultPrevented,true);assert.equal(transfer.dropEffect,'copy');
  assert.equal(drag(target,'drop',transfer).defaultPrevented,true);
  assert.deepEqual(received,[files]);assert.equal(target.classList.contains('dragging'),false);
});

test('text drags are ignored and busy projects reject file drops without navigating',()=>{
  const target=new Desk();let imported=0;
  bindFileDrop(target,{onFiles:()=>imported++,isBusy:()=>true});
  assert.equal(drag(target,'dragover',{types:['text/plain']}).defaultPrevented,false);
  const transfer={types:['Files'],files:[new File(['a'],'plano.png')]};
  drag(target,'dragenter',transfer);assert.equal(target.classList.contains('dragging'),false);
  drag(target,'dragover',transfer);assert.equal(transfer.dropEffect,'none');
  assert.equal(drag(target,'drop',transfer).defaultPrevented,true);assert.equal(imported,0);
});
