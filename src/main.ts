import * as THREE from 'three';

document.body.style.margin = '0';
document.body.style.overflow = 'hidden';
document.body.style.background = '#8fc5e8';

const WORLD_SIZE = 10000;
const CITY_EXTENT = 180;
const BOUNDARY = WORLD_SIZE / 2 - 10;
const COIN_COUNT = 28;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x8fc5e8);
scene.fog = new THREE.Fog(0x8fc5e8, 250, 2400);

const camera = new THREE.PerspectiveCamera(64, innerWidth / innerHeight, 0.1, 3500);
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
  new THREE.MeshLambertMaterial({ color: 0x5f9f62 })
);
ground.position.y = -1;
scene.add(ground);

const hemiLight = new THREE.HemisphereLight(0xffffff, 0x496b4f, 1.35);
scene.add(hemiLight);
const sunLight = new THREE.DirectionalLight(0xffffff, 1.6);
sunLight.position.set(-300, 700, 250);
scene.add(sunLight);
const buildingMaterial = new THREE.MeshLambertMaterial({ color: 0xc8c6c0 });
const darkBuildingMaterial = new THREE.MeshLambertMaterial({ color: 0x74787b });

const buildings: THREE.Mesh[] = [];

// Landmark helper used by the lightweight Sydney renderer.
function addLandmark(x: number, z: number, height: number, width: number) {
  const landmark = new THREE.Mesh(
    new THREE.BoxGeometry(width, height, width),
    new THREE.MeshBasicMaterial({ color: 0x777777 })
  );
  landmark.position.set(x, height / 2 - 0.5, z);
  scene.add(landmark);
}

// ---------- SYDNEY CITY ----------
// Runtime Overpass loading is intentionally disabled in the playable prototype.
// A live 5 km OSM query can return a very large JSON payload and stall the
// browser before the first useful frame. The prototype therefore renders a
// lightweight Sydney proxy immediately. This will later be replaced by baked,
// chunked GIS data for the final city.
const SYDNEY_LAT = -33.8688;
const SYDNEY_LON = 151.2093;
const CITY_RADIUS_M = 5000;

function createSydneyCity() {
  // CBD-style high density around the centre, tapering outward.
  const blockSize = 34;
  const half = 2500;

  for (let x = -half; x <= half; x += blockSize) {
    for (let z = -half; z <= half; z += blockSize) {
      const distance = Math.hypot(x, z);
      if (distance > half * 1.02) continue;

      // Leave broad corridors representing major streets/parks/water.
      const roadX = Math.abs(((x + 17) % 170) - 85) < 11;
      const roadZ = Math.abs(((z + 17) % 210) - 105) < 11;
      if (roadX || roadZ) continue;

      // Sydney CBD is dense; suburbs become lower and more spread out.
      const density = Math.max(0, 1 - distance / 2800);
      const seed = Math.abs((x * 73856093) ^ (z * 19349663));
      const lotSkip = (seed % 100) / 100;
      if (lotSkip > 0.72 + density * 0.20) continue;

      const width = 18 + (seed % 12);
      const depth = 18 + ((seed >> 4) % 12);
      const baseHeight = 8 + density * 20;
      const towerChance = (seed % 1000) / 1000;
      const height = towerChance < density * 0.22
        ? 45 + (seed % 120)
        : baseHeight + (seed % 18);

      const building = new THREE.Mesh(
        new THREE.BoxGeometry(width, height, depth),
        height > 55 ? darkBuildingMaterial : buildingMaterial
      );
      building.position.set(x, height / 2 - 0.5, z);
      building.userData.width = width;
      building.userData.depth = depth;
      building.userData.height = height;
      scene.add(building);
      buildings.push(building);
    }
  }

  // Harbour/water proxy: broad blue strips north/east of the CBD.
  const waterMaterial = new THREE.MeshBasicMaterial({ color: 0x4e9fc4 });
  const harbour = new THREE.Mesh(
    new THREE.BoxGeometry(1200, 0.15, 1800),
    waterMaterial
  );
  harbour.position.set(720, -0.88, -1150);
  scene.add(harbour);

  // Major navigation landmarks, kept deliberately simple and cheap.
  addLandmark(0, -90, 52, 11);       // CBD landmark
  addLandmark(95, 55, 42, 13);       // eastern CBD
  addLandmark(-105, 65, 34, 15);      // western CBD

  cityLabel.textContent = 'SYDNEY • LIGHTWEIGHT CITY';
}

const cityLabel = document.createElement('div');
Object.assign(cityLabel.style, {
  position: 'fixed', right: '16px', top: '16px', zIndex: '10',
  color: '#fff', font: 'bold 16px system-ui',
  textShadow: '0 2px 5px #000', pointerEvents: 'none'
});
cityLabel.textContent = 'SYDNEY • LOADING CITY';
document.body.appendChild(cityLabel);

createSydneyCity();

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

glider.position.set(0, 500, 155);
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
let speed = 55;

function updateHud() {
  hud.innerHTML =
    '<b>CITY GLIDER</b><br>' +
    '<span style="font-size:14px;font-weight:normal">' +
    '← → STEER &nbsp; ↑ CLIMB &nbsp; ↓ DIVE' +
    '</span><br>' +
    '<span style="font-size:14px">COINS: ' + score + ' / ' + COIN_COUNT +
    ' &nbsp; ALTITUDE: ' + Math.max(0, Math.floor(glider.position.y)) + 'm' +
    ' &nbsp; SPEED: ' + Math.round(speed * 3.6) + ' km/h' +
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
// ---------- FLIGHT ----------
// Velocity-vector wingsuit model: dive to convert altitude into speed, then
// use that stored momentum to carve a pull-up. This targets the arcade
// wingsuit feel associated with Just Cause 3 rather than a conventional
// aircraft model. citeturn0search3turn0search9
let heading = 0;
let pitch = 0;

const velocity = new THREE.Vector3(0, -5, -55);
const desiredForward = new THREE.Vector3();
const velocityDirection = new THREE.Vector3();

const minSpeed = 8;
const maxSpeed = 95;
const gravity = 24;
const diveAcceleration = 20;
const drag = 0.0025;
const steeringRate = 1.65;
const pitchUpRate = 1.35;
const pitchDownRate = 2.15;
const velocityAlignment = 2.8;
const startPosition = new THREE.Vector3(0, 500, 155);

function resetRun() {
  glider.position.copy(startPosition);
  glider.rotation.set(0, 0, 0);
  heading = 0;
  pitch = 0;
  velocity.set(0, -5, -55);
  speed = velocity.length();
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
    coin.position.set(Math.sin(angle) * radius, 8 + Math.sin(t * Math.PI * 4) * 4, 110 - t * 205 + Math.cos(angle) * 18);
    coin.visible = true;
    coin.userData.collected = false;
  });
  updateHud();
}

function crash() {
  if (crashed) return;
  crashed = true;
  crashTimer = 0;
  velocity.set(0, 0, 0);
  speed = 0;
  updateHud();
}

function updateFlight(dt: number) {
  if (keys.ArrowLeft) heading += steeringRate * dt;
  if (keys.ArrowRight) heading -= steeringRate * dt;

  if (keys.ArrowUp) pitch += pitchUpRate * dt;
  if (keys.ArrowDown) pitch -= pitchDownRate * dt;
  pitch = THREE.MathUtils.clamp(pitch, -Math.PI * 0.99, Math.PI * 0.99);

  desiredForward.set(
    Math.sin(heading) * Math.cos(pitch),
    Math.sin(pitch),
    -Math.cos(heading) * Math.cos(pitch)
  ).normalize();

  const currentSpeed = velocity.length();
  velocityDirection.copy(velocity).normalize();

  // Redirect, don't replace, the velocity vector. At high speed the player
  // can pull through a large arc; at low speed there is not enough energy to
  // simply point upward and fly like a powered aircraft.
  const alignment = THREE.MathUtils.clamp(velocityAlignment * dt * (currentSpeed / 55), 0, 0.34);
  velocityDirection.lerp(desiredForward, alignment).normalize();
  velocity.copy(velocityDirection).multiplyScalar(currentSpeed);

  velocity.y -= gravity * dt;
  if (keys.ArrowDown) velocity.addScaledVector(desiredForward, diveAcceleration * dt);

  const lift = Math.max(0, currentSpeed - 18) * 0.34;
  velocity.y += lift * Math.max(0, desiredForward.y) * dt;

  velocity.multiplyScalar(Math.max(0.90, 1 - drag * currentSpeed * dt));

  const newSpeed = THREE.MathUtils.clamp(velocity.length(), minSpeed, maxSpeed);
  velocity.normalize().multiplyScalar(newSpeed);
  speed = newSpeed;

  const oldPosition = glider.position.clone();
  glider.position.addScaledVector(velocity, dt);
  distance += oldPosition.distanceTo(glider.position);

  glider.rotation.y = heading;
  glider.rotation.x = -pitch;
  const turnRoll = ((keys.ArrowLeft ? -1 : 0) + (keys.ArrowRight ? 1 : 0)) * 0.55 * Math.min(1, currentSpeed / 45);
  glider.rotation.z += (turnRoll - glider.rotation.z) * Math.min(1, 6 * dt);

  return currentSpeed;
}

const tempForward = new THREE.Vector3();
const desiredCamera = new THREE.Vector3();
const lookTarget = new THREE.Vector3();
const smoothedLookTarget = new THREE.Vector3();
let cameraHeading = 0;

function updateCamera(dt: number, currentSpeed: number) {
  tempForward.copy(velocity).normalize();
  const speed01 = THREE.MathUtils.clamp((currentSpeed - minSpeed) / (maxSpeed - minSpeed), 0, 1);
  const chaseDistance = THREE.MathUtils.lerp(13, 34, speed01);
  const cameraHeight = THREE.MathUtils.lerp(5.5, 9.5, speed01);

  let headingDelta = heading - cameraHeading;
  headingDelta = Math.atan2(Math.sin(headingDelta), Math.cos(headingDelta));
  cameraHeading += headingDelta * (1 - Math.pow(0.72, dt * 60));

  desiredCamera.set(
    glider.position.x - Math.sin(cameraHeading) * chaseDistance - tempForward.x * chaseDistance * 0.35,
    glider.position.y + cameraHeight - tempForward.y * chaseDistance * 0.15,
    glider.position.z + Math.cos(cameraHeading) * chaseDistance - tempForward.z * chaseDistance * 0.35
  );
  camera.position.lerp(desiredCamera, Math.min(1, 5 * dt));

  lookTarget.set(
    glider.position.x + tempForward.x * THREE.MathUtils.lerp(12, 35, speed01),
    glider.position.y + tempForward.y * THREE.MathUtils.lerp(7, 18, speed01),
    glider.position.z + tempForward.z * THREE.MathUtils.lerp(12, 35, speed01)
  );
  smoothedLookTarget.lerp(lookTarget, Math.min(1, 4 * dt));
  camera.lookAt(smoothedLookTarget);

  camera.fov = THREE.MathUtils.lerp(62, 78, speed01);
  camera.updateProjectionMatrix();
}


function animate(now = performance.now()) {
  requestAnimationFrame(animate);

  const dt = Math.min((now - previousTime) / 1000, 0.033);
  previousTime = now;

  if (crashed) {
    crashTimer += dt;
    glider.rotation.z += 0.025 * (dt * 60);
    updateHud();
    renderer.render(scene, camera);
    return;
  }

  const currentSpeed = updateFlight(dt);

  if (glider.position.y <= 0.35) {
    glider.position.y = 0.35;
    crash();
  }

  if (glider.position.x < -BOUNDARY || glider.position.x > BOUNDARY ||
      glider.position.z < -BOUNDARY || glider.position.z > BOUNDARY) {
    crash();
  }

  if (!crashed) {
    const p = glider.position;
    for (const building of buildings) {
      const dx = Math.abs(p.x - building.position.x);
      const dz = Math.abs(p.z - building.position.z);
      const halfX = Math.max(3, (building.userData.width as number) * 0.5) + 1;
      const halfZ = Math.max(3, (building.userData.depth as number) * 0.5) + 1;
      const top = building.userData.height as number;
      if (dx < halfX && dz < halfZ && p.y < top + 0.8) {
        crash();
        break;
      }
    }
  }

  for (const coin of coins) {
    if (!coin.visible) continue;
    coin.rotation.y += 0.05 * dt * 60;
    coin.rotation.x += 0.025 * dt * 60;
    if (glider.position.distanceTo(coin.position) < 2.1) {
      coin.visible = false;
      coin.userData.collected = true;
      score++;
    }
  }

  updateCamera(dt, currentSpeed);
  updateHud();
  renderer.render(scene, camera);
}


animate();

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});
