import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {gunzipSync} from 'node:zlib';
import {decodeRaw} from '../src/welcome/cad-loader.js';
import {welcomeAssembly,GUARD_IDS,GUARD_PAIRS} from '../src/welcome/cad-guards.js';

const asset=new URL('../src/site/published-welcome/welcome-cad/',import.meta.url);
const metadata=JSON.parse(await readFile(new URL('robot-metadata.json',asset)));
const data=await decodeRaw(metadata,gunzipSync(await readFile(new URL(metadata.files.meshes,asset))),gunzipSync(await readFile(new URL(metadata.files.edges,asset))),{includeColors:true});
const parts=welcomeAssembly(data.meshes),byId=new Map(parts.map(m=>[m.id,m]));
assert.equal(parts.length,998);
assert.equal(new Set(parts.map(m=>m.id)).size,parts.length);
assert.equal(parts.filter(m=>GUARD_IDS.has(m.id)).length,4);
for(const m of data.meshes)if(![3,230,694].includes(m.id))assert.equal(byId.get(m.id),m,'Existing CAD pieces must retain their source geometry and colors');
for(const {source,target}of GUARD_PAIRS){
 const a=byId.get(source),b=byId.get(target);
 for(const key of ['position','normal','edges']){
  assert.equal(a[key].length,b[key].length);
  for(let i=0;i<a[key].length;i++)assert.equal(b[key][i],i%3===0?-a[key][i]:a[key][i],`${source}/${target} ${key} ${i}`);
 }
 for(let i=0;i<a.index.length;i+=3){assert.equal(b.index[i],a.index[i]);assert.equal(b.index[i+1],a.index[i+2]);assert.equal(b.index[i+2],a.index[i+1]);}
 assert.deepEqual(b.vertexColor,a.vertexColor);
 assert.equal(b.min[0],-a.max[0]);assert.equal(b.max[0],-a.min[0]);
}
const close=(a,b)=>assert(Math.abs(a-b)<.001,`${a} != ${b}`);
for(const [innerId,outerId]of [[146,682],[230,694]]){
 const inner=byId.get(innerId),outer=byId.get(outerId);
 close(inner.max[0]-inner.min[0],2);close(outer.max[0]-outer.min[0],2);
 close(Math.abs((outer.min[0]+outer.max[0]-inner.min[0]-inner.max[0])/2)-2,18.8);
 close(Math.min(inner.max[2],outer.max[2])-Math.max(inner.min[2],outer.min[2]),86.48551);
}
assert.equal(parts.reduce((n,m)=>n+m.index.length/3,0),558418);
console.log('PASS: 998 CAD pieces; four 2 mm guards; exact mirrored positions, normals, winding, edges and colors; 18.8 mm clear gap and 86.4855 mm overlap; all other source pieces unchanged.');
