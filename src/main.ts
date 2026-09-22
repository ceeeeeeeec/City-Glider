import * as THREE from 'three';

document.body.style.margin = '0';
document.body.style.overflow = 'hidden';
document.body.style.background = '#8fc5e8';

const WORLD_SIZE = 240;
const CITY_EXTENT = 105;
const BOUNDARY = WORLD_SIZE / 2 - 8;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x8fc5e8);

const camera = new THREE.PerspectiveCamera(60, innerWidth / innerHeight, 0.1, 700);
camera.position.set(0, 8, 16);

const renderer = new THREE.WebGLRenderer({ antialias: false });
renderer.setSize(innerWidth, innerHeight);
renderer.setPixelRatio(1);
Object.assign(renderer.domElement.style, {
  position: 'fixed', left: '0', top: '0', width: '100vw',
  height: '100vh', display: 'block', zIndex: '0'
});
document.body.appendChild(renderer.domElement);

// Large test world.
const ground = new THREE.Mesh(
  new THREE.BoxGeometry(WORLD_SIZE, 1, WORLD_SIZE),
  new THREE.MeshBasicMaterial({ color: 0x4f9d55 })
);
ground.position.y = -1;
scene.add(ground);

// Larger low-cost city blockout.
const buildingMaterial = new THREE.MeshBasicMaterial({ color: 0xd8d8d8 });
const darkBuildingMaterial = new THREE.MeshBasicMaterial({ color: 0x9b9b9b });

for (let x = -CITY_EXTENT; x <= CITY_EXTENT; x += 12) {
  for (let z = -CITY_EXTENT; z <= CITY_EXTENT; z += 12) {
    if (Math.abs(x % 24) < 4 || Math.abs(z % 24) < 4) continue;
    if (Math.abs(x) < 15 && Math.abs(z) < 15) continue;

    const seed = Math.abs(x * 17 + z * 31);
    const height = 3 + (seed % 14);

    const building = new THREE.Mesh(
      new THREE.BoxGeometry(7, height, 7),
      seed % 5 === 0 ? darkBuildingMaterial : buildingMaterial
    );
    building.position.set(x, height / 2 - 0.5, z);
    scene.add(building);
  }
}

// Glider.
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

glider.position.set(0, 7, 20);
scene.add(glider);

// HUD.
const hud = document.createElement('div');
Object.assign(hud.style, {
  position: 'fixed', left: '16px', top: '16px', zIndex: '10',
  color: '#fff', font: 'bold 18px system-ui',
  textShadow: '0 2px 5px #000', pointerEvents: 'none'
});
hud.innerHTML = 'CITY GLIDER<br><span style="font-size:13px;font-weight:normal">ARROWS: STEER / CLIMB / DIVE</span>';
document.body.appendChild(hud);

// Keyboard.
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

// Flight model: the glider now has a heading, so it can turn through 360 degrees.
let speed = 0.22;
let verticalSpeed = -0.015;
let heading = 0; // radians; zero means forward along -Z
let turnRate = 0;

const minSpeed = 0.08;
const maxSpeed = 0.42;
const gravity = 0.004;
const liftStrength = 0.020;
const turnAcceleration = 0.012;
const turnDrag = 0.90;
const maxTurnRate = 0.055;
const climbAcceleration = 0.006;
const diveAcceleration = 0.005;
const speedDrag = 0.997;

let previousTime = performance.now();

function animate(now = performance.now()) {
  requestAnimationFrame(animate);

  const dt = Math.min((now - previousTime) / 16.667, 2);
  previousTime = now;

  // Left/right changes heading. Holding a direction continues the turn,
  // rather than pushing the glider sideways against a fixed world axis.
  if (keys.ArrowLeft) turnRate += turnAcceleration * dt;
  if (keys.ArrowRight) turnRate -= turnAcceleration * dt;
  turnRate *= Math.pow(turnDrag, dt);
  turnRate = THREE.MathUtils.clamp(turnRate, -maxTurnRate, maxTurnRate);
  heading += turnRate * dt;

  // Up/down controls climb and dive momentum.
  if (keys.ArrowUp) verticalSpeed += climbAcceleration * dt;
  if (keys.ArrowDown) verticalSpeed -= diveAcceleration * dt;

  // Gravity and lift.
  verticalSpeed -= gravity * dt;
  verticalSpeed += Math.max(0, speed - minSpeed) * liftStrength * dt;
  verticalSpeed *= Math.pow(0.985, dt);

  // Diving builds speed; climbing costs some speed.
  if (keys.ArrowDown) speed += 0.006 * dt;
  if (keys.ArrowUp) speed -= 0.003 * dt;
  speed *= Math.pow(speedDrag, dt);
  speed = THREE.MathUtils.clamp(speed, minSpeed, maxSpeed);

  // Move in the direction the glider is actually facing.
  const forward = new THREE.Vector3(
    Math.sin(heading),
    verticalSpeed / Math.max(speed, 0.01),
    -Math.cos(heading)
  ).normalize();

  glider.position.x += forward.x * speed * dt;
  glider.position.y += verticalSpeed * dt;
  glider.position.z += forward.z * speed * dt;

  // Soft altitude limits.
  if (glider.position.y < 0.5) {
    glider.position.y = 0.5;
    verticalSpeed = Math.max(0.025, verticalSpeed * -0.15);
  }
  if (glider.position.y > 20) {
    glider.position.y = 20;
    verticalSpeed = Math.min(-0.01, verticalSpeed * 0.2);
  }

  // Large-world boundaries, far outside normal flight.
  if (glider.position.x < -BOUNDARY) {
    glider.position.x = -BOUNDARY;
    heading = Math.PI - heading;
    turnRate *= 0.25;
  }
  if (glider.position.x > BOUNDARY) {
    glider.position.x = BOUNDARY;
    heading = Math.PI - heading;
    turnRate *= 0.25;
  }
  if (glider.position.z < -BOUNDARY) {
    glider.position.z = -BOUNDARY;
    heading = -heading;
    turnRate *= 0.25;
  }
  if (glider.position.z > BOUNDARY) {
    glider.position.z = BOUNDARY;
    heading = -heading;
    turnRate *= 0.25;
  }

  // Point the glider along its flight direction and bank into the turn.
  glider.rotation.y = heading;
  const targetRoll = THREE.MathUtils.clamp(-turnRate * 9, -0.75, 0.75);
  const targetPitch = THREE.MathUtils.clamp(verticalSpeed * 1.8, -0.45, 0.45);
  glider.rotation.z += (targetRoll - glider.rotation.z) * 0.10 * dt;
  glider.rotation.x += (targetPitch - glider.rotation.x) * 0.10 * dt;

  // Smooth chase camera.
  const desiredCamera = new THREE.Vector3(
    glider.position.x - Math.sin(heading) * 13,
    glider.position.y + 4.5,
    glider.position.z + Math.cos(heading) * 13
  );
  camera.position.lerp(desiredCamera, 0.08 * dt);

  const lookTarget = new THREE.Vector3(
    glider.position.x + Math.sin(heading) * 10,
    glider.position.y + verticalSpeed * 8,
    glider.position.z - Math.cos(heading) * 10
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
