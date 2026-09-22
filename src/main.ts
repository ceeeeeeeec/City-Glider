const canvas = document.createElement('canvas');
canvas.style.position = 'fixed';
canvas.style.inset = '0';
canvas.style.width = '100%';
canvas.style.height = '100%';
document.body.appendChild(canvas);

const status = document.createElement('div');
status.style.cssText = 'position:fixed;top:20px;left:50%;transform:translateX(-50%);z-index:10;background:#111;color:#fff;padding:16px 22px;border-radius:12px;font:16px system-ui;text-align:center';
document.body.appendChild(status);

const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');

if (!gl) {
  status.innerHTML = '<strong>WEBGL: NOT AVAILABLE</strong><br><small>The browser could not create a WebGL context.</small>';
  document.body.style.background = '#b00020';
} else {
  status.innerHTML = '<strong>WEBGL: AVAILABLE</strong><br><small>Raw WebGL context created successfully.</small>';
  gl.clearColor(0.05, 0.15, 0.35, 1);
  gl.clear(gl.COLOR_BUFFER_BIT);

  const vertexShader = gl.createShader(gl.VERTEX_SHADER);
  const fragmentShader = gl.createShader(gl.FRAGMENT_SHADER);

  if (!vertexShader || !fragmentShader) {
    status.innerHTML = '<strong>WEBGL: SHADER CREATION FAILED</strong>';
  } else {
    gl.shaderSource(vertexShader, 'attribute vec2 position; void main(){ gl_Position=vec4(position,0.0,1.0); }');
    gl.compileShader(vertexShader);

    gl.shaderSource(fragmentShader, 'void main(){ gl_FragColor=vec4(1.0,0.0,0.0,1.0); }');
    gl.compileShader(fragmentShader);

    const program = gl.createProgram();
    if (!program) {
      status.innerHTML = '<strong>WEBGL: PROGRAM CREATION FAILED</strong>';
    } else {
      gl.attachShader(program, vertexShader);
      gl.attachShader(program, fragmentShader);
      gl.linkProgram(program);

      if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        status.innerHTML = '<strong>WEBGL: PROGRAM LINK FAILED</strong><br><small>' + gl.getProgramInfoLog(program) + '</small>';
      } else {
        gl.useProgram(program);
        const buffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-0.6,-0.5, 0.6,-0.5, 0.0,0.6]), gl.STATIC_DRAW);
        const location = gl.getAttribLocation(program, 'position');
        gl.enableVertexAttribArray(location);
        gl.vertexAttribPointer(location, 2, gl.FLOAT, false, 0, 0);
        gl.drawArrays(gl.TRIANGLES, 0, 3);
      }
    }
  }
}
