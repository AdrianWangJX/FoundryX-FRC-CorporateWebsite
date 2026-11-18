// The retained CAD side is the reference for the requested mirrored guards.
// CAD 146/230 are different designs; merely unhiding 230 is not symmetric.
export const GUARD_PAIRS = Object.freeze([{source:146,target:230,layer:'inner'},{source:682,target:694,layer:'outer'}]);
export const GUARD_IDS = new Set(GUARD_PAIRS.flatMap(p=>[p.source,p.target]));

function mirrorGuard(source,target){
  const position=source.position.slice(),normal=source.normal.slice(),edges=source.edges.slice(),index=source.index.slice();
  for(let i=0;i<position.length;i+=3){position[i]=-position[i];normal[i]=-normal[i];}
  for(let i=0;i<edges.length;i+=3)edges[i]=-edges[i];
  // Reflection reverses handedness, so keep the original outward-facing winding.
  for(let i=0;i<index.length;i+=3)[index[i+1],index[i+2]]=[index[i+2],index[i+1]];
  return {...source,id:target,mirroredFrom:source.id,position,normal,edges,index,
    min:[-source.max[0],source.min[1],source.min[2]],max:[-source.min[0],source.max[1],source.max[2]]};
}

export function welcomeAssembly(meshes){
  const replacements=new Map(GUARD_PAIRS.map(pair=>{
    const source=meshes.find(m=>m.id===pair.source);
    if(!source)throw Error(`Missing CAD guard ${pair.source}`);
    return [pair.target,mirrorGuard(source,pair.target)];
  }));
  return meshes.filter(m=>m.id!==3).map(m=>replacements.get(m.id)??m);
}
