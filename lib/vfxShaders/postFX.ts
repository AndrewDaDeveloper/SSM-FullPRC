import * as THREE from 'three';

const V = `varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`;

export const PostShader = {
  uniforms: {
    tDiffuse:   { value: null },
    time:       { value: 0 },
    mouse:      { value: new THREE.Vector2(0.5, 0.5) },
    resolution: { value: new THREE.Vector2() },
  },
  vertexShader: V,
  fragmentShader: `
    uniform sampler2D tDiffuse;uniform float time;uniform vec2 mouse,resolution;varying vec2 vUv;
    float rand(vec3 p){return fract(sin(dot(p,vec3(829.,4839.,432.)))*39428.);}
    vec4 cascade(vec2 uv,float t){
      vec2 p=uv*2.-1.;p.y+=.3;
      float g=exp(-pow(abs(p.y-sin(p.x*3.+t*.3+sin(p.x*2.)*.5)*.15)*3.,2.)*2.)*.8
             +exp(-pow(abs(p.y-sin(p.x*5.-t*.4+cos(p.x*3.)*.3)*.1-.1)*4.,2.)*3.)*.6
             +exp(-pow(abs(p.y-sin(p.x*7.+t*.25)*.08+.15)*5.,2.)*4.)*.5;
      return vec4((vec3(g)+vec3(.2)*smoothstep(.8,0.,abs(p.y)))*g*.5,g*.5);
    }
    vec2 zoom(vec2 uv,float t){return(uv-.5)*t+.5;}
    void main(){
      vec2 uv=vUv,p=uv*2.-1.;p.x*=resolution.x/resolution.y;
      float l=length(p);
      uv=zoom(uv,.6+smoothstep(0.,1.,pow(l,2.)*.3));
      vec4 tex=texture2D(tDiffuse,uv);
      float lum=dot(tex.rgb,vec3(.2126,.7152,.0722));
      vec3 c=vec3(lum);
      c+=(sin(uv.y*resolution.y*.7+time*100.)*sin(uv.y*resolution.y*.3-time*130.))*.02;
      c+=smoothstep(.01,.0,min(fract(uv.x*20.),fract(uv.y*20.)))*.04;
      c+=cascade(uv,time).rgb*(1.-clamp(lum,0.,1.))*.35;
      gl_FragColor=vec4(c,1.);
    }
  `,
};

export const ChromaShader = {
  uniforms: { tDiffuse: { value: null }, strength: { value: 0.0025 } },
  vertexShader: V,
  fragmentShader: `
    uniform sampler2D tDiffuse;uniform float strength;varying vec2 vUv;
    void main(){
      vec2 center=vUv-0.5;float dist=length(center);
      float s=strength*(1.0+dist*1.8);vec2 dir=normalize(center+0.0001);
      float r=texture2D(tDiffuse,vUv+dir*s*1.0).r;
      float g=texture2D(tDiffuse,vUv+dir*s*0.4).g;
      float b=texture2D(tDiffuse,vUv-dir*s*0.8).b;
      gl_FragColor=vec4(r,g,b,1.0);
    }
  `,
};

export const GalleryShader = {
  uniforms: { tDiffuse: { value: null }, time: { value: 0 }, seed: { value: 0 }, opacity: { value: 1 } },
  vertexShader: V,
  fragmentShader: `
    uniform sampler2D tDiffuse;
    uniform float time, seed, opacity;
    varying vec2 vUv;
    float rand(vec2 p){ return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5); }
    void main(){
      vec2 uv = vUv;
      vec3 col = texture2D(tDiffuse, uv).rgb;
      float lum = dot(col, vec3(0.2126, 0.7152, 0.0722));
      col = mix(col, vec3(lum), 0.35);
      col *= 1.08 + sin(uv.y * 60.0 + time * 0.35 + seed) * 0.022;
      col += rand(uv + vec2(time * 0.006, seed * 0.002)) * 0.028;
      col = clamp(col * 1.06 - 0.03, 0.0, 1.0);
      float edgeX = smoothstep(0.0, 0.18, uv.x) * smoothstep(1.0, 0.82, uv.x);
      float edgeY = smoothstep(0.0, 0.08, uv.y) * smoothstep(1.0, 0.92, uv.y);
      float mask = edgeX * edgeY;
      float a = mask * (opacity * opacity);
      gl_FragColor = vec4(col * a, a);
    }
  `,
};

export const CenterImageShader = {
  uniforms: {
    tDiffuse:  { value: null },
    time:      { value: 0 },
    hover:     { value: 0.0 },
    evaporate: { value: 0.0 },
    evapSeed:  { value: 0.0 },
  },
  vertexShader: V,
  fragmentShader: `
    precision highp float;
    uniform sampler2D tDiffuse;
    uniform float time, hover, evaporate, evapSeed;
    varying vec2 vUv;
    float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
    float hash3(vec3 p){return fract(sin(dot(p,vec3(127.1,311.7,74.7)))*43758.5);}
    float noise2(vec2 p){
      vec2 i=floor(p),f=fract(p);
      f=f*f*(3.-2.*f);
      return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),
                 mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y);
    }
    float fbm(vec2 p){
      float v=0.,a=.5;
      for(int i=0;i<3;i++){v+=a*noise2(p);p*=2.1;a*=.5;}
      return v;
    }
    void main(){
      vec2 uv = vUv;
      float noiseVal  = fbm(vUv * 4.5 + vec2(evapSeed * 3.7, evapSeed * 1.3));
      float yBias     = mix(0.15, 0.85, vUv.y);
      float threshold = mix(yBias, noiseVal, 0.55);
      float pixProgress = smoothstep(threshold - 0.08, threshold + 0.12, evaporate);
      float drift  = pixProgress * 0.55;
      float swirl  = fbm(vUv * 7.0 + vec2(time * 0.4, evapSeed)) * 2.0 - 1.0;
      vec2 evapUV  = uv - vec2(swirl * pixProgress * 0.12,
                                drift + noise2(vUv*9.+evapSeed)*pixProgress*0.18);
      vec2 sampleUV = mix(uv, evapUV, pixProgress);
      vec4 c4  = texture2D(tDiffuse, clamp(sampleUV, 0.0, 1.0));
      float lum = dot(c4.rgb, vec3(0.2126, 0.7152, 0.0722));
      vec3  col = vec3(lum);
      float edgeMask = smoothstep(0.0,0.03,uv.x)*smoothstep(1.0,0.97,uv.x)
                      *smoothstep(0.0,0.03,uv.y)*smoothstep(1.0,0.97,uv.y);
      float front = exp(-pow((evaporate - threshold)*8.0, 2.0)) * (1.0-evaporate);
      col += vec3(0.9, 0.85, 0.7) * front * 1.2;
      float alpha = c4.a * edgeMask * (1.0 - smoothstep(0.55, 1.0, pixProgress));
      gl_FragColor = vec4(col * alpha, alpha);
    }
  `,
};