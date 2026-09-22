import * as THREE from 'three';
import './style.css';

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x8fc5e8);

const camera = new THREE.PerspectiveCamera(60, innerWidth / innerHeight, 0.1, 1000);
camera.position.set(0, 4, 10);
camera.lookAt(0, 1, 0);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(innerWidth, innerHeight);
renderer.setPixelRatio(1);
document.body.appendChild(renderer.domElement);

const ground = new THREE.Mesh(
  new THREE.BoxGeometry(20, 1, 20),
  new THREE.MeshBasicMaterial({ color: 0x00aa00 })
);
ground.position.y = -2;
scene.add(ground);

const building = new THREE.Mesh(
  new THREE.BoxGeometry(3, 6, 3),
  new THREE.MeshBasicMaterial({ color: 0xff3333 })
);
building.position.set(0, 1, 0);
scene.add(building);

const glider = new THREE.Mesh(
  new THREE.ConeGeometry(1, 3, 3),
  new THREE.MeshBasicMaterial({ color: 0xffff00 })
);
glider.rotation.z = Math.PI / 2;
glider.position.set(-4, 3, 0);
scene.add(glider);

const label = document.createElement('div');
label.style.cssText = 'position:fixed;top:20px;left:50%;transform:translateX(-50%);z-index:20;background:#111;color:#fff;padding:14px 20px;border-radius:12px;font:16px system-ui';
label.textContent = 'THREE.JS + CITY SCENE TEST';
document.body.appendChild(label);

function animate() {
  requestAnimationFrame(animate);
  glider.rotation.x += 0.01;
  renderer.render(scene, camera);
}
animate();

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});
