import { MeshoptDecoder } from 'meshoptimizer/decoder';

/** Accept either a gzip file or already HTTP-decompressed bytes. */
export async function gunzipIfNeeded(input) {
  const bytes=input instanceof Uint8Array?input:new Uint8Array(input);
  if(bytes[0]!==0x1f||bytes[1]!==0x8b)return bytes;
  if(typeof DecompressionStream==='undefined')throw new Error('This browser cannot decompress the CAD model');
  const stream=new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

/** Decode the inner meshopt buffers. Positions, normals and edges are world-space, in mm. */
export async function decodeRaw(metadata,meshInput,edgeInput=null,{includeColors=false,yieldToUI=false,onProgress,signal}={}){
  if(metadata.format!=='foundryx-cad-meshopt-v1')throw new Error('Unsupported CAD packing format');
  await MeshoptDecoder.ready;
  const meshBytes=meshInput instanceof Uint8Array?meshInput:new Uint8Array(meshInput);
  const edgeBytes=edgeInput?(edgeInput instanceof Uint8Array?edgeInput:new Uint8Array(edgeInput)):null;
  // The renderer always receives linear Float32 colors. New packs store sRGB8
  // to retain the CAD palette exactly, including almost-black design colors.
  const colorLut=Float32Array.from({length:256},(_,i)=>{const c=i/255;return metadata.colorSpace==='srgb'?(c<=.04045?c/12.92:Math.pow((c+.055)/1.055,2.4)):c;});
  const meshes=[];
  for(const part of metadata.parts){
    signal?.throwIfAborted();
    const packed=new Uint8Array(part.vertexCount*12),packedIndices=new Uint8Array(part.indexCount*part.indexSize);
    MeshoptDecoder.decodeVertexBuffer(packed,part.vertexCount,12,meshBytes.subarray(part.vertex.offset,part.vertex.offset+part.vertex.bytes));
    MeshoptDecoder.decodeIndexBuffer(packedIndices,part.indexCount,part.indexSize,meshBytes.subarray(part.index.offset,part.index.offset+part.index.bytes));
    const view=new DataView(packed.buffer),position=new Float32Array(part.vertexCount*3),normal=new Float32Array(part.vertexCount*3),color=includeColors?new Float32Array(part.vertexCount*3):undefined;
    const decodeMin=part.decodeMin??part.min,decodeMax=part.decodeMax??part.max,size=decodeMax.map((x,k)=>x-decodeMin[k]);
    for(let i=0;i<part.vertexCount;i++){
      for(let k=0;k<3;k++){position[i*3+k]=decodeMin[k]+view.getUint16(i*12+k*2,true)*size[k]/65535;normal[i*3+k]=view.getInt8(i*12+6+k)/127;if(color)color[i*3+k]=colorLut[view.getUint8(i*12+9+k)];}
      if(part.geometryTransform){const p=[position[i*3],position[i*3+1],position[i*3+2]],n=[normal[i*3],normal[i*3+1],normal[i*3+2]];for(let k=0;k<3;k++){const row=part.geometryTransform[k];position[i*3+k]=row[3]+row[0]*p[0]+row[1]*p[1]+row[2]*p[2];normal[i*3+k]=row[0]*n[0]+row[1]*n[1]+row[2]*n[2];}}
      const length=Math.hypot(normal[i*3],normal[i*3+1],normal[i*3+2])||1;
      for(let k=0;k<3;k++)normal[i*3+k]/=length;
    }
    const index=part.indexSize===4?new Uint32Array(packedIndices.buffer):new Uint32Array(new Uint16Array(packedIndices.buffer));
    let edges=new Float32Array();
    if(edgeBytes&&part.edges){
      const raw=new Uint8Array(part.edges.vertexCount*8);
      MeshoptDecoder.decodeVertexBuffer(raw,part.edges.vertexCount,8,edgeBytes.subarray(part.edges.offset,part.edges.offset+part.edges.bytes));
      const lineView=new DataView(raw.buffer);edges=new Float32Array(part.edges.vertexCount*3);
      for(let i=0;i<part.edges.vertexCount;i++){
        for(let k=0;k<3;k++)edges[i*3+k]=decodeMin[k]+lineView.getUint16(i*8+k*2,true)*size[k]/65535;
        if(part.geometryTransform){const p=[edges[i*3],edges[i*3+1],edges[i*3+2]];for(let k=0;k<3;k++){const row=part.geometryTransform[k];edges[i*3+k]=row[3]+row[0]*p[0]+row[1]*p[1]+row[2]*p[2];}}
      }
    }
    meshes.push({id:part.id,name:part.name,path:part.path,prototype:part.prototype,color:part.color,colorPalette:part.colorPalette,position,normal,index,edges,...(color?{vertexColor:color}:{}),pca:part.pca,min:part.min,max:part.max,transparent:part.transparent,auxiliary:part.auxiliary});
    if(meshes.length%50===0){onProgress?.({phase:'decode',loaded:meshes.length,total:metadata.parts.length});if(yieldToUI)await new Promise(resolve=>setTimeout(resolve,0));}
  }
  return {meshes,stats:metadata.statistics,metadata};
}

export async function decodePackedCad(metadata,meshInput,edgeInput=null,options={}){
  const [meshBytes,edgeBytes]=await Promise.all([gunzipIfNeeded(meshInput),edgeInput?gunzipIfNeeded(edgeInput):null]);
  options.signal?.throwIfAborted();
  return decodeRaw(metadata,meshBytes,edgeBytes,options);
}

/** urlBase is the folder containing robot-metadata.json and its two .bin.gz files. */
export async function loadPackedCad(urlBase,{includeColors=false,includeEdges=true,signal,onProgress}={}){
  const base=new URL(String(urlBase).replace(/\/?$/,'/'),globalThis.location?.href??'http://localhost/');
  const get=async name=>{const response=await fetch(new URL(name,base),{signal,priority:'high'});if(!response.ok)throw new Error(`Cannot load robot asset (${response.status}): ${name}`);return response;};
  const metadata=await (await get('robot-metadata.json')).json();
  const [meshBytes,edgeBytes]=await Promise.all([(async()=>new Uint8Array(await (await get(metadata.files.meshes)).arrayBuffer()))(),includeEdges?(async()=>new Uint8Array(await (await get(metadata.files.edges)).arrayBuffer()))():null]);
  signal?.throwIfAborted();
  onProgress?.({phase:'decode',loaded:0,total:metadata.parts.length});
  const result=await decodePackedCad(metadata,meshBytes,edgeBytes,{includeColors,yieldToUI:true,onProgress,signal});
  signal?.throwIfAborted();
  return result;
}
