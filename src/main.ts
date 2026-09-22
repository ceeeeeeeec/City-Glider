import './style.css';

const canvas = document.createElement('canvas');
canvas.style.position = 'fixed';
canvas.style.inset = '0';
canvas.style.width = '100%';
canvas.style.height = '100%';
document.body.appendChild(canvas);

const ctx = canvas.getContext('2d');
if (!ctx) throw new Error('2D canvas unavailable');

function resize() {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.floor(innerWidth * dpr);
  canvas.height = Math.floor(innerHeight * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}
resize();
addEventListener('resize', resize);

function draw() {
  ctx.fillStyle = '#8fc5e8';
  ctx.fillRect(0, 0, innerWidth, innerHeight);
  ctx.fillStyle = '#00aa00';
  ctx.fillRect(innerWidth * 0.1, innerHeight * 0.65, innerWidth * 0.8, innerHeight * 0.25);
  ctx.fillStyle = '#ff0000';
  ctx.fillRect(innerWidth * 0.4, innerHeight * 0.25, innerWidth * 0.2, innerHeight * 0.25);
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 24px system-ui';
  ctx.textAlign = 'center';
  ctx.fillText('CITY GLIDER — 2D CANVAS TEST', innerWidth / 2, 60);
  requestAnimationFrame(draw);
}
draw();