import * as THREE from 'three';

document.body.style.margin = '0';
document.body.style.overflow = 'hidden';
document.body.style.background = '#8fc5e8';

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x8fc5e8);

const camera = new THREE.PerspectiveCamera(60, innerWidth / innerHeight, 0.1, 500);
camera.position.set(0, 8, 16);
camera.lookAt(0, 2, 0);

const renderer = new THREE.WebGLRenderer({ antialias: false });
renderer.setSize(innerWidth, innerHeight);
renderer.setPixelRatio(1);
Object.assign(renderer.domElement.style, {
  position: 'fixed',
  left: '0',
  top: '0',
  width: '100vw',
  height: '100vh',
  display: 'block',
  zIndex: '0'
});
document.body.appendChild(renderer.domElement);

// Ground
const ground = new THREE.Mesh(
  new THREE.BoxGeometry(80, 1, 80),
  new THREE.MeshBasicMaterial({ color: 0x4f9d55 })
);
ground.position.y = -1;
scene.add(ground);

// Simple city blockout
const buildingMaterial = new THREE.MeshBasicMaterial({ color: 0xd8d8d8 });
const darkBuildingMaterial = new THREE.MeshBasicMaterial({ color: 0x9b9b9b });

for (let x = -30; x <= 30; x += 10) {
  for (let z = -30; z <= 30; z += 10) {
    if (Math.abs(x) < 11 && Math.abs(z) < 11) continue;

    const height = 3 + (Math.abs(x * 7 + z * 13) % 9);
    const building = new THREE.Mesh(
      new THREE.BoxGeometry(6, height, 6),
      (x + z) % 20 === 0 ? darkBuildingMaterial : buildingMaterial
    );
    building.position.set(x, height / 2 - 0.5, z);
    scene.add(building);
  }
}

// Glider
const glider = new THREE.Group();

const body = new THREE.Mesh(
  new THREE.ConeGeometry(0.55, 2.4, 4),
  new THREE.MeshBasicMaterial({ color: 0xffc400 })
);
body.rotation.z = Math.PI / 2;
glider.add(body);

const wing = new THREE.Mesh(
  new THREE.BoxGeometry(3.2, 0.12, 0.65),
  new THREE.MeshBasicMaterial({ color: 0xff6b35 })
);
glider.add(wing);

glider.position.set(0, 7, 4);
scene.add(glider);

// HUD
const hud = document.createElement('div');
Object.assign(hud.style, {
  position: 'fixed',
  left: '16px',
  top: '16px',
  zIndex: '10',
  color: '#fff',
  font: 'bold 18px system-ui',
  textShadow: '0 2px 5px #000',
  pointerEvents: 'none'
});
hud.innerHTML = 'CITY GLIDER<br><span style="font-size:13px;font-weight:normal">ARROWS: STEER / CLIMB / DIVE</span>';
document.body.appendChild(hud);

// Keyboard state
const keys = {
  ArrowLeft: false,
  ArrowRight: false,
  ArrowUp: false,
  ArrowDown: false
};

addEventListener('keydown', (event) => {
  if (event.key in keys) {
    keys[event.key as keyof typeof keys] = true;
    event.preventDefault();
  }
});

addEventListener('keyup', (event) => {
  if (event.key in keys) {
    keys[event.key as keyof typeof keys] = false;
    event.preventDefault();
  }
});

// Flight tuning
const forwardSpeed = 0.035;
const horizontalSpeed = 0.075;
const verticalSpeed = 0.055;

function animate() {
  requestAnimationFrame(animate);

  // Automatic forward momentum.
  glider.position.z -= forwardSpeed;

  // Player steering.
  if (keys.ArrowLeft) glider.position.x -= horizontalSpeed;
  if (keys.ArrowRight) glider.position.x += horizontalSpeed;
  if (keys.ArrowUp) glider.position.y += verticalSpeed;
  if (keys.ArrowDown) glider.position.y -= verticalSpeed;

  // Keep the glider within a safe playable height for this prototype.
  glider.position.y = Math.max(0.5, Math.min(18, glider.position.y));

  // Bank the glider visually while steering.
  const targetRoll = keys.ArrowLeft ? 0.35 : keys.ArrowRight ? -0.35 : 0;
  glider.rotation.z += (targetRoll - glider.rotation.z) * 0.12;

  camera.position.x = glider.position.x;
  camera.position.y = glider.position.y + 4;
  camera.position.z = glider.position.z + 12;
  camera.lookAt(glider.position.x, glider.position.y, glider.position.z - 8);

  renderer.render(scene, camera);
}

animate();

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});
