import * as THREE from 'three';

document.body.style.margin = '0';
document.body.style.overflow = 'hidden';
document.body.style.background = '#8fc5e8';

const WORLD_SIZE = 2400;
const CITY_EXTENT = 180;
const BOUNDARY = WORLD_SIZE / 2 - 10;
const COIN_COUNT = 28;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x8fc5e8);
scene.fog = new THREE.Fog(0x8fc5e8, 120, 950);

const camera = new THREE.PerspectiveCamera(62, innerWidth / innerHeight, 0.1, 700);
camera.position.set(0, 10, 18);

const renderer = new THREE.WebGLRenderer({ antialias: false });
renderer.setSize(innerWidth, innerHeight);
renderer.setPixelRatio(1);
Object.assign(renderer.domElement.style, {
  position: 'fixed', left: '0', top: '0', width: '100vw',
  height: '100vh', display: 'block', zIndex: '0'
});
document.body.appendChild(renderer.domElement);

// ---------- WORLD ----------
const ground = new THREE.Mesh(
  new THREE.BoxGeometry(WORLD_SIZE, 1, WORLD_SIZE),
  new THREE.MeshBasicMaterial({ color: 0x4f9d55 })
);
ground.position.y = -1;
scene.add(ground);

const buildingMaterial = new THREE.MeshBasicMaterial({ color: 0xd8d8d8 });
const darkBuildingMaterial = new THREE.MeshBasicMaterial({ color: 0x9b9b9b });

const buildings: THREE.Mesh[] = [];

for (let x = -CITY_EXTENT; x <= CITY_EXTENT; x += 14) {
  for (let z = -CITY_EXTENT; z <= CITY_EXTENT; z += 14) {
    if (Math.abs(x % 28) < 5 || Math.abs(z % 28) < 5) continue;
    if (Math.abs(x) < 22 && Math.abs(z) < 22) continue;

    const seed = Math.abs(x * 17 + z * 31);
    const height = 5 + (seed % 24);
    const width = 7 + (seed % 4);

    const building = new THREE.Mesh(
      new THREE.BoxGeometry(width, height, width),
      seed % 6 === 0 ? darkBuildingMaterial : buildingMaterial
    );
    building.position.set(x, height / 2 - 0.5, z);
    building.userData.width = width;
    building.userData.height = height;
    scene.add(building);
    buildings.push(building);
  }
}

// Simple landmark towers to establish recognizable navigation targets.
function addLandmark(x: number, z: number, height: number, width: number) {
  const landmark = new THREE.Mesh(
    new THREE.BoxGeometry(width, height, width),
    new THREE.MeshBasicMaterial({ color: 0x777777 })
  );
  landmark.position.set(x, height / 2 - 0.5, z);
  scene.add(landmark);
}

addLandmark(0, -90, 52, 11);
addLandmark(95, 55, 42, 13);
addLandmark(-105, 65, 34, 15);

// ---------- GLIDER ----------
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

glider.position.set(0, 18, 155);
scene.add(glider);

// ---------- COIN ROUTE ----------
const coinGeometry = new THREE.TorusGeometry(0.72, 0.16, 8, 16);
const coinMaterial = new THREE.MeshBasicMaterial({ color: 0xffd21f });
const coins: THREE.Mesh[] = [];

for (let i = 0; i < COIN_COUNT; i++) {
  const t = i / (COIN_COUNT - 1);
  const angle = t * Math.PI * 2.25;
  const radius = 34 + t * 70;

  const coin = new THREE.Mesh(coinGeometry, coinMaterial);
  coin.position.set(
    Math.sin(angle) * radius,
    8 + Math.sin(t * Math.PI * 4) * 4,
    110 - t * 205 + Math.cos(angle) * 18
  );
  coin.userData.collected = false;
  scene.add(coin);
  coins.push(coin);
}

// ---------- HUD ----------
const hud = document.createElement('div');
Object.assign(hud.style, {
  position: 'fixed', left: '16px', top: '16px', zIndex: '10',
  color: '#fff', font: 'bold 18px system-ui',
  textShadow: '0 2px 5px #000', pointerEvents: 'none',
  lineHeight: '1.35'
});
document.body.appendChild(hud);

let score = 0;
let distance = 0;
let crashed = false;
let crashTimer = 0;

function updateHud() {
  hud.innerHTML =
    '<b>CITY GLIDER</b><br>' +
    '<span style="font-size:14px;font-weight:normal">' +
    '← → STEER &nbsp; ↑ CLIMB &nbsp; ↓ DIVE' +
    '</span><br>' +
    '<span style="font-size:14px">COINS: ' + score + ' / ' + COIN_COUNT +
    ' &nbsp; DISTANCE: ' + Math.floor(distance) + 'm</span>' +
    (crashed
      ? '<br><span style="font-size:16px">CRASHED — press SPACE to restart</span>'
      : '');
}
updateHud();

// ---------- INPUT ----------
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

  if (event.code === 'Space' && crashed) {
    resetRun();
    event.preventDefault();
  }
});

addEventListener('keyup', (event) => {
  if (event.key in keys) {
    keys[event.key as keyof typeof keys] = false;
    event.preventDefault();
  }
});

// ---------- FLIGHT ----------
let speed = 0.42;
let verticalSpeed = 0;
let heading = 0;
let pitch = 0;

const minSpeed = 0.28;
const maxSpeed = 0.78;

// Arcade wingsuit/glider model inspired by the feel of Just Cause 3:
// strong forward momentum, easy diving, gentle climbing, responsive yaw,
// and enough pitch authority to carry through the zenith into a loop.
const gravity = 0.0017;
const liftStrength = 0.0065;
const turnRate = 0.028;
const yawResponse = 0.14;
const climbPitchRate = 0.006;
const divePitchRate = 0.014;
const pitchReturn = 0.985;
const startPosition = new THREE.Vector3(0, 1000, 155);

let yawVelocity = 0;

function resetRun() {
  glider.position.copy(startPosition);
  glider.rotation.set(0, 0, 0);
  speed = 0.42;
  verticalSpeed = 0;
  heading = 0;
  pitch = 0;
  yawVelocity = 0;
  cameraHeading = 0;
  desiredCamera.copy(startPosition);
  smoothedLookTarget.copy(startPosition);
  score = 0;
  distance = 0;
  crashed = false;
  crashTimer = 0;

  coins.forEach((coin, index) => {
    const t = index / (COIN_COUNT - 1);
    const angle = t * Math.PI * 2.25;
    const radius = 34 + t * 70;
    coin.position.set(
      Math.sin(angle) * radius,
      8 + Math.sin(t * Math.PI * 4) * 4,
      110 - t * 205 + Math.cos(angle) * 18
    );
    coin.visible = true;
    coin.userData.collected = false;
  });

  updateHud();
}

function crash() {
  if (crashed) return;
  crashed = true;
  crashTimer = 0;
  speed = 0;
  verticalSpeed = 0;
  updateHud();
}

const tempForward = new THREE.Vector3();
const desiredCamera = new THREE.Vector3();
const lookTarget = new THREE.Vector3();
const smoothedLookTarget = new THREE.Vector3();
let cameraHeading = 0;

let previousTime = performance.now();

function animate(now = performance.now()) {
  requestAnimationFrame(animate);

  const dt = Math.min((now - previousTime) / 16.667, 2);
  previousTime = now;

  if (crashed) {
    crashTimer += dt;
    glider.rotation.z += 0.025 * dt;
    // Freeze the glider at the collision point; don't let the crash animation
    // move it into the sky/void and away from the object that caused the crash.
    updateHud();
    renderer.render(scene, camera);
    return;
  }

  // LEFT/RIGHT: direct, responsive yaw. Turning is deliberately independent
  // of the forward speed so the glider remains manoeuvrable at speed.
  if (keys.ArrowLeft) yawVelocity -= turnRate * dt;
  if (keys.ArrowRight) yawVelocity += turnRate * dt;
  yawVelocity *= Math.pow(0.82, dt);
  yawVelocity = THREE.MathUtils.clamp(yawVelocity, -0.055, 0.055);
  heading += yawVelocity * dt;

  // UP/DOWN: pitch control. Diving is substantially stronger than climbing.
  // Pitch is allowed to pass +/-90 degrees, so a pull-up can continue into
  // a loop/flip at the zenith instead of hitting an artificial ceiling.
  if (keys.ArrowUp) pitch += climbPitchRate * dt;
  if (keys.ArrowDown) pitch -= divePitchRate * dt;

  // Natural pitch damping, but retain momentum through a loop.
  pitch *= Math.pow(pitchReturn, dt);

  // Keep some gravity, but let the glider's orientation determine most of
  // the vertical movement.
  verticalSpeed -= gravity * dt;
  verticalSpeed += Math.sin(pitch) * liftStrength * speed * dt;
  verticalSpeed *= Math.pow(0.992, dt);

  // Diving adds energy; climbing costs a little. This makes downward flight
  // easy to initiate while preserving substantial forward momentum.
  if (keys.ArrowDown) speed += 0.004 * dt;
  if (keys.ArrowUp) speed -= 0.0012 * dt;
  speed *= Math.pow(0.9985, dt);
  speed = THREE.MathUtils.clamp(speed, minSpeed, maxSpeed);

  // True 3D flight vector.
  tempForward.set(
    Math.sin(heading) * Math.cos(pitch),
    Math.sin(pitch),
    -Math.cos(heading) * Math.cos(pitch)
  ).normalize();

  const oldX = glider.position.x;
  const oldZ = glider.position.z;

  glider.position.x += tempForward.x * speed * dt;
  glider.position.y += tempForward.y * speed * dt + verticalSpeed * dt;
  glider.position.z += tempForward.z * speed * dt;

  distance += Math.hypot(glider.position.x - oldX, glider.position.z - oldZ);

  if (glider.position.y <= 0.35) {
    glider.position.y = 0.35;
    crash();
  }

  if (glider.position.x < -BOUNDARY || glider.position.x > BOUNDARY ||
      glider.position.z < -BOUNDARY || glider.position.z > BOUNDARY) {
    crash();
  }

  // Lightweight building collision.
  if (!crashed) {
    const gliderPoint = glider.position;
    for (const building of buildings) {
      const dx = Math.abs(gliderPoint.x - building.position.x);
      const dz = Math.abs(gliderPoint.z - building.position.z);
      const halfX = (building.userData.width as number) * 0.5 + 1.0;
      const halfZ = (building.userData.width as number) * 0.5 + 1.0;
      const top = building.position.y + (building.userData.height as number) * 0.5;

      if (dx < halfX && dz < halfZ && gliderPoint.y < top + 0.8) {
        crash();
        break;
      }
    }
  }

  for (const coin of coins) {
    if (!coin.visible) continue;
    coin.rotation.y += 0.05 * dt;
    coin.rotation.x += 0.025 * dt;

    if (glider.position.distanceTo(coin.position) < 2.1) {
      coin.visible = false;
      coin.userData.collected = true;
      score++;
    }
  }

  // Visual orientation follows the actual 3D flight vector.
  glider.rotation.y = heading;
  glider.rotation.x = -pitch;
  const targetRoll = THREE.MathUtils.clamp(-yawVelocity * 7.5, -0.38, 0.38);
  glider.rotation.z += (targetRoll - glider.rotation.z) * yawResponse * dt;

  // CAMERA: third-person chase, but intentionally NOT rigidly attached to the glider.
  // The camera's horizontal follow heading lags behind the glider, so yaw turns
  // sweep naturally instead of snapping the whole view around with the player.
  let headingDelta = heading - cameraHeading;
  headingDelta = Math.atan2(Math.sin(headingDelta), Math.cos(headingDelta));
  cameraHeading += headingDelta * (1 - Math.pow(0.88, dt));

  desiredCamera.set(
    glider.position.x - Math.sin(cameraHeading) * 15,
    glider.position.y + 6.5,
    glider.position.z + Math.cos(cameraHeading) * 15
  );
  camera.position.lerp(desiredCamera, 0.055 * dt);

  // Also smooth the point the camera looks toward. This prevents a hard pan when
  // the glider changes direction, while still keeping the aircraft centred.
  lookTarget.set(
    glider.position.x + tempForward.x * 12,
    glider.position.y + tempForward.y * 12,
    glider.position.z + tempForward.z * 12
  );
  smoothedLookTarget.lerp(lookTarget, 0.075 * dt);
  camera.lookAt(smoothedLookTarget);

  updateHud();
  renderer.render(scene, camera);
}

animate();

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});
