/** Shared comparison state for buttons, range, desk and draggable divider. */
export function bindPlanComparator({state,frame,render,line,range,value,originalBadge,buttons,onCompare}){
  function apply(){
    const position=Math.max(0,Math.min(100,Number(range.value)||0));
    value.textContent=`${position} %`;line.style.left=`${position}%`;
    range.setAttribute('aria-valuetext',`${position} % plano · ${100-position} % render`);
    render.style.clipPath=state.compare?`inset(0 0 0 ${position}%)`:'none';
    render.hidden=state.step!==2||state.sourceOnly;line.hidden=state.step!==2||!state.compare;
    originalBadge.hidden=state.step===2&&!state.compare&&!state.sourceOnly;
  }
  function setMode(mode){
    if(mode==='compare')onCompare();
    state.compare=mode==='compare';state.sourceOnly=mode==='source';
    for(const [name,button]of Object.entries(buttons)){
      button.classList.toggle('active',name===mode);button.setAttribute('aria-pressed',String(name===mode));
    }
    apply();
  }
  for(const [mode,button]of Object.entries(buttons))button.addEventListener('click',()=>setMode(mode));
  range.addEventListener('input',()=>{if(state.step===2)setMode('compare');});
  let pointer=null;
  const blocked=()=>state.step!==2||!state.compare||state.mode||state.panEnabled||state.busy;
  function move(event){const rect=frame.getBoundingClientRect();if(rect.width>0){range.value=Math.max(0,Math.min(100,(event.clientX-rect.left)/rect.width*100));apply();}}
  // Capture on the common frame so both the handle and the canvas use the same
  // coordinate system, including when zoomed or panned.
  frame.addEventListener('pointerdown',event=>{
    if(blocked()||event.button!==0)return;
    event.preventDefault();pointer=event.pointerId;frame.setPointerCapture(pointer);move(event);
  });
  frame.addEventListener('pointermove',event=>{if(pointer===event.pointerId)move(event);});
  for(const type of ['pointerup','pointercancel','lostpointercapture'])frame.addEventListener(type,event=>{
    if(pointer!==event.pointerId)return;pointer=null;
    if(frame.hasPointerCapture(event.pointerId))frame.releasePointerCapture(event.pointerId);
  });
  return {apply,setMode};
}
