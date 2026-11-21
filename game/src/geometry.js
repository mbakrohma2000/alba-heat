// geometry.js — tiny BufferGeometry helpers shared by the city, vehicle and
// pedestrian builders. One job: merge many simple boxes into a single
// vertex-coloured geometry, so a whole car or building lot renders as one
// mesh and the frame rate stays sane on a weak machine.

import * as THREE from 'three';

// Append a transformed, coloured box to the part list used by mergeParts().
// colour is a THREE.Color or a hex number; (x, y, z) is the box centre.
// rotY turns the box around the vertical axis; rotZ (rarely needed) tips its
// long axis up or down after the turn — palm fronds droop with it.
export function pushBox(parts, w, h, d, x, y, z, colour, rotY = 0, rotZ = 0) {
  parts.push({ w, h, d, x, y, z, colour, rotY, rotZ });
}

// Build one BufferGeometry out of pushBox parts, with a colour attribute the
// shared MeshLambertMaterial({ vertexColors: true }) materials can use.
export function mergeParts(parts) {
  const positions = [];
  const normals = [];
  const colours = [];
  const colour = new THREE.Color();
  const m = new THREE.Matrix4();
  const euler = new THREE.Euler();
  const geo = new THREE.BoxGeometry(1, 1, 1);
  const posAttr = geo.getAttribute('position');
  const norAttr = geo.getAttribute('normal');
  const index = geo.getIndex();
  const v = new THREE.Vector3();
  const n = new THREE.Vector3();
  const nm = new THREE.Matrix3();
  let base = 0;
  const indices = [];
  for (const p of parts) {
    colour.set(p.colour);
    // 'YXZ': yaw first, then the Z tip acts in the yawed frame, so a frond
    // droops downward whichever way it points.
    euler.set(0, p.rotY || 0, p.rotZ || 0, 'YXZ');
    m.makeRotationFromEuler(euler);
    m.scale(new THREE.Vector3(p.w, p.h, p.d));
    m.setPosition(p.x, p.y, p.z);
    nm.getNormalMatrix(m);
    for (let i = 0; i < posAttr.count; i++) {
      v.fromBufferAttribute(posAttr, i).applyMatrix4(m);
      positions.push(v.x, v.y, v.z);
      n.fromBufferAttribute(norAttr, i).applyMatrix3(nm).normalize();
      normals.push(n.x, n.y, n.z);
      colours.push(colour.r, colour.g, colour.b);
    }
    for (let i = 0; i < index.count; i++) indices.push(base + index.getX(i));
    base += posAttr.count;
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  out.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  out.setAttribute('color', new THREE.Float32BufferAttribute(colours, 3));
  out.setIndex(indices);
  geo.dispose();
  return out;
}

// One shared material for every vertex-coloured mesh in the game.
export function vertexMaterial(extra = {}) {
  return new THREE.MeshLambertMaterial({ vertexColors: true, ...extra });
}
