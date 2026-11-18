import * as THREE from 'three';
import {WELCOME_TIMING} from './timing.js';

// Moving welding tips and hot metal sprays, instanced in one GPU draw.
export function createWireSparks(time,resolution){
  const pixelRatio={value:1};
  const material=new THREE.ShaderMaterial({
    transparent:true,blending:THREE.AdditiveBlending,depthTest:false,depthWrite:false,
    uniforms:{uTime:time,uResolution:resolution,uPixelRatio:pixelRatio,uTraceSeconds:{value:WELCOME_TIMING.gold/1000}},
    vertexShader:`attribute vec2 aOrigin;attribute vec2 aVelocity;attribute float aStart;attribute float aLife;attribute float aKind;attribute float aPower;
uniform float uTime;uniform float uTraceSeconds;uniform vec2 uResolution;uniform float uPixelRatio;
varying vec2 vLocal;varying vec2 vDirection;varying float vFade;varying float vAge;varying float vKind;varying float vPower;
void main(){
 float age=(uTime-aStart)*uTraceSeconds;float alive=step(0.,age)*(1.-step(aLife,age))*(1.-step(.99,uTime));
 float t=clamp(age,0.,aLife);vAge=t/aLife;vKind=aKind;vPower=aPower;
 vec2 gravity=vec2(0.,-180.);vec2 velocity=aVelocity+gravity*t;
 vec2 drift=aVelocity*t+gravity*t*t*.5;
 if(aKind>.5){drift=vec2(0.);velocity=vec2(1.,0.);}
 if(aKind>1.5){drift=(aVelocity-aOrigin)*clamp(age/aLife,0.,1.)*uResolution/uPixelRatio;velocity=(aVelocity-aOrigin)*uResolution;}
 vec2 local=position.xy*56.;vLocal=local;vDirection=normalize(velocity);
 float flicker=.82+.18*sin(uTime*700.+aStart*1951.);
 vFade=alive*smoothstep(0.,.008,t)*(1.-smoothstep(.18,1.,vAge))*flicker;
 if(aKind>1.5)vFade=alive*flicker;
 gl_Position=vec4(aOrigin*2.-1.+(drift+local)*uPixelRatio/uResolution*2.,0.,1.);
 if(alive<.5)gl_Position=vec4(2.,2.,0.,1.);
}`,
    fragmentShader:`varying vec2 vLocal;varying vec2 vDirection;varying float vFade;varying float vAge;varying float vKind;varying float vPower;
void main(){
 if(vFade<=.001)discard;
 float core;float glow;vec3 color;
 if(vKind>.5){
  vec2 p=vLocal/max(.8,vPower);float radius=length(p);
  core=1.-smoothstep(.7,2.2,radius);glow=exp(-radius*.42)*.58;
  float star=exp(-abs(p.x)*3.8-abs(p.y)*.44)+exp(-abs(p.y)*3.8-abs(p.x)*.44);
  glow+=star*.33;
  if(vKind>1.5){float along=clamp(dot(vLocal,-vDirection),0.,9.);float d=length(vLocal+vDirection*along);glow+=exp(-d*1.2)*.35;}
  color=mix(vec3(1.,.27,.025),vec3(1.,.98,.84),core);
 }else{
  float along=clamp(dot(vLocal,-vDirection),0.,mix(10.,2.,vAge)*vPower);
  float distance=length(vLocal+vDirection*along);
  core=1.-smoothstep(.22,.68,distance);glow=exp(-distance*1.7)*.25;
  color=mix(vec3(1.,.22,.012),vec3(1.,.74,.32),core);
 }
 float alpha=(core+glow)*vFade;if(alpha<.004)discard;
 gl_FragColor=vec4(color,alpha);
 #include <colorspace_fragment>
}`
  });
  const mesh=new THREE.Mesh(new THREE.InstancedBufferGeometry(),material);mesh.frustumCulled=false;mesh.renderOrder=2;
  function update(anchors,dpr,flow){
    pixelRatio.value=dpr;
    // Short afterglow keeps fast tracing legible without dimming its hot tips.
    const afterglowScale=Math.min(1,WELCOME_TIMING.gold/840);
    const particles=[];
    for(const [burst,a] of anchors.entries()){
      const ignition=(a.strength||1)>1.5,rays=ignition?34:7;
      particles.push({a,velocity:[0,0],kind:1,life:ignition?.28:.10,power:ignition?2.3:1});
      for(let ray=0;ray<rays;ray++){
        let h=Math.imul(burst*61+ray*17+13,0x45d9f3b);h=Math.imul(h^(h>>>16),0x45d9f3b);
        const seed=((h^(h>>>16))>>>0)/4294967296;
        const radial=Math.atan2(a.y-.5,a.x-.5);
        const angle=ignition?ray/rays*Math.PI*2:radial+((ray+seed)/rays-.5)*5.2;
        const speed=(ignition?110:65)+seed*(ignition?180:125);
        particles.push({a,velocity:[Math.cos(angle)*speed,Math.sin(angle)*speed+24],kind:0,life:.20+seed*.21,power:.65+seed*.5});
      }
    }
    // Long CAD strokes get a continuously moving white-hot tip. Adjacent
    // raster segments share the same arc-length clock, with no JS per frame.
    if(flow)for(const stroke of flow.strokes){
      if(stroke.length<16)continue;
      const points=stroke.path;let arc=0,segmentArc=0,first=points[0];
      const uv=i=>[(i%flow.width+.5)/flow.width,(Math.floor(i/flow.width)+.5)/flow.height];
      for(let j=1;j<points.length;j++){
        const a=points[j-1],b=points[j];arc+=Math.hypot(b%flow.width-a%flow.width,Math.floor(b/flow.width)-Math.floor(a/flow.width));
        // Keep bends exactly on the ink; merge only collinear raster steps.
        const c=points[j+1],turn=c!==undefined&&((b%flow.width-a%flow.width)!==(c%flow.width-b%flow.width)||Math.floor(b/flow.width)-Math.floor(a/flow.width)!==Math.floor(c/flow.width)-Math.floor(b/flow.width));
        if(turn||j===points.length-1){
          const start=stroke.start+(stroke.end-stroke.start)*segmentArc/stroke.length;
          const end=stroke.start+(stroke.end-stroke.start)*arc/stroke.length;
          const p=uv(first);particles.push({a:{x:p[0],y:p[1],time:start},velocity:uv(b),kind:2,life:Math.max(.00001,(end-start)*WELCOME_TIMING.gold/1000),power:.8});first=b;segmentArc=arc;
        }
      }
    }
    const count=particles.length,origins=new Float32Array(count*2),velocities=new Float32Array(count*2),starts=new Float32Array(count),lives=new Float32Array(count),kinds=new Float32Array(count),powers=new Float32Array(count);
    particles.forEach(({a,velocity,kind,life,power},i)=>{
      origins.set([a.x,a.y],i*2);velocities.set(velocity,i*2);starts[i]=a.time;lives[i]=kind<2?life*afterglowScale:life;kinds[i]=kind;powers[i]=power;
    });
    const plane=new THREE.PlaneGeometry(1,1),geometry=new THREE.InstancedBufferGeometry();
    geometry.setIndex(plane.index);geometry.setAttribute('position',plane.attributes.position);
    for(const [name,array,size]of [['aOrigin',origins,2],['aVelocity',velocities,2],['aStart',starts,1],['aLife',lives,1],['aKind',kinds,1],['aPower',powers,1]])geometry.setAttribute(name,new THREE.InstancedBufferAttribute(array,size));
    geometry.instanceCount=count;mesh.geometry.dispose();mesh.geometry=geometry;plane.dispose();
  }
  update([],1);
  return {mesh,update,dispose(){mesh.geometry.dispose();material.dispose();}};
}
