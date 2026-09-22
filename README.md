# City Glider

City Glider is a browser-first 3D base-jumping/gliding game set initially in Sydney, Australia.

## Prototype goal
The first playable vertical slice is a single Sydney gliding run:
- Third-person glider control
- Start high above central Sydney
- Momentum-based flight
- Lightweight procedural/streamed city representation
- Coin route
- Basic crash/landing end states
- Mobile-friendly controls

## Geospatial approach
The prototype is designed around lightweight geospatial data rather than photorealistic city meshes. The architecture keeps the flight simulation independent from the map provider so the city data can be replaced or baked for future mobile builds.

Candidate sources include OpenStreetMap-derived building footprints/heights and other appropriately licensed/open government geospatial datasets. Commercial/global 3D services may be used during prototyping only where their terms permit the intended use.

## Development
The initial prototype is browser-first. See docs/PROTOTYPE.md for the current architecture and data-source plan.
