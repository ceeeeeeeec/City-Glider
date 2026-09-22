import { defineConfig } from 'vite';
import { cpSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

function cesiumAssets() {
  return {
    name: 'city-glider-cesium-assets',
    buildStart() {
      const source = resolve('node_modules/cesium/Build/Cesium');
      const target = resolve('public/cesium');
      mkdirSync(target, { recursive: true });
      for (const folder of ['Workers', 'ThirdParty', 'Assets', 'Widgets']) {
        cpSync(resolve(source, folder), resolve(target, folder), { recursive: true });
      }
    },
  };
}

export default defineConfig({
  base: './',
  plugins: [cesiumAssets()],
});
