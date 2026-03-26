"use client";
import { useEffect, useRef, useState } from "react";
import type { Map as MaplibreMap, CustomRenderMethodInput } from "maplibre-gl";
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

const CX = 23.3219;
const CY = 42.6977;
const CENTER: [number, number] = [CX, CY];
const MODEL_LNG = 23.3328;
const MODEL_LAT  = 42.7070;
const MODEL_SCALE_METERS = 3000;

const MAP_STYLE: any = {
  version: 8,
  sources: { omt: { type: "vector", url: "https://tiles.openfreemap.org/planet" } },
  layers: [
    { id: "bg", type: "background",     paint: { "background-color": "#000205" } },
    { id: "wt", type: "fill",           source: "omt", "source-layer": "water",    paint: { "fill-color": "#00060d" } },
    { id: "lu", type: "fill",           source: "omt", "source-layer": "landuse",  paint: { "fill-color": "#020408" } },
    { id: "bf", type: "fill",           source: "omt", "source-layer": "building", paint: { "fill-color": "#03060e", "fill-outline-color": "#0d0d0d" } },
    { id: "b3", type: "fill-extrusion", source: "omt", "source-layer": "building", minzoom: 13,
      paint: {
        "fill-extrusion-color":             ["interpolate",["linear"],["get","render_height"],0,"#090909",20,"#111111",60,"#1a1a1a",150,"#222222"],
        "fill-extrusion-height":            ["coalesce",["get","render_height"],0],
        "fill-extrusion-base":              ["coalesce",["get","render_min_height"],0],
        "fill-extrusion-opacity":           0.95,
        "fill-extrusion-vertical-gradient": false,
      },
    },
    { id: "rb",  type: "line", source: "omt", "source-layer": "transportation", filter: ["in",["get","class"],["literal",["motorway","trunk","primary","secondary","tertiary","minor","service"]]], paint: { "line-color": "#000", "line-width": 2 } },
    { id: "gmo", type: "line", source: "omt", "source-layer": "transportation", filter: ["in",["get","class"],["literal",["minor","tertiary","service"]]], paint: { "line-color": "#555", "line-width": 6,   "line-blur": 8,  "line-opacity": 0.18 } },
    { id: "gmm", type: "line", source: "omt", "source-layer": "transportation", filter: ["in",["get","class"],["literal",["minor","tertiary","service"]]], paint: { "line-color": "#888", "line-width": 1.5, "line-blur": 2,  "line-opacity": 0.35 } },
    { id: "gmc", type: "line", source: "omt", "source-layer": "transportation", filter: ["in",["get","class"],["literal",["minor","tertiary","service"]]], paint: { "line-color": "#aaa", "line-width": 0.6, "line-blur": 0,  "line-opacity": 0.55 } },
    { id: "gso", type: "line", source: "omt", "source-layer": "transportation", filter: ["==",["get","class"],"secondary"], paint: { "line-color": "#666", "line-width": 10,  "line-blur": 10, "line-opacity": 0.28 } },
    { id: "gsm", type: "line", source: "omt", "source-layer": "transportation", filter: ["==",["get","class"],"secondary"], paint: { "line-color": "#999", "line-width": 3,   "line-blur": 4,  "line-opacity": 0.5  } },
    { id: "gsc", type: "line", source: "omt", "source-layer": "transportation", filter: ["==",["get","class"],"secondary"], paint: { "line-color": "#ddd", "line-width": 0.8, "line-blur": 0,  "line-opacity": 0.85 } },
    { id: "gpo", type: "line", source: "omt", "source-layer": "transportation", filter: ["==",["get","class"],"primary"],   paint: { "line-color": "#777", "line-width": 14,  "line-blur": 12, "line-opacity": 0.32 } },
    { id: "gpm", type: "line", source: "omt", "source-layer": "transportation", filter: ["==",["get","class"],"primary"],   paint: { "line-color": "#aaa", "line-width": 4,   "line-blur": 5,  "line-opacity": 0.6  } },
    { id: "gpc", type: "line", source: "omt", "source-layer": "transportation", filter: ["==",["get","class"],"primary"],   paint: { "line-color": "#eee", "line-width": 1,   "line-blur": 0,  "line-opacity": 1    } },
    { id: "gxo", type: "line", source: "omt", "source-layer": "transportation", filter: ["in",["get","class"],["literal",["motorway","trunk"]]], paint: { "line-color": "#888", "line-width": 20,  "line-blur": 16, "line-opacity": 0.38 } },
    { id: "gxm", type: "line", source: "omt", "source-layer": "transportation", filter: ["in",["get","class"],["literal",["motorway","trunk"]]], paint: { "line-color": "#bbb", "line-width": 5,   "line-blur": 6,  "line-opacity": 0.7  } },
    { id: "gxc", type: "line", source: "omt", "source-layer": "transportation", filter: ["in",["get","class"],["literal",["motorway","trunk"]]], paint: { "line-color": "#fff", "line-width": 1.2, "line-blur": 0,  "line-opacity": 1    } },
  ],
};

const VOL_VERT = `
attribute vec2 aPos;
varying vec2 vUV;
void main() {
  vUV = aPos * 0.5 + 0.5;
  gl_Position = vec4(aPos, 0.0, 1.0);
}
`;

const VOL_FRAG = `
precision mediump float;

uniform float uTime;
uniform mat4  uInvMVP;
uniform vec3  uVolCenter;
uniform float uVolR;
uniform float uVolH;
varying vec2  vUV;

float h21(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}
float n2(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f*f*(3.0-2.0*f);
  return mix(mix(h21(i),h21(i+vec2(1,0)),u.x),mix(h21(i+vec2(0,1)),h21(i+vec2(1,1)),u.x),u.y);
}
float fbm(vec2 p) {
  float v=0.0,a=0.5;
  v+=a*n2(p); p=p*2.17+vec2(1.7,9.2); a*=0.5;
  v+=a*n2(p); p=p*2.17+vec2(8.3,2.8); a*=0.5;
  v+=a*n2(p);
  return v;
}

float getDensity(vec3 world) {
  vec3 lc = world - uVolCenter;
  float r  = length(lc.xz) / uVolR;
  float ny = lc.y / uVolH + 0.5;
  if (r > 1.0 || ny < 0.0 || ny > 1.0) return 0.0;

  float phi = atan(lc.z, lc.x);

  float wobble = sin(uTime * 0.31 + r * 4.2) * 0.18;
  float swirl  = phi / 6.2832
               + uTime * (0.28 - r * 0.16)
               + (1.0 - r) * 3.5
               + wobble;

  float drift = -uTime * 0.05 + sin(phi * 2.0 + uTime * 0.4) * 0.08;
  vec2 uv = vec2(swirl * 0.85, ny * 1.5 + drift);

  float a = fbm(uv * 2.8 + vec2(uTime * 0.07, 0.0));
  float b = fbm(uv * 6.5 + vec2(0.0, uTime * 0.11) + vec2(4.3, 1.7));
  float cloud = a * 0.62 + b * 0.38;

  float hFade = smoothstep(0.0, 0.08, ny) * smoothstep(1.0, 0.42, ny);
  float rFade = smoothstep(0.08, 0.38, r) * smoothstep(1.0, 0.55, r);

  float d = (cloud - 0.42) * 5.5 * hFade * rFade;
  return clamp(d, 0.0, 1.0);
}

bool hitCylinder(vec3 ro, vec3 rd, out float t0, out float t1) {
  vec3 lro = ro - uVolCenter;
  float a = rd.x*rd.x + rd.z*rd.z;
  float b = 2.0*(lro.x*rd.x + lro.z*rd.z);
  float c = lro.x*lro.x + lro.z*lro.z - uVolR*uVolR;
  float disc = b*b - 4.0*a*c;
  if (disc < 0.0) return false;
  float sq = sqrt(disc);
  t0 = (-b-sq)/(2.0*a);
  t1 = (-b+sq)/(2.0*a);
  float yBot = uVolCenter.y - uVolH*0.5;
  float yTop = uVolCenter.y + uVolH*0.5;
  if (rd.y != 0.0) {
    float tB=(yBot-ro.y)/rd.y, tT=(yTop-ro.y)/rd.y;
    t0=max(t0,min(tB,tT)); t1=min(t1,max(tB,tT));
  } else if (ro.y<yBot||ro.y>yTop) return false;
  return t1>t0 && t1>0.0;
}

void main() {
  vec4 ndcA=vec4(vUV*2.0-1.0,-1.0,1.0);
  vec4 ndcB=vec4(vUV*2.0-1.0, 1.0,1.0);
  vec4 wA=uInvMVP*ndcA; wA/=wA.w;
  vec4 wB=uInvMVP*ndcB; wB/=wB.w;
  vec3 ro=wA.xyz, rd=normalize(wB.xyz-wA.xyz);

  float t0,t1;
  if (!hitCylinder(ro,rd,t0,t1)){gl_FragColor=vec4(0.0);return;}
  t0=max(t0,0.001);

  const int STEPS=16;
  float span=t1-t0;
  float step=span/float(STEPS);
  float jitter=h21(vUV*317.4+vec2(uTime*0.03))*step;

  float transmit=1.0, accum=0.0;
  for (int i=0;i<16;i++){
    float t=t0+jitter+float(i)*step;
    vec3 pos=ro+rd*t;
    float d=getDensity(pos);
    if (d<0.005) continue;
    float sT=exp(-d*6.0*step);
    accum+=transmit*d*step;
    transmit*=sT;
    if (transmit<0.01) break;
  }

  float alpha=clamp(1.0-transmit,0.0,1.0);
  if (alpha<0.008) discard;

  float bright=clamp(accum*2.8,0.0,1.0);
  float core=bright*bright;
  vec3 col=mix(
    vec3(0.55,0.65,0.80),
    vec3(0.92,0.95,1.00),
    core
  );

  gl_FragColor=vec4(col*alpha*0.75, alpha*0.75);
}
`;

type MapRef = MaplibreMap & { _ro?: ResizeObserver };

export default function MapPanel() {
  const containerRef  = useRef<HTMLDivElement>(null);
  const mapRef        = useRef<MapRef | null>(null);
  const mapIdleRef    = useRef(false);
  const modelReadyRef = useRef(false);
  const [loaded, setLoaded] = useState(false);

  const checkReady = (fn: (v: boolean) => void) => {
    if (mapIdleRef.current && modelReadyRef.current) fn(true);
  };

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    let destroyed = false;

    import("maplibre-gl").then(({ Map: MLMap, MercatorCoordinate }) => {
      if (destroyed) return;

      const map = new MLMap({
        container: containerRef.current!,
        style: MAP_STYLE,
        center: CENTER,
        zoom: 14.8, minZoom: 12, maxZoom: 18,
        pitch: 60, bearing: -20,
        attributionControl: false,
        interactive: true,
        dragPan: true, dragRotate: true, scrollZoom: true,
        boxZoom: false, keyboard: true, doubleClickZoom: true,
        touchZoomRotate: true, touchPitch: true, fadeDuration: 0,
      });

      const setPtr = () => map.getCanvas().style.setProperty("pointer-events","auto","important");
      setPtr();

      map.on("load", () => {
        if (destroyed) { map.remove(); return; }

        const origin        = MercatorCoordinate.fromLngLat([MODEL_LNG, MODEL_LAT], 0);
        const metersPerUnit = origin.meterInMercatorCoordinateUnits();
        const scale         = metersPerUnit * MODEL_SCALE_METERS;

        const whiteMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.6, metalness: 0.0 });

        let threeCamera:   THREE.Camera        | null = null;
        let threeScene:    THREE.Scene         | null = null;
        let threeRenderer: THREE.WebGLRenderer | null = null;

        const startTime = performance.now();

        let volProg:    WebGLProgram         | null = null;
        let volBuf:     WebGLBuffer          | null = null;
        let uTimeLoc:   WebGLUniformLocation | null = null;
        let uInvMVPLoc: WebGLUniformLocation | null = null;
        let uCenterLoc: WebGLUniformLocation | null = null;
        let uRLoc:      WebGLUniformLocation | null = null;
        let uHLoc:      WebGLUniformLocation | null = null;

        let volR=0, volH=0, volCX=0, volCY=0, volCZ=0;

        function mkShader(gl: WebGLRenderingContext, type: number, src: string) {
          const s = gl.createShader(type)!;
          gl.shaderSource(s, src); gl.compileShader(s);
          if (!gl.getShaderParameter(s, gl.COMPILE_STATUS))
            console.error("shader err:", gl.getShaderInfoLog(s));
          return s;
        }

        const modelLayer = {
          id: "citadel-model", type: "custom" as const, renderingMode: "3d" as const,

          onAdd(_map: MaplibreMap, gl: WebGLRenderingContext) {
            threeCamera = new THREE.Camera();
            threeScene  = new THREE.Scene();
            threeScene.add(new THREE.AmbientLight(0xffffff, 0.5));

            const sun = new THREE.DirectionalLight(0xffffff, 1.6);
            sun.position.set(200, 400, 300);
            sun.castShadow = true;
            sun.shadow.mapSize.set(2048, 2048);
            sun.shadow.camera.near = 0.1;
            sun.shadow.camera.far  = 2000;
            sun.shadow.bias        = -0.0005;
            threeScene.add(sun);

            const fill = new THREE.DirectionalLight(0xddeeff, 0.4);
            fill.position.set(-1, 0.5, 0.5);
            threeScene.add(fill);

            new GLTFLoader().load("/Citadel.glb", (gltf: {scene:THREE.Group}) => {
              const model = gltf.scene;
              model.traverse(c => { if ((c as THREE.Mesh).isMesh) { (c as THREE.Mesh).material=whiteMat; (c as THREE.Mesh).castShadow=(c as THREE.Mesh).receiveShadow=true; }});
              const b0=new THREE.Box3().setFromObject(model), s0=new THREE.Vector3();
              b0.getSize(s0); model.scale.setScalar(1/Math.max(s0.x,s0.y,s0.z));
              const b1=new THREE.Box3().setFromObject(model); model.position.y-=b1.min.y;
              threeScene!.add(model);
              const fb=new THREE.Box3().setFromObject(model);
              const fs=new THREE.Vector3(), fc=new THREE.Vector3();
              fb.getSize(fs); fb.getCenter(fc);
              const ground=new THREE.Mesh(new THREE.PlaneGeometry(fs.x*6,fs.z*6),new THREE.ShadowMaterial({opacity:0.45}));
              ground.rotation.x=-Math.PI/2; ground.position.set(fc.x,fb.min.y,fc.z); ground.receiveShadow=true;
              threeScene!.add(ground);
              sun.shadow.camera.left=-fs.x*3; sun.shadow.camera.right=fs.x*3;
              sun.shadow.camera.top=fs.z*3; sun.shadow.camera.bottom=-fs.z*3;
              sun.shadow.camera.far=fs.y*12; sun.shadow.camera.updateProjectionMatrix();

              volR  = Math.max(fs.x,fs.z) * 0.65;
              volH  = fs.y * 0.55;
              volCX = fc.x + 0.0005;
              volCY = fb.min.y + fs.y * 1.24;
              volCZ = fc.z + 0.0005; 

              modelReadyRef.current=true; checkReady(setLoaded); map.triggerRepaint();
            }, undefined, (e:unknown)=>console.error(e));

            threeRenderer = new THREE.WebGLRenderer({canvas:map.getCanvas(),context:gl,antialias:true});
            threeRenderer.autoClear=false; threeRenderer.shadowMap.enabled=true;
            threeRenderer.shadowMap.type=THREE.PCFSoftShadowMap;
          },

          render(_gl: WebGLRenderingContext, opts: CustomRenderMethodInput) {
            if (!threeCamera||!threeScene||!threeRenderer) return;
            const lm = new THREE.Matrix4()
              .makeTranslation(origin.x,origin.y,origin.z??0)
              .scale(new THREE.Vector3(scale,-scale,scale))
              .multiply(new THREE.Matrix4().makeRotationX(Math.PI/2));
            threeCamera.projectionMatrix=new THREE.Matrix4().fromArray(opts.defaultProjectionData.mainMatrix).multiply(lm);
            threeRenderer.resetState(); threeRenderer.render(threeScene,threeCamera);
            map.triggerRepaint();
          },
        };

        const volumeLayer = {
          id: "citadel-volume", type: "custom" as const, renderingMode: "3d" as const,

          onAdd(_map: MaplibreMap, gl: WebGLRenderingContext) {
            const p=gl.createProgram()!;
            gl.attachShader(p, mkShader(gl,gl.VERTEX_SHADER,  VOL_VERT));
            gl.attachShader(p, mkShader(gl,gl.FRAGMENT_SHADER,VOL_FRAG));
            gl.linkProgram(p);
            if (!gl.getProgramParameter(p,gl.LINK_STATUS)) console.error(gl.getProgramInfoLog(p));
            volProg=p;
            uTimeLoc   = gl.getUniformLocation(p,"uTime");
            uInvMVPLoc = gl.getUniformLocation(p,"uInvMVP");
            uCenterLoc = gl.getUniformLocation(p,"uVolCenter");
            uRLoc      = gl.getUniformLocation(p,"uVolR");
            uHLoc      = gl.getUniformLocation(p,"uVolH");
            volBuf=gl.createBuffer()!;
            gl.bindBuffer(gl.ARRAY_BUFFER,volBuf);
            gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,1,1]),gl.STATIC_DRAW);
          },

          render(gl: WebGLRenderingContext, opts: CustomRenderMethodInput) {
            if (!volProg||!volBuf||!modelReadyRef.current) return;
            const t=(performance.now()-startTime)/1000;
            const lm=new THREE.Matrix4()
              .makeTranslation(origin.x,origin.y,origin.z??0)
              .scale(new THREE.Vector3(scale,-scale,scale))
              .multiply(new THREE.Matrix4().makeRotationX(Math.PI/2));
            const invMVP=new THREE.Matrix4().fromArray(opts.defaultProjectionData.mainMatrix).multiply(lm).invert();

            gl.useProgram(volProg);
            gl.uniform1f(uTimeLoc,t);
            gl.uniformMatrix4fv(uInvMVPLoc,false,invMVP.toArray());
            gl.uniform3f(uCenterLoc,volCX,volCY,volCZ);
            gl.uniform1f(uRLoc,volR);
            gl.uniform1f(uHLoc,volH);

            gl.bindBuffer(gl.ARRAY_BUFFER,volBuf);
            const aPos=gl.getAttribLocation(volProg,"aPos");
            gl.enableVertexAttribArray(aPos);
            gl.vertexAttribPointer(aPos,2,gl.FLOAT,false,0,0);

            gl.enable(gl.BLEND);
            gl.blendFunc(gl.ONE,gl.ONE_MINUS_SRC_ALPHA);
            gl.disable(gl.DEPTH_TEST);
            gl.drawArrays(gl.TRIANGLE_STRIP,0,4);
            gl.disable(gl.BLEND);
            gl.enable(gl.DEPTH_TEST);
            gl.disableVertexAttribArray(aPos);
            map.triggerRepaint();
          },
        };

        map.addLayer(modelLayer);
        map.addLayer(volumeLayer);
        setPtr();
      });

      map.on("idle", () => {
        setPtr();
        if (!mapIdleRef.current) { mapIdleRef.current=true; checkReady(setLoaded); }
      });

      const ro=new ResizeObserver(()=>{ if (!destroyed) map.resize(); });
      if (containerRef.current) ro.observe(containerRef.current);
      (map as MapRef)._ro=ro;
      mapRef.current=map as MapRef;
    });

    return () => {
      destroyed=true;
      mapRef.current?._ro?.disconnect();
      mapRef.current?.remove();
      mapRef.current=null;
    };
  }, []);

  return (
    <div
      style={{position:"relative",width:"100%",height:"100%",cursor:"grab",touchAction:"pan-x pan-y"}}
      onMouseDown={e=>e.stopPropagation()} onTouchStart={e=>e.stopPropagation()}
      onMouseMove={e=>e.stopPropagation()} onTouchMove={e=>e.stopPropagation()}
      onWheel={e=>e.stopPropagation()}
    >
      {!loaded && <MapSkeleton />}
      <div ref={containerRef} style={{width:"100%",height:"100%",position:"absolute",inset:0}} />
    </div>
  );
}

function MapSkeleton() {
  return (
    <div style={{position:"absolute",inset:0,zIndex:10,background:"#060608",display:"flex",alignItems:"center",justifyContent:"center"}}>
      <div style={{width:28,height:28,border:"1.5px solid rgba(255,255,255,0.12)",borderTopColor:"rgba(255,255,255,0.4)",borderRadius:"50%",animation:"skspin 0.9s linear infinite"}} />
      <style>{`@keyframes skspin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}