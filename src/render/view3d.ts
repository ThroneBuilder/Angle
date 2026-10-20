// Rotatable 3D view (T053; FR-018). Stand-in geometry in LBU (research R10): boxes for parts,
// cylinders for studs and pins, red markers at the connections. Everything is placed through the
// same frames as the tests (world.ts). Loaded lazily, so the page opens without three.js.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { localPoint } from '../build/build.ts';
import { CATALOG, color } from '../catalog/catalog.ts';
import { toSolverInput } from '../solver/grid.ts';
import { SURFACE_TYPES } from '../surfaces/surface-types.ts';
import type { Build, PlacedPart } from '../types.ts';
import { planeFrame, stackFor, type PlaneFrame } from './world.ts';

const CONNECTION = 0xd01012;

function rgb(id: number): THREE.Color {
  return new THREE.Color(color(CATALOG, id)?.rgb ?? '#a0a5a9');
}

function material(id: number, opacity = 1): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({ color: rgb(id), roughness: 0.6, metalness: 0, transparent: opacity < 1, opacity });
}

/** A group in plane coordinates (x across, y up the plane, z along the normal) for one surface. */
function surfaceGroup(frame: PlaneFrame): THREE.Group {
  const g = new THREE.Group();
  g.position.set(frame.offsetX, frame.offsetY, 0);
  g.rotation.z = (frame.rotationDeg * Math.PI) / 180;
  return g;
}

function box(p: PlacedPart, frame: PlaneFrame, [from, to]: readonly [number, number], mat: THREE.Material): THREE.Mesh {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(p.widthLbu, p.heightLbu, to - from), mat);
  mesh.position.set(p.x + frame.originX, p.y + frame.originY, (from + to) / 2);
  return mesh;
}

/** Cylinder along the plane's normal. */
function cylinder(radius: number, from: number, to: number, mat: THREE.Material): THREE.Mesh {
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, to - from, 20), mat);
  mesh.rotation.x = Math.PI / 2;
  mesh.position.z = (from + to) / 2;
  return mesh;
}

/** Studs on the upper face of flat parts, one instanced mesh per surface. */
function studs(parts: readonly PlacedPart[], frame: PlaneFrame, top: number, mat: THREE.Material): THREE.InstancedMesh | null {
  const centers: [number, number][] = [];
  for (const p of parts) {
    if (p.kind === 'riser' || p.kind === 'offset' || p.kind === 'pin') continue;
    for (let a = 0; a < Math.round(p.widthLbu / 10); a++) {
      for (let b = 0; b < Math.round(p.heightLbu / 10); b++) {
        centers.push([p.x - p.widthLbu / 2 + 5 + 10 * a, p.y - p.heightLbu / 2 + 5 + 10 * b]);
      }
    }
  }
  if (centers.length === 0) return null;
  const geometry = new THREE.CylinderGeometry(3, 3, 2, 16);
  geometry.rotateX(Math.PI / 2);
  const mesh = new THREE.InstancedMesh(geometry, mat, centers.length);
  const m = new THREE.Matrix4();
  centers.forEach(([x, y], n) => mesh.setMatrixAt(n, m.makeTranslation(x + frame.originX, y + frame.originY, top + 1)));
  return mesh;
}

function disposeTree(object: THREE.Object3D): void {
  object.traverse((o) => {
    if (o instanceof THREE.Mesh) {
      o.geometry.dispose();
      const mats = Array.isArray(o.material) ? o.material : [o.material];
      for (const mat of mats) mat.dispose();
    }
  });
}

export function buildScene(build: Build): THREE.Group {
  const input = toSolverInput(build.config);
  const stack = stackFor(build);
  const bottomFrame = planeFrame(build, 'bottom');
  const topFrame = planeFrame(build, 'top');
  const root = new THREE.Group();
  // Flat surfaces lie in the ground plane with the normal up; upright ones face the viewer.
  if (stack.orientation === 'flat') root.rotation.x = -Math.PI / 2;

  const bottom = surfaceGroup(bottomFrame);
  for (const p of build.bottomParts) bottom.add(box(p, bottomFrame, stack.bottom(p.kind), material(p.color)));
  const top = surfaceGroup(topFrame);
  for (const p of build.topParts) top.add(box(p, topFrame, stack.top(p.kind), material(p.color, 0.85)));

  if (stack.orientation === 'flat') {
    const bottomStuds = studs(build.bottomParts, bottomFrame, stack.bottom(build.bottomParts[0]!.kind)[1], material(build.bottomParts[0]!.color));
    if (bottomStuds) bottom.add(bottomStuds);
    const topStuds = studs(build.topParts, topFrame, stack.top(build.topParts[0]!.kind)[1], material(build.topParts[0]!.color, 0.85));
    if (topStuds) top.add(topStuds);
  }

  const red = new THREE.MeshStandardMaterial({ color: CONNECTION, roughness: 0.5 });
  for (const c of build.connectors) {
    const p = c.placed;
    if (p.kind === 'riser') {
      bottom.add(box(p, bottomFrame, stack.riser, material(p.color)));
      const stud = cylinder(3, stack.riser[1], stack.riser[1] + 2, red);
      stud.position.x = p.x + bottomFrame.originX;
      stud.position.y = p.y + bottomFrame.originY;
      bottom.add(stud);
    } else {
      const pin = cylinder(2.4, stack.pin[0] - 1, stack.pin[1] + 1, material(p.color));
      pin.position.x = p.x + bottomFrame.originX;
      pin.position.y = p.y + bottomFrame.originY;
      bottom.add(pin);
      // Red caps on both outer faces mark the connection.
      for (const z of [stack.pin[0] - 1.2, stack.pin[1] + 1.2]) {
        const cap = cylinder(2.6, z - 0.2, z + 0.2, red);
        cap.position.x = pin.position.x;
        cap.position.y = pin.position.y;
        bottom.add(cap);
      }
    }
  }

  // Red markers on the top's connection points too (flat builds: on its upper face).
  if (stack.orientation === 'flat') {
    const topFace = stack.top(build.topParts[0]!.kind)[1];
    for (const conn of build.connections) {
      const t = localPoint(build.top, input.top, conn.top.i, conn.top.j);
      const marker = cylinder(3.2, topFace + 0.1, topFace + 2.2, red);
      marker.position.x = t.x + topFrame.originX;
      marker.position.y = t.y + topFrame.originY;
      top.add(marker);
    }
  }

  root.add(bottom, top);
  root.userData.view = SURFACE_TYPES[build.bottom.spec.typeId].view;
  return root;
}

export interface View3d {
  show(build: Build): void;
  savePng(): Promise<Blob | null>;
  dispose(): void;
}

export function createView3d(container: HTMLElement): View3d {
  const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  container.append(renderer.domElement);
  const scene = new THREE.Scene();
  scene.add(new THREE.HemisphereLight(0xffffff, 0x606060, 2.2));
  const sun = new THREE.DirectionalLight(0xffffff, 2);
  sun.position.set(200, 400, 300);
  scene.add(sun);
  const camera = new THREE.PerspectiveCamera(35, 1, 1, 10000);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = false;
  let model: THREE.Group | null = null;

  const render = () => renderer.render(scene, camera);
  controls.addEventListener('change', render);

  const resize = () => {
    const width = container.clientWidth;
    const height = container.clientHeight;
    renderer.setSize(width, height, false);
    camera.aspect = width / Math.max(1, height);
    camera.updateProjectionMatrix();
    render();
  };
  const observer = new ResizeObserver(resize);
  observer.observe(container);

  return {
    show(build) {
      const background = getComputedStyle(container).getPropertyValue('--chart-surface').trim() || '#fcfcfb';
      scene.background = new THREE.Color(background);
      if (model) {
        scene.remove(model);
        disposeTree(model);
      }
      model = buildScene(build);
      scene.add(model);
      // Frame the model: look from the front and above, at a distance that fits it.
      const bounds = new THREE.Box3().setFromObject(model);
      const center = bounds.getCenter(new THREE.Vector3());
      const size = bounds.getSize(new THREE.Vector3()).length();
      camera.position.copy(center).add(new THREE.Vector3(0.35, 0.55, 0.9).normalize().multiplyScalar(size * 1.3));
      camera.near = size / 100;
      camera.far = size * 10;
      controls.target.copy(center);
      controls.update();
      resize();
    },
    savePng() {
      render();
      return new Promise((resolve) => renderer.domElement.toBlob(resolve, 'image/png'));
    },
    dispose() {
      observer.disconnect();
      controls.dispose();
      if (model) disposeTree(model);
      renderer.dispose();
      renderer.domElement.remove();
    },
  };
}
