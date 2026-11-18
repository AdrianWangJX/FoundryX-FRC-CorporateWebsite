import * as THREE from 'three';
import {buildWireFlow} from './wire-flow.js';
import {createWireSparks} from './wire-sparks.js';
import {WELCOME_TIMING,WELCOME_TURN_RADIANS,cadPhaseTime} from './timing.js';
import {GUARD_IDS,welcomeAssembly} from './cad-guards.js';
import {createLogoTransition} from './logo-transition.js';

const smooth=(a,b,x)=>{const t=Math.max(0,Math.min(1,(x-a)/(b-a)));return t*t*(3-2*t);};
const SCALE=1/160,CENTER=[0,293.5,-90],SPAN=4.62;
// The poster, live drawing and solid always show the same assembly.
// Four side guards share the same mirrored geometry in every animation stage.
const cameraDirection=new THREE.Vector3(.879*Math.cos(27.77*Math.PI/180),Math.sin(28.5*Math.PI/180),.879*Math.sin(27.77*Math.PI/180)).normalize();
const formationGLSL=`
uniform float uTime;uniform vec3 uViewAxis;uniform float uPaperDepth;
float depthScale(){return .03+.97*smoothstep(1.,3.,uTime);}
vec3 formedPosition(vec3 p){
 if(uTime>=3.)return p;
 return p-uViewAxis*(dot(p,uViewAxis)-uPaperDepth)*(1.-depthScale());
}`;

// A distance field from the actual visible CAD lines. Surface material grows
// inward from these lines; its opacity is never cross-faded against an image.
function distanceFromInk(rgba,width,height){
 const d=new Float32Array(width*height),diagonal=Math.SQRT2;
 for(let i=0;i<d.length;i++)d[i]=rgba[i*4]>24?0:width+height;
 for(let y=0;y<height;y++)for(let x=0;x<width;x++){
  const i=y*width+x;let v=d[i];if(x)v=Math.min(v,d[i-1]+1);if(y){v=Math.min(v,d[i-width]+1);if(x)v=Math.min(v,d[i-width-1]+diagonal);if(x+1<width)v=Math.min(v,d[i-width+1]+diagonal);}d[i]=v;
 }
 for(let y=height-1;y>=0;y--)for(let x=width-1;x>=0;x--){
  const i=y*width+x;let v=d[i];if(x+1<width)v=Math.min(v,d[i+1]+1);if(y+1<height){v=Math.min(v,d[i+width]+1);if(x)v=Math.min(v,d[i+width-1]+diagonal);if(x+1<width)v=Math.min(v,d[i+width+1]+diagonal);}d[i]=v;
 }
 for(let i=0;i<d.length;i++)d[i]/=width;
 const texture=new THREE.DataTexture(d,width,height,THREE.RedFormat,THREE.FloatType);
 texture.minFilter=texture.magFilter=THREE.NearestFilter;texture.needsUpdate=true;return texture;
}

function packParts(parts){
 const totalVertices=parts.reduce((n,m)=>n+m.position.length/3,0),totalIndices=parts.reduce((n,m)=>n+m.index.length,0);
 const totalEdgeVertices=parts.reduce((n,m)=>n+(m.edges?.length||0)/3,0);
 const position=new Float32Array(totalVertices*3),normal=new Float32Array(totalVertices*3),color=new Float32Array(totalVertices*3),index=new Uint32Array(totalIndices),linePosition=new Float32Array(totalEdgeVertices*3);
 let vertexBase=0,indexBase=0,lineBase=0,paperDepth=Infinity;
 for(const m of parts){
  const vertices=m.position.length/3;
  for(let i=0;i<vertices;i++){
   const j=(vertexBase+i)*3;
   for(let k=0;k<3;k++){position[j+k]=(m.position[i*3+k]-CENTER[k])*SCALE;normal[j+k]=m.normal[i*3+k];color[j+k]=m.vertexColor?m.vertexColor[i*3+k]:(m.color?.[k]??.55);}
   paperDepth=Math.min(paperDepth,position[j]*cameraDirection.x+position[j+1]*cameraDirection.y+position[j+2]*cameraDirection.z);
  }
  for(let i=0;i<m.index.length;i++)index[indexBase+i]=m.index[i]+vertexBase;
  for(let i=0;i<(m.edges?.length||0);i++)linePosition[lineBase*3+i]=(m.edges[i]-CENTER[i%3])*SCALE;
  vertexBase+=vertices;indexBase+=m.index.length;lineBase+=(m.edges?.length||0)/3;
 }
 const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.BufferAttribute(position,3));geometry.setAttribute('normal',new THREE.BufferAttribute(normal,3));geometry.setAttribute('color',new THREE.BufferAttribute(color,3));geometry.setIndex(new THREE.BufferAttribute(index,1));
 const edgeGeometry=new THREE.BufferGeometry();edgeGeometry.setAttribute('position',new THREE.BufferAttribute(linePosition,3));
 return {geometry,edgeGeometry,paperDepth,triangles:totalIndices/3};
}

export function createCadRenderer(canvas,data){
 const parts=welcomeAssembly(data.meshes),partCount=parts.length;
 const solid=packParts(parts.filter(m=>!GUARD_IDS.has(m.id)));
 const guards=parts.filter(m=>GUARD_IDS.has(m.id)).map(m=>({...packParts([m]),id:m.id}));
 const {geometry,edgeGeometry}=solid;
 const paperDepth=Math.min(solid.paperDepth,...guards.map(g=>g.paperDepth));
 const triangleCount=solid.triangles+guards.reduce((n,g)=>n+g.triangles,0);
 const staticGeometry=new THREE.BufferGeometry();staticGeometry.setAttribute('position',geometry.attributes.position);staticGeometry.setAttribute('normal',geometry.attributes.normal);staticGeometry.setIndex(geometry.index);
 const renderer=new THREE.WebGLRenderer({canvas,antialias:true,alpha:false,powerPreference:'high-performance'});
 renderer.setClearColor(0x000000,1);renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.NoToneMapping;renderer.info.autoReset=false;
 renderer.debug.onShaderError=(gl,p,v,f)=>{throw Error([gl.getProgramInfoLog(p),gl.getShaderInfoLog(v),gl.getShaderInfoLog(f)].filter(Boolean).join('\n')||'CAD shader failed');};
 const camera=new THREE.OrthographicCamera(-SPAN,SPAN,SPAN,-SPAN,8,24);camera.position.copy(cameraDirection).multiplyScalar(16);camera.lookAt(0,0,0);
 const scene=new THREE.Scene(),assembly=new THREE.Group();scene.add(assembly);scene.add(new THREE.AmbientLight(0xffffff,.68));
 for(const [p,power]of [[[-5,8,6],1.65],[[6,3,-5],.85],[[4,0,7],.3]]){const light=new THREE.DirectionalLight(0xffffff,power);light.position.set(...p);scene.add(light);}
 const time={value:0},distance={value:distanceFromInk(new Uint8Array([255,255,255,255]),1,1)},resolution={value:new THREE.Vector2(1,1)};
 const dissolve={value:0};
 const buildUniforms={uDissolve:dissolve,uTime:time,uViewAxis:{value:cameraDirection},uPaperDepth:{value:paperDepth}};
 const material=new THREE.MeshPhongMaterial({color:0xffffff,vertexColors:true,shininess:45,specular:0x333333,side:THREE.DoubleSide,polygonOffset:true,polygonOffsetFactor:1,polygonOffsetUnits:1});
 material.onBeforeCompile=shader=>{
  Object.assign(shader.uniforms,buildUniforms,{uSurfaceDistance:distance,uCanvasSize:resolution});
  shader.vertexShader=formationGLSL+'\n'+shader.vertexShader;
  shader.vertexShader=shader.vertexShader.replace('#include <beginnormal_vertex>',`#include <beginnormal_vertex>
if(uTime<3.){float k=depthScale();objectNormal=normalize(k*objectNormal+(1.-k)*uViewAxis*dot(objectNormal,uViewAxis));}`);
  shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\ntransformed=formedPosition(transformed);');
  shader.fragmentShader='uniform float uDissolve;uniform float uTime;uniform sampler2D uSurfaceDistance;uniform vec2 uCanvasSize;\n'+shader.fragmentShader;
  shader.fragmentShader=shader.fragmentShader.replace('#include <clipping_planes_fragment>',`#include <clipping_planes_fragment>
float surfaceFront=.12*smoothstep(1.,2.75,uTime);
float surfaceDistance=texture2D(uSurfaceDistance,gl_FragCoord.xy/uCanvasSize).r;
if(uTime<2.75&&surfaceDistance>surfaceFront)discard;`);
  shader.fragmentShader=shader.fragmentShader.replace('#include <opaque_fragment>',`float rim=(1.-smoothstep(0.,1.5/uCanvasSize.x,surfaceFront-surfaceDistance))*(1.-smoothstep(2.55,2.75,uTime));
outgoingLight=mix(outgoingLight,vec3(1.,.6,.16),rim);
outgoingLight*=1.-smoothstep(0.,.24,uDissolve);
diffuseColor.a*=1.-smoothstep(0.,.24,uDissolve);
#include <opaque_fragment>`);
 };
 material.customProgramCacheKey=()=> 'cad-drawing-depth-surface-growth-v23-2';
 const mesh=new THREE.Mesh(geometry,material);mesh.frustumCulled=false;assembly.add(mesh);
 // Thin CAD sheets are rendered as transparent surfaces, without depth writes;
 // the opaque mechanism remains visible through both overlapping layers.
 // This short turn always views the +X side. Whole-object center sorting
 // would swap the offset inner/outer sheets halfway through the turn.
 const guardOrder=new Map([[682,10],[146,12],[230,14],[694,16]]);
 const guardMaterial=new THREE.MeshPhongMaterial({color:0xffffff,vertexColors:true,shininess:105,specular:0x8b9da5,transparent:true,opacity:.13,depthWrite:false,side:THREE.DoubleSide,forceSinglePass:true});
 guardMaterial.onBeforeCompile=material.onBeforeCompile;
 guardMaterial.customProgramCacheKey=()=> 'cad-transparent-symmetric-guards-v33';
 for(const g of guards){const pane=new THREE.Mesh(g.geometry,guardMaterial);pane.frustumCulled=false;pane.renderOrder=guardOrder.get(g.id);assembly.add(pane);}
 const formedLineMaterial=new THREE.ShaderMaterial({uniforms:{...buildUniforms,uSurfaceDistance:distance,uCanvasSize:resolution},transparent:true,depthTest:true,depthWrite:false,
 vertexShader:formationGLSL+'\nvoid main(){vec3 p=formedPosition(position);gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.);}',
 fragmentShader:`uniform float uDissolve;uniform float uTime;uniform sampler2D uSurfaceDistance;uniform vec2 uCanvasSize;void main(){if(uTime<2.75&&texture2D(uSurfaceDistance,gl_FragCoord.xy/uCanvasSize).r>.12*smoothstep(1.,2.75,uTime))discard;vec3 c=mix(vec3(1.,.67,.22),vec3(.055),smoothstep(1.15,2.9,uTime));c=mix(c,vec3(1.25,.72,.24),smoothstep(0.,.12,uDissolve));gl_FragColor=vec4(c,.6*(1.-smoothstep(.16,.42,uDissolve)));
 #include <colorspace_fragment>
 }`});
 const formedLines=new THREE.LineSegments(edgeGeometry,formedLineMaterial);formedLines.frustumCulled=false;formedLines.renderOrder=1;assembly.add(formedLines);
 const guardLineMaterial=formedLineMaterial.clone();
 guardLineMaterial.fragmentShader=guardLineMaterial.fragmentShader.replace('vec3(.055)','vec3(.40,.52,.59)');
 // clone() copies uniform values; retain the live animation/distance references.
 guardLineMaterial.uniforms={...buildUniforms,uSurfaceDistance:distance,uCanvasSize:resolution};
 for(const g of guards){const edges=new THREE.LineSegments(g.edgeGeometry,guardLineMaterial);edges.frustumCulled=false;edges.renderOrder=guardOrder.get(g.id)+1;assembly.add(edges);}
 const wireScene=new THREE.Scene(),normalScene=new THREE.Scene();
 const black=new THREE.MeshBasicMaterial({color:0,polygonOffset:true,polygonOffsetFactor:1,polygonOffsetUnits:1,side:THREE.DoubleSide});
 const wireMaterial=new THREE.LineBasicMaterial({color:0xffffff}),normalMaterial=new THREE.MeshNormalMaterial({side:THREE.DoubleSide});
 const occluder=new THREE.Mesh(staticGeometry,black),normals=new THREE.Mesh(staticGeometry,normalMaterial),outlines=new THREE.LineSegments(edgeGeometry,wireMaterial);
 for(const m of [occluder,normals,outlines])m.frustumCulled=false;
 wireScene.add(occluder,outlines);normalScene.add(normals);
 // Guard outlines are visible, but their clear faces never occlude inner ink.
 for(const g of guards){const edges=new THREE.LineSegments(g.edgeGeometry,wireMaterial);edges.frustumCulled=false;wireScene.add(edges);}
 const wireTarget=new THREE.WebGLRenderTarget(1,1,{samples:2}),normTarget=new THREE.WebGLRenderTarget(1,1,{samples:2});
 const quadScene=new THREE.Scene(),quadCamera=new THREE.OrthographicCamera(-1,1,1,-1,0,1);
 const arrival={value:new THREE.DataTexture(new Float32Array([1]),1,1,THREE.RedFormat,THREE.FloatType)};arrival.value.needsUpdate=true;
 const quadUniforms={uArrival:arrival,uWire:{value:wireTarget.texture},uNormal:{value:normTarget.texture},uTime:time,uPixel:{value:new THREE.Vector2(1,1)}};
 const quadMaterial=new THREE.ShaderMaterial({uniforms:quadUniforms,depthTest:false,depthWrite:false,
 vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position.xy,0.,1.);}',
 fragmentShader:`varying vec2 vUv;uniform sampler2D uWire;uniform sampler2D uNormal;uniform sampler2D uArrival;uniform vec2 uPixel;uniform float uTime;
 void main(){vec4 c=texture2D(uNormal,vUv);float outline=0.;
 for(int i=0;i<4;i++){vec2 o=i==0?vec2(uPixel.x,0.):i==1?vec2(-uPixel.x,0.):i==2?vec2(0.,uPixel.y):vec2(0.,-uPixel.y);vec4 n=texture2D(uNormal,vUv+o);outline=max(outline,abs(c.a-n.a));outline=max(outline,smoothstep(.30,.6,length(c.rgb-n.rgb))*step(.5,min(c.a,n.a))*.85);}
 float ink=max(texture2D(uWire,vUv).r,outline*.8);float sweep=1.;float head=0.;float trail=0.;
 float dim=1.;
 if(uTime<1.){
  float reached=texture2D(uArrival,vUv).r;float age=uTime-reached;
  sweep=smoothstep(-.0018,.0018,age);if(uTime<=0.)sweep=0.;
  head=(1.-smoothstep(.002,.010,abs(age)))*step(.001,uTime);
  trail=(1.-smoothstep(.012,.065,age))*step(0.,age);
  dim=mix(1.,.14,smoothstep(0.,.04,uTime));
 }
 vec3 col=mix(vec3(.96,.98,1.)*dim,vec3(1.,.60,.11),sweep);
 col=mix(col,vec3(1.6,1.05,.30),trail*.7);
 col=mix(col,vec3(2.6,2.3,1.5),head);
 gl_FragColor=vec4(col*ink*(1.-smoothstep(1.15,2.7,uTime)),1.);
 #include <colorspace_fragment>
 }`});
 const quad=new THREE.Mesh(new THREE.PlaneGeometry(2,2),quadMaterial);quadScene.add(quad);
 const sparks=createWireSparks(time,resolution);quadScene.add(sparks.mesh);
 const transitionScene=new THREE.Scene(),transition=createLogoTransition(dissolve,resolution);transitionScene.add(transition.mesh);
 let logoLayout={width:.67,height:.67*158.5/485.7,x:0,y:0};
 const updateTransition=()=>transition.update([edgeGeometry,...guards.map(g=>g.edgeGeometry)],camera,{...logoLayout,pixelRatio:canvas.width/Math.max(1,canvas.getBoundingClientRect().width)});
 let width=0,height=0,disposed=false,resizeCount=0,prepared=false,flowStats=null;
 function cacheDrawing(){
  if(width===canvas.width&&height===canvas.height)return;
  width=canvas.width;height=canvas.height;resizeCount++;renderer.setSize(width,height,false);wireTarget.setSize(width,height);normTarget.setSize(width,height);quadUniforms.uPixel.value.set(1/width,1/height);resolution.value.set(width,height);updateTransition();
  renderer.setRenderTarget(normTarget);renderer.setClearColor(0,0);renderer.clear();renderer.render(normalScene,camera);
  renderer.setRenderTarget(wireTarget);renderer.setClearColor(0,1);renderer.clear();renderer.render(wireScene,camera);
  const inkTarget=new THREE.WebGLRenderTarget(width,height),rgba=new Uint8Array(width*height*4),savedTime=time.value;time.value=0;
  renderer.setRenderTarget(inkTarget);renderer.render(quadScene,quadCamera);renderer.readRenderTargetPixels(inkTarget,0,0,width,height,rgba);
  distance.value.dispose();distance.value=distanceFromInk(rgba,width,height);
  const flowStarted=performance.now(),flow=buildWireFlow(rgba,width,height);
  arrival.value.dispose();arrival.value=new THREE.DataTexture(flow.arrival,flow.width,flow.height,THREE.RedFormat,THREE.FloatType);arrival.value.minFilter=arrival.value.magFilter=THREE.NearestFilter;arrival.value.needsUpdate=true;
  sparks.update(flow.sparks,width/Math.max(1,canvas.getBoundingClientRect().width),flow);
  flowStats={width:flow.width,height:flow.height,inkPixels:flow.inkCount,bursts:flow.sparks.length,activeHeads:flow.activeHeads,...flow.diagnostics,buildMs:Math.round(performance.now()-flowStarted)};
 time.value=savedTime;inkTarget.dispose();renderer.setRenderTarget(null);
  // Upload the size-specific distance texture before the user's first click.
  renderer.initTexture(distance.value);renderer.initTexture(arrival.value);
  // Compile/upload the new instanced attributes before playback as well.
  const warmTarget=new THREE.WebGLRenderTarget(16,16);renderer.setRenderTarget(warmTarget);renderer.render(quadScene,quadCamera);renderer.render(transitionScene,quadCamera);renderer.setRenderTarget(null);warmTarget.dispose();
 }
 const api={setLogoLayout(layout){if(layout.width<=0||layout.height<=0||!['width','height','x','y'].every(k=>Number.isFinite(layout[k]))||['width','height','x','y'].every(k=>Math.abs(layout[k]-logoLayout[k])<.00001))return;logoLayout=layout;transition.setLayout(layout);},kind:'source-cad',partCount,triangles:triangleCount,
 async prepare(){
  if(prepared||disposed)return;await renderer.compileAsync(scene,camera);if(disposed)return;
  const target=new THREE.WebGLRenderTarget(16,16);time.value=3;renderer.setRenderTarget(target);renderer.render(scene,camera);renderer.setRenderTarget(null);target.dispose();time.value=0;prepared=true;
 },
 render(ms){
  if(disposed)return;cacheDrawing();renderer.info.reset();dissolve.value=Math.max(0,Math.min(1,(ms-WELCOME_TIMING.hold)/(WELCOME_TIMING.dissolved-WELCOME_TIMING.hold)));time.value=cadPhaseTime(ms);assembly.rotation.y=WELCOME_TURN_RADIANS*smooth(3,4,time.value);
  sparks.mesh.visible=ms>0&&ms<WELCOME_TIMING.gold;
  renderer.autoClear=true;if(time.value<2.7)renderer.render(quadScene,quadCamera);else renderer.clear();
  if(ms>WELCOME_TIMING.gold&&dissolve.value<.42){renderer.autoClear=false;renderer.clearDepth();renderer.render(scene,camera);}
  if(dissolve.value>0&&dissolve.value<1){renderer.autoClear=false;renderer.render(transitionScene,quadCamera);}renderer.autoClear=true;
 },
 dispose(){
  if(disposed)return;disposed=true;wireTarget.dispose();normTarget.dispose();distance.value.dispose();quad.geometry.dispose();quadMaterial.dispose();arrival.value.dispose();sparks.dispose();transition.dispose();
  for(const m of [material,guardMaterial,formedLineMaterial,guardLineMaterial,black,wireMaterial,normalMaterial])m.dispose();for(const g of [geometry,edgeGeometry,staticGeometry,...guards.flatMap(g=>[g.geometry,g.edgeGeometry])])g.dispose();renderer.dispose();
 },
 get diagnostics(){return {drawCalls:renderer.info.render.calls,triangles:renderer.info.render.triangles,lines:renderer.info.render.lines,parts:partCount,transparentGuards:guards.map(g=>g.id),programs:renderer.info.programs?.length||0,resizeCount,prepared,flow:flowStats};}
 };
 return api;
}
