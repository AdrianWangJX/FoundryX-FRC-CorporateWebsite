import {loadPackedCad} from './cad-loader.js';
import {createCadRenderer} from './cad-renderer.js';
export async function makeRobotRenderer(canvas,{signal}={}){
 const data=await loadPackedCad('/assets/welcome-cad/',{signal,includeColors:true});
 signal?.throwIfAborted();
 const renderer=createCadRenderer(canvas,data);
 try{await renderer.prepare();signal?.throwIfAborted();return renderer;}
 catch(error){renderer.dispose();throw error;}
}
