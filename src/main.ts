import * as THREE from 'three';
import './style.css';

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x8fc5e8);

const camera = new THREE.PerspectiveCamera(60, innerWidth / innerHeight, 0.1, 1000);
camera.position.set(0, 0, 8);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(innerWidth, innerHeight);
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setClearColor(0x8fc5e8);
document.body.appendChild(renderer.domElement);

const cube = new THREE.Mesh(
  new THREE.BoxGeometry(3, 3, 3),
  new THREE.MeshBasicMaterial({ color: 0xff0000 })
);
scene.add(cube);

const ground = new THREE.Mesh(
  new THREE.PlaneGeometry(20, 20),
  new THREE.MeshBasicMaterial({ color: 0x00aa00 })
);
ground.rotation.x = -Math.PI / 2;
ground.position.y = -2;
scene.add(ground);

const hud = document.createElement('div');
hud.id = 'hud';
hud.innerHTML = '<strong>CITY GLIDER — RENDER TEST</strong><span>Three.js diagnostic: red cube + green ground</span>';
document.body.appendChild(hud);

const status = document.createElement('div');
status.id = 'message';
status.innerHTML = '<strong>3D RENDER TEST</strong><small>If you can see a red cube, WebGL/Three.js is working.</small>';
document.body.appendChild(status);

window.addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

function animate() {
  requestAnimationFrame(animate);
  cube.rotation.x += 0.01;
  cube.rotation.y += 0.015;
  renderer.render(scene, camera);
}
animate();
