import * as THREE from 'three';
import './style.css';

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x8fc5e8);
scene.fog = new THREE.Fog(0x8fc5e8, 900, 5200);

const camera = new THREE.PerspectiveCamera(68, innerWidth / innerHeight, 0.5, 12000);
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
renderer.setSize(innerWidth, innerHeight);
renderer.setClearColor(0x8fc5e8);
document.body.appendChild(renderer.domElement);

scene.add(new THREE.HemisphereLight(0xe8f6ff, 0x405060, 2.4));
const sun = new THREE.DirectionalLight(0xffffff, 2.8);
sun.position.set(-800, 1400, -500);
scene.add(sun);

const ground = new THREE.Mesh(
  new THREE.PlaneGeometry(8000, 8000),
  new THREE.MeshStandardMaterial({ color: 0x76996b, roughness: 1 })
);
ground.rotation.x = -Math.PI / 2;
scene.add(ground);

const city = new THREE.Group();
scene.add(city);

const buildingMaterials = [
  new THREE.MeshStandardMaterial({ color: 0xbfc4c6, roughness: 0.9 }),
  new THREE.MeshStandardMaterial({ color: 0x9fa7ad, roughness: 0.9 }),
  new THREE.MeshStandardMaterial({ color: 0xd0c7b9, roughness: 0.9 }),
  new THREE.MeshStandardMaterial({ color: 0x707a83, roughness: 0.85 })
];

const blocks: [number, number, number, number, number][] = [
  [-300,-520,120,130,180],[-130,-560,110,120,300],[20,-500,130,140,220],[190,-540,120,130,390],
  [-350,-300,140,120,120],[-170,-280,110,130,260],[-20,-320,150,120,180],[170,-300,130,140,330],[340,-330,120,120,210],
  [-320,-80,120,150,240],[-150,-70,130,120,420],[20,-100,110,140,280],[180,-80,140,130,190],[350,-100,120,140,360],
  [-300,170,150,120,150],[-100,190,120,140,320],[60,160,150,120,230],[250,180,120,150,450],[390,170,100,120,170],
  [-250,420,140,120,220],[-70,430,120,130,150],[100,410,150,120,280],[290,430,130,130,190]
];

for (let i = 0; i < blocks.length; i++) {
  const [x, z, w, d, h] = blocks[i];
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), buildingMaterials[i % buildingMaterials.length]);
  m.position.set(x, h / 2, z);
  m.userData.height = h;
  city.add(m);
}

const water = new THREE.Mesh(
  new THREE.PlaneGeometry(1900, 1000),
  new THREE.MeshStandardMaterial({ color: 0x4d91b0, roughness: 0.35, metalness: 0.05 })
);
water.rotation.x = -Math.PI / 2;
water.position.set(950, 0.5, -20);
scene.add(water);

const coins: THREE.Mesh[] = [];
for (let i = 0; i < 24; i++) {
  const c = new THREE.Mesh(
    new THREE.TorusGeometry(7, 2.2, 8, 16),
    new THREE.MeshStandardMaterial({ color: 0xffd447, metalness: 0.5, roughness: 0.35 })
  );
  const t = i / 23;
  c.position.set(-120 + t * 240, 430 - t * 80, -760 + t * 1050);
  c.rotation.y = Math.PI / 2;
  scene.add(c);
  coins.push(c);
}

const glider = new THREE.Group();
const wingMaterial = new THREE.MeshStandardMaterial({ color: 0x20252b, roughness: 0.7 });
const wing = new THREE.Mesh(new THREE.ConeGeometry(20, 72, 3), wingMaterial);
wing.rotation.z = Math.PI / 2;
glider.add(wing);

const body = new THREE.Mesh(new THREE.CapsuleGeometry(4, 10, 5, 10), new THREE.MeshStandardMaterial({ color: 0x26323b }));
body.rotation.z = Math.PI / 2;
glider.add(body);

const pilot = new THREE.Mesh(new THREE.SphereGeometry(5, 16, 12), new THREE.MeshStandardMaterial({ color: 0xf1c6a5 }));
pilot.position.y = -7;
glider.add(pilot);
scene.add(glider);

const pos = new THREE.Vector3(0, 650, -900);
const vel = new THREE.Vector3(0, -8, 85);
let alive = true;
let score = 0;

const keys = new Set<string>();
const input = { x: 0, y: 0, active: false };

addEventListener('keydown', e => {
  keys.add(e.key);
  if (['ArrowUp','ArrowDown','ArrowLeft','ArrowRight',' '].includes(e.key)) e.preventDefault();
  if (!alive && (e.key === 'Enter' || e.key === ' ')) reset();
});
addEventListener('keyup', e => keys.delete(e.key));

const hud = document.createElement('div');
hud.id = 'hud';
hud.innerHTML = '<strong>CITY GLIDER</strong><span id="stats">Sydney prototype</span>';
document.body.appendChild(hud);

const message = document.createElement('div');
message.id = 'message';
message.innerHTML = '<strong>GLIDE TEST</strong><small>Arrow keys: ← → steer · ↑ dive · ↓ pull up</small>';
document.body.appendChild(message);

const controls = document.createElement('div');
controls.id = 'controls';
controls.textContent = 'ARROWS: steer  •  ↑ dive  •  ↓ pull up';
document.body.appendChild(controls);

const pad = document.createElement('div');
pad.id = 'pad';
pad.innerHTML = '<div id="stick"></div>';
document.body.appendChild(pad);
const stick = document.querySelector('#stick') as HTMLElement;

function steer(px: number, py: number) {
  const r = pad.getBoundingClientRect();
  const max = r.width * 0.34;
  const dx = THREE.MathUtils.clamp(px - r.left - r.width / 2, -max, max);
  const dy = THREE.MathUtils.clamp(py - r.top - r.height / 2, -max, max);
  input.x = dx / max;
  input.y = dy / max;
  input.active = true;
  stick.style.transform = 'translate(' + dx + 'px,' + dy + 'px)';
}
function clear() {
  input.x = input.y = 0;
  input.active = false;
  stick.style.transform = 'translate(0,0)';
}
pad.addEventListener('pointerdown', e => { pad.setPointerCapture(e.pointerId); steer(e.clientX, e.clientY); });
pad.addEventListener('pointermove', e => { if (input.active) steer(e.clientX, e.clientY); });
pad.addEventListener('pointerup', clear);
pad.addEventListener('pointercancel', clear);

function reset() {
  pos.set(0, 650, -900);
  vel.set(0, -8, 85);
  score = 0;
  alive = true;
  coins.forEach(c => c.visible = true);
  message.innerHTML = '<strong>GLIDE TEST</strong><small>Arrow keys: steer · Up = dive · Down = pull up</small>';
}

message.addEventListener('pointerdown', reset);

const clock = new THREE.Clock();

function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), 0.033);

  if (alive) {
    const keyboardX = (keys.has('ArrowRight') ? 1 : 0) - (keys.has('ArrowLeft') ? 1 : 0);
    const keyboardY = (keys.has('ArrowDown') ? 1 : 0) - (keys.has('ArrowUp') ? 1 : 0);
    const steerX = input.active ? input.x : keyboardX;
    const pitchInput = input.active ? input.y : keyboardY;
    // Mirror keyboard state on the on-screen pad so desktop testing and touch testing use the same control language.
    if (!input.active) {
      input.x = keyboardX;
      input.y = keyboardY;
      const max = pad.getBoundingClientRect().width * 0.34;
      stick.style.transform = 'translate(' + (keyboardX * max) + 'px,' + (keyboardY * max) + 'px)';
    }

    // Flight model: speed and momentum are retained; control inputs bend the velocity
    // instead of directly moving the player. Up dives, Down pulls the nose up.
    const speed = Math.max(42, vel.length());
    const forward = vel.clone().normalize();
    const right = new THREE.Vector3().crossVectors(forward, new THREE.Vector3(0, 1, 0)).normalize();
    const liftDirection = new THREE.Vector3(0, 1, 0);

    vel.addScaledVector(right, steerX * 34 * dt);
    vel.addScaledVector(liftDirection, pitchInput * 42 * dt);
    vel.y -= 9.0 * dt;

    // Gentle aerodynamic drag: enough to feel floaty, but momentum remains important.
    const drag = Math.pow(0.998, dt * 60);
    vel.multiplyScalar(drag);

    // Keep the flight from becoming unrealistically slow.
    if (vel.length() < speed * 0.94) vel.setLength(speed * 0.94);
    pos.addScaledVector(vel, dt);

    glider.position.copy(pos);

    // Orient the glider with its actual flight direction.
    const flightDir = vel.clone().normalize();
    glider.quaternion.setFromUnitVectors(new THREE.Vector3(1, 0, 0), flightDir);
    glider.rotateZ(-steerX * 0.18);

    // True third-person camera: behind and above the moving glider.
    const cameraForward = vel.clone().normalize();
    const desiredCamera = pos.clone()
      .addScaledVector(cameraForward, -150)
      .add(new THREE.Vector3(0, 65, 0));
    camera.position.lerp(desiredCamera, 1 - Math.pow(0.00035, dt));
    camera.lookAt(pos.clone().addScaledVector(cameraForward, 95));

    for (const c of coins) {
      c.rotation.z += dt * 3;
      if (c.visible && c.position.distanceTo(pos) < 28) {
        c.visible = false;
        score++;
      }
    }

    let crash = pos.y <= 3;
    for (const b of city.children) {
      const halfW = (b as THREE.Mesh).geometry.boundingSphere?.radius ?? 50;
      if (Math.abs(pos.x - b.position.x) < 48 &&
          Math.abs(pos.z - b.position.z) < 58 &&
          pos.y < (b.userData.height ?? 100) + 8) {
        crash = true;
        break;
      }
    }

    if (crash) {
      alive = false;
      message.innerHTML = '<strong>RUN ENDED</strong><small>' + score + ' coins · Press Enter/Space or tap to restart</small>';
    }

    const s = document.querySelector('#stats');
    if (s) s.textContent = 'Sydney prototype · ' + score + ' coins · altitude ' + Math.max(0, Math.round(pos.y)) + 'm';
  }

  renderer.render(scene, camera);
}

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

camera.position.set(0, 715, -1050);
camera.lookAt(new THREE.Vector3(0, 500, -650));
glider.position.copy(pos);
animate();
