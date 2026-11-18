// Bounded concurrent CAD pen strokes; the schedule is built before playback.
// Coordinates follow WebGL readRenderTargetPixels (bottom row first).
export function buildWireFlow(rgba, sourceWidth, sourceHeight) {
  const scale=Math.min(1,720/Math.max(sourceWidth,sourceHeight));
  const width=Math.ceil(sourceWidth*scale),height=Math.ceil(sourceHeight*scale);
  const count=width*height,ink=new Uint8Array(count),sourcePixel=new Uint32Array(count),brightness=new Uint8Array(count),pixels=[];
  for(let y=0;y<sourceHeight;y++)for(let x=0;x<sourceWidth;x++){
    const p=y*sourceWidth+x,v=rgba[p*4];if(v<=24)continue;
    const i=Math.min(height-1,Math.floor((y+.5)*height/sourceHeight))*width+Math.min(width-1,Math.floor((x+.5)*width/sourceWidth));
    if(!ink[i]){ink[i]=1;pixels.push(i);}if(v>brightness[i]){brightness[i]=v;sourcePixel[i]=p;}
  }
  const arrival=new Float32Array(count).fill(1),skeleton=ink.slice(),remove=new Uint32Array(pixels.length);
  if(!pixels.length)return {arrival,width,height,sparks:[],inkCount:0,strokes:[],traceSegments:[],activeHeads:0};
  const dx=[0,1,1,1,0,-1,-1,-1],dy=[-1,-1,0,1,1,1,0,-1],offset=dx.map((x,k)=>x+dy[k]*width);
  const bits=new Uint8Array(256),thin=[new Uint8Array(256),new Uint8Array(256)];
  for(let m=0;m<256;m++){
    let n=0,a=0;for(let k=0;k<8;k++){n+=(m>>k)&1;if(!(m&(1<<k))&&(m&(1<<((k+1)&7))))a++;}bits[m]=n;
    const p=k=>(m>>k)&1;
    thin[0][m]=n>=2&&n<=6&&a===1&&!(p(0)*p(2)*p(4))&&!(p(2)*p(4)*p(6));
    thin[1][m]=n>=2&&n<=6&&a===1&&!(p(0)*p(2)*p(6))&&!(p(0)*p(4)*p(6));
  }
  const maskAt=(i,map)=>{let m=0;const x=i%width,y=(i/width)|0;for(let k=0;k<8;k++){const nx=x+dx[k],ny=y+dy[k];if(nx>=0&&nx<width&&ny>=0&&ny<height&&map[i+offset[k]])m|=1<<k;}return m;};
  let passes=0,changed=true;
  // CAD strokes are only a few raster pixels wide; this limit also bounds load.
  while(changed&&passes++<24){changed=false;for(let pass=0;pass<2;pass++){let n=0;for(const i of pixels)if(skeleton[i]&&thin[pass][maskAt(i,skeleton)])remove[n++]=i;for(let k=0;k<n;k++)skeleton[remove[k]]=0;changed ||= n>0;}}
  const radius=i=>Math.hypot(i%width-width*.5,((i/width)|0)-height*.5);
  // Parallel thinning can erase a tiny 2x2 island: preserve one real seed in
  // every original connected component before extracting the graph.
  const originalSeen=new Uint8Array(count),originalQueue=new Uint32Array(pixels.length);
  for(const start of pixels)if(!originalSeen[start]){let q0=0,q1=1,hasSkeleton=false,near=start;originalQueue[0]=start;originalSeen[start]=1;while(q0<q1){const i=originalQueue[q0++];hasSkeleton ||= !!skeleton[i];if(radius(i)<radius(near))near=i;const m=maskAt(i,ink);for(let k=0;k<8;k++)if(m&(1<<k)){const j=i+offset[k];if(!originalSeen[j]){originalSeen[j]=1;originalQueue[q1++]=j;}}}if(!hasSkeleton)skeleton[near]=1;}
  const skel=pixels.filter(i=>skeleton[i]),links=new Uint8Array(count),degree=new Uint8Array(count);
  for(const i of skel){let m=maskAt(i,skeleton);for(let k=1;k<8;k+=2)if((m&(1<<k))&&((m&(1<<(k-1)))||(m&(1<<((k+1)&7)))))m&=~(1<<k);links[i]=m;degree[i]=bits[m];}
  const pixelNode=new Int32Array(count).fill(-1),nodes=[],queue=new Uint32Array(skel.length),visited=new Uint8Array(count);
  function addNode(seed,junction){const id=nodes.length,n={pixels:[],edges:[],radius:Infinity,time:Infinity,lit:false};nodes.push(n);let q0=0,q1=1;queue[0]=seed;pixelNode[seed]=id;while(q0<q1){const i=queue[q0++];n.pixels.push(i);n.radius=Math.min(n.radius,radius(i));if(junction)for(let k=0;k<8;k++)if(links[i]&(1<<k)){const j=i+offset[k];if(degree[j]>2&&pixelNode[j]<0){pixelNode[j]=id;queue[q1++]=j;}}}return id;}
  for(const i of skel)if(pixelNode[i]<0&&degree[i]!==2)addNode(i,degree[i]>2);
  // Every component gets a root, and pure loops get one synthetic junction.
  const components=[];
  for(const start of skel)if(!visited[start]){let q0=0,q1=1;queue[0]=start;visited[start]=1;let near=start,root=-1;
    while(q0<q1){const i=queue[q0++];if(radius(i)<radius(near))near=i;if(pixelNode[i]>=0&&(root<0||nodes[pixelNode[i]].radius<nodes[root].radius))root=pixelNode[i];for(let k=0;k<8;k++)if(links[i]&(1<<k)){const j=i+offset[k];if(!visited[j]){visited[j]=1;queue[q1++]=j;}}}
    // Root exactly at the nearest skeleton pixel, including degree-2 chains.
    root=pixelNode[near]>=0?pixelNode[near]:addNode(near,false);components.push(root);
  }
  const used=new Uint8Array(count),edges=[];
  const mark=(i,k)=>{used[i]|=1<<k;used[i+offset[k]]|=1<<((k+4)&7);};
  for(let from=0;from<nodes.length;from++)for(const first of nodes[from].pixels)for(let direction=0;direction<8;direction++)if((links[first]&(1<<direction))&&!(used[first]&(1<<direction))){
    const path=[first];let i=first,k=direction,length=0;
    do{mark(i,k);length+=(k&1)?Math.SQRT2:1;i+=offset[k];path.push(i);if(pixelNode[i]>=0)break;const next=links[i]&~used[i];if(!next)break;k=0;while(!(next&(1<<k)))k++;}while(path.length<=skel.length+1);
    let to=pixelNode[i];if(to<0)to=addNode(i,false);if(to===from&&path.length===2)continue;
    const id=edges.length;edges.push({from,to,path,length,state:0,start:0,end:0,reverse:false});nodes[from].edges.push(id);if(to!==from)nodes[to].edges.push(id);
  }
  // Each job is a complete chain. Branches wait for an actual reached endpoint.
  // An event heap limits concurrency; a priority heap chooses inner chains first.
  class Heap{constructor(key){this.a=[];this.key=key;}push(v){const a=this.a,k=this.key;let i=a.length;a.push(v);while(i){const p=(i-1)>>1;if(k(a[p])<=k(v))break;a[i]=a[p];i=p;}a[i]=v;}pop(){const a=this.a,k=this.key,v=a[0],last=a.pop();if(a.length){let i=0;while(i*2+1<a.length){let c=i*2+1;if(c+1<a.length&&k(a[c+1])<k(a[c]))c++;if(k(last)<=k(a[c]))break;a[i]=a[c];i=c;}a[i]=last;}return v;}get size(){return this.a.length;}}
  const ready=new Heap(j=>j.priority),active=new Heap(j=>j.end);let time=0,maxHeads=0;
  // Disconnected pieces may ignite only after completed strokes have reached
  // their radius. This gates whole components, never individual pixel colors.
  const pendingRoots=components.slice().sort((a,b)=>nodes[a].radius-nodes[b].radius);
  const centerRoot=pendingRoots.shift();let pendingIndex=0,reachedRadius=nodes[centerRoot].radius;
  ready.push({root:centerRoot,priority:nodes[centerRoot].radius});
  function releaseReachedRoots(){while(pendingIndex<pendingRoots.length&&nodes[pendingRoots[pendingIndex]].radius<=reachedRadius+2){const root=pendingRoots[pendingIndex++];ready.push({root,priority:nodes[root].radius});}}
  function light(id,t){const n=nodes[id];if(n.lit)return;n.lit=true;n.time=t;for(const e of n.edges){const edge=edges[e];if(edge.state)continue;edge.state=1;ready.push({edge:e,from:id,priority:Math.min(nodes[edge.from].radius,nodes[edge.to].radius)+Math.min(24,edge.length*.025)});}}
  while(ready.size||active.size||pendingIndex<pendingRoots.length){
    while(ready.size&&active.size<12){const job=ready.pop();if(job.root!==undefined){light(job.root,time);continue;}const e=edges[job.edge];e.reverse=job.from===e.to;e.start=time;e.end=time+Math.max(1,e.length);active.push({edge:job.edge,to:e.reverse?e.from:e.to,end:e.end});maxHeads=Math.max(maxHeads,active.size);}
    if(active.size){const done=active.pop();time=done.end;for(const i of edges[done.edge].path)reachedRadius=Math.max(reachedRadius,radius(i));light(done.to,time);releaseReachedRoots();}
    else if(pendingIndex<pendingRoots.length){
      // If there is no remaining connected work, bridge to the nearest island.
      // One logical unit also gives an all-isolated-points drawing an ordering.
      const root=pendingRoots[pendingIndex++];time+=1;reachedRadius=Math.max(reachedRadius,nodes[root].radius);ready.push({root,priority:nodes[root].radius});releaseReachedRoots();
    }
  }
  const totalTime=Math.max(1,time),norm=t=>.065+.835*t/totalTime,rawArrival=new Float64Array(count).fill(Infinity),strokes=[],traceSegments=[];
  for(const n of nodes)for(const i of n.pixels)rawArrival[i]=n.time;
  for(const e of edges){const path=e.reverse?e.path.slice().reverse():e.path;let s=0;for(let p=0;p<path.length;p++){if(p)s+=Math.hypot(path[p]%width-path[p-1]%width,((path[p]/width)|0)-((path[p-1]/width)|0));rawArrival[path[p]]=Math.min(rawArrival[path[p]],e.start+s);}strokes.push({path,start:norm(e.start),end:norm(e.end),length:e.length});}
  // Nearest-skeleton ownership stays inside the source ink, preserving width.
  let q0=0,q1=0;const owner=new Int32Array(count).fill(-1),allQueue=new Uint32Array(count);
  for(const i of skel){owner[i]=i;allQueue[q1++]=i;arrival[i]=norm(Number.isFinite(rawArrival[i])?rawArrival[i]:totalTime);}
  while(q0<q1){const i=allQueue[q0++],m=maskAt(i,ink);for(let k=0;k<8;k++)if(m&(1<<k)){const j=i+offset[k];if(owner[j]<0){owner[j]=owner[i];arrival[j]=arrival[owner[i]];allQueue[q1++]=j;}}}
  // Tiny original components removed by thinning are retained as point jobs.
  let missed=0;for(const i of pixels)if(owner[i]<0){arrival[i]=.90;missed++;}
  const uv=i=>{const p=sourcePixel[i],x=(p%sourceWidth+.5)/sourceWidth,y=(((p/sourceWidth)|0)+.5)/sourceHeight;return {x:x+Math.sign((i%width+.5)/width-x)*.01/sourceWidth,y:y+Math.sign((((i/width)|0)+.5)/height-y)*.01/sourceHeight};};
  // Equal-distance center pixels may belong to different chains. Keep the
  // actual scheduled root, rather than choosing a second unregistered pixel.
  const center=nodes[centerRoot].pixels.reduce((best,i)=>radius(i)<radius(best)?i:best,nodes[centerRoot].pixels[0]);
  for(const i of nodes[centerRoot].pixels)arrival[i]=.025;
  for(const i of pixels)if(owner[i]>=0&&pixelNode[owner[i]]===centerRoot)arrival[i]=.025;
  const sparks=[],candidates=[];
  for(const stroke of strokes){const path=stroke.path;let length=0,last=0;for(let p=1;p<path.length;p++){length+=Math.hypot(path[p]%width-path[p-1]%width,((path[p]/width)|0)-((path[p-1]/width)|0));if(length-last>=38||p===path.length-1){const i=path[p];candidates.push({...uv(i),time:arrival[i],strength:1});last=length;}}}
  // Stratified sampling retains actual on-ink anchors and their exact times.
  candidates.sort((a,b)=>a.time-b.time);for(let j=0;j<Math.min(440,candidates.length);j++)sparks.push(candidates[Math.floor(j*candidates.length/Math.min(440,candidates.length))]);
  sparks.unshift({...uv(center),time:arrival[center],strength:3});
  return {arrival,width,height,sparks,inkCount:pixels.length,strokes,traceSegments,activeHeads:maxHeads,diagnostics:{skeletonPixels:skel.length,nodes:nodes.length,edges:edges.length,components:components.length,thinningPasses:passes,missedInk:missed,totalLength:edges.reduce((s,e)=>s+e.length,0)}};
}
