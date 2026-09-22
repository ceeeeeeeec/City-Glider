import * as maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';

const SYDNEY = { lon: 151.2093, lat: -33.8688 };
const START_ALT = 1000;
const DEG_LAT = 1 / 111320;
const DEG_LON = 1 / (111320 * Math.cos(SYDNEY.lat * Math.PI / 180));

const app = document.getElementById('app')!;
Object.assign(document.body.style, { margin: '0', overflow: 'hidden', background: '#8fc5e8', fontFamily: 'system-ui,sans-serif' });

app.innerHTML = `
  <div id="map"></div>
  <div id="miniMap"></div>
  <div id="hud"></div>
  <div id="compass"></div>
  <div id="glider">➤</div>
  <div id="message">LOADING SYDNEY…<small>OpenStreetMap 3D city data — no API key required</small></div>
`;

const style = document.createElement('style');
style.textContent = `
  html,body,#app,#map{width:100%;height:100%}
  #map{position:fixed;inset:0}
  #miniMap{position:fixed;left:18px;bottom:18px;width:230px;height:230px;border:3px solid #fff;border-radius:50%;overflow:hidden;box-shadow:0 4px 20px #0009;z-index:5}
  #miniMap .maplibregl-ctrl-attrib{display:none}
  #hud{position:fixed;left:18px;top:16px;z-index:10;color:#fff;font-size:15px;line-height:1.55;text-shadow:0 2px 5px #000;pointer-events:none}
  #compass{position:fixed;left:50%;top:14px;transform:translateX(-50%);z-index:10;color:#fff;font-size:15px;font-weight:900;text-shadow:0 2px 5px #000;pointer-events:none;width:190px;height:22px}
  #compass span{position:absolute;transform:translateX(-50%)}
  #glider{position:fixed;left:50%;top:58%;transform:translate(-50%,-50%);z-index:9;color:#ffd226;font-size:46px;font-weight:900;text-shadow:0 2px 5px #000;pointer-events:none}
  #message{position:fixed;left:50%;top:50%;transform:translate(-50%,-50%);z-index:20;color:#fff;text-align:center;font-weight:900;font-size:22px;text-shadow:0 2px 8px #000;pointer-events:none}
  #message small{display:block;margin-top:8px;font-size:13px;font-weight:500;opacity:.9}
  .maplibregl-ctrl-attrib{font-size:10px}
`;
document.head.appendChild(style);

let map: maplibregl.Map;
let miniMap: maplibregl.Map | null = null;

const hud = document.getElementById('hud')!;
const compass = document.getElementById('compass')!;
const message = document.getElementById('message')!;
const glider = document.getElementById('glider')!;

const keys = new Set<string>();
addEventListener('keydown', e => {
  keys.add(e.code);
  if (['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space','KeyW','KeyA','KeyS','KeyD'].includes(e.code)) e.preventDefault();
});
addEventListener('keyup', e => keys.delete(e.code));

let heading = 0;
let pitch = 0;
let altitude = START_ALT;
let speed = 58;
let distance = 0;
let crashed = false;
let mapReady = false;
let miniMapReady = false;
let startupFailed = false;

const position = { x: 0, y: 0 };
const velocity = { x: 0, y: -58, z: -6 };
const forward = { x: 0, y: 1, z: 0 };
const desired = { x: 0, y: 0, z: 0 };

function coord(x:number, y:number) {
  return [SYDNEY.lon + x * DEG_LON, SYDNEY.lat + y * DEG_LAT] as [number, number];
}

function aheadCoord(distanceM:number) {
  return coord(position.x + Math.sin(heading) * distanceM, position.y + Math.cos(heading) * distanceM);
}

function cameraUpdate() {
  const camDistance = Math.min(42, 18 + speed * 0.22);
  const cam = coord(position.x - Math.sin(heading) * camDistance, position.y - Math.cos(heading) * camDistance);
  const target = aheadCoord(Math.min(260, 100 + speed * 1.8));
  const cameraAlt = Math.max(altitude + 12, 18);
  const targetAlt = Math.max(0, altitude - Math.min(altitude * 0.7, 220));
  const options = map.calculateCameraOptionsFromTo(cam, cameraAlt, target, targetAlt);
  options.bearing = heading * 180 / Math.PI;
  options.pitch = Math.max(42, Math.min(82, 58 - pitch * 18));
  map.jumpTo(options);
  if (miniMap && miniMapReady) {
    miniMap.jumpTo({
      center: coord(position.x, position.y),
      bearing: heading * 180 / Math.PI,
      zoom: altitude > 700 ? 12.2 : altitude > 250 ? 13.1 : 14.1,
    });
  }
}

function updateFlight(dt:number) {
  if (keys.has('ArrowLeft') || keys.has('KeyA')) heading -= 1.55 * dt;
  if (keys.has('ArrowRight') || keys.has('KeyD')) heading += 1.55 * dt;
  if (keys.has('ArrowUp') || keys.has('KeyW')) pitch += 0.9 * dt;
  if (keys.has('ArrowDown') || keys.has('KeyS')) pitch -= 1.55 * dt;

  pitch = Math.max(-Math.PI * 0.49, Math.min(Math.PI * 0.14, pitch));

  const h = Math.cos(pitch);
  forward.x = Math.sin(heading) * h;
  forward.y = Math.cos(heading) * h;
  forward.z = Math.sin(pitch);

  const current = Math.hypot(velocity.x, velocity.y, velocity.z);
  const steer = Math.min(0.28, 2.6 * dt * Math.max(0.35, current / 55));

  desired.x = forward.x * current;
  desired.y = forward.y * current;
  desired.z = forward.z * current;

  velocity.x += (desired.x - velocity.x) * steer;
  velocity.y += (desired.y - velocity.y) * steer;
  velocity.z += (desired.z - velocity.z) * steer;

  velocity.z -= 18 * dt;
  if (keys.has('ArrowDown') || keys.has('KeyS')) velocity.z += 32 * dt;

  const drag = Math.max(0.90, 1 - 0.0018 * current * dt);
  velocity.x *= drag;
  velocity.y *= drag;
  velocity.z *= drag;

  if (velocity.z > 2.5) velocity.z = 2.5;

  speed = Math.max(20, Math.min(115, Math.hypot(velocity.x, velocity.y, velocity.z)));
  const normal = Math.hypot(velocity.x, velocity.y, velocity.z) || 1;
  velocity.x = velocity.x / normal * speed;
  velocity.y = velocity.y / normal * speed;
  velocity.z = velocity.z / normal * speed;

  position.x += velocity.x * dt;
  position.y += velocity.y * dt;
  altitude = Math.max(0, altitude + velocity.z * dt);
  distance += speed * dt;

  if (altitude <= 2) {
    altitude = 0;
    crashed = true;
    message.style.display = 'block';
    message.innerHTML = '<b>CRASHED</b><small>Press SPACE to restart</small>';
  }
}

function reset() {
  position.x = 0;
  position.y = 0;
  altitude = START_ALT;
  speed = 58;
  distance = 0;
  heading = 0;
  pitch = 0;
  velocity.x = 0;
  velocity.y = -58;
  velocity.z = -6;
  crashed = false;
  message.style.display = 'none';
}

function compassUpdate() {
  const deg = ((heading * 180 / Math.PI) % 360 + 360) % 360;
  const labels = ['N','NE','E','SE','S','SW','W','NW'];
  compass.innerHTML = labels.map((label, i) => {
    const angle = i * 45;
    const delta = ((angle - deg + 540) % 360) - 180;
    const x = 95 + delta * 1.8;
    const opacity = Math.max(0, 1 - Math.abs(delta) / 105);
    return '<span style="left:' + x + 'px;opacity:' + opacity.toFixed(2) + '">' + label + '</span>';
  }).join('');
}

function hudUpdate() {
  const hd = ((heading * 180 / Math.PI) % 360 + 360) % 360;
  hud.innerHTML =
    '<b>CITY GLIDER</b><br>' +
    'SYDNEY • OPEN DATA 3D<br>' +
    'ALTITUDE <b>' + Math.round(altitude) + 'm</b> &nbsp; ' +
    'SPEED <b>' + Math.round(speed * 3.6) + ' km/h</b><br>' +
    'DISTANCE <b>' + Math.round(distance) + 'm</b> &nbsp; ' +
    'HEADING <b>' + Math.round(hd) + '°</b>';
}

function addBuildingLayer() {
  if (map.getSource('openfreemap-buildings')) return;
  map.addSource('openfreemap-buildings', {
    type: 'vector',
    url: 'https://tiles.openfreemap.org/planet'
  });
  const layers = map.getStyle().layers || [];
  const labelLayer = layers.find(layer =>
    layer.type === 'symbol' && Boolean((layer as any).layout?.['text-field'])
  );
  map.addLayer({
    id: 'city-glider-3d-buildings',
    source: 'openfreemap-buildings',
    'source-layer': 'building',
    type: 'fill-extrusion',
    minzoom: 13,
    filter: ['!=', ['get', 'hide_3d'], true],
    paint: {
      'fill-extrusion-color': ['coalesce', ['get', 'colour'], '#b9b6ad'],
      'fill-extrusion-height': ['interpolate', ['linear'], ['zoom'], 13, 0, 15, ['get', 'render_height']],
      'fill-extrusion-base': ['case', ['>=', ['zoom'], 15], ['get', 'render_min_height'], 0],
      'fill-extrusion-opacity': 0.92,
      'fill-extrusion-vertical-gradient': true
    }
  }, labelLayer?.id);
}

let mapLoadFailed = false;

function showStartupError(title: string, detail: string) {
  startupFailed = true;
  mapReady = false;
  message.style.display = 'block';
  message.innerHTML = '<b>' + title + '</b><small>' + detail + '</small>';
}

function beginGame() {
  if (mapReady || startupFailed) return;
  mapReady = true;
  message.style.display = 'block';
  message.innerHTML = '<b>SYDNEY READY</b><small>Arrow keys / WASD to fly</small>';

  // The base style is the critical path. 3D building enhancement is optional.
  try {
    addBuildingLayer();
  } catch (error) {
    console.warn('Optional 3D building layer failed:', error);
  }

  try {
    cameraUpdate();
  } catch (error) {
    console.warn('Initial camera positioning failed:', error);
  }

  setTimeout(() => {
    if (!crashed && !startupFailed) message.style.display = 'none';
  }, 900);
}

try {
  map = new maplibregl.Map({
    container: 'map',
    style: 'https://tiles.openfreemap.org/styles/bright',
    center: [SYDNEY.lon, SYDNEY.lat],
    zoom: 14.5,
    pitch: 68,
    bearing: 0,
    maxPitch: 85,
    centerClampedToGround: false,
    antialias: false,
    attributionControl: true,
    interactive: false,
  });

  // style.load is intentionally used as the playable readiness signal.
  // MapLibre's full load event waits for all necessary resources and can be
  // delayed by individual tile/resource failures. The style itself is enough
  // to make the flight loop responsive.
  map.once('style.load', beginGame);

  map.on('error', e => {
    console.warn('MapLibre error:', e.error || e);
    if (!mapReady && !startupFailed && map.isStyleLoaded()) beginGame();
  });

  map.on('webglcontextlost', () => {
    showStartupError('GRAPHICS CONTEXT LOST', 'Refresh the page to restart the 3D map.');
  });

  map.on('webglcontextrestored', () => {
    if (!startupFailed) beginGame();
  });

  miniMap = new maplibregl.Map({
    container: 'miniMap',
    style: 'https://tiles.openfreemap.org/styles/bright',
    center: [SYDNEY.lon, SYDNEY.lat],
    zoom: 12.5,
    pitch: 0,
    bearing: 0,
    maxPitch: 0,
    interactive: false,
    attributionControl: false,
  });

  miniMap.once('style.load', () => {
    miniMapReady = true;
  });

  miniMap.on('error', e => {
    // The minimap is decorative. Never let a minimap failure block gameplay.
    console.warn('Minimap error:', e.error || e);
  });
} catch (error) {
  const detail = error instanceof Error ? error.message : String(error);
  console.error('City Glider startup error:', error);
  showStartupError('SYDNEY MAP COULD NOT START', detail);
}

// Hard fallback: no permanent loading screen, even if the map provider or
// browser graphics stack never emits a useful event.
setTimeout(() => {
  if (!mapReady && !startupFailed) {
    showStartupError(
      'SYDNEY MAP FAILED TO START',
      'The map service did not become ready. Refresh to retry.'
    );
  }
}, 10000);

let last = performance.now();
function frame(now:number) {
  requestAnimationFrame(frame);
  const dt = Math.min((now - last) / 1000, 0.033);
  last = now;
  if (!mapReady || startupFailed) return;

  if (crashed) {
    if (keys.has('Space')) {
      reset();
      cameraUpdate();
    }
  } else {
    updateFlight(dt);
    cameraUpdate();
    hudUpdate();
    compassUpdate();
  }

  glider.style.transform =
    'translate(-50%,-50%) rotate(' +
    (((heading * 180 / Math.PI) % 360) + 360) % 360 +
    'deg)';
}

requestAnimationFrame(frame);
