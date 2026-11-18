'use strict';
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const context={};vm.createContext(context);
vm.runInContext(fs.readFileSync(path.resolve(__dirname,'../src/welcome/wire-flow.js'),'utf8').replace('export function','function')+'\nthis.build=buildWireFlow;',context);
const bitmap=n=>({n,rgba:new Uint8Array(n*n*4),dot(x,y){this.rgba[(y*n+x)*4]=255;}});
const run=b=>context.build(b.rgba,b.n,b.n);
const empty=run(bitmap(20));assert.equal(empty.inkCount,0);assert.equal(empty.sparks.length,0);
const bent=bitmap(80);
for(let x=40;x<=65;x++){bent.dot(x,40);bent.dot(x,15);}
for(let y=15;y<=40;y++)bent.dot(65,y);
for(let y=15;y<=30;y++)bent.dot(40,y);
const bend=run(bent);
assert(bend.arrival[40*80+55]<bend.arrival[30*80+40], 'Light must follow the bend instead of reaching the nearer disconnected tip first');
for(const n of [721,1440]){
  const b=bitmap(n),c=Math.floor(n/2);
  for(let i=25;i<n-25;i++){b.dot(c,i);b.dot(i,c);}
  for(const [x,y]of [[20,20],[n-21,20],[20,n-21],[n-21,n-21]])b.dot(x,y);
  const flow=run(b);assert(flow.sparks.length>20);
  for(let i=0;i<b.rgba.length;i+=4)if(b.rgba[i]){
    const p=i/4,x=p%n,y=Math.floor(p/n);
    const cell=Math.floor((y+.5)*flow.height/n)*flow.width+Math.floor((x+.5)*flow.width/n);
    assert(flow.arrival[cell]>.009&&flow.arrival[cell]<.991,'Every visible line must start white and finish gold');
  }
  for(const spark of flow.sparks){
    const x=Math.floor(spark.x*n),y=Math.floor(spark.y*n);
    assert(b.rgba[(y*n+x)*4]>24,'Spark must originate on actual source ink');
    const cell=Math.floor(spark.y*flow.height)*flow.width+Math.floor(spark.x*flow.width);
    assert.equal(spark.time,flow.arrival[cell],'Spark birth must match the line arrival at its anchor');
  }
}
const line=bitmap(64);for(let x=8;x<=56;x++)line.dot(x,32);
const central=run(line);assert.equal(central.strokes.length,2);assert(central.strokes.every(s=>s.path[0]===32*64+32));
assert(Math.abs(central.arrival[32*64+32]-.025)<1e-6,'Ignition must be at the actual central stroke, including degree-2 pixels');
const island=bitmap(100);for(let x=40;x<=60;x++)island.dot(x,50);for(let y=5;y<=6;y++)for(let x=5;x<=6;x++)island.dot(x,y);
const sparse=run(island);assert.equal(sparse.diagnostics.missedInk,0);assert(sparse.arrival[505]>.8,'Remote island must wait for the central connected strokes');
const loop=bitmap(64);for(let x=16;x<=48;x++){loop.dot(x,16);loop.dot(x,48);}for(let y=17;y<48;y++){loop.dot(16,y);loop.dot(48,y);}
const ring=run(loop);assert(ring.strokes.some(s=>s.path[0]===s.path.at(-1)&&s.path.length>20),'A closed loop must remain a complete scheduled path');
// Equal-distance center pixels can appear in a different BFS and scan order.
const tie=bitmap(12),vertices=[[9,1],[9,6],[7,6],[7,10],[5,10],[5,4]];
for(let p=1;p<vertices.length;p++){
  let [x,y]=vertices[p-1];const [endX,endY]=vertices[p];
  while(true){tie.dot(x,y);if(x===endX&&y===endY)break;x+=Math.sign(endX-x);y+=Math.sign(endY-y);}
}
const tied=run(tie),ignition=tied.sparks.find(s=>s.strength>1.5);
assert(ignition);assert.equal(Math.floor(ignition.x*12),7);assert.equal(Math.floor(ignition.y*12),6);
assert(Math.abs(tied.arrival[6*12+7]-.025)<1e-6,'The scheduled root must ignite first');
assert(tied.arrival[6*12+5]>.025001,'The other equally near pixel must wait for its stroke');
assert.equal(tied.diagnostics.missedInk,0);
const lattice=bitmap(160);for(let y=0;y<160;y++)for(let x=0;x<160;x++)if(x%16===0||y%16===0)lattice.dot(x,y);
const dense=run(lattice),events=[];for(const stroke of dense.strokes){events.push([stroke.start,1],[stroke.end,-1]);assert(stroke.end<=.900001);}
events.sort((a,b)=>a[0]-b[0]||a[1]-b[1]);let active=0,peak=0;for(const [t,delta]of events){active+=delta;peak=Math.max(peak,active);}assert.equal(peak,12);assert.equal(dense.activeHeads,peak);
console.log('PASS: exact central ignition, bent paths, loops, delayed remote islands, 12-stroke scheduling, full ink coverage and exact source spark anchors.');
