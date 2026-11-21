export const liquidFragment = `precision highp float;
uniform vec2 u_resolution;
uniform float u_time, u_bass, u_mid, u_treble, u_pulse, u_silk;
uniform vec3 u_accent;

float surface(vec2 p) {
 float t=u_time;
 p.x+=0.36*sin(p.y*1.7+t*0.26);
 p.y+=0.22*sin(p.x*1.35-t*0.21);
 return sin(p.x*3.0+sin(p.y*1.9+t*0.4)+t*0.36)*0.25
       +sin(p.y*4.1-p.x*1.7-t*0.31)*0.11
       +sin(p.x*6.0+p.y*2.7+t*0.23)*0.04;
}
void main() {
 vec2 uv=(gl_FragCoord.xy-0.5*u_resolution)/min(u_resolution.x,u_resolution.y);
 vec2 p=uv*1.65;
 p+=vec2(sin(p.y+u_time*0.1),cos(p.x-u_time*0.13))*u_bass*0.12;
 float e=0.004,h=surface(p);
 vec2 d=vec2(surface(p+vec2(e,0.0))-h,surface(p+vec2(0.0,e))-h)/e;
 vec3 n=normalize(vec3(-d*(0.85+u_bass*0.35),1.0));
 vec3 v=normalize(vec3(uv*0.12,1.4));
 vec3 r=reflect(-v,n);
 float box1=pow(max(0.0,dot(r,normalize(vec3(-0.5,0.9,1.0)))),38.0);
 float box2=pow(max(0.0,dot(r,normalize(vec3(0.7,-0.4,1.0)))),22.0);
 float soft=pow(max(0.0,dot(n,normalize(vec3(-0.5,0.8,1.5)))),3.0);
 float stripe=pow(0.5+0.5*sin(r.x*7.5+r.y*2.0+0.5),11.0);
 float groove=smoothstep(-0.16,0.16,sin(p.x*2.9+p.y*0.9+sin(p.y*2.0+u_time*0.23)));
 vec3 metal=vec3(0.055,0.07,0.11)+vec3(0.20,0.23,0.28)*soft;
 metal+=vec3(0.78,0.86,1.0)*box1*1.6+vec3(1.0,0.77,0.47)*box2*0.95;
 metal+=vec3(0.42,0.54,0.75)*stripe*0.8;
 metal*=0.33+groove*0.8;
 metal+=u_accent*pow(max(0.0,1.0-n.z),2.0)*0.65;
 vec3 silk=mix(u_accent*0.22,vec3(0.88,0.62,0.37),0.5+0.5*sin(h*7.0+u_time*0.08));
 silk*=0.18+soft*0.9;
 silk+=vec3(1.0,0.86,0.68)*(box1*0.38+stripe*0.16);
 vec3 color=mix(metal,silk,u_silk)*(0.90+u_pulse*0.08+u_treble*0.03);
 float vignette=1.0-smoothstep(0.3,1.8,length(uv))*0.45;
 color=pow(max(color*vignette,vec3(0.0)),vec3(0.92));
 gl_FragColor=vec4(color,1.0);
}`;

export class LiquidShader {
  constructor() {
    this.canvas = document.createElement('canvas'); this.ready = false;
    this.canvas.addEventListener('webglcontextlost', event => { event.preventDefault(); this.ready = false; });
    this.canvas.addEventListener('webglcontextrestored', () => this.init());
    try { this.gl = this.canvas.getContext('webgl', { alpha: false, antialias: false, preserveDrawingBuffer: true }); if (this.gl) this.init(); } catch { this.ready = false; }
  }
  init() {
    const gl = this.gl; if (!gl) return;
    try {
      const compile = (type, text) => { const shader = gl.createShader(type); gl.shaderSource(shader, text); gl.compileShader(shader); if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) { gl.deleteShader(shader); throw new Error('Shader compilation failed'); } return shader; };
      const vertex = compile(gl.VERTEX_SHADER, 'attribute vec2 position;void main(){gl_Position=vec4(position,0.0,1.0);}');
      const fragment = compile(gl.FRAGMENT_SHADER, liquidFragment);
      const program = gl.createProgram(); gl.attachShader(program, vertex); gl.attachShader(program, fragment); gl.linkProgram(program);
      gl.deleteShader(vertex); gl.deleteShader(fragment);
      if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error('Shader linking failed');
      gl.useProgram(program); this.program = program;
      const buffer = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buffer); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1,1,-1,-1,1,-1,1,1,-1,1,1]), gl.STATIC_DRAW);
      const attribute = gl.getAttribLocation(program, 'position'); gl.enableVertexAttribArray(attribute); gl.vertexAttribPointer(attribute, 2, gl.FLOAT, false, 0, 0);
      this.uniforms = Object.fromEntries(['resolution','time','bass','mid','treble','pulse','silk','accent'].map(name => [name, gl.getUniformLocation(program, 'u_' + name)])); this.ready = true;
    } catch { this.ready = false; }
  }
  render(w, h, time, sound, material, accent) {
    if (!this.ready) return false;
    const scale = Math.min(1, 1440 / Math.max(w, h), Math.sqrt(1100000 / (w * h)));
    const width = Math.max(2, Math.round(w * scale)), height = Math.max(2, Math.round(h * scale));
    if (width !== this.canvas.width || height !== this.canvas.height) { this.canvas.width = width; this.canvas.height = height; }
    const gl = this.gl, u = this.uniforms; gl.viewport(0, 0, width, height); gl.useProgram(this.program);
    gl.uniform2f(u.resolution, width, height); gl.uniform1f(u.time, time);
    for (const name of ['bass','mid','treble','pulse']) gl.uniform1f(u[name], sound[name]);
    gl.uniform1f(u.silk, material === 'silk' ? 1 : 0);
    gl.uniform3f(u.accent, ...[1, 3, 5].map(i => parseInt(accent.slice(i, i + 2), 16) / 255));
    gl.drawArrays(gl.TRIANGLES, 0, 6); return true;
  }
}
