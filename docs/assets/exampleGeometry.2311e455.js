import { V as Viewer, ak as SphereGeometry, al as IcosahedronGeometry, am as OctahedronGeometry, an as TetrahedronGeometry, ao as PlaneGeometry, ap as BoxGeometry, aq as CircleGeometry, ar as RingGeometry, as as CylinderGeometry, at as ConeGeometry, au as TorusGeometry, av as TorusKnotGeometry, w as MeshStandardMaterial, C as Color, E as Mesh } from "./compressors.5793b060.js";
async function runExample() {
  const viewer = new Viewer();
  const geometries = [
    new SphereGeometry(75, 20, 10),
    new IcosahedronGeometry(75, 1),
    new OctahedronGeometry(75, 2),
    new TetrahedronGeometry(75, 0),
    new PlaneGeometry(100, 100, 4, 4),
    new BoxGeometry(100, 100, 100, 4, 4, 4),
    new CircleGeometry(50, 20, 0, Math.PI * 2),
    new RingGeometry(10, 50, 20, 5, 0, Math.PI * 2),
    new CylinderGeometry(50, 50, 100, 20),
    new ConeGeometry(50, 100, 20),
    new TorusGeometry(50, 15, 16, 100),
    new TorusKnotGeometry(50, 15, 100, 16)
  ];
  const materials = geometries.map(
    (_, i) => new MeshStandardMaterial({
      color: new Color(`hsl(${(i * 360 / geometries.length).toFixed(0)}, 60%, 50%)`),
      roughness: 0.2 + 0.6 * Math.random(),
      metalness: 0.1 + 0.8 * Math.random()
    })
  );
  const spacing = 200;
  const numRows = geometries.length / 3;
  const numCols = geometries.length / numRows;
  const x0 = -numRows * spacing / 2;
  const y0 = -numCols * spacing / 2;
  for (let i = 0; i < geometries.length; i++) {
    const geom = geometries[i];
    const mat = materials[i];
    const mesh = new Mesh(geom, mat);
    const row = i / numRows;
    const col = i % numRows;
    const x = x0 + col * spacing;
    const y = y0 + row * spacing;
    mesh.rotation.y = Math.PI;
    mesh.position.set(x, 0, y);
    viewer.add(mesh);
  }
}
runExample();
//# sourceMappingURL=exampleGeometry.2311e455.js.map
