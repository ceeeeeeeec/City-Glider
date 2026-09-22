import * as Cesium from 'cesium';
import 'cesium/Build/Cesium/Widgets/widgets.css';

const SYDNEY={lon:151.2093,lat:-33.8688};
const START_ALT=1000;
const origin=Cesium.Cartesian3.fromDegrees(SYDNEY.lon,SYDNEY.lat,0);
const enu=Cesium.Transforms.eastNorthUpToFixedFrame(origin);
const local=new Cesium.Cartesian3(0,0,START_ALT);
const velocity=new Cesium.Cartesian3(0,0,-58);
const desired=new Cesium.Cartesian3();
const world=new Cesium.Cartesian3();
const app=document.getElementById('app')!;
Object.assign(document.body.style,{margin:'0',overflow:'hidden',background:'#8fc5e8',fontFamily:'system-ui,sans-serif'});

const viewer=new Cesium.Viewer(app,{
  animation:false,timeline:false,baseLayerPicker:false,geocoder:false,homeButton:false,
  sceneModePicker:false,navigationHelpButton:false,fullscreenButton:false,infoBox:false,
  selectionIndicator:false,terrainProvider:new Cesium.EllipsoidTerrainProvider(),
  globe:false,skyBox:false,skyAtmosphere:false
});
viewer.scene.backgroundColor=Cesium.Color.fromCssColorString('#8fc5e8');
viewer.scene.screenSpaceCameraController.enableInputs=false;
viewer.scene.screenSpaceCameraController.enableCollisionDetection=false;
viewer.scene.fog.enabled=true; viewer.scene.fog.density=.000045;

const ui=document.createElement('div');
Object.assign(ui.style,{position:'fixed',inset:'0',zIndex:'10',pointerEvents:'none',color:'#fff',textShadow:'0 2px 5px #000'});
ui.innerHTML=`
<div id="hud" style="position:absolute;left:18px;top:16px;font-size:15px;line-height:1.5"></div>
<div style="position:absolute;left:50%;top:12px;transform:translateX(-50%);font-size:22px;font-weight:900">N</div>
<canvas id="map" width="280" height="280" style="position:absolute;left:18px;bottom:18px;width:280px;height:280px;border:3px solid #fff;border-radius:50%;box-shadow:0 3px 18px #0008;background:#5b9db8"></canvas>
<div id="msg" style="position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);text-align:center;font-size:18px;line-height:1.5;max-width:650px"></div>
`;
document.body.appendChild(ui);
const hud=ui.querySelector('#hud') as HTMLDivElement;
const map=ui.querySelector('#map') as HTMLCanvasElement;
const ctx=map.getContext('2d')!;
const msg=ui.querySelector('#msg') as HTMLDivElement;

const panel=document.createElement('div');
Object.assign(panel.style,{position:'fixed',right:'18px',bottom:'18px',zIndex:'20',width:'min(440px,calc(100vw - 36px))',padding:'16px',background:'#000c',color:'#fff',borderRadius:'14px',boxSizing:'border-box'});
panel.innerHTML=`
<b style="font-size:22px">CITY GLIDER</b>
<div style="margin:6px 0 12px;opacity:.8">Real Sydney 3D world • Cesium streaming</div>
<input id="ion" type="password" placeholder="Cesium ion access token" style="width:100%;box-sizing:border-box;padding:10px;margin-bottom:8px">
<input id="google" type="password" placeholder="Google Maps API key (optional, photorealistic)" style="width:100%;box-sizing:border-box;padding:10px;margin-bottom:8px">
<button id="load" style="width:100%;padding:12px;border:0;border-radius:8px;font-weight:900;font-size:16px">LOAD REAL SYDNEY</button>
<div id="status" style="margin-top:8px;font-size:12px;opacity:.8"></div>`;
document.body.appendChild(panel);
const ion=panel.querySelector('#ion') as HTMLInputElement;
const google=panel.querySelector('#google') as HTMLInputElement;
const load=panel.querySelector('#load') as HTMLButtonElement;
const status=panel.querySelector('#status') as HTMLDivElement;
ion.value=localStorage.getItem('cg-ion')||'';
google.value=localStorage.getItem('cg-google')||'';

const keys=new Set<string>();
addEventListener('keydown',e=>{keys.add(e.code);if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space','KeyW','KeyA','KeyS','KeyD'].includes(e.code))e.preventDefault()});
addEventListener('keyup',e=>keys.delete(e.code));

let heading=0,pitch=0,speed=58,distance=0,started=false,ready=false,photorealistic=false;
let tileset:Cesium.Cesium3DTileset|undefined;
let glider:Cesium.Entity|undefined;
let last=performance.now();

function updateWorld(){
  Cesium.Matrix4.multiplyByPoint(enu,local,world);
  if(glider) glider.position=world.clone();
}
function meters(lon:number,lat:number){
  return {e:(lon-SYDNEY.lon)*111320*Math.cos(Cesium.Math.toRadians(SYDNEY.lat)),n:(lat-SYDNEY.lat)*111320};
}
const landmarks=[
  ['OPERA HOUSE',151.2153,-33.8568],['HARBOUR BRIDGE',151.2150,-33.8523],
  ['CENTRAL',151.2069,-33.8830],['DARLING HARBOUR',151.2010,-33.8748],
  ['BONDI',151.2743,-33.8915],['TARONGA ZOO',151.2417,-33.8430],
  ['MANLY',151.2849,-33.7969],['AIRPORT',151.1772,-33.9399]
] as const;

function gliderImage(){
  return 'data:image/svg+xml;charset=utf-8,'+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="180" height="80"><path d="M8 40L82 31 172 7 132 40 172 73 82 49Z" fill="#ffcf22" stroke="#111" stroke-width="5"/></svg>');
}
function addGlider(){
  updateWorld();
  glider=viewer.entities.add({position:world.clone(),billboard:{image:gliderImage(),width:56,height:25,disableDepthTestDistance:0}});
}
function reset(){
  local.set(0,0,START_ALT);velocity.set(0,0,-58);heading=0;pitch=0;speed=58;distance=0;
  updateWorld(); if(glider)glider.billboard!.show=true;
}
function crash(){
  started=false;msg.style.display='block';msg.innerHTML='<b>CRASHED</b><br>Press SPACE to restart';
  velocity.set(0,0,0);speed=0;
}
function fly(dt:number){
  if(keys.has('ArrowLeft')||keys.has('KeyA'))heading-=1.55*dt;
  if(keys.has('ArrowRight')||keys.has('KeyD'))heading+=1.55*dt;
  if(keys.has('ArrowUp')||keys.has('KeyW'))pitch+=.9*dt;
  if(keys.has('ArrowDown')||keys.has('KeyS'))pitch-=1.55*dt;
  pitch=Cesium.Math.clamp(pitch,Cesium.Math.toRadians(-85),Cesium.Math.toRadians(8));
  const h=Math.cos(pitch);
  const f=new Cesium.Cartesian3(Math.sin(heading)*h,Math.cos(heading)*h,Math.sin(pitch));
  const current=Cesium.Cartesian3.magnitude(velocity);
  const steer=Cesium.Math.clamp(2.6*dt*(current/55),0,.28);
  Cesium.Cartesian3.multiplyByScalar(f,current,desired);
  Cesium.Cartesian3.lerp(velocity,desired,steer,velocity);
  velocity.z-=18*dt;
  if(keys.has('ArrowDown')||keys.has('KeyS'))velocity.z+=32*dt;
  Cesium.Cartesian3.multiplyByScalar(velocity,Math.max(.9,1-.0018*current*dt),velocity);
  if(velocity.z>2.5)velocity.z=2.5;
  speed=Cesium.Math.clamp(Cesium.Cartesian3.magnitude(velocity),20,115);
  Cesium.Cartesian3.normalize(velocity,desired);Cesium.Cartesian3.multiplyByScalar(desired,speed,velocity);
  local.x+=velocity.x*dt;local.y+=velocity.y*dt;local.z=Math.max(2,local.z+velocity.z*dt);
  distance+=speed*dt;updateWorld();
}
function camera(){
  viewer.camera.lookAt(world,new Cesium.HeadingPitchRange(heading+Math.PI,Cesium.Math.toRadians(-12),Cesium.Math.clamp(20+speed*.2,24,45)));
}
function drawMap(){
  const c=140,s=.075;
  ctx.clearRect(0,0,280,280);ctx.save();ctx.beginPath();ctx.arc(c,c,132,0,Math.PI*2);ctx.clip();
  ctx.fillStyle='#5799b6';ctx.fillRect(0,0,280,280);
  ctx.translate(c,c);ctx.rotate(-heading);ctx.translate(-local.x*s,local.y*s);
  ctx.strokeStyle='#ffffff33';ctx.lineWidth=1;
  for(let x=-5000;x<=5000;x+=1000){ctx.beginPath();ctx.moveTo(x*s,-5000*s);ctx.lineTo(x*s,5000*s);ctx.stroke()}
  for(let y=-5000;y<=5000;y+=1000){ctx.beginPath();ctx.moveTo(-5000*s,y*s);ctx.lineTo(5000*s,y*s);ctx.stroke()}
  for(const [name,lon,lat] of landmarks){const p=meters(lon,lat),x=p.e*s,y=-p.n*s;ctx.fillStyle='#ffd23f';ctx.beginPath();ctx.arc(x,y,4,0,7);ctx.fill();ctx.fillStyle='#fff';ctx.font='bold 9px system-ui';ctx.fillText(name,x+6,y+3)}
  ctx.restore();ctx.save();ctx.translate(c,c);ctx.fillStyle='#ef3b35';ctx.beginPath();ctx.moveTo(0,-13);ctx.lineTo(8,10);ctx.lineTo(0,5);ctx.lineTo(-8,10);ctx.closePath();ctx.fill();ctx.strokeStyle='#fff';ctx.lineWidth=2;ctx.stroke();ctx.restore();
  ctx.fillStyle='#fff';ctx.font='900 14px system-ui';ctx.textAlign='center';ctx.fillText('N',c,17);
}
function hudUpdate(){
  const hd=(Cesium.Math.toDegrees(heading)+360)%360;
  const card=hd<22.5||hd>=337.5?'N':hd<67.5?'NE':hd<112.5?'E':hd<157.5?'SE':hd<202.5?'S':hd<247.5?'SW':hd<292.5?'W':'NW';
  hud.innerHTML='<b>CITY GLIDER</b><br>ALTITUDE <b>'+Math.round(local.z)+'m</b> &nbsp; SPEED <b>'+Math.round(speed*3.6)+' km/h</b><br>DISTANCE <b>'+Math.round(distance)+'m</b> &nbsp; HEADING <b>'+card+'</b>'+(photorealistic?' &nbsp; <b>PHOTOREALISTIC</b>':'');
}
async function loadWorld(){
  const t=ion.value.trim(),g=google.value.trim();
  if(!t){status.textContent='Paste a Cesium ion access token first.';return}
  localStorage.setItem('cg-ion',t);if(g)localStorage.setItem('cg-google',g);
  load.disabled=true;load.textContent='LOADING…';status.textContent='Streaming real Sydney 3D data…';msg.style.display='block';msg.innerHTML='<b>Loading Sydney…</b><br>Building geometry will stream in around the camera.';
  try{
    Cesium.Ion.defaultAccessToken=t;viewer.scene.primitives.removeAll();if(glider)viewer.entities.remove(glider);
    if(g){
      Cesium.GoogleMaps.defaultApiKey=g;
      try{tileset=await Cesium.createGooglePhotorealistic3DTileset();viewer.scene.primitives.add(tileset);photorealistic=true}
      catch(e){console.warn(e);tileset=await Cesium.createOsmBuildingsAsync({showOutline:false});viewer.scene.primitives.add(tileset);photorealistic=false}
    }else{tileset=await Cesium.createOsmBuildingsAsync({showOutline:false});viewer.scene.primitives.add(tileset);photorealistic=false}
    ready=true;panel.style.display='none';addGlider();reset();
    viewer.camera.flyTo({destination:world.clone(),orientation:{heading:0,pitch:Cesium.Math.toRadians(-12),roll:0},duration:2,complete:()=>{started=true;msg.style.display='none';last=performance.now()}});
    status.textContent=photorealistic?'Google Photorealistic 3D active':'Cesium OSM Buildings active';
  }catch(e){console.error(e);status.textContent='World load failed. Check the Cesium token/API key.';load.disabled=false;load.textContent='LOAD REAL SYDNEY'}
}
load.onclick=loadWorld;

function frame(now:number){
  requestAnimationFrame(frame);const dt=Math.min((now-last)/1000,.033);last=now;
  if(started&&ready){fly(dt);camera();if(local.z<=2)crash();hudUpdate();drawMap()}
  if(!started&&ready&&keys.has('Space')){reset();started=true;msg.style.display='none'}
}
viewer.camera.setView({destination:Cesium.Cartesian3.fromDegrees(SYDNEY.lon,SYDNEY.lat,12000),orientation:{heading:0,pitch:Cesium.Math.toRadians(-75),roll:0}});
requestAnimationFrame(frame);
