import * as THREE from 'three';

document.body.style.margin = '0';
document.body.style.overflow = 'hidden';
document.body.style.background = '#8fc5e8';

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x8fc5e8);

const camera = new THREE.PerspectiveCamera(60, innerWidth / innerHeight, 0.1, 500);
camera.position.set(0, 8, 16);

const renderer = new THREE.WebGLRenderer({ antialias: false });
renderer.setSize(innerWidth, innerHeight);
renderer.setPixelRatio(1);
Object.assign(renderer.domElement.style, {
  position: 'fixed', left: '0', top: '0', width: '100vw',
  height: '100vh', display: 'block', zIndex: '0'
});
document.body.appendChild(renderer.domElement);

// Ground
const ground = new THREE.Mesh(
  new THREE.BoxGeometry(80, 1, 80),
  new THREE.MeshBasicMaterial({ color: 0x4f9d55 })
);
ground.position.y = -1;
scene.add(ground);

// City blockout
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
  position: 'fixed', left: '16px', top: '16px', zIndex: '10',
  color: '#fff', font: 'bold 18px system-ui',
  textShadow: '0 2px 5px #000', pointerEvents: 'none'
});
hud.innerHTML = 'CITY GLIDER<br><span style="font-size:13px;font-weight:normal">ARROWS: STEER / CLIMB / DIVE</span>';
document.body.appendChild(hud);

// Keyboard
const keys = {
  ArrowLeft: false, ArrowRight: false, ArrowUp: false, ArrowDown: false
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

// Simple flight physics.
// Position is velocity-driven rather than directly moved by the keys.
const velocity = new THREE.Vector3(0, -0.015, -0.22);

const maxSpeed = 0.42;
const minSpeed = 0.08;
const gravity = -0.004;
const liftStrength = 0.006;
const steeringAcceleration = 0.009;
const climbAcceleration = 0.006;
const diveAcceleration = 0.005;
const drag = 0.985;

let previousTime = performance.now();

function animate(now = performance.now()) {
  requestAnimationFrame(animate);

  const dt = Math.min((now - previousTime) / 16.667, 2);
  previousTime = now;

  // Steering changes velocity, creating momentum.
  if (keys.ArrowLeft) velocity.x -= steeringAcceleration * dt;
  if (keys.ArrowRight) velocity.x += steeringAcceleration * dt;

  // Vertical input changes vertical velocity rather than position.
  if (keys.ArrowUp) velocity.y += climbAcceleration * dt;
  if (keys.ArrowDown) velocity.y -= diveAcceleration * dt;

  // Gravity.
  velocity.y += gravity * dt;

  // Forward speed is affected by diving/climbing.
  if (keys.ArrowDown) velocity.z -= 0.006 * dt;
  if (keys.ArrowUp) velocity.z += 0.003 * dt;

  // Lift increases with forward speed.
  const speed = Math.max(0, -velocity.z);
  velocity.y += Math.max(0, speed - minSpeed) * liftStrength * dt;

  // Mild drag.
  velocity.x *= Math.pow(drag, dt);
  velocity.y *= Math.pow(drag, dt);

  // Keep forward speed within a useful range.
  velocity.z = Math.max(-maxSpeed, Math.min(-minSpeed, velocity.z));

  // Apply velocity.
  glider.position.x += velocity.x * dt;
  glider.position.y += velocity.y * dt;
  glider.position.z += velocity.z * dt;

  // Soft altitude limits for this prototype.
  if (glider.position.y < 0.5) {
    glider.position.y = 0.5;
    velocity.y = Math.max(0.025, velocity.y * -0.15);
  }
  if (glider.position.y > 20) {
    glider.position.y = 20;
    velocity.y = Math.min(-0.01, velocity.y * 0.2);
  }

  // Gentle horizontal bounds.
  if (glider.position.x < -35) {
    glider.position.x = -35;
    velocity.x = Math.abs(velocity.x) * 0.25;
  }
  if (glider.position.x > 35) {
    glider.position.x = 35;
    velocity.x = -Math.abs(velocity.x) * 0.25;
  }

  // Visual attitude: bank into horizontal movement and pitch with vertical velocity.
  const targetRoll = THREE.MathUtils.clamp(-velocity.x * 2.4, -0.65, 0.65);
  const targetPitch = THREE.MathUtils.clamp(velocity.y * 1.8, -0.45, 0.45);
  glider.rotation.z += (targetRoll - glider.rotation.z) * 0.10 * dt;
  glider.rotation.x += (targetPitch - glider.rotation.x) * 0.10 * dt;

  // Smooth camera follow.
  const desiredCamera = new THREE.Vector3(
    glider.position.x,
    glider.position.y + 4.5,
    glider.position.z + 13
  );
  camera.position.lerp(desiredCamera, 0.08 * dt);

  const lookTarget = new THREE.Vector3(
    glider.position.x + velocity.x * 8,
    glider.position.y + velocity.y * 8,
    glider.position.z - 10
  );
  camera.lookAt(lookTarget);

  renderer.render(scene, camera);
}

animate();

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});
