const fs=require('node:fs'),path=require('node:path');
const file=path.join(__dirname,'data.js');
const maps=JSON.parse(fs.readFileSync(file,'utf8').replace(/^export default /,'').replace(/;\s*$/,''));
const clamp=(n,max)=>Math.max(0,Math.min(max,n));
for(const map of maps){
 const raw=Buffer.from(map.dataBase64,'base64'),out=Buffer.alloc(raw.length),v=[];
 for(let y=0;y<map.height;y++)for(let x=0;x<map.width;x++){
  v.length=0;
  for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++)v.push(raw[clamp(y+dy,map.height-1)*map.width+clamp(x+dx,map.width-1)]);
  v.sort((a,b)=>a-b);out[y*map.width+x]=v[4];
 }
 map.dataBase64=out.toString('base64');
}
fs.writeFileSync(path.join(__dirname,'cleaned.js'),'// Build-time median filter. Original photograph pixels are unchanged.\nexport default '+JSON.stringify(maps)+';\n');
