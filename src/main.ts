import * as THREE from 'three';

document.body.style.margin = '0';
document.body.style.overflow = 'hidden';
document.body.style.background = '#8fc5e8';

const WORLD_SIZE = 10000;
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

const buildings: Array<{x:number; z:number; width:number; depth:number; height:number}> = [];

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

async function createSydneyCity(onProgress: (progress: number) => void = () => {}) {
  // Keep the whole prototype GPU-light: one shared box geometry + one
  // InstancedMesh instead of thousands of independent Three.js meshes.
  const blockSize = 55;
  const half = 2450;
  const positions: Array<{x:number; z:number; width:number; depth:number; height:number}> = [];
  const totalRows = Math.floor((half * 2) / blockSize) + 1;
  let row = 0;

  for (let x = -half; x <= half; x += blockSize) {
    for (let z = -half; z <= half; z += blockSize) {
      const distance = Math.hypot(x, z);
      if (distance > half) continue;

      // Large corridors make the city read as a street grid from altitude.
      const roadX = Math.abs(((x + 27) % 275) - 137.5) < 18;
      const roadZ = Math.abs(((z + 27) % 330) - 165) < 18;
      if (roadX || roadZ) continue;

      const density = Math.max(0, 1 - distance / 2700);
      const seed = Math.abs((x * 73856093) ^ (z * 19349663));
      const chance = (seed % 1000) / 1000;
      if (chance > 0.40 + density * 0.35) continue;

      const width = 28 + (seed % 15);
      const depth = 28 + ((seed >> 4) % 15);
      const tower = (seed % 1000) / 1000 < density * 0.16;
      const height = tower ? 55 + (seed % 115) : 10 + density * 22 + (seed % 18);

      positions.push({x, z, width, depth, height});
    }
    row++;
    onProgress(Math.min(55, Math.round((row / totalRows) * 55)));
    if (row % 8 === 0) await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
  }

  const geometry = new THREE.BoxGeometry(1, 1, 1);
  const material = new THREE.MeshLambertMaterial({ color: 0xc8c6c0 });
  const instanced = new THREE.InstancedMesh(geometry, material, positions.length);
  const matrix = new THREE.Matrix4();
  const scale = new THREE.Vector3();

  positions.forEach((b, i) => {
    scale.set(b.width, b.height, b.depth);
    matrix.compose(
      new THREE.Vector3(b.x, b.height / 2 - 0.5, b.z),
      new THREE.Quaternion(),
      scale
    );
    instanced.setMatrixAt(i, matrix);
    buildings.push(b);
  });

  instanced.instanceMatrix.needsUpdate = true;
  scene.add(instanced);
  onProgress(70);
  await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));

  // Harbour proxy north/east of the CBD.
  const water = new THREE.Mesh(
    new THREE.BoxGeometry(1500, 0.15, 1900),
    new THREE.MeshBasicMaterial({ color: 0x4e9fc4 })
  );
  water.position.set(800, -0.88, -1200);
  scene.add(water);
  onProgress(80);
  await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));

  // Three cheap vertical navigation markers.
  addLandmark(0, -90, 52, 11);
  addLandmark(95, 55, 42, 13);
  addLandmark(-105, 65, 34, 15);

  // 3D street network: low-profile instanced strips aligned to the same
  // deterministic city grid. These are deliberately cheap so streets remain
  // visible from altitude without creating thousands of individual meshes.
  const roadPositions: Array<{x:number; z:number; width:number; depth:number}> = [];
  for (let x = -half; x <= half; x += 275) {
    roadPositions.push({x, z:0, width:11, depth:half * 2});
  }
  for (let z = -half; z <= half; z += 330) {
    roadPositions.push({x:0, z, width:half * 2, depth:11});
  }
  const roadGeometry = new THREE.BoxGeometry(1, 0.035, 1);
  const roadMaterial = new THREE.MeshBasicMaterial({color: 0x4f5558});
  const roads = new THREE.InstancedMesh(roadGeometry, roadMaterial, roadPositions.length);
  roadPositions.forEach((r, i) => {
    scale.set(r.width, 1, r.depth);
    matrix.compose(new THREE.Vector3(r.x, 0.018, r.z), new THREE.Quaternion(), scale);
    roads.setMatrixAt(i, matrix);
  });
  roads.instanceMatrix.needsUpdate = true;
  scene.add(roads);
  onProgress(94);
  await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));

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
hud.style.display = 'none';

// ---------- GTA-STYLE MINIMAP ----------
// This first pass is a detailed, lightweight vector minimap. It deliberately
// stays local/offline so gameplay never depends on a live map request. The
// coordinates are aligned to the Sydney prototype and will later be replaced
// by baked OSM/NSW GIS vectors. OSM contains roads, buildings, POIs and natural
// features suitable for this next data pipeline. 
const minimap = document.createElement('canvas');
minimap.width = 260;
minimap.height = 260;
Object.assign(minimap.style, {
  position: 'fixed', left: '18px', bottom: '18px', width: '260px', height: '260px',
  zIndex: '11', borderRadius: '50%', border: '3px solid rgba(255,255,255,.9)',
  boxShadow: '0 3px 14px rgba(0,0,0,.45)', pointerEvents: 'none', display: 'none'
});
document.body.appendChild(minimap);
const mapCtx = minimap.getContext('2d')!;
const MAP_SCALE = 0.075;

const mapStreets: Array<{name:string; points:Array<[number,number]>; major?:boolean}> = [
  {name:'George St', points:[[-120,100],[-75,20],[-35,-90],[10,-260],[70,-520]], major:true},
  {name:'Pitt St', points:[[10,100],[28,15],[55,-80],[75,-210],[110,-430]]},
  {name:'Macquarie St', points:[[115,80],[105,-10],[95,-100],[65,-185]], major:true},
  {name:'Elizabeth St', points:[[-80,110],[-55,10],[-20,-95],[10,-210]], major:true},
  {name:'Kent St', points:[[-190,60],[-160,-30],[-145,-130],[-120,-250]], major:true},
  {name:'York St', points:[[-145,90],[-115,10],[-95,-80],[-70,-190]], major:true},
  {name:'Castlereagh St', points:[[-20,80],[-5,5],[15,-75],[30,-160]],},
  {name:'Wynyard', points:[[-190,-40],[-110,-50],[-30,-45],[45,-55],[120,-75]], major:true},
  {name:'Bridge St', points:[[-110,55],[-30,45],[50,50],[125,20]], major:true},
  {name:'Market St', points:[[-115,-145],[-35,-150],[45,-140],[125,-165]], major:true},
  {name:'Park St', points:[[-125,-185],[-40,-190],[45,-185],[125,-205]]},
  {name:'William St', points:[[85,115],[95,65],[130,15],[170,-20],[205,-40]], major:true},
  {name:'Anzac Bridge', points:[[-720,230],[-500,180],[-300,120],[-170,40]] ,major:true},
  {name:'Cahill Expressway', points:[[-50,160],[30,125],[105,120],[190,95]], major:true},
  {name:'Darling Harbour', points:[[-260,-120],[-220,-30],[-190,60],[-150,135]]}
];

const mapSuburbs: Array<{name:string;x:number;z:number}> = [
  {name:'THE ROCKS',x:-20,z:115},{name:'CIRCULAR QUAY',x:65,z:100},{name:'CBD',x:0,z:-55},
  {name:'BARANGAROO',x:-150,z:-5},{name:'PYRMONT',x:-360,z:-90},{name:'DARLING HARBOUR',x:-220,z:-150},
  {name:'WOOLLOOMOOLOO',x:230,z:95},{name:'POTTS POINT',x:350,z:120},{name:'KIRRIBILLI',x:170,z:300},
  {name:'NORTH SYDNEY',x:280,z:560},{name:'ULTIMO',x:-300,z:-250},{name:'SURRY HILLS',x:210,z:-260}
];

function drawMapShape(points:Array<[number,number]>, fill:string, stroke?:string) {
  if (!points.length) return;
  mapCtx.beginPath();
  points.forEach(([x,z], i) => {
    const px = 130 + x * MAP_SCALE;
    const py = 130 - z * MAP_SCALE;
    if (i === 0) mapCtx.moveTo(px, py); else mapCtx.lineTo(px, py);
  });
  mapCtx.closePath();
  mapCtx.fillStyle = fill; mapCtx.fill();
  if (stroke) { mapCtx.strokeStyle = stroke; mapCtx.stroke(); }
}

function drawMinimap() {
  const cx = 130, cy = 130;
  mapCtx.clearRect(0, 0, 260, 260);
  mapCtx.save();
  mapCtx.beginPath(); mapCtx.arc(cx, cy, 127, 0, Math.PI * 2); mapCtx.clip();
  mapCtx.translate(cx, cy);
  mapCtx.rotate(-heading);
  mapCtx.translate(-glider.position.x * MAP_SCALE, glider.position.z * MAP_SCALE);

  // Water/harbour silhouette.
  mapCtx.fillStyle = '#3f91b6';
  mapCtx.fillRect(-2500 * MAP_SCALE, -2500 * MAP_SCALE, 5000 * MAP_SCALE, 5000 * MAP_SCALE);
  drawMapShape([[-1200,900],[-750,620],[-500,380],[-360,230],[-250,150],[-150,130],[-50,170],[80,130],[210,190],[370,330],[650,500],[1000,700],[1200,1100],[1200,1600],[-1200,1600]], '#78b99c');
  drawMapShape([[-950,-500],[-650,-350],[-420,-260],[-260,-170],[-180,-80],[-120,80],[-40,160],[100,150],[220,70],[340,-20],[520,-120],[800,-200],[1100,-300],[1200,-700],[1200,-1200],[-950,-1200]], '#78b99c');

  // Blocks/building mass: fine polygons at the central scale.
  for (let x=-650; x<=650; x+=48) for (let z=-520; z<=520; z+=48) {
    const d=Math.hypot(x,z); if(d>850) continue;
    const roadX=Math.abs(((x+24)%190)-95)<12;
    const roadZ=Math.abs(((z+24)%220)-110)<12;
    if(roadX||roadZ) continue;
    mapCtx.fillStyle = d<300 ? '#a7a9aa' : '#969a9b';
    mapCtx.fillRect(x*MAP_SCALE-11,z*MAP_SCALE-11,22,22);
  }

  // Streets.
  mapStreets.forEach(street => {
    mapCtx.beginPath();
    street.points.forEach(([x,z],i)=>{
      const px=x*MAP_SCALE, py=z*MAP_SCALE;
      if(i===0) mapCtx.moveTo(px,py); else mapCtx.lineTo(px,py);
    });
    mapCtx.strokeStyle = street.major ? '#f4f4f4' : '#d7d7d7';
    mapCtx.lineWidth = street.major ? 3 : 1.5;
    mapCtx.stroke();
  });

  // Recognisable landmark silhouettes.
  // Opera House: five white shell-like triangles/fans near Circular Quay.
  const ox=65*MAP_SCALE, oz=100*MAP_SCALE;
  mapCtx.fillStyle='#ffffff';
  for(let i=0;i<5;i++){ mapCtx.beginPath(); mapCtx.moveTo(ox+i*2-5,oz+4); mapCtx.lineTo(ox+i*2,oz-9-Math.abs(i-2)*1.5); mapCtx.lineTo(ox+i*2+5,oz+4); mapCtx.closePath(); mapCtx.fill(); }
  // Harbour Bridge: broad arch.
  mapCtx.strokeStyle='#555'; mapCtx.lineWidth=5; mapCtx.beginPath();
  mapCtx.moveTo(-25*MAP_SCALE,120*MAP_SCALE); mapCtx.quadraticCurveTo(80*MAP_SCALE,275*MAP_SCALE,190*MAP_SCALE,185*MAP_SCALE); mapCtx.stroke();
  mapCtx.strokeStyle='#777'; mapCtx.lineWidth=2; mapCtx.beginPath();
  mapCtx.moveTo(-25*MAP_SCALE,120*MAP_SCALE); mapCtx.lineTo(190*MAP_SCALE,185*MAP_SCALE); mapCtx.stroke();

  // Player marker remains fixed at centre.
  mapCtx.restore();
  mapCtx.save();
  mapCtx.translate(cx,cy);
  mapCtx.fillStyle='#e83b32'; mapCtx.beginPath(); mapCtx.moveTo(0,-11); mapCtx.lineTo(7,9); mapCtx.lineTo(0,5); mapCtx.lineTo(-7,9); mapCtx.closePath(); mapCtx.fill();
  mapCtx.strokeStyle='#fff'; mapCtx.lineWidth=2; mapCtx.stroke();
  mapCtx.restore();

  // Compass ring / cardinal directions.
  mapCtx.fillStyle='#fff'; mapCtx.font='bold 12px system-ui'; mapCtx.textAlign='center';
  mapCtx.fillText('N',130,16); mapCtx.fillText('E',244,134); mapCtx.fillText('S',130,250); mapCtx.fillText('W',16,134);
  mapCtx.font='bold 10px system-ui'; mapCtx.fillStyle='rgba(255,255,255,.75)';
  mapCtx.fillText('SYDNEY',130,236);
}


// ---------- HOME / LOADING ----------
const home = document.createElement('div');
Object.assign(home.style, {
  position: 'fixed', inset: '0', zIndex: '20', display: 'flex',
  alignItems: 'center', justifyContent: 'center', flexDirection: 'column',
  background: 'linear-gradient(#8fc5e8, #d9eef7)', color: '#fff',
  fontFamily: 'system-ui, sans-serif', textAlign: 'center',
  textShadow: '0 3px 8px #234',
});
home.innerHTML = '<div style="font-size:54px;font-weight:900;letter-spacing:2px">CITY GLIDER</div>' +
  '<div style="font-size:20px;margin-top:8px">SYDNEY</div>' +
  '<div id="loadingPanel" style="width:min(420px,78vw);margin-top:30px;display:none">' +
  '<div id="loadingText" style="font-size:16px;margin-bottom:10px">LOADING CITY 0%</div>' +
  '<div style="height:12px;background:rgba(0,0,0,.22);border-radius:8px;overflow:hidden">' +
  '<div id="loadingBar" style="width:0%;height:100%;background:#fff;border-radius:8px;transition:width .15s ease"></div></div></div>' +
  '<button id="playButton" style="margin-top:34px;padding:16px 46px;border:0;border-radius:12px;font-size:22px;font-weight:800;cursor:pointer">LOAD</button>';
document.body.appendChild(home);

const playButton = document.getElementById('playButton') as HTMLButtonElement;
let gameStarted = false;
let cityLoaded = false;
let loadingInProgress = false;

let score = 0;
let distance = 0;
let crashed = false;
let crashTimer = 0;
let speed = 55;
let previousTime = performance.now();

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

drawMinimap();

async function startGame() {
  if (gameStarted || cityLoaded || loadingInProgress) return;

  loadingInProgress = true;
  playButton.disabled = true;
  playButton.textContent = 'LOADING…';

  const loadingPanel = document.getElementById('loadingPanel') as HTMLDivElement;
  const loadingText = document.getElementById('loadingText') as HTMLDivElement;
  const loadingBar = document.getElementById('loadingBar') as HTMLDivElement;
  loadingPanel.style.display = 'block';
  loadingText.textContent = 'LOADING CITY 0%';
  loadingBar.style.width = '0%';
  cityLabel.textContent = 'SYDNEY • LOADING CITY';

  // Let the browser paint the loading state before doing any city generation.
  await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));

  try {
    await createSydneyCity((progress) => {
      loadingText.textContent = 'LOADING CITY ' + progress + '%';
      loadingBar.style.width = progress + '%';
    });

    loadingText.textContent = 'CITY READY';
    loadingBar.style.width = '100%';
    cityLoaded = true;
    loadingInProgress = false;
    playButton.disabled = false;
    playButton.textContent = 'PLAY';
    playButton.style.display = 'inline-block';
    cityLabel.textContent = 'SYDNEY • LIGHTWEIGHT CITY';
  } catch (error) {
    console.error(error);
    loadingInProgress = false;
    loadingText.textContent = 'LOAD FAILED — TRY AGAIN';
    loadingBar.style.width = '0%';
    playButton.disabled = false;
    playButton.textContent = 'LOAD';
  }
}

playButton.addEventListener('click', () => {
  if (!cityLoaded) {
    startGame();
    return;
  }

  gameStarted = true;
  home.remove();
  hud.style.display = 'block';
  minimap.style.display = 'block';
  resetRun();
  previousTime = performance.now();
});

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

  if (event.code === 'Space' && crashed && gameStarted) {
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
  if (keys.ArrowLeft) heading -= steeringRate * dt;
  if (keys.ArrowRight) heading += steeringRate * dt;

  if (keys.ArrowUp) pitch += pitchUpRate * dt;
  if (keys.ArrowDown) pitch -= pitchDownRate * dt;
  pitch = THREE.MathUtils.clamp(pitch, -Math.PI * 0.49, Math.PI * 0.22);

  desiredForward.set(
    Math.sin(heading) * Math.cos(pitch),
    Math.sin(pitch),
    -Math.cos(heading) * Math.cos(pitch)
  ).normalize();

  const currentSpeed = velocity.length();
  velocityDirection.copy(velocity).normalize();

  // Redirect the velocity for simple arcade gliding. Upward looping/pull-up
  // mechanics are intentionally disabled for this prototype.
  const alignment = THREE.MathUtils.clamp(velocityAlignment * dt * (currentSpeed / 55), 0, 0.34);
  velocityDirection.lerp(desiredForward, alignment).normalize();
  velocity.copy(velocityDirection).multiplyScalar(currentSpeed);

  velocity.y -= gravity * dt;
  if (keys.ArrowDown) velocity.addScaledVector(desiredForward, diveAcceleration * dt);

  velocity.multiplyScalar(Math.max(0.90, 1 - drag * currentSpeed * dt));

  // Never generate upward velocity in this prototype.
  if (velocity.y > 0) velocity.y = 0;
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

  if (!gameStarted) {
    renderer.render(scene, camera);
    return;
  }

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
      const dx = Math.abs(p.x - building.x);
      const dz = Math.abs(p.z - building.z);
      const halfX = Math.max(3, building.width * 0.5) + 1;
      const halfZ = Math.max(3, building.depth * 0.5) + 1;
      const top = building.height;
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
  drawMinimap();
  updateHud();
  renderer.render(scene, camera);
}


animate();

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});
