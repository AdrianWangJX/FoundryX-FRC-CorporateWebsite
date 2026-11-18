// Calibration measured from the source's parallel frame edges, in its
// 1888 x 1334 inspection coordinate system. Actual dimensional units are relative.
export const reference={width:1888,height:1334,origin:[879,1046],scale:220,azimuth:26.5*Math.PI/180,elevation:26.25*Math.PI/180,screenCenter:[839,699],cameraSpan:3.66};
const {scale:s,azimuth:a,elevation:e}=reference;
export const projection={ux:s*Math.cos(a),uz:s*Math.sin(a),vx:-s*Math.sin(e)*Math.sin(a),vy:-s*Math.cos(e),vz:s*Math.sin(e)*Math.cos(a)};
export const viewDirection=[-Math.cos(e)*Math.sin(a),Math.sin(e),Math.cos(e)*Math.cos(a)];
export function fromDrawing(u,v,plane='xy',constant=0){
 const U=u-reference.origin[0],V=v-reference.origin[1],{ux,uz,vx,vy,vz}=projection;
 if(plane==='xy'){const z=constant,x=(U-uz*z)/ux;return [x,(V-vx*x-vz*z)/vy,z];}
 if(plane==='zy'){const x=constant,z=(U-ux*x)/uz;return [x,(V-vx*x-vz*z)/vy,z];}
 const y=constant,D=ux*vz-uz*vx;return [(U*vz-uz*(V-vy*y))/D,y,(ux*(V-vy*y)-vx*U)/D];
}
export function toDrawing(x,y,z){const p=projection;return [reference.origin[0]+p.ux*x+p.uz*z,reference.origin[1]+p.vx*x+p.vy*y+p.vz*z];}
export const referenceCenter=fromDrawing(...reference.screenCenter,'xy',0);
