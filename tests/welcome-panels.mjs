import assert from 'node:assert/strict';
import * as THREE from 'three';
import {buildRobot} from '../src/welcome/robot-model.js';

const model=buildRobot(THREE);
const part=prefix=>model.parts.find(p=>p.name.startsWith(prefix));
const bounds=p=>{p.geometry.computeBoundingBox();return p.geometry.boundingBox;};
const center=p=>bounds(p).getCenter(new THREE.Vector3());
const close=(a,b)=>assert(Math.abs(a-b)<1e-5,`${a} != ${b}`);
const rearLeft=part('original-rear-left-'),rearRight=part('original-rear-right-');
const frontLeft=part('clear-service-cover-left-'),frontRight=part('clear-service-cover-right-');
const rl=center(rearLeft),rr=center(rearRight),fl=center(frontLeft),fr=center(frontRight);

// Both sides have the short sheet toward the interior. Reflection preserves
// each sheet's world-space shape and its position relative to the other sheet.
assert(rr.z>rl.z);
assert(fr.z<fl.z);
close(rr.z-rl.z,fl.z-fr.z);
close(rl.z+fl.z,rr.z+fr.z);
for(const axis of ['x','y']){
  close(fl[axis]-rl[axis],fr[axis]-rr[axis]);
  close(bounds(frontLeft).getSize(new THREE.Vector3())[axis],bounds(rearLeft).getSize(new THREE.Vector3())[axis]);
  close(bounds(frontRight).getSize(new THREE.Vector3())[axis],bounds(rearRight).getSize(new THREE.Vector3())[axis]);
}

// The two overlap sleeves must bridge the two sheets, with screw heads on
// the free face of the inner sheet instead of buried inside those sleeves.
const sleeves=model.parts.filter(p=>p.name.startsWith('cover-stand-off-')&&Math.abs(bounds(p).max.z-bounds(p).min.z-.32)<1e-5);
assert.equal(sleeves.length,2);
for(const sleeve of sleeves){close(bounds(sleeve).min.z,fr.z);close(bounds(sleeve).max.z,fl.z);}
const heads=model.parts.filter(p=>p.name.startsWith('cover-mount-screw-')&&center(p).z<fr.z);
assert.equal(heads.length,2);
for(const head of heads)close(center(head).z,fr.z-.018);
console.log('PASS: mirrored panel shapes and overlap, connected sleeves, exposed screw heads');
