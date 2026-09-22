# City Glider — Prototype Plan

## Vertical slice
Sydney only, centered on the Sydney CBD. The first test should establish whether the core loop feels good before adding progression systems.

### Core loop
1. Spawn high above Sydney.
2. Enter a controlled glide.
3. Steer with a virtual control pad.
4. Maintain momentum and manage descent.
5. Collect coins along a route.
6. Avoid buildings and terrain.
7. Finish when landing safely or crashing.

### Simulation
The flight model will be deterministic and independent of rendering/map code:
- velocity vector
- gravity
- lift/glide force
- drag
- steering input
- optional boost/jet fuel
- collision/end-state handling

### Rendering
The city should be visually convincing at gliding distance without attempting photorealism:
- simple building volumes
- stronger landmark silhouettes
- aggressive level-of-detail and distance culling
- streamed/partitioned city data
- minimal textures
- no dependency on a giant local city mesh

## Data strategy
OpenStreetMap is a strong baseline because building footprints and some height/3D attributes can be used to reconstruct lightweight geometry. OSM data is distributed under the Open Database License (ODbL), with attribution/share-alike obligations for the database as applicable.

Cesium OSM Buildings is another useful prototype/reference source: Cesium provides a global 3D Tiles layer derived from OSM and updated quarterly. Its use is subject to Cesium ion and third-party content terms, so it should not automatically be treated as the final mobile-game data source.

For a commercial mobile release, we should prefer a deliberately licensed/baked dataset and document provenance for every city.

## Future cities
- Sydney
- Melbourne
- New York City
- Hong Kong
- Madrid
- Milan
- Ljubljana

## Later systems
- missions
- achievements
- leaderboards
- timed coin multipliers
- coin magnet
- extra jet fuel
- radar/sonar secret scanning
- landmark collectible cards
- additional cities
