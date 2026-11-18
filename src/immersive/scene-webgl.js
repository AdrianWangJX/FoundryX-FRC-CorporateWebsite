import * as THREE from 'three';

// This module is a separate browser chunk. Portrait scrolling never imports it;
// the desktop photographs or an explicit model request own the GPU lifetime.
export function createSceneRenderer(canvas){
 const renderer=new THREE.WebGLRenderer({canvas,antialias:true,alpha:true,powerPreference:'high-performance'});
 renderer.setClearColor(0,0);renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.3;
 const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(38,1,.1,120);
 scene.fog=new THREE.FogExp2(0x17090e,.009);scene.add(new THREE.HemisphereLight(0xe3e9f2,0x422b2d,2.8));
 for(const [color,intensity,position]of [[0xfff4e2,3.2,[4,14,9]],[0xa44b56,1.2,[-9,7,-6]],[0xb6d5ed,2,[8,6,-10]]]){
  const light=new THREE.DirectionalLight(color,intensity);light.position.set(...position);scene.add(light);
 }
 return {renderer,scene,camera};
}

export function disposeSceneRenderer({renderer,scene}){
 const geometries=new Set(),materials=new Set(),textures=new Set();
 scene?.traverse(object=>{
  if(object.geometry)geometries.add(object.geometry);
  if(object.material)for(const material of Array.isArray(object.material)?object.material:[object.material]){
   materials.add(material);for(const value of Object.values(material))if(value?.isTexture)textures.add(value);
  }
 });
 geometries.forEach(item=>item.dispose());materials.forEach(item=>item.dispose());textures.forEach(item=>item.dispose());renderer?.dispose();
}
