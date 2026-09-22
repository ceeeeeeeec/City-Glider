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

// Sydney CBD origin. The game world is in local metres around this point.
// We deliberately load real OpenStreetMap building footprints instead of the
// temporary procedural blocks. This is the first real-city rendering pass.
const SYDNEY_LAT = -33.8688;
const SYDNEY_LON = 151.2093;
const CITY_RADIUS_M = 5000;

function lonToX(lon: number) {
  return (lon - SYDNEY_LON) * 111320 * Math.cos(SYDNEY_LAT * Math.PI / 180);
}

function latToZ(lat: number) {
  return -(lat - SYDNEY_LAT) * 111320;
}

function addOSMBuilding(points: Array<{lat: number; lon: number}>, height: number) {
  if (points.length < 3) return;

  const shape = new THREE.Shape();
  points.forEach((p, i) => {
    const x = lonToX(p.lon);
    const z = latToZ(p.lat);
    if (i === 0) shape.moveTo(x, z);
    else shape.lineTo(x, z);
  });
  shape.closePath();

  const depth = THREE.MathUtils.clamp(height, 3, 180);
  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth,
    bevelEnabled: false,
    curveSegments: 1,
    steps: 1
  });

  // ExtrudeGeometry uses local Z as depth; rotate so depth becomes world Y.
  geometry.rotateX(-Math.PI / 2);

  const material = height > 45 ? darkBuildingMaterial : buildingMaterial;
  const building = new THREE.Mesh(geometry, material);
  const xs = points.map(p => lonToX(p.lon));
  const zs = points.map(p => latToZ(p.lat));
  building.userData.width = Math.max(...xs) - Math.min(...xs);
  building.userData.depth = Math.max(...zs) - Math.min(...zs);
  building.userData.height = depth;
  building.userData.osm = true;

  // Extrusion starts at y=0; keep city at ground level.
  scene.add(building);
  buildings.push(building);
}

async function loadSydneyBuildings() {
  const radius = CITY_RADIUS_M;
  const query =
    '[out:json][timeout:25];' +
    '(way["building"](around:' + radius + ',' + SYDNEY_LAT + ',' + SYDNEY_LON + '););' +
    'out tags geom;';

  try {
    const response = await fetch(
      'https://overpass-api.de/api/interpreter?data=' + encodeURIComponent(query)
    );
    if (!response.ok) throw new Error('OSM request failed: ' + response.status);

    const data = await response.json();

    // Keep the prototype lightweight: nearest/smaller footprints first and
    // cap the total number of rendered buildings.
    const elements = (data.elements ?? [])
      .filter((el: any) => el.geometry?.length >= 3)
      .sort((a: any, b: any) => {
        const ay = a.geometry.reduce((s: number, p: any) => s + latToZ(p.lat), 0) / a.geometry.length;
        const ax = a.geometry.reduce((s: number, p: any) => s + lonToX(p.lon), 0) / a.geometry.length;
        const by = b.geometry.reduce((s: number, p: any) => s + latToZ(p.lat), 0) / b.geometry.length;
        const bx = b.geometry.reduce((s: number, p: any) => s + lonToX(p.lon), 0) / b.geometry.length;
        return (ax * ax + ay * ay) - (bx * bx + by * by);
      })
      .slice(0, 8500);

    // Never build thousands of ExtrudeGeometry meshes in one synchronous burst.
    // Doing so blocks the browser's main thread and prevents the first frame
    // (including the glider) from being rendered.
    const batchSize = 100;
    for (let i = 0; i < elements.length; i += batchSize) {
      const batch = elements.slice(i, i + batchSize);
      for (const el of batch) {
        const tags = el.tags ?? {};
        let height = Number.parseFloat(tags.height ?? '');
        if (!Number.isFinite(height)) {
          const levels = Number.parseFloat(tags['building:levels'] ?? '');
          height = Number.isFinite(levels) ? levels * 3.2 : 9;
        }

        addOSMBuilding(
          el.geometry.map((p: any) => ({ lat: p.lat, lon: p.lon })),
          height
        );
      }

      cityLabel.textContent = 'SYDNEY • BUILDING CITY ' +
        Math.min(i + batchSize, elements.length) + '/' + elements.length;

      // Yield to the renderer between batches.
      await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
    }

    cityLabel.textContent = 'SYDNEY • REAL OSM BUILDINGS';
  } catch (error) {
    console.warn('Sydney OSM loading failed; using fallback city blocks.', error);
    cityLabel.textContent = 'SYDNEY • FALLBACK CITY';
    createFallbackCity();
  }
}

function createFallbackCity() {
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
}

const cityLabel = document.createElement('div');
Object.assign(cityLabel.style, {
  position: 'fixed', right: '16px', top: '16px', zIndex: '10',
  color: '#fff', font: 'bold 16px system-ui',
  textShadow: '0 2px 5px #000', pointerEvents: 'none'
});
cityLabel.textContent = 'SYDNEY • LOADING CITY';
document.body.appendChild(cityLabel);

void loadSydneyBuildings();

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
