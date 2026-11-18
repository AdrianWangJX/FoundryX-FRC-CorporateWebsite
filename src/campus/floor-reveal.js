import * as THREE from 'three';

// Pick a stable architectural volume, not individual desks/glass panels.
// Keeping the original and lifted regions active prevents hover flicker as
// the floor moves away from a stationary pointer.
export function createFloorReveal({level2,footprint,elevation,camera,stage,reduced,onChange,onRequest=()=>{}}) {
  const events=new AbortController();
  const listen=(type,handler)=>stage.addEventListener(type,event=>{handler(event);onRequest();},{signal:events.signal});
  const shape=new THREE.Shape();
  footprint.forEach(([x,z],i)=>i?shape.lineTo(x,-z):shape.moveTo(x,-z));shape.closePath();
  const geometry=new THREE.ExtrudeGeometry(shape,{depth:3.4,bevelEnabled:false});
  geometry.rotateX(-Math.PI/2);
  const material=new THREE.MeshBasicMaterial({side:THREE.DoubleSide});
  const rest=new THREE.Mesh(geometry,material),lifted=new THREE.Mesh(geometry,material);
  rest.position.y=elevation-.24;rest.updateMatrixWorld(true);
  const ray=new THREE.Raycaster(),pointer=new THREE.Vector2(),offset=new THREE.Vector3();
  const up=new THREE.Vector3(),right=new THREE.Vector3(),projected=new THREE.Vector3();
  const baseBox=new THREE.Box3().setFromObject(rest);
  const corners=[];
  for(const x of [baseBox.min.x,baseBox.max.x])for(const y of [baseBox.min.y,baseBox.max.y])for(const z of [baseBox.min.z,baseBox.max.z])corners.push(new THREE.Vector3(x,y,z));
  let inside=false,pinned=false,amount=0,wanted=0,from=0,start=0,lastHit=0,enteredAt=0,enabled=false,waiting=false;
  let pointerX=0,pointerY=0,downX=0,downY=0,downType='',anchor=null,lastTick=0,viewScale=.88,settled=0;
  const smooth=t=>t*t*(3-2*t);
  function locate(e) {
    const r=stage.getBoundingClientRect();pointerX=e.clientX-r.left;pointerY=e.clientY-r.top;
    pointer.set(pointerX/r.width*2-1,1-pointerY/r.height*2);inside=true;
  }
  function hit() {
    camera.updateMatrixWorld();ray.setFromCamera(pointer,camera);
    if(ray.intersectObject(rest,false).length)return true;
    if(amount>.02){lifted.position.copy(level2.position);lifted.position.y-=.24;lifted.updateMatrixWorld(true);if(ray.intersectObject(lifted,false).length)return true;}
    return false;
  }
  function screenBounds(points,shift=new THREE.Vector3()) {
    const r=stage.getBoundingClientRect();const b={left:Infinity,right:-Infinity,top:Infinity,bottom:-Infinity};
    for(const point of points){projected.copy(point).add(shift).project(camera);const x=(projected.x+1)*r.width/2,y=(1-projected.y)*r.height/2;b.left=Math.min(b.left,x);b.right=Math.max(b.right,x);b.top=Math.min(b.top,y);b.bottom=Math.max(b.bottom,y);}
    return b;
  }
  function retained() {
    if(hit())return true;
    if(!anchor||wanted===0)return false;
    // The connecting area also keeps the first-floor inspection area open.
    const moved=screenBounds(corners,offset.clone().multiplyScalar(amount));
    const pad=12;
    return pointerX>=Math.min(anchor.left,moved.left)-pad&&pointerX<=Math.max(anchor.right,moved.right)+pad&&pointerY>=Math.min(anchor.top,moved.top)-pad&&pointerY<=Math.max(anchor.bottom,moved.bottom)+pad;
  }
  function fitExpandedView() {
    const model=level2.parent;
    if(!model)return .88;
    // Fit the actual mesh bounds once on entry, including instanced furniture.
    // The camera then stays under the user's control during rotation.
    const fitCamera=camera.clone();fitCamera.zoom=1;fitCamera.position.y+=1.5;
    fitCamera.updateProjectionMatrix();fitCamera.updateMatrixWorld();model.updateMatrixWorld(true);
    const instance=new THREE.Matrix4(),world=new THREE.Matrix4(),point=new THREE.Vector3();
    let extent=0;
    model.traverse(mesh=>{
      if(!mesh.isMesh)return;
      let upper=false;for(let node=mesh;node;node=node.parent){if(node===level2){upper=true;break;}}
      mesh.geometry.computeBoundingBox();const b=mesh.geometry.boundingBox;
      for(let i=0;i<(mesh.isInstancedMesh?mesh.count:1);i++){
        if(mesh.isInstancedMesh){mesh.getMatrixAt(i,instance);world.multiplyMatrices(mesh.matrixWorld,instance);}else world.copy(mesh.matrixWorld);
        for(const x of [b.min.x,b.max.x])for(const y of [b.min.y,b.max.y])for(const z of [b.min.z,b.max.z]){
          point.set(x,y,z).applyMatrix4(world);if(upper)point.add(offset);point.project(fitCamera);
          extent=Math.max(extent,Math.abs(point.x),Math.abs(point.y));
        }
      }
    });
    return Math.min(.88,.90/(extent*camera.zoom));
  }
  function aim(next,now) {
    if(next===wanted)return;
    if(next){
      if(amount===0){
        camera.updateMatrixWorld();up.setFromMatrixColumn(camera.matrixWorld,1);right.setFromMatrixColumn(camera.matrixWorld,0);
        offset.set(0,5.4,0).addScaledVector(up,Math.max(0,6.8-5.4*up.y)).addScaledVector(right,-1.5);
        viewScale=fitExpandedView();
      }
      anchor=screenBounds(corners);
    }
    from=amount;wanted=next;settled=null;start=now;onChange?.(next?'opening':'closing');
  }
  listen('pointermove',e=>{if(e.pointerType==='mouse'||e.pointerType==='pen')locate(e);});
  listen('pointerenter',e=>{if(e.pointerType==='mouse'||e.pointerType==='pen')locate(e);});
  listen('pointerleave',()=>{inside=false;enteredAt=0;});
  listen('pointerdown',e=>{locate(e);downX=e.clientX;downY=e.clientY;downType=e.pointerType;});
  listen('pointerup',e=>{
    if(downType==='touch'){
      if(enabled&&Math.hypot(e.clientX-downX,e.clientY-downY)<8){locate(e);if(hit()||pinned){pinned=!pinned;aim(pinned?1:0,performance.now());}}
      inside=false;enteredAt=0;
    }
    downType='';
  });
  listen('pointercancel',()=>{inside=false;enteredAt=0;downType='';});
  listen('keydown',e=>{if(enabled&&(e.key==='Enter'||e.key===' ')){e.preventDefault();if(e.repeat)return;pinned=!pinned;inside=false;enteredAt=0;aim(pinned?1:0,performance.now());}});
  return {
    get amount(){return amount;},get viewScale(){return viewScale;},get active(){return amount>.001||wanted>0;},get pointerInside(){return inside;},
    get pending(){return waiting||amount!==wanted;},
    dispose(){events.abort();geometry.dispose();material.dispose();},
    reset(){amount=from=wanted=settled=0;waiting=false;enabled=false;inside=false;pinned=false;anchor=null;enteredAt=0;viewScale=.88;level2.position.set(0,elevation,0);onChange?.('closed');},
    update(now,isEnabled,dragging){
      const elapsed=lastTick?Math.min(now-lastTick,100):0;lastTick=now;
      enabled=isEnabled;waiting=false;
      if(!enabled)return false;
      if(!dragging&&!pinned){
        if(inside&&retained()){lastHit=now;if(!enteredAt)enteredAt=now;if(now-enteredAt>70)aim(1,now);else waiting=wanted!==1;}
        else{enteredAt=0;if(now-lastHit>230)aim(0,now);else waiting=wanted!==0;}
      }else if(dragging){lastHit=now;enteredAt=0;start+=elapsed;return false;}
      const reduce=typeof reduced==='function'?reduced():reduced;
      const previous=amount,t=Math.min(1,(now-start)/(reduce?160:620));
      amount=from+(wanted-from)*smooth(t);
      if(Math.abs(amount-wanted)<.0001)amount=wanted;
      level2.position.set(offset.x*amount,elevation+offset.y*amount,offset.z*amount);
      if(amount===wanted&&settled!==wanted){settled=wanted;onChange?.(amount===1?'open':'closed');}
      return previous!==amount;
    },
  };
}
