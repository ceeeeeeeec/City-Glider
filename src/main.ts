import * as THREE from 'three';

const status = document.createElement('div');
status.style.cssText = 'position:fixed;top:20px;left:50%;transform:translateX(-50%);z-index:10;background:#111;color:#fff;padding:16px 22px;border-radius:12px;font:16px system-ui;text-align:center';
document.body.appendChild(status);

try {
  const renderer = new THREE.WebGLRenderer({ antialias: false });
  renderer.setSize(innerWidth, innerHeight);
  renderer.setPixelRatio(1);
  document.body.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x102040);

  const camera = new THREE.PerspectiveCamera(60, innerWidth / innerHeight, 0.1, 100);
  camera.position.z = 5;

  const geometry = new THREE.BoxGeometry(2, 2, 2);
  const material = new THREE.MeshBasicMaterial({ color: 0xff0000 });
  const cube = new THREE.Mesh(geometry, material);
  scene.add(cube);

  status.innerHTML = '<strong>THREE.JS: WORKING</strong><br><small>Renderer created and scene rendered.</small>';

  addEventListener('resize', () => {
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(innerWidth, innerHeight);
  });

  function animate() {
    requestAnimationFrame(animate);
    cube.rotation.x += 0.01;
    cube.rotation.y += 0.015;
    renderer.render(scene, camera);
  }

  animate();
} catch (error) {
  status.innerHTML = '<strong>THREE.JS: FAILED</strong><br><small>' + String(error) + '</small>';
}
