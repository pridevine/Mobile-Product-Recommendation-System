/* SpecularButton effect — vanilla WebGL2 port of the React Bits
   <SpecularButton /> component (MIT). React + ogl were only wrappers; this
   upgrades any element with class="specular-btn" with the same cursor-aware
   rim-light shader, zero dependencies.

   Per-button tuning via data attributes (all optional):
   data-line-color, data-base-color, data-intensity, data-shine-size,
   data-shine-fade, data-thickness, data-speed, data-proximity,
   data-radius, data-auto-animate. */
(function () {
  "use strict";

  const REDUCED = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (REDUCED) return; // static buttons under reduced motion

  const PAD = 20;

  const VERT = `#version 300 es
in vec2 position;
void main() { gl_Position = vec4(position, 0.0, 1.0); }
`;

  const FRAG = `#version 300 es
precision highp float;

uniform vec2 uCenter;
uniform vec2 uHalfSize;
uniform float uRadius;
uniform float uAngle;
uniform float uPx;
uniform vec3 uLineColor;
uniform vec3 uBaseColor;
uniform float uIntensity;
uniform float uShineSize;
uniform float uShineFade;
uniform float uThickness;
uniform float uBaseWidth;

out vec4 fragColor;

float sdRoundedRect(vec2 p, vec2 b, float r) {
  vec2 q = abs(p) - b + r;
  return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r;
}

float shapeSDF(vec2 p) { return sdRoundedRect(p, uHalfSize, uRadius); }

float gaussianLine(float d, float sigma) {
  float x = d / (sigma + 1e-6);
  float k = mix(1.0, 1.6, smoothstep(0.0, 1.5, x));
  return exp(-k * x * x);
}

void main() {
  vec2 p = gl_FragCoord.xy - uCenter;
  float d = shapeSDF(p);
  vec2 L = vec2(cos(uAngle), sin(uAngle));

  float base = (1.0 - smoothstep(0.0, uBaseWidth, abs(d))) * 0.45;

  vec2 nEll = normalize(p / (uHalfSize * uHalfSize) + 1e-6);
  float phi = acos(clamp(abs(dot(nEll, L)), 0.0, 1.0));
  float rim = 1.0 - smoothstep(uShineSize - uShineFade, uShineSize + uShineFade + 1e-4, phi);
  float line = gaussianLine(d, uThickness);
  float edgeClamp = 1.0 - smoothstep(0.5 * uPx, 3.0 * uPx, abs(d));
  float hi = line * rim * edgeClamp * uIntensity;

  vec3 col = uBaseColor * base + uLineColor * hi;
  float a = clamp(base + hi, 0.0, 1.0);
  fragColor = vec4(col, a);
}
`;

  function hexToRgb(hex) {
    let h = (hex || "#ffffff").replace("#", "");
    if (h.length === 3) h = h.split("").map((c) => c + c).join("");
    const n = parseInt(h, 16);
    return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
  }

  function initButton(btn) {
    const cfg = {
      radius: parseFloat(btn.dataset.radius || "999"),
      lineColor: hexToRgb(btn.dataset.lineColor || "#ffffff"),
      baseColor: hexToRgb(btn.dataset.baseColor || "#525252"),
      intensity: parseFloat(btn.dataset.intensity || "1"),
      shineSize: parseFloat(btn.dataset.shineSize || "10"),
      shineFade: parseFloat(btn.dataset.shineFade || "40"),
      thickness: parseFloat(btn.dataset.thickness || "1"),
      speed: parseFloat(btn.dataset.speed || "0.35"),
      proximity: parseFloat(btn.dataset.proximity || "250"),
      autoAnimate: btn.dataset.autoAnimate === "true",
    };

    // wrap existing content so it stays above the fx canvas
    const label = document.createElement("span");
    label.className = "sb-label";
    while (btn.firstChild) label.appendChild(btn.firstChild);
    btn.appendChild(label);

    const fx = document.createElement("span");
    fx.className = "sb-fx";
    fx.setAttribute("aria-hidden", "true");
    const canvas = document.createElement("canvas");
    fx.appendChild(canvas);
    btn.appendChild(fx);

    const gl = canvas.getContext("webgl2", { alpha: true, premultipliedAlpha: true, antialias: true });
    if (!gl) { fx.remove(); return; }

    const compile = (type, src) => {
      const s = gl.createShader(type);
      gl.shaderSource(s, src);
      gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
        console.warn("specular shader:", gl.getShaderInfoLog(s));
        return null;
      }
      return s;
    };
    const vs = compile(gl.VERTEX_SHADER, VERT);
    const fs = compile(gl.FRAGMENT_SHADER, FRAG);
    if (!vs || !fs) { fx.remove(); return; }
    const prog = gl.createProgram();
    gl.attachShader(prog, vs);
    gl.attachShader(prog, fs);
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) { fx.remove(); return; }
    gl.useProgram(prog);

    gl.clearColor(0, 0, 0, 0);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);

    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(prog, "position");
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

    const U = (n) => gl.getUniformLocation(prog, n);
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    gl.uniform1f(U("uPx"), dpr);
    gl.uniform1f(U("uBaseWidth"), dpr);
    gl.uniform3fv(U("uLineColor"), cfg.lineColor);
    gl.uniform3fv(U("uBaseColor"), cfg.baseColor);
    gl.uniform1f(U("uShineSize"), (cfg.shineSize * Math.PI) / 180);
    gl.uniform1f(U("uShineFade"), (cfg.shineFade * Math.PI) / 180);
    gl.uniform1f(U("uThickness"), cfg.thickness * dpr);
    const uCenter = U("uCenter"), uHalf = U("uHalfSize"), uRadius = U("uRadius"),
      uAngle = U("uAngle"), uIntensity = U("uIntensity");

    const sizeRef = { w: 1, h: 1 };
    const resize = () => {
      const rect = btn.getBoundingClientRect();
      sizeRef.w = rect.width; sizeRef.h = rect.height;
      canvas.width = Math.max(1, Math.floor((rect.width + PAD * 2) * dpr));
      canvas.height = Math.max(1, Math.floor((rect.height + PAD * 2) * dpr));
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.uniform2f(uCenter, (PAD + rect.width / 2) * dpr, (PAD + rect.height / 2) * dpr);
      gl.uniform2f(uHalf, (rect.width / 2) * dpr, (rect.height / 2) * dpr);
      gl.uniform1f(uRadius, Math.min(cfg.radius, Math.min(rect.width, rect.height) / 2) * dpr);
    };
    new ResizeObserver(resize).observe(btn);
    resize();

    // pointer steering + proximity fade (mirrors the original's math)
    let pointerAngle = null, proximityT = 0;
    window.addEventListener("pointermove", (e) => {
      const rect = btn.getBoundingClientRect();
      const cx = rect.left + rect.width / 2, cy = rect.top + rect.height / 2;
      const dx = Math.max(rect.left - e.clientX, 0, e.clientX - rect.right);
      const dy = Math.max(rect.top - e.clientY, 0, e.clientY - rect.bottom);
      const dist = Math.hypot(dx, dy);
      if (dist === 0) {
        const nx = (e.clientX - cx) / (rect.width / 2);
        const ny = (cy - e.clientY) / (rect.height / 2);
        pointerAngle = Math.atan2(2 / rect.height, -2 / rect.width) + nx * 0.3 + ny * 0.15;
      } else {
        pointerAngle = Math.atan2(cy - e.clientY, e.clientX - cx);
      }
      const t = Math.max(0, 1 - dist / Math.max(cfg.proximity, 1));
      proximityT = t * t * (3 - 2 * t);
    }, { passive: true });

    let angle = 2.4, idleAngle = 2.4, bright = 0, last = performance.now();
    const loop = (now) => {
      requestAnimationFrame(loop);
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;
      idleAngle += cfg.speed * dt;
      const steer = pointerAngle != null && (!cfg.autoAnimate || proximityT > 0);
      const target = steer ? pointerAngle : idleAngle;
      const diff = ((target - angle + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
      angle += diff * (1 - Math.exp(-dt * 7));
      const brightTarget = cfg.autoAnimate ? 1 : proximityT;
      bright += (brightTarget - bright) * (1 - Math.exp(-dt * 8));
      gl.uniform1f(uAngle, angle);
      gl.uniform1f(uIntensity, cfg.intensity * bright);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    };
    requestAnimationFrame(loop);
  }

  document.querySelectorAll(".specular-btn").forEach(initButton);
})();
