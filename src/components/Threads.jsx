import React, {useEffect,useRef} from 'react';
import {Renderer,Program,Mesh,Triangle,Color} from 'ogl';
// React Bits Threads. MIT + Commons Clause. See LICENSE-ReactBits.md.
const vertexShader = `
attribute vec2 position;
attribute vec2 uv;
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position, 0.0, 1.0);
}
`;

const fragmentShader = `
precision highp float;

uniform float iTime;
uniform vec3 iResolution;
uniform vec3 uColor;
uniform float uAmplitude;
uniform float uDistance;
uniform vec2 uMouse;

#define PI 3.1415926538

const int u_line_count = 28;
const float u_line_width = 5.0;
const float u_line_blur = 3.0;

float Perlin2D(vec2 P) {
    vec2 Pi = floor(P);
    vec4 Pf_Pfmin1 = P.xyxy - vec4(Pi, Pi + 1.0);
    vec4 Pt = vec4(Pi.xy, Pi.xy + 1.0);
    Pt = Pt - floor(Pt * (1.0 / 71.0)) * 71.0;
    Pt += vec2(26.0, 161.0).xyxy;
    Pt *= Pt;
    Pt = Pt.xzxz * Pt.yyww;
    vec4 hash_x = fract(Pt * (1.0 / 951.135664));
    vec4 hash_y = fract(Pt * (1.0 / 642.949883));
    vec4 grad_x = hash_x - 0.49999;
    vec4 grad_y = hash_y - 0.49999;
    vec4 grad_results = inversesqrt(grad_x * grad_x + grad_y * grad_y)
        * (grad_x * Pf_Pfmin1.xzxz + grad_y * Pf_Pfmin1.yyww);
    grad_results *= 1.4142135623730950;
    vec2 blend = Pf_Pfmin1.xy * Pf_Pfmin1.xy * Pf_Pfmin1.xy
               * (Pf_Pfmin1.xy * (Pf_Pfmin1.xy * 6.0 - 15.0) + 10.0);
    vec4 blend2 = vec4(blend, vec2(1.0 - blend));
    return dot(grad_results, blend2.zxzx * blend2.wwyy);
}

float pixel(float count, vec2 resolution) {
    return (1.0 / max(resolution.x, resolution.y)) * count;
}

float lineFn(vec2 st, float width, float perc, float offset, vec2 mouse, float time, float amplitude, float distance) {
    float split_offset = (perc * 0.4);
    float split_point = 0.1 + split_offset;

    float amplitude_normal = smoothstep(split_point, 0.7, st.x);
    float amplitude_strength = 0.5;
    float finalAmplitude = amplitude_normal * amplitude_strength
                           * amplitude * (1.0 + (mouse.y - 0.5) * 0.2);

    float time_scaled = time / 10.0 + (mouse.x - 0.5) * 1.0;
    float blur = smoothstep(split_point, split_point + 0.05, st.x) * perc;

    float xnoise = mix(
        Perlin2D(vec2(time_scaled, st.x + perc) * 2.5),
        Perlin2D(vec2(time_scaled, st.x + time_scaled) * 3.5) / 1.5,
        st.x * 0.3
    );

    float y = 0.5 + (perc - 0.5) * distance + xnoise / 2.0 * finalAmplitude;

    float line_start = smoothstep(
        y + (width / 2.0) + (u_line_blur * pixel(1.0, iResolution.xy) * blur),
        y,
        st.y
    );

    float line_end = smoothstep(
        y,
        y - (width / 2.0) - (u_line_blur * pixel(1.0, iResolution.xy) * blur),
        st.y
    );

    return clamp(
        (line_start - line_end) * (1.0 - smoothstep(0.0, 1.0, pow(perc, 0.3))),
        0.0,
        1.0
    );
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    vec2 uv = fragCoord / iResolution.xy;

    float line_strength = 1.0;
    for (int i = 0; i < u_line_count; i++) {
        float p = float(i) / float(u_line_count);
        line_strength *= (1.0 - lineFn(
            uv,
            u_line_width * pixel(1.0, iResolution.xy) * (1.0 - p),
            p,
            (PI * 1.0) * p,
            uMouse,
            iTime,
            uAmplitude,
            uDistance
        ));
    }

    float colorVal = 1.0 - line_strength;
    vec3 tint = mix(vec3(0.72, 0.12, 0.13), uColor, smoothstep(0.15, 0.82, uv.x));
    fragColor = vec4(tint, colorVal * 0.85);
}

void main() {
    mainImage(gl_FragColor, gl_FragCoord.xy);
}
`;


export default function Threads(){
 const ref=useRef(null);
 useEffect(()=>{
  const container=ref.current,host=container.closest('.hero,.chapter-hero,.type-hero')||container.parentElement;let renderer;
  try{renderer=new Renderer({alpha:true,antialias:false,dpr:1,powerPreference:'low-power'});}catch{return;}
  const gl=renderer.gl;gl.clearColor(0,0,0,0);container.appendChild(gl.canvas);
  const geometry=new Triangle(gl),program=new Program(gl,{vertex:vertexShader,fragment:fragmentShader,uniforms:{
   iTime:{value:5},iResolution:{value:new Color(1,1,1)},uColor:{value:new Color(.96,.76,.46)},uAmplitude:{value:1.1},uDistance:{value:.17},uMouse:{value:new Float32Array([.5,.5])}
  }}),mesh=new Mesh(gl,{geometry,program});
  let raf=0,last=0,elapsed=5,visible=true,paused=matchMedia('(prefers-reduced-motion:reduce)').matches||document.body.classList.contains('motion-paused'),dead=false;
  let target=[.5,.5],current=[.5,.5];const fine=matchMedia('(pointer:fine)').matches;
  function draw(){if(dead||gl.isContextLost())return;program.uniforms.iTime.value=elapsed;program.uniforms.uMouse.value.set(current);renderer.render({scene:mesh});}
  function tick(now){raf=0;if(paused||!visible||document.hidden||dead)return;if(now-last>=40){elapsed+=Math.min((now-last)/1000,.05);last=now;current=current.map((v,i)=>v+(target[i]-v)*.055);draw();}raf=requestAnimationFrame(tick);}
  function sync(){cancelAnimationFrame(raf);raf=0;last=performance.now();if(!paused&&visible&&!document.hidden&&!dead)raf=requestAnimationFrame(tick);}
  function resize(){const w=container.clientWidth,h=container.clientHeight;if(!w||!h)return;renderer.dpr=Math.min(1,1440/Math.max(w,h));renderer.setSize(w,h);program.uniforms.iResolution.value.set(gl.canvas.width,gl.canvas.height,gl.canvas.width/gl.canvas.height);draw();}
  function motion(e){paused=e.detail.paused;sync();draw();}
  function pointer(e){if(!fine||paused)return;const r=host.getBoundingClientRect();target=[(e.clientX-r.left)/r.width,1-(e.clientY-r.top)/r.height];}
  function leave(){target=[.5,.5];}
  function lost(e){e.preventDefault();dead=true;sync();container.classList.add('unavailable');}
  const ro=new ResizeObserver(resize);ro.observe(container);const io=new IntersectionObserver(([e])=>{visible=e.isIntersecting;sync();});io.observe(host);
  document.addEventListener('foundryx:motion',motion);document.addEventListener('visibilitychange',sync);host.addEventListener('pointermove',pointer,{passive:true});host.addEventListener('pointerleave',leave);gl.canvas.addEventListener('webglcontextlost',lost);
  resize();sync();
  return()=>{dead=true;sync();ro.disconnect();io.disconnect();document.removeEventListener('foundryx:motion',motion);document.removeEventListener('visibilitychange',sync);host.removeEventListener('pointermove',pointer);host.removeEventListener('pointerleave',leave);gl.canvas.removeEventListener('webglcontextlost',lost);geometry.remove();program.remove();gl.canvas.remove();gl.getExtension('WEBGL_lose_context')?.loseContext();};
 },[]);
 return <div ref={ref} className="threads-container"/>;
}
