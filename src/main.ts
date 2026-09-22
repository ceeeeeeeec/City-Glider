import * as THREE from 'three';

document.body.style.margin = '0';
document.body.style.overflow = 'hidden';
document.body.style.background = '#8fc5e8';

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x8fc5e8);

const camera = new THREE.PerspectiveCamera(60, innerWidth / innerHeight, 0.1, 1000);
camera.position.set(0, 4, 10);
camera.lookAt(0, 1, 0);

const renderer = new THREE.WebGLRenderer({ antialias: false });
renderer.setSize(innerWidth, innerHeight);
renderer.setPixelRatio(1);
renderer.domElement.style.position = 'fixed';
renderer.domElement.style.left = '0';
renderer.domElement.style.top = '0';
renderer.domElement.style.width = '100vw';
renderer.domElement.style.height = '100vh';
renderer.domElement.style.display = 'block';
renderer.domElement.style.zIndex = '0';
document.body.appendChild(renderer.domElement);

const ground = new THREE.Mesh(
  new THREE.BoxGeometry(20, 1, 20),
  new THREE.MeshBasicMaterial({ color: 0x00ff00 })
);
ground.position.y = -2;
scene.add(ground);

const building = new THREE.Mesh(
  new THREE.BoxGeometry(3, 6, 3),
  new THREE.MeshBasicMaterial({ color: 0xff0000 })
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
label.textContent = 'STEP 1 — THREE.JS WITHOUT PROJECT CSS';
Object.assign(label.style, {
  position: 'fixed',
  top: '20px',
  left: '50%',
  transform: 'translateX(-50%)',
  zIndex: '20',
  background: '#111',
  color: '#fff',
  padding: '14px 20px',
  borderRadius: '12px',
  font: '16px system-ui',
  whiteSpace: 'nowrap'
});
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
