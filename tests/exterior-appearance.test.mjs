import {test} from 'node:test';
import assert from 'node:assert/strict';
import {floorZones,addOutlinedExterior} from '../dist/appearance-mapping.js';
import {wallMask} from '../dist/evaluation.js';
const rect=(a,b,c,d)=>({outer:[[a,b],[c,b],[c,d],[a,d]],holes:[]});
test('only a closed exterior outline within the structural extent receives a cosmetic deck; no walls are added',()=>{
 const arch={width:100,height:80,wallPolygons:[rect(10,10,90,13),rect(10,10,13,35),rect(10,33,70,36),rect(87,10,90,70),rect(68,33,71,70),rect(68,67,90,70)],openings:[]},before=JSON.stringify(arch),z=floorZones(arch),mask=wallMask(arch),data=new Uint8ClampedArray(100*80*4);data.fill(255);
 const set=(x,y)=>{const i=(y*100+x)*4;data[i]=data[i+1]=data[i+2]=0;};for(let i=0;i<mask.length;i++)if(mask[i])set(i%100,Math.floor(i/100));
 const open=addOutlinedExterior(z,{width:100,height:80,data},arch);assert.equal(open.zones.filter(o=>o.outdoor).length,0);
 for(let y=35;y<=65;y++)set(30,y);for(let x=30;x<=70;x++)set(x,65);
 const covered=addOutlinedExterior(z,{width:100,height:80,data},arch);assert.equal(covered.zones.filter(o=>o.outdoor).length,1);assert.equal(JSON.stringify(arch),before);assert.notEqual(covered.labels,z.labels);
});
test('semantic kitchen and bathroom finishes are clipped to existing floors and cannot paint walls or the exterior',async()=>{
 const {applyFinishRegions}=await import('../dist/appearance-mapping.js');const arch={width:100,height:80,wallPolygons:[rect(10,10,90,14),rect(10,66,90,70),rect(10,10,14,70),rect(86,10,90,70)]},z=floorZones(arch),before=z.labels.slice();
 const low=applyFinishRegions(z,[{category:'kitchen',confidence:.6,...rect(0,0,100,80)}]);assert.deepEqual(low.labels,z.labels);
 const finish=applyFinishRegions(z,[{category:'kitchen',confidence:.9,...rect(0,0,100,80)}]);const inside=finish.labels[40*100+40];assert.equal(finish.zones[inside].wet,true);assert.equal(finish.labels[11*100+20],-2);assert.equal(finish.labels[0],z.labels[0]);assert.deepEqual(z.labels,before);
});
