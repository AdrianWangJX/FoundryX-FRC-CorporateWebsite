import * as THREE from 'three';
import { createCampusTextures } from './textures.js';
import { CAMPUS_PLAN as P, planX, planZ } from './plan-metrics.js';

/**
 * Architectural study built from the supplied 24.575 × 20.645 m plan.
 * This is a proposed spatial model, not a measured scan or an as-built claim.
 * X goes right in the plan, Z goes down, Y is height. The footprint is centred.
 */
export function createCampusModel() {
  const group = new THREE.Group();
  group.name = 'FoundryX campus · spatial study';
  const level2 = new THREE.Group();
  level2.name = 'Second floor · classroom / meeting / office';
  level2.position.y = P.displayAssumptions.floor2Elevation;
  group.add(level2);
  let activeGroup = group;
  const textures = createCampusTextures();
  const materials = [];
  const material = (name, color, options = {}) => {
    const m = new THREE.MeshStandardMaterial({
      color, roughness: 0.75, metalness: 0.05, ...options,
    });
    m.name = name;
    m.userData.baseOpacity = m.opacity;
    m.userData.baseTransparent = m.transparent;
    materials.push(m);
    return m;
  };
  const M = {
    slab: material('Concrete · section edge', '#aaa69e', { roughness: 0.96 }),
    floor: material('Polished industrial concrete', '#b9b4a9', {
      map: textures.concrete, bumpMap: textures.concrete, bumpScale: 0.017, roughness: 0.91,
    }),
    plaster: material('Warm white plaster', '#e2ddd1', { roughness: 0.9 }),
    gypsum: material('Opaque painted gypsum partition', '#e7e3db', { roughness: 0.96, metalness: 0 }),
    pale: material('Cabinet · off white', '#dedbd3'),
    charcoal: material('Powder-coated charcoal steel', '#262c2e', { roughness: 0.59, metalness: 0.52 }),
    black: material('Black equipment polymer', '#161c1e', { roughness: 0.84 }),
    silver: material('Brushed aluminium', '#9ea7a7', { roughness: 0.34, metalness: 0.82 }),
    steel: material('Machined steel', '#657174', { roughness: 0.4, metalness: 0.75 }),
    oak: material('Natural oak cabinetry', '#d1af77', { map: textures.oak, roughness: 0.73, metalness: 0 }),
    carpet: material('Dark grey practice carpet', '#4a5052', {
      map: textures.carpet, bumpMap: textures.carpet, bumpScale: 0.022, roughness: 1, metalness: 0,
    }),
    fabric: material('Graphite upholstery', '#626663', { roughness: 1, metalness: 0 }),
    gold: material('Brass details', '#b7a06c', { roughness: 0.4, metalness: 0.62 }),
    blue: material('Practice robot bumper · blue', '#344f6a', { roughness: 0.9 }),
    red: material('Practice robot bumper · red', '#794a40', { roughness: 0.9 }),
    ball: material('Practice game piece · yellow', '#ceb46a', { roughness: 0.82, metalness: 0 }),
    line: material('White field tape', '#d1d2c9', { roughness: 0.96 }),
    glass: material('Low-iron glass', '#b8d0cf', {
      transparent: true, opacity: 0.14, roughness: 0.22, metalness: 0.12,
      depthWrite: false, side: THREE.DoubleSide,
    }),
    screen: material('Standby monitor glass', '#193d45', { emissive: '#124047', emissiveIntensity: 0.22, roughness: 0.25 }),
    light: material('Linear light diffuser', '#fff8e1', { emissive: '#fff5d7', emissiveIntensity: 1.6, roughness: 0.4 }),
    led: material('Machine status lamp', '#88a99d', { emissive: '#73bba2', emissiveIntensity: 0.65 }),
  };

  const geometries = {
    box: new THREE.BoxGeometry(1, 1, 1),
    cylinder: new THREE.CylinderGeometry(1, 1, 1, 12),
    sphere: new THREE.SphereGeometry(1, 14, 10),
    wheel: new THREE.CylinderGeometry(1, 1, 1, 16),
  };
  const batches = new Map();
  const transform = new THREE.Object3D();
  const yAxis = new THREE.Vector3(0, 1, 0);
  const box = (x, y, z, w, h, d, mat, rotation = 0) => instance('box', x, y, z, w, h, d, mat, 0, rotation, 0);
  function instance(kind, x, y, z, sx, sy, sz, mat, rx = 0, ry = 0, rz = 0) {
    const key = `${activeGroup.id}:${kind}:${mat.name}`;
    if (!batches.has(key)) batches.set(key, { kind, mat, matrices: [], parent: activeGroup });
    transform.position.set(x, y, z);
    transform.rotation.set(rx, ry, rz);
    transform.scale.set(sx, sy, sz);
    transform.updateMatrix();
    batches.get(key).matrices.push(transform.matrix.clone());
  }
  const rod = (a, b, radius, mat = M.silver) => {
    const va = new THREE.Vector3(...a);
    const vb = new THREE.Vector3(...b);
    const delta = vb.clone().sub(va);
    const key = `${activeGroup.id}:cylinder:${mat.name}`;
    if (!batches.has(key)) batches.set(key, { kind: 'cylinder', mat, matrices: [], parent: activeGroup });
    transform.position.copy(va.add(vb).multiplyScalar(0.5));
    transform.quaternion.setFromUnitVectors(yAxis, delta.clone().normalize());
    transform.scale.set(radius, delta.length(), radius);
    transform.updateMatrix();
    batches.get(key).matrices.push(transform.matrix.clone());
  };
  const sphere = (x, y, z, r, mat) => instance('sphere', x, y, z, r, r, r, mat);
  const architecturalMeshes = [];
  function solidBox(name, x, y, z, w, h, d, mat) {
    const mesh = new THREE.Mesh(geometries.box, mat);
    mesh.name = name;
    mesh.position.set(x, y, z);
    mesh.scale.set(w, h, d);
    mesh.castShadow = mesh.receiveShadow = true;
    mesh.userData.architecture = true;
    activeGroup.add(mesh);
    architecturalMeshes.push(mesh);
    return mesh;
  }

  // The model follows the dimension control lines. Wall-face offsets and
  // the 25 mm north/south control-line difference are retained separately.
  const W = P.width, D = P.depth;
  const X0 = -W / 2, X1 = W / 2, Z0 = -D / 2, Z1 = D / 2;
  const XE = X0 + P.mainWidth;
  const northEastControl = 9.890 + 10.605;
  const XNE = planX(northEastControl);
  // The drawing uses u=20.495 at the north return and u=20.520 on the
  // south chain. Their 25 mm offset is reconciled within the 200 mm
  // structural band; the image does not establish an as-built wall jog.
  const footprint = [
    [X0, Z0], [X1, Z0], [X1, Z0 + 2.41], [XNE, Z0 + 2.41],
    [XNE, planZ(P.hallSouth)], [XE, planZ(P.southRoomsNorth)],
    [XE, Z1], [X0, Z1],
  ];
  const shape = new THREE.Shape();
  footprint.forEach(([x, z], i) => i ? shape.lineTo(x, -z) : shape.moveTo(x, -z));
  shape.closePath();
  const slabGeo = new THREE.ExtrudeGeometry(shape, { depth: 0.26, bevelEnabled: false });
  slabGeo.rotateX(-Math.PI / 2);
  const slab = new THREE.Mesh(slabGeo, M.slab);
  slab.position.y = -0.29;
  slab.name = '24.575 × 20.645 m · plan footprint';
  slab.receiveShadow = true;
  slab.userData.architecture = true;
  architecturalMeshes.push(slab);
  group.add(slab);
  const topGeo = new THREE.ShapeGeometry(shape);
  topGeo.rotateX(-Math.PI / 2);
  const floor = new THREE.Mesh(topGeo, M.floor);
  floor.position.y = -0.018;
  floor.name = 'Concrete floor';
  floor.receiveShadow = true;
  group.add(floor);

  // Cutaway architecture: north and west read as the built shell; south
  // and east are sectioned low so the plan and equipment remain visible.
  solidBox('North wall · double-height hall', 0, 3.12, Z0 + 0.07, W, 6.24, 0.14, M.plaster);
  solidBox('West wall · low cutaway', X0 + 0.07, 0.56, 0, 0.14, 1.12, D, M.plaster);
  solidBox('East hall section edge · north control', XNE - 0.07, 0.11, planZ((2.410+P.hallSouth)/2), 0.14, 0.22, P.hallSouth-2.410, M.plaster);
  solidBox('East workshop section edge · south control', XE - 0.07, 0.11, planZ((P.southRoomsNorth+D)/2), 0.14, 0.22, D-P.southRoomsNorth, M.plaster);
  solidBox('East structural band · control-line reconciliation', (XNE+XE)/2-0.07, 0.11, planZ((P.hallSouth+P.southRoomsNorth)/2), 0.165, 0.22, P.southRoomsNorth-P.hallSouth, M.plaster);
  solidBox('South section edge', (X0 + XE) / 2, 0.11, Z1 - 0.07, P.mainWidth, 0.22, 0.14, M.plaster);
  solidBox('North-east return · double height', X1 - 0.07, 3.12, Z0 + 1.205, 0.14, 6.24, 2.41, M.plaster);
  solidBox('North-east bay sill · 4.080 m control span', (XNE + X1) / 2, 0.45, Z0 + 2.41, W-northEastControl, 0.9, 0.14, M.plaster);
  // Exposed steel skeleton and warm suspended industrial strips.
  const columnPoints = [[X0 + 0.28, Z0 + 0.27], [XE - 0.26, Z0 + 0.27], [X0 + 0.28, 1.23], [XE - 0.26, 1.23], [XE - 0.26, Z1 - 0.32]];
  for (const [x, z] of columnPoints) {
    box(x, 3.16, z, 0.18, 6.32, 0.18, M.charcoal);
    box(x, 0.035, z, 0.36, 0.055, 0.36, M.steel);
    box(x, 6.24, z, 0.3, 0.2, 0.3, M.charcoal);
  }
  box(-2.01, 6.25, Z0 + 0.27, 20.26, 0.25, 0.16, M.charcoal);
  box(X0 + 0.28, 6.25, -4.53, 0.17, 0.25, 11.89, M.charcoal);
  box(XE - 0.26, 6.25, -4.53, 0.17, 0.25, 11.89, M.charcoal);
  for (const z of [-7.35, -3.65]) {
    // Wires and luminaires leave the full roof open to the cutaway view.
    rod([-8.2, 6.23, z], [-8.2, 5.62, z], 0.011, M.charcoal);
    rod([3.7, 6.23, z], [3.7, 5.62, z], 0.011, M.charcoal);
    box(-2.25, 5.63, z, 12.25, 0.085, 0.085, M.charcoal);
    box(-2.25, 5.58, z, 12.1, 0.025, 0.06, M.light);
  }
  // Air-handling duct along the rear wall, plus its hangers.
  box(-2.1, 5.48, -9.85, 18.7, 0.34, 0.48, M.silver);
  for (let x = -10; x < 7; x += 2.25) {
    box(x, 5.47, -9.85, 0.025, 0.39, 0.54, M.steel);
    rod([x, 5.68, -9.85], [x, 6.23, -9.85], 0.012, M.charcoal);
  }

  // Practice field: dimensions and position derive from the supplied plan.
  const field = { x:planX(P.field.west+P.field.width/2), z:planZ(P.field.north+P.field.depth/2), w:P.field.width, d:P.field.depth };
  solidBox('FRC practice carpet · 15.801 × 7.9 m', field.x, 0.018, field.z, field.w, 0.06, field.d, M.carpet);
  const fx0 = field.x - field.w / 2, fx1 = field.x + field.w / 2;
  const fz0 = field.z - field.d / 2, fz1 = field.z + field.d / 2;
  // Fine aluminium profiles and translucent polycarbonate perimeter.
  function railing(x0, z0, x1, z1, gaps = []) {
    const length = Math.hypot(x1 - x0, z1 - z0);
    const count = Math.ceil(length / 1.34);
    for (let i = 0; i < count; i++) {
      if (gaps.includes(i)) continue;
      const a = i / count, b = (i + 1) / count;
      const ax = x0 + (x1 - x0) * a, az = z0 + (z1 - z0) * a;
      const bx = x0 + (x1 - x0) * b, bz = z0 + (z1 - z0) * b;
      rod([ax, 0.07, az], [ax, 0.64, az], 0.025);
      rod([bx, 0.07, bz], [bx, 0.64, bz], 0.025);
      rod([ax, 0.1, az], [bx, 0.1, bz], 0.021);
      rod([ax, 0.62, az], [bx, 0.62, bz], 0.026);
      const segmentLength = Math.hypot(bx - ax, bz - az);
      box((ax + bx) / 2, 0.34, (az + bz) / 2, segmentLength - 0.05, 0.47, 0.008, M.glass, -Math.atan2(bz - az, bx - ax));
      box(ax, 0.055, az, 0.14, 0.05, 0.18, M.steel);
    }
  }
  railing(fx0, fz0, fx1, fz0);
  railing(fx0, fz1, fx1, fz1, [8]);
  railing(fx0, fz0, fx0, fz1);
  railing(fx1, fz0, fx1, fz1, [5]);
  for (const x of [fx0 + 3.18, fx1 - 3.18]) box(x, 0.053, field.z, 0.035, 0.008, field.d - 0.12, M.line);
  box(field.x, 0.054, field.z, 0.028, 0.008, field.d - 0.12, M.line);
  box(field.x - 5.5, 0.058, fz1 - 0.75, 3.0, 0.01, 0.035, M.red);
  box(field.x + 5.5, 0.058, fz0 + 0.75, 3.0, 0.01, 0.035, M.blue);

  // Open training truss; structural diagonals are visible at normal view scale.
  const truss = { x: -2.15, z: -5.12, w: 3.0, d: 1.28, h: 2.22 };
  for (const x of [truss.x - truss.w / 2, truss.x + truss.w / 2]) {
    for (const z of [truss.z - truss.d / 2, truss.z + truss.d / 2]) {
      box(x, 0.09, z, 0.52, 0.065, 0.46, M.steel);
      rod([x, 0.12, z], [x, truss.h, z], 0.045);
      for (let k = 0; k < 4; k++) {
        const y = 0.2 + k * 0.48;
        rod([x - 0.09, y, z], [x + 0.09, y + 0.46, z], 0.014);
      }
    }
    rod([x, truss.h, truss.z - truss.d / 2], [x, truss.h, truss.z + truss.d / 2], 0.055);
  }
  for (const z of [truss.z - truss.d / 2, truss.z + truss.d / 2]) {
    rod([truss.x - truss.w / 2, truss.h, z], [truss.x + truss.w / 2, truss.h, z], 0.055);
    rod([truss.x - truss.w / 2, truss.h - 0.26, z], [truss.x + truss.w / 2, truss.h - 0.26, z], 0.03);
    for (let i = 0; i < 6; i++) {
      rod([truss.x - 1.5 + i * 0.5, truss.h, z], [truss.x - 1.25 + i * 0.5, truss.h - 0.26, z], 0.018);
      rod([truss.x - 1.25 + i * 0.5, truss.h - 0.26, z], [truss.x - 1 + i * 0.5, truss.h, z], 0.018);
    }
  }

  function robot(x, z, yaw, bumperMaterial = M.blue) {
    // Rotate each small component around a local robot coordinate system.
    const part = (lx, y, lz, w, h, d, mat) => {
      const xx = x + Math.cos(yaw) * lx + Math.sin(yaw) * lz;
      const zz = z - Math.sin(yaw) * lx + Math.cos(yaw) * lz;
      box(xx, y, zz, w, h, d, mat, yaw);
    };
    const point = (lx, y, lz) => [x + Math.cos(yaw) * lx + Math.sin(yaw) * lz, y, z - Math.sin(yaw) * lx + Math.cos(yaw) * lz];
    part(0, 0.18, 0, 0.93, 0.25, 0.98, bumperMaterial);
    part(0, 0.29, 0, 0.72, 0.08, 0.78, M.silver);
    part(0, 0.36, 0, 0.58, 0.07, 0.68, M.black);
    for (const dx of [-0.3, 0.3]) {
      for (const dz of [-0.32, 0, 0.32]) {
        const p = point(dx, 0.16, dz);
        instance('wheel', p[0], p[1], p[2], 0.105, 0.08, 0.105, M.black, 0, 0, Math.PI / 2);
      }
      rod(point(dx, 0.34, -0.31), point(dx, 1.05, 0.15), 0.027);
      rod(point(dx, 0.34, 0.3), point(dx, 1.05, 0.15), 0.027);
      rod(point(dx, 0.4, -0.29), point(dx, 0.93, -0.2), 0.02);
    }
    for (const y of [0.5, 0.64, 0.78, 0.92]) rod(point(-0.32, y, 0.24), point(0.32, y, 0.24), 0.065, M.black);
    part(0, 0.48, -0.18, 0.48, 0.045, 0.22, M.pale);
    part(0.13, 0.52, -0.21, 0.19, 0.09, 0.17, M.charcoal);
    part(-0.1, 0.53, -0.23, 0.03, 0.03, 0.03, M.led);
    rod(point(-0.28, 1.05, 0.15), point(0.28, 1.05, 0.15), 0.027);
  }
  robot(-6.98, -3.02, 0.5, M.blue);
  robot(1.28, -6.49, -0.67, M.red);
  robot(-0.23, -1.72, -0.14, M.blue);
  for (const [x, z] of [[-5.5,-6.2],[-5.22,-6.01],[-0.8,-6.4],[1.8,-2.7],[2.04,-2.64],[2.23,-2.9],[-7.7,-4.4]]) sphere(x, 0.18, z, 0.122, M.ball);

  // Furniture is made from legs, seats, handles and frames rather than
  // single coloured blocks. Repeated components are instanced below.
  function chair(x, z, yaw = 0, upholstered = false) {
    const rotate = (lx, y, lz, w, h, d, mat) => {
      box(x + Math.cos(yaw) * lx + Math.sin(yaw) * lz, y,
        z - Math.sin(yaw) * lx + Math.cos(yaw) * lz, w, h, d, mat, yaw);
    };
    rotate(0, 0.47, 0, 0.46, 0.07, 0.43, upholstered ? M.fabric : M.black);
    rotate(0, 0.75, 0.2, 0.45, 0.49, 0.055, upholstered ? M.fabric : M.black);
    for (const dx of [-0.17, 0.17]) for (const dz of [-0.14, 0.14]) rotate(dx, 0.23, dz, 0.026, 0.43, 0.026, M.charcoal);
    rotate(0, 0.54, 0.21, 0.33, 0.03, 0.04, M.steel);
  }
  function worktable(x, z, w = 2.2, d = 0.86, withCabinet = false) {
    box(x, 0.84, z, w, 0.08, d, M.oak);
    for (const dx of [-w / 2 + 0.09, w / 2 - 0.09]) {
      for (const dz of [-d / 2 + 0.09, d / 2 - 0.09]) box(x + dx, 0.42, z + dz, 0.045, 0.82, 0.045, M.charcoal);
      box(x + dx, 0.2, z, 0.035, 0.035, d - 0.11, M.charcoal);
    }
    box(x, 0.19, z + d / 2 - 0.1, w - 0.15, 0.035, 0.035, M.charcoal);
    if (withCabinet) {
      box(x + w / 2 - 0.38, 0.41, z, 0.57, 0.76, d - 0.11, M.pale);
      for (let i = 0; i < 4; i++) {
        box(x + w / 2 - 0.38, 0.15 + i * 0.175, z + d / 2 - 0.048, 0.55, 0.008, 0.012, M.steel);
        box(x + w / 2 - 0.38, 0.22 + i * 0.175, z + d / 2 - 0.025, 0.18, 0.022, 0.04, M.charcoal);
      }
    }
  }
  function monitor(x, z, yaw = 0) {
    box(x, 0.9, z, 0.28, 0.026, 0.18, M.charcoal, yaw);
    box(x, 1.03, z, 0.025, 0.26, 0.027, M.charcoal);
    box(x, 1.24, z, 0.58, 0.34, 0.04, M.black, yaw);
    box(x + Math.sin(yaw) * 0.023, 1.24, z + Math.cos(yaw) * 0.023, 0.53, 0.29, 0.01, M.screen, yaw);
  }
  function shelf(x, z, w = 1.7, d = 0.53, levelCount = 4, h = 2.05, direction = 0) {
    const local = (lx, y, lz, ww, hh, dd, mat) => box(x + Math.cos(direction) * lx + Math.sin(direction) * lz,
      y, z - Math.sin(direction) * lx + Math.cos(direction) * lz, ww, hh, dd, mat, direction);
    for (const dx of [-w / 2, w / 2]) for (const dz of [-d / 2, d / 2]) local(dx, h / 2, dz, 0.04, h, 0.04, M.charcoal);
    for (let j = 0; j < levelCount; j++) {
      const y = 0.12 + j * (h - 0.21) / (levelCount - 1);
      local(0, y, 0, w, 0.035, d, M.oak);
      if (j < levelCount - 1) {
        const n = j % 2 ? 2 : 3;
        for (let k = 0; k < n; k++) {
          const cx = -w / 2 + (k + 0.5) * w / n;
          local(cx, y + 0.16, 0, w / n - 0.15, 0.27, d * 0.8, j === 1 ? M.pale : M.steel);
          local(cx, y + 0.18, d * 0.42, 0.09, 0.014, 0.02, M.charcoal);
        }
      }
    }
    // Cross braces sit behind the objects, visible through the open frame.
    const point = (lx, yy, lz) => [x + Math.cos(direction) * lx + Math.sin(direction) * lz, yy, z - Math.sin(direction) * lx + Math.cos(direction) * lz];
    rod(point(-w / 2, 0.15, -d / 2), point(w / 2, h - 0.1, -d / 2), 0.012, M.steel);
    rod(point(w / 2, 0.15, -d / 2), point(-w / 2, h - 0.1, -d / 2), 0.012, M.steel);
  }

  // Nine seats follow the north strip. Furniture offsets, heights and
  // finishes are scaled/visual estimates rather than measured annotations.
  for (let i = 0; i < 9; i++) chair(planX(10.39+i*.63), planZ(.72), Math.PI, true);
  worktable(7.19, -9.25, 1.35, 0.68);
  chair(7.19, -8.7);
  box(10.5, 0.44, -9.18, 1.32, 0.86, 0.59, M.oak);
  box(10.5, 0.9, -9.18, 1.39, 0.07, 0.64, M.pale);
  box(10.1, 1.08, -9.2, 0.25, 0.35, 0.29, M.charcoal);
  rod([10.97, 0.94, -9.23], [10.97, 1.18, -9.23], 0.015, M.steel);
  rod([10.97, 1.18, -9.23], [10.81, 1.18, -9.23], 0.015, M.steel);

  // Reusable glass construction; room boundaries come from the drawings,
  // while this finish follows the supplied architectural references.
  function glassPartition(x0, z0, x1, z1, height = 2.55, opening = false) {
    const length = Math.hypot(x1 - x0, z1 - z0);
    const count = Math.max(1, Math.ceil(length / 1.08));
    const yaw = -Math.atan2(z1 - z0, x1 - x0);
    for (let i = 0; i < count; i++) {
      if (opening && i === count - 1) continue;
      const a = i / count, b = (i + 1) / count;
      const ax = x0 + (x1 - x0) * a, az = z0 + (z1 - z0) * a;
      const bx = x0 + (x1 - x0) * b, bz = z0 + (z1 - z0) * b;
      box((ax + bx) / 2, height / 2, (az + bz) / 2, length / count - 0.04, height - 0.08, 0.012, M.glass, yaw);
      box(ax, height / 2, az, 0.044, height, 0.044, M.charcoal);
      box(bx, height / 2, bz, 0.044, height, 0.044, M.charcoal);
      for (const y of [0.04, 0.98, height]) box((ax + bx) / 2, y, (az + bz) / 2, length / count, 0.04, 0.042, M.charcoal, yaw);
    }
  }
  function gypsumPartition(name, x0, z0, x1, z1, height = 2.57, openingAtStart = false) {
    const length = Math.hypot(x1-x0,z1-z0);
    // Retain a clear doorway, with the office opening on its front aisle
    // instead of behind its workstations. No glazing or mullions remain.
    const doorWidth = length/Math.ceil(length/1.08), wallLength = length-doorWidth;
    const ux=(x1-x0)/length,uz=(z1-z0)/length,yaw=-Math.atan2(uz,ux);
    const wallCenter=(openingAtStart?doorWidth:0)+wallLength/2;
    const doorCenter=openingAtStart?doorWidth/2:length-doorWidth/2;
    const wall=solidBox(name,x0+ux*wallCenter,height/2,z0+uz*wallCenter,wallLength,height,.12,M.gypsum);
    wall.rotation.y=yaw;
    const lintel=solidBox(`${name} · door lintel`,x0+ux*doorCenter,(2.15+height)/2,z0+uz*doorCenter,doorWidth,height-2.15,.12,M.gypsum);
    lintel.rotation.y=yaw;
  }
  // The unlabelled western room is 2.875 m wide. Its u origin is a
  // scaled trace aligned with the upper room, not a new exact dimension.
  const smallRoom = { west:P.meeting.west, width:2.875, north:P.southRoomsNorth, south:P.southRoomsSouth };
  const smallWest=planX(smallRoom.west), smallEast=planX(smallRoom.west+smallRoom.width);
  const smallNorth=planZ(smallRoom.north), smallSouth=planZ(smallRoom.south);
  solidBox('1F small room · 2.875 m clear plan span', (smallWest+smallEast)/2,.51,smallNorth,smallRoom.width,1.02,.11,M.plaster);
  solidBox('1F small room · west cutaway', smallWest,.51,(smallNorth+smallSouth)/2,.11,1.02,smallRoom.south-smallRoom.north,M.plaster);
  glassPartition(smallEast,smallNorth,smallEast,smallSouth);
  glassPartition(smallWest,smallSouth,smallEast,smallSouth,2.55,true);

  // The adjacent six-place table is OPEN to the exchange/workshop area.
  // Its overall 1.8 m occupied span is read from the plan; table/chair
  // separation and its centre are scaled estimates from the raster.
  const openExchange={u:6.85,v:13.35};
  worktable(planX(openExchange.u),planZ(openExchange.v),.84,1.8);
  for (const v of [12.65,13.35,14.05]) {
    chair(planX(openExchange.u-.70),planZ(v),-Math.PI/2);
    chair(planX(openExchange.u+.70),planZ(v),Math.PI/2);
  }
  shelf(planX(5.16),planZ((P.southRoomsNorth+P.southRoomsSouth)/2),2.55,.44,4,1.85,Math.PI/2);

  // Three parallel southwest shelf rows, without an invented solid wall.
  // Row depths and centres are scaled estimates; the 1.740 m aisle and
  // 2.140 m southern transverse shelf are explicitly dimensioned.
  const storageNorth=P.southRoomsSouth+1.20;
  const storageRows=[
    {u:.34,depth:.60,south:P.classroomNotchNorth},
    {u:1.83,depth:.86,south:P.classroomNotchNorth},
    {u:2.260+1.740+.44,depth:.88,south:19.80},
  ];
  for (const row of storageRows) {
    const segmentLength=(row.south-storageNorth)/3;
    for(let i=0;i<3;i++) shelf(planX(row.u),planZ(storageNorth+(i+.5)*segmentLength),segmentLength-.025,row.depth,4,1.95,Math.PI/2);
  }
  shelf(planX(2.260+2.140/2),planZ(P.depth-.36),2.140,.60,4,1.90);

  // Two joined-table clusters, each with 4 + 4 + 2 seats. The 0.700 m
  // tabletop depth is annotated; 2.40 m width and centres are scaled estimates.
  const exchange={u:7.50,centres:[16.80,19.05],width:2.40,depth:.700};
  for (const v of exchange.centres) {
    const x=planX(exchange.u),z=planZ(v);
    worktable(x-exchange.width/4,z,exchange.width/2-.008,exchange.depth);
    worktable(x+exchange.width/4,z,exchange.width/2-.008,exchange.depth);
    for (const offset of [-.9,-.3,.3,.9]) {
      // Keep the chair beside the south stair entrance tucked under the table.
      const besideEntry=v===exchange.centres[0]&&offset===.9;
      chair(x+offset-(besideEntry?.08:0),z-(besideEntry?.30:.70),Math.PI);
      chair(x+offset,z+.70);
    }
    chair(x-exchange.width/2-.38,z,-Math.PI/2);
    chair(x+exchange.width/2+.38,z,Math.PI/2);
    box(x,.897,z,.58,.017,.39,M.pale);
    box(x-.68,.9,z+.06,.25,.02,.32,M.charcoal);
    box(x+.76,.9,z-.03,.23,.035,.27,M.gold);
  }

  // The user removed the entire north tool bench, pegboard and equipment.
  // The south 2.133 / 3.388 m segments remain. Their final length closes
  // against the eastern rack; its width is derived, not a source annotation.
  // The updated entrance detail supersedes the old 2.670 m clear strip:
  // 0.600 m storage + 0.400 m display + 2.270 m clear entrance aisle.
  const displayWidth=2.270,displayRackDepth=.400,storageRackDepth=.600;
  const eastRackRight=northEastControl-displayWidth-displayRackDepth;
  const southTool={west:9.90,east:eastRackRight,north:P.depth-.720,depth:.720};
  const southToolZ=planZ(southTool.north+southTool.depth/2);
  let southCursor=southTool.west;
  for (const width of [2.133,3.388,southTool.east-southTool.west-2.133-3.388]) {
    worktable(planX(southCursor+width/2),southToolZ,width-.012,southTool.depth,true);
    southCursor+=width;
  }
  // The central mobile build table and loose equipment remain illustrative.
  worktable(1.23, 6.0, 2.52, 1.26, true);
  // Tabletop engineering parts and a partially assembled drivetrain.
  box(1.02, 0.97, 5.95, 0.8, 0.11, 0.73, M.silver);
  box(1.02, 1.02, 5.95, 0.58, 0.045, 0.55, M.black);
  for (const xx of [0.68, 1.36]) for (const zz of [5.73, 6.15]) instance('wheel', xx, 0.97, zz, 0.095, 0.065, 0.095, M.black, 0, 0, Math.PI / 2);
  box(1.99, 0.936, 6.22, 0.27, 0.025, 0.2, M.gold);
  box(0.29, 0.944, 5.8, 0.19, 0.06, 0.35, M.blue);
  // Pillar drill.
  box(2.26, 0.922, 9.77, 0.43, 0.055, 0.48, M.steel);
  rod([2.26, 0.95, 9.55], [2.26, 1.65, 9.55], 0.038, M.silver);
  box(2.26, 1.57, 9.72, 0.25, 0.25, 0.44, M.steel);
  box(2.26, 1.16, 9.77, 0.35, 0.045, 0.35, M.silver);
  rod([2.26, 1.49, 9.86], [2.26, 1.24, 9.86], 0.015, M.silver);
  // Enclosed printer/CNC with clear door, bed, gantry and status lamp.
  const machine = { x: 4.32, z: 9.79 };
  box(machine.x, 1.23, machine.z, 0.9, 0.7, 0.64, M.pale);
  box(machine.x, 1.26, machine.z + 0.33, 0.72, 0.48, 0.018, M.charcoal);
  box(machine.x, 1.26, machine.z + 0.345, 0.62, 0.4, 0.012, M.glass);
  box(machine.x, 1.07, machine.z + 0.15, 0.58, 0.022, 0.34, M.silver);
  rod([machine.x - 0.25, 1.37, machine.z + 0.19], [machine.x + 0.25, 1.37, machine.z + 0.19], 0.019, M.silver);
  box(machine.x + 0.17, 1.61, machine.z + 0.2, 0.07, 0.065, 0.07, M.led);
  // Parts trolley.
  box(3.51, 0.65, 7.21, 0.74, 0.07, 0.55, M.oak);
  box(3.51, 0.23, 7.21, 0.74, 0.04, 0.55, M.steel);
  for (const dx of [-0.3, 0.3]) for (const dz of [-0.21, 0.21]) {
    box(3.51 + dx, 0.42, 7.21 + dz, 0.03, 0.65, 0.03, M.charcoal);
    sphere(3.51 + dx, 0.07, 7.21 + dz, 0.064, M.black);
  }
  box(3.5, 0.73, 7.2, 0.48, 0.14, 0.32, M.blue);
  // Updated user detail: the north edge sits 1.990 m below the structural
  // band; both main racks run 5.100 m. The four levels retain the previous
  // 2.020 m display height assumption, while the new depths are dimensioned.
  const eastRack={right:eastRackRight,depth:storageRackDepth,north:P.southRoomsNorth+1.990,length:5.100,height:2.020,levels:4};
  eastRack.south=eastRack.north+eastRack.length;
  const displayFront=eastRack.right+displayRackDepth;
  const entranceAssembly=new THREE.Group();
  entranceAssembly.name='1F entrance · paired racks and north-facing display';
  entranceAssembly.userData={storageDepth:storageRackDepth,displayDepth:displayRackDepth,rackLength:eastRack.length,height:eastRack.height,levels:4,clearAisle:displayWidth,north:eastRack.north,south:eastRack.south};
  group.add(entranceAssembly);
  const storageRack=new THREE.Group();
  storageRack.name='1F entrance · west storage rack 600 × 5100';
  storageRack.userData={depth:storageRackDepth,length:eastRack.length,height:eastRack.height,levels:4,facing:'west'};
  entranceAssembly.add(storageRack);activeGroup=storageRack;
  const rackBay=eastRack.length/3;
  for(let i=0;i<3;i++) shelf(planX(eastRack.right-storageRackDepth/2),planZ(eastRack.north+(i+.5)*rackBay),rackBay-.040,storageRackDepth-.040,4,eastRack.height,-Math.PI/2);

  const displayRack=new THREE.Group();
  displayRack.name='1F entrance · east display rack 400 × 5100';
  displayRack.userData={depth:displayRackDepth,length:eastRack.length,height:eastRack.height,levels:4,facing:'east'};
  entranceAssembly.add(displayRack);activeGroup=displayRack;
  const displayX=planX(eastRack.right+displayRackDepth/2),displayZ=planZ((eastRack.north+eastRack.south)/2);
  const shelfLevels=Array.from({length:4},(_,i)=>.12+i*(eastRack.height-.21)/3);
  for(const y of shelfLevels) box(displayX,y,displayZ,displayRackDepth,.035,eastRack.length,M.oak);
  for(let i=0;i<=3;i++) {
    const v=eastRack.north+i*rackBay+(i===0?.02:i===3?-.02:0);
    for(const u of [eastRack.right+.02,displayFront-.02]) box(planX(u),eastRack.height/2,planZ(v),.04,eastRack.height,.04,M.charcoal);
  }
  // Slim backing braces sit between the two opposed faces, leaving the
  // entrance-facing shelves open. A few objects avoid filling every bay.
  for(let i=0;i<3;i++) {
    const a=planZ(eastRack.north+i*rackBay+.04),b=planZ(eastRack.north+(i+1)*rackBay-.04);
    rod([planX(eastRack.right+.015),.14,a],[planX(eastRack.right+.015),eastRack.height-.08,b],.011,M.steel);
  }
  for(const [v,index] of [[eastRack.north+.85,1],[eastRack.north+4.25,2]]) {
    const y=shelfLevels[index]+.018;
    box(displayX,y+.025,planZ(v),.22,.05,.24,M.black);
    rod([displayX,y+.05,planZ(v)],[displayX,y+.23,planZ(v)],.027,M.gold);
    sphere(displayX,y+.30,planZ(v),.09,M.gold);
    rod([displayX,y+.24,planZ(v)-.09],[displayX,y+.35,planZ(v)-.10],.011,M.gold);
    rod([displayX,y+.24,planZ(v)+.09],[displayX,y+.35,planZ(v)+.10],.011,M.gold);
  }
  const modelV=planZ(eastRack.north+2.55),modelY=shelfLevels[1]+.045;
  box(displayX,modelY,modelV,.27,.055,.50,M.blue);
  box(displayX,modelY+.10,modelV,.22,.045,.38,M.silver);
  for(const dz of [-.17,.17]) rod([displayX-.08,modelY+.11,modelV+dz],[displayX+.06,modelY+.36,modelV+dz],.015,M.silver);
  rod([displayX+.06,modelY+.36,modelV-.17],[displayX+.06,modelY+.36,modelV+.17],.02,M.black);

  // The reference retains the original 600 mm southern return below the
  // 5.100 m paired section, joining it back into the south tool furniture.
  const southReturn=new THREE.Group();
  southReturn.name='1F entrance · retained south storage return';
  entranceAssembly.add(southReturn);activeGroup=southReturn;
  const returnLength=southTool.north-eastRack.south;
  if(returnLength>.1) shelf(planX(eastRack.right-storageRackDepth/2),planZ((eastRack.south+southTool.north)/2),returnLength-.04,storageRackDepth-.04,4,eastRack.height,-Math.PI/2);

  // Screen hangs on the transverse wall SOUTH of the doorway, facing
  // NORTH into the entrance. Its 1.840 m outer width is dimensioned;
  // mounting height, 16:9 ratio and wall height are display assumptions.
  activeGroup=entranceAssembly;
  const entranceScreen={west:displayFront,width:1.840,v:eastRack.south,wallHeight:2.50,mountCenter:1.58};
  const screenX=planX(entranceScreen.west+entranceScreen.width/2);
  const screenWallZ=planZ(entranceScreen.v);
  const screenWall=solidBox('1F entrance · south transverse screen wall',screenX,entranceScreen.wallHeight/2,screenWallZ+.065,entranceScreen.width+.08,entranceScreen.wallHeight,.13,M.plaster);
  screenWall.userData.entranceScreenWall=true;
  const screenFrame=solidBox('1F entrance · 1840 mm north-facing screen',screenX,entranceScreen.mountCenter,screenWallZ-.050,entranceScreen.width,entranceScreen.width*9/16,.075,M.black);
  screenFrame.userData={...screenFrame.userData,width:1.840,facing:'north',wallSide:'south of entrance'};
  solidBox('1F entrance · display active surface',screenX,entranceScreen.mountCenter,screenWallZ-.091,entranceScreen.width-.085,entranceScreen.width*9/16-.085,.008,M.screen);
  box(screenX+entranceScreen.width/2-.08,entranceScreen.mountCenter-entranceScreen.width*9/32+.04,screenWallZ-.098,.015,.006,.004,M.led);
  activeGroup=group;
  // Compact CAD station near the assembly floor.
  worktable(4.65, 2.07, 1.5, 0.77, true);
  monitor(4.5, 1.95);
  chair(4.49, 2.91);

  // Flush expansion-joint lines in the concrete floor, kept off the carpet.
  for (const z of [4.7, 7.53]) box(-2.09, -0.006, z, 20.15, 0.004, 0.012, M.steel);
  for (const x of [-7.94, -2.11, 3.72]) box(x, -0.006, 5.91, 0.011, 0.004, 8.85, M.steel);

  // SECOND FLOOR — traced from the supplied 2F drawing. Only this small
  // south-west wing receives a slab. Both marked double-height voids stay
  // open: the entire practice hall and the east assembly/display zone.
  // Plan drawings contain no storey height; 3.2 m is a visual-model assumption.
  const secondFloorElevation = P.displayAssumptions.floor2Elevation;
  const meetingWest=planX(P.meeting.west), meetingEast=planX(P.meeting.east);
  const roomNorth=planZ(P.southRoomsNorth), roomSouth=planZ(P.southRoomsSouth);
  const officeEast=planX(P.office.east), officeWest=officeEast-(2*P.office.bayWidth+P.office.aisle);
  const notchEast=planX(P.classroomNotchWidth), notchNorth=planZ(P.classroomNotchNorth);
  const stairWest=planX(P.stair.west);
  const stairFlightSplit=planX(P.stair.narrowEast);
  // The reference camera looks from the east. South is screen-left, so
  // the long flight must RISE SOUTH into the existing office/classroom foyer.
  // Preserve the earlier tread runs; the upper step ends flush at roomSouth.
  const stairUpperRun=P.stair.turn-P.stair.north;
  const stairLandingDepth=P.stair.south-P.stair.turn;
  const stairTurn=roomSouth-stairUpperRun;
  const stairLandingNorth=stairTurn-stairLandingDepth;
  const secondFloorFootprint = [
    [X0,roomSouth],[meetingWest,roomSouth],[meetingWest,roomNorth],
    [stairWest,roomNorth],[stairWest,roomSouth],[officeEast,roomSouth],[officeEast,Z1],
    [notchEast,Z1],[notchEast,notchNorth],[X0,notchNorth],
  ];
  const floor2Shape = new THREE.Shape();
  secondFloorFootprint.forEach(([x, z], i) => i ? floor2Shape.lineTo(x, -z) : floor2Shape.moveTo(x, -z));
  floor2Shape.closePath();
  const floor2SlabGeo = new THREE.ExtrudeGeometry(floor2Shape, { depth: 0.23, bevelEnabled: false });
  floor2SlabGeo.rotateX(-Math.PI / 2);
  const floor2Slab = new THREE.Mesh(floor2SlabGeo, M.slab);
  floor2Slab.position.y = -0.23;
  floor2Slab.name = '2F slab · classroom / meeting / office only';
  floor2Slab.castShadow = floor2Slab.receiveShadow = true;
  floor2Slab.userData.architecture = true;
  level2.add(floor2Slab);
  architecturalMeshes.push(floor2Slab);
  const floor2TopGeo = new THREE.ShapeGeometry(floor2Shape);
  floor2TopGeo.rotateX(-Math.PI / 2);
  const floor2Top = new THREE.Mesh(floor2TopGeo, M.floor);
  floor2Top.position.y = 0.003;
  floor2Top.name = '2F floor finish · no slab over the two voids';
  floor2Top.receiveShadow = true;
  level2.add(floor2Top);

  // The support geometry follows the corrected wing perimeter, including
  // the 2.260 × 1.310 m southwest recess visible in the 2F drawing.
  for (const [x,z] of [[X0+.15,roomSouth+.12],[meetingWest+.12,roomNorth+.12],[officeWest,roomSouth+.12],[officeEast-.12,roomSouth+.12],[officeEast-.12,Z1-.15],[notchEast+.12,Z1-.15]]) {
    box(x,1.49,z,.14,2.98,.14,M.charcoal);box(x,.035,z,.3,.055,.3,M.steel);
  }
  // Restore the foyer edge beam under the south-facing upper landing.
  box((X0+officeEast)/2,2.91,roomSouth+.08,officeEast-X0,.23,.15,M.charcoal);
  box((notchEast+officeEast)/2,2.91,Z1-.1,officeEast-notchEast,.23,.15,M.charcoal);
  box(officeEast-.06,2.91,(roomSouth+Z1)/2,.15,.23,Z1-roomSouth,M.charcoal);

  activeGroup = level2;
  solidBox('2F classroom west wall',X0+.055,1.31,(roomSouth+notchNorth)/2,.11,2.62,notchNorth-roomSouth,M.plaster);
  solidBox('2F southwest recess north wall',(X0+notchEast)/2,.20,notchNorth,notchEast-X0,.4,.10,M.plaster);
  solidBox('2F southwest recess east return',notchEast,.20,(notchNorth+Z1)/2,.10,.4,Z1-notchNorth,M.plaster);
  solidBox('2F south wall · cutaway',(notchEast+officeEast)/2,.17,Z1-.045,officeEast-notchEast,.34,.09,M.plaster);
  solidBox('2F meeting west wall',meetingWest,1.25,(roomNorth+roomSouth)/2,.12,2.5,roomSouth-roomNorth,M.plaster);
  glassPartition(meetingWest+.06,roomNorth,meetingEast,roomNorth,2.57);
  gypsumPartition('2F meeting / foyer · gypsum wall',meetingEast,roomNorth,meetingEast,roomSouth);
  gypsumPartition('2F meeting / classroom · gypsum wall',meetingWest+.06,roomSouth,meetingEast,roomSouth);
  glassPartition(X0+.10,roomSouth,meetingWest-.06,roomSouth,2.57);
  gypsumPartition('2F classroom / office · gypsum wall',officeWest,roomSouth,officeWest,Z1-.05,2.57,true);
  glassPartition(officeEast,roomSouth,officeEast,Z1-.05,2.57);
  for(const [x,z,w,d] of [[(meetingWest+meetingEast)/2,roomNorth,meetingEast-meetingWest,.075],[officeEast,(roomSouth+Z1)/2,.075,Z1-roomSouth],[officeWest,(roomSouth+Z1)/2,.075,Z1-roomSouth]])
    box(x,2.63,z,w,.12,d,M.charcoal);

  // The classroom's fifteen individual places follow the two clusters in
  // the plan: two rows of six, then three on the right-hand side.
  function studentDesk(x, z) {
    box(x,.755,z,.80,.055,.60,M.oak);
    for (const dx of [-.335,.335]) for (const dz of [-.25,.25]) box(x+dx,.37,z+dz,.027,.74,.027,M.charcoal);
    box(x,.23,z-.17,.61,.025,.028,M.charcoal);
    chair(x,z+.57);
  }
  const classroomColumns=[.515,1.315,2.115,3.715,4.515,5.315].map(planX);
  for(const z of [planZ(16.595),planZ(18.095)])for(const x of classroomColumns)studentDesk(x,z);
  for(const x of classroomColumns.slice(3))studentDesk(x,planZ(19.595));
  // The plan leaves the front teaching/circulation strip clear.
  box(planX(1.42),1.62,roomSouth+.06,2.3,1.18,.07,M.pale);
  box(planX(1.42),1.02,roomSouth+.11,2.38,.035,.085,M.silver);

  // Ten-person meeting room along the edge overlooking the practice hall.
  worktable(-7.79,2.91,3.0,1.02);
  for (const x of [-8.87,-8.15,-7.43,-6.71]) {
    chair(x,2.06,Math.PI,true);
    chair(x,3.76,0,true);
  }
  chair(-9.68,2.91,-Math.PI/2,true);
  chair(-5.90,2.91,Math.PI/2,true);
  box(-7.79,.897,2.91,.53,.025,.33,M.black);
  box(-8.53,.898,2.94,.23,.018,.3,M.pale);
  box(-10.19,1.56,2.91,.055,.78,1.33,M.black);
  box(-10.154,1.56,2.91,.012,.69,1.23,M.screen);

  // Six mirrored corner workstations. The drawing labels each bay 1.450 m
  // wide/deep and the central aisle 1.170 m; those clear dimensions are
  // retained directly, rather than substituting ordinary rectangular desks.
  const officeStations=[];
  const officeDeskGeometries=[];
  const officeBay = { width:P.office.bayWidth, depth:P.office.bayDepth, aisle:P.office.aisle, arm:.50, cornerRadius:.16 };
  function cornerWorkstation(x0,z0,mirrored,row) {
    const {width:w,depth:d,arm:a,cornerRadius:r}=officeBay;
    const sx=x=>mirrored?w-x:x;
    const shape=new THREE.Shape();
    shape.moveTo(sx(0),0); shape.lineTo(sx(w),0); shape.lineTo(sx(w),-a);
    shape.lineTo(sx(a+r),-a); shape.quadraticCurveTo(sx(a),-a,sx(a),-a-r);
    shape.lineTo(sx(a),-d); shape.lineTo(sx(0),-d); shape.closePath();
    const geo=new THREE.ExtrudeGeometry(shape,{depth:.045,bevelEnabled:false,curveSegments:10});
    geo.rotateX(-Math.PI/2); officeDeskGeometries.push(geo);
    const desk=new THREE.Mesh(geo,M.oak); desk.position.set(x0,.735,z0);
    desk.name=`2F L-shaped desk · ${mirrored?'east':'west'} ${row+1}`;
    desk.castShadow=desk.receiveShadow=true;
    desk.userData={cornerDesk:true,width:w,depth:d,aisle:officeBay.aisle,mirrored,planFootprint:[x0,z0,x0+w,z0+d]};
    level2.add(desk);
    // An open inner corner, shaped knee space, and a low service pedestal.
    for(const [lx,lz] of [[.09,.09],[w-.09,.09],[.09,d-.09],[a-.09,d-.09],[w-.09,a-.09]])
      box(x0+sx(lx),.363,z0+lz,.035,.725,.035,M.charcoal);
    box(x0+sx(.24),.365,z0+1.14,.40,.69,.46,M.pale);
    for(let i=0;i<3;i++)box(x0+sx(.448),.16+i*.19,z0+1.14,.025,.025,.15,M.charcoal);
    const angle=mirrored?-Math.PI/4:Math.PI/4;
    const mx=x0+sx(.29),mz=z0+.28;
    box(mx,.794,mz,.23,.025,.15,M.charcoal,angle);
    box(mx,.895,mz,.023,.20,.026,M.charcoal);
    box(mx,1.07,mz,.46,.28,.035,M.black,angle);
    box(mx+Math.sin(angle)*.022,1.07,mz+Math.cos(angle)*.022,.42,.245,.008,M.screen,angle);
    box(x0+sx(.52),.791,z0+.52,.30,.02,.12,M.black,angle);
    chair(x0+sx(.93),z0+.91,angle);
    // Dividers follow the L bays shown in plan and leave the aisle clear.
    box(x0+w/2,.565,z0-.025,w,.1+1.03,.035,M.fabric);
    box(x0+sx(.015),.565,z0+d/2,.035,1.13,d,M.fabric);
    officeStations.push({x:x0,z:z0,mirrored,width:w,depth:d,row});
  }
  // Keep the full bay dimensions, with a 5 mm joint inside the 90 mm
  // south wall instead of embedding the last desk/pedestal in that wall.
  const officeLeft=officeWest, officeNorth=Z1-.095-P.office.rows*officeBay.depth;
  for(let row=0;row<3;row++) {
    const z=officeNorth+row*officeBay.depth;
    cornerWorkstation(officeLeft,z,false,row);
    cornerWorkstation(officeLeft+officeBay.width+officeBay.aisle,z,true,row);
  }
  // Floating light strips expose the rooms while retaining the industrial
  // architecture reference; no opaque upper roof is added.
  for (const [x,z,w] of [[-9.47,6.46,4.45],[-8.20,9.44,2.65],[-4.38,6.68,3.55],[-4.38,9.04,3.55],[-7.79,2.87,3.7]]) {
    box(x,2.69,z,w,.075,.065,M.charcoal);
    box(x,2.645,z,w-.06,.024,.043,M.light);
    for (const dx of [-w*.35,w*.35]) rod([x+dx,2.73,z],[x+dx,3.07,z],.009,M.charcoal);
  }

  // Enter from the EAST (towards the reference camera), rise west on the
  // short flight, then turn south up the long flight into the 2F foyer.
  // User-confirmed upper flight stays unchanged; the lower flight turns 90°.
  // Heights and tread subdivision remain display assumptions.
  const stair={left:stairWest,split:stairFlightSplit,right:officeEast,
    landingNorth:stairLandingNorth,turn:stairTurn,south:roomSouth};
  const stairWidth=stair.split-stair.left;
  const lowerCount=5,upperCount=10,landingHeight=secondFloorElevation/3;
  const lowerWidth=stair.turn-stair.landingNorth;
  const lowerRun=stair.right-stair.split,upperRun=stair.south-stair.turn;
  const stairAssembly=new THREE.Group();
  stairAssembly.name='Stair assembly · fixed to ground floor';
  stairAssembly.userData={ascent:'east entrance facing the reference camera, west on short flight, turn south on long flight into the 2F foyer',landingHeight};
  group.add(stairAssembly);
  activeGroup=stairAssembly;
  for(let i=0;i<lowerCount;i++) {
    const y=(i+1)*landingHeight/lowerCount;
    const x=stair.right-(i+.5)*lowerRun/lowerCount;
    box(x,y-.035,(stair.landingNorth+stair.turn)/2,lowerRun/lowerCount+.012,.07,lowerWidth,M.charcoal);
    box(x+lowerRun/lowerCount*.4,y-.008,(stair.landingNorth+stair.turn)/2,.022,.012,lowerWidth-.04,M.silver);
  }
  box((stair.left+stair.split)/2,landingHeight-.045,(stair.landingNorth+stair.turn)/2,stairWidth,.09,stair.turn-stair.landingNorth,M.charcoal);
  for(let i=0;i<upperCount;i++) {
    const y=landingHeight+(i+1)*(secondFloorElevation-landingHeight)/upperCount;
    const z=stair.turn+(i+.5)*upperRun/upperCount;
    box((stair.left+stair.split)/2,y-.035,z,stairWidth,.07,upperRun/upperCount+.012,M.charcoal);
    box((stair.left+stair.split)/2,y-.008,z-upperRun/upperCount*.4,stairWidth-.04,.012,.022,M.silver);
  }
  function stairRail(a,b) {
    rod([a[0],a[1]+.96,a[2]],[b[0],b[1]+.96,b[2]],.025,M.charcoal);
    for(let i=0;i<=5;i++){const t=i/5,p=a.map((v,k)=>v+(b[k]-v)*t);rod(p,[p[0],p[1]+.96,p[2]],.018,M.charcoal);}
    rod(a,b,.037,M.charcoal);
  }
  for(const x of [stair.left+.035,stair.split-.035])
    stairRail([x,landingHeight,stair.turn],[x,secondFloorElevation,stair.south]);
  for(const z of [stair.landingNorth+.035,stair.turn-.035])
    stairRail([stair.right-.04,landingHeight/lowerCount,z],[stair.split,landingHeight,z]);
  stairRail([stair.split,landingHeight,stair.landingNorth+.035],[stair.left+.035,landingHeight,stair.landingNorth+.035]);
  stairRail([stair.left+.035,landingHeight,stair.landingNorth+.035],[stair.left+.035,landingHeight,stair.turn]);
  activeGroup=level2;
  // Guard the foyer edge, leaving the south-facing main-flight exit open.
  function upperGuard(x0,z0,x1,z1,height=1.05) {
    rod([x0,height,z0],[x1,height,z1],.025,M.charcoal);
    rod([x0,.12,z0],[x1,.12,z1],.019,M.charcoal);
    const count=Math.ceil(Math.hypot(x1-x0,z1-z0)/.75);
    for(let i=0;i<=count;i++) {
      const t=i/count,x=THREE.MathUtils.lerp(x0,x1,t),z=THREE.MathUtils.lerp(z0,z1,t);
      rod([x,0,z],[x,height,z],.019,M.charcoal);
    }
    const length=Math.hypot(x1-x0,z1-z0);
    box((x0+x1)/2,.57,(z0+z1)/2,length-.035,.86,.01,M.glass,-Math.atan2(z1-z0,x1-x0));
  }
  upperGuard(meetingEast,roomNorth,stair.left,roomNorth);
  upperGuard(stair.left,roomNorth,stair.left,roomSouth);
  upperGuard(stair.split,roomSouth,officeEast,roomSouth);
  upperGuard(officeEast,roomSouth,officeEast,officeNorth-.12);
  // Top edges provide a clear roof cut line without covering the interiors.
  box(X0+.055,2.66,(roomSouth+notchNorth)/2,.12,.08,notchNorth-roomSouth,M.charcoal);
  box(meetingWest,2.56,(roomNorth+roomSouth)/2,.13,.075,roomSouth-roomNorth,M.charcoal);

  level2.userData={ elevation:secondFloorElevation, classroomSeats:15, meetingSeats:10, officeStations:6,
    footprint:secondFloorFootprint, officeBay, officeStationGeometry:officeStations, stairType:'L-shaped; tread/height assumptions for display', stairOutline:stair, doubleHeightVoids:['north practice hall','east assembly and display'],
    heightAssumption:'2F floor +3.2 m; upper room clear height approx. 2.7 m; roof structure +6.3 m' };
  activeGroup = group;

  // Many detailed objects, few draw calls. Instancing also keeps a consistent
  // opacity during the white drawing → gold → material transition.
  let instanceCount = 0;
  for (const { kind, mat, matrices, parent } of batches.values()) {
    const mesh = new THREE.InstancedMesh(geometries[kind], mat, matrices.length);
    mesh.name = `${mat.name} · ${kind}`;
    matrices.forEach((matrix, index) => mesh.setMatrixAt(index, matrix));
    mesh.instanceMatrix.needsUpdate = true;
    mesh.castShadow = mat !== M.glass && mat !== M.light;
    mesh.receiveShadow = true;
    mesh.computeBoundingSphere();
    mesh.userData.campusInstances = matrices.length;
    parent.add(mesh);
    instanceCount += matrices.length;
  }
  group.userData = { source: 'User supplied 1F / 2F floor plans and material references', instanceCount, footprint,
    floors:2, planMetrics:P, secondFloorElevation, secondFloorFootprint };
  const zones = [
    { id:'field',name:'练习场',center:[field.x,.05,field.z],size:[field.w,field.d] },
    { id:'rest',name:'休息区',center:[planX(12.91),.05,planZ(.72)],size:[7.8,1.1],seats:9 },
    { id:'exchange',name:'交流区',center:[planX(exchange.u),.05,planZ((exchange.centres[0]+exchange.centres[1])/2)],size:[3.8,4.2],tableSeats:[10,10],openNorthTable:{center:[planX(openExchange.u),.05,planZ(openExchange.v)],seats:6},geometryBasis:'0.700 m table depth annotated; centres and widths scaled' },
    { id:'storage',name:'存储区',center:[planX(2.5),.05,planZ((storageNorth+P.depth)/2)],size:[5.0,P.depth-storageNorth],parallelRows:3,aisleWidth:1.740,southShelfWidth:2.140 },
    { id:'build',name:'搭建区',center:[planX(13.3),.05,planZ(16.2)],size:[6.9,6.5] },
    { id:'tools',name:'工具区',center:[planX((southTool.west+southTool.east)/2),.05,southToolZ],size:[southTool.east-southTool.west,southTool.depth],northEastControl,southEastControl:P.mainWidth },
    { id:'display',name:'展示区',center:[planX(displayFront+displayWidth/2),.05,planZ((eastRack.north+eastRack.south)/2)],size:[displayWidth,eastRack.length],eastRack:{north:eastRack.north,south:eastRack.south,right:eastRack.right,depth:eastRack.depth,length:eastRack.length,height:eastRack.height,levels:4},displayRack:{west:eastRack.right,depth:displayRackDepth,length:eastRack.length,levels:4,facing:'east'},screen:entranceScreen,geometryBasis:'Updated entrance detail: 600 + 400 mm racks, 5100 mm paired length, 2270 mm east clearance, 1840 mm north-facing screen; heights illustrative' },
    { id:'classroom',name:'二楼教室 · 15 人',center:[(X0+officeWest)/2,3.25,(roomSouth+Z1)/2],size:[officeWest-X0,Z1-roomSouth],level:2 },
    { id:'meeting',name:'二楼会议室',center:[(meetingWest+meetingEast)/2,3.25,(roomNorth+roomSouth)/2],size:[meetingEast-meetingWest,roomSouth-roomNorth],level:2 },
    { id:'office',name:'二楼办公室 · 6 工位',center:[(officeWest+officeEast)/2,3.25,officeNorth+3*officeBay.depth/2],size:[officeEast-officeWest,3*officeBay.depth],level:2 },
  ];
  return {
    group, materials, architecturalMeshes, zones, level2, stairAssembly,
    bounds: new THREE.Box3(new THREE.Vector3(X0, -0.29, Z0), new THREE.Vector3(X1, 6.4, Z1)),
    footprint, secondFloorFootprint, secondFloorElevation,
    update(time = 0) { M.led.emissiveIntensity = 0.59 + Math.sin(time * 1.1) * 0.065; },
    dispose() {
      for (const geo of new Set([...Object.values(geometries), slabGeo, topGeo, floor2SlabGeo, floor2TopGeo, ...officeDeskGeometries])) geo.dispose();
      materials.forEach(m => m.dispose());
      Object.values(textures).forEach(t => t.dispose());
    },
  };
}
