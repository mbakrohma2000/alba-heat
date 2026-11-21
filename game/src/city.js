// city.js — builds Puerto Alba itself: the sunset sky, the painted ground
// (roads, crosswalks, sidewalks, promenade, sand), instanced stucco buildings
// with lit windows, the Hotel Alba, the marina, palms and lamps, and the
// ocean. One job: own everything static in the world, plus the building
// collision boxes the moving actors test against.

import * as THREE from 'three';
import { CITY, PALETTE } from './config.js';
import { pushBox, mergeParts, vertexMaterial } from './geometry.js';

const GROUND_MIN_X = -280;
const GROUND_MAX_X = 300;
const GROUND_HALF_Z = 200;

// A facade texture pair: walls with dark windows, and a black emissive map
// where some windows glow — golden-hour apartments coming home.
function makeFacade(rng, litRatio) {
  const w = 128, h = 256;
  const face = document.createElement('canvas'); face.width = w; face.height = h;
  const glow = document.createElement('canvas'); glow.width = w; glow.height = h;
  const f = face.getContext('2d');
  const g = glow.getContext('2d');
  f.fillStyle = '#f5efe4'; f.fillRect(0, 0, w, h);
  g.fillStyle = '#000'; g.fillRect(0, 0, w, h);
  const cols = 6, rows = 13;
  const cw = w / cols, ch = h / rows;
  for (let i = 0; i < cols; i++) {
    for (let j = 0; j < rows; j++) {
      const x = i * cw + cw * 0.22, y = j * ch + ch * 0.2, ww = cw * 0.56, hh = ch * 0.58;
      const lit = rng.chance(litRatio);
      f.fillStyle = lit ? '#8a6a42' : '#33404f';
      f.fillRect(x, y, ww, hh);
      f.fillStyle = 'rgba(255,255,255,0.25)';
      f.fillRect(x, y, ww, 2);
      if (lit) { g.fillStyle = rng.chance(0.5) ? '#ffc46b' : '#ffdf9e'; g.fillRect(x, y, ww, hh); }
    }
  }
  const faceTex = new THREE.CanvasTexture(face);
  const glowTex = new THREE.CanvasTexture(glow);
  faceTex.colorSpace = THREE.SRGBColorSpace;
  return { faceTex, glowTex };
}

// Paint the whole street plan onto one big canvas: asphalt, lane paint,
// crosswalks, sidewalks, plaza blocks, the boardwalk and the sand.
function paintGround(rng, parks) {
  const W = 2048, H = 1366;
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
  const c = cv.getContext('2d');
  const px = (x) => ((x - GROUND_MIN_X) / (GROUND_MAX_X - GROUND_MIN_X)) * W;
  const pz = (z) => ((z + GROUND_HALF_Z) / (2 * GROUND_HALF_Z)) * H;
  const sx = W / (GROUND_MAX_X - GROUND_MIN_X); // pixels per metre, x
  const sz = H / (2 * GROUND_HALF_Z);

  c.fillStyle = '#a8916e'; c.fillRect(0, 0, W, H); // dry city earth

  // Block interiors: plazas, grass parks, terracotta yards.
  const blockTints = ['#b39d77', '#ac9a76', '#bfae86', '#c08552', '#a8a077'];
  for (let i = 0; i < CITY.avenues.length - 1; i++) {
    for (let j = 0; j < CITY.streets.length - 1; j++) {
      const x0 = CITY.avenues[i] + CITY.roadHalf, x1 = CITY.avenues[i + 1] - CITY.roadHalf;
      const z0 = CITY.streets[j] + CITY.roadHalf, z1 = CITY.streets[j + 1] - CITY.roadHalf;
      const isPark = parks.some((p) => p.i === i && p.j === j);
      c.fillStyle = isPark ? '#79a95c' : blockTints[(i * 7 + j * 3) % blockTints.length];
      c.fillRect(px(x0), pz(z0), (x1 - x0) * sx, (z1 - z0) * sz);
      // Sidewalk border around every block.
      c.strokeStyle = '#d8cbae'; c.lineWidth = 4.5 * sx / 2.2;
      c.strokeRect(px(x0), pz(z0), (x1 - x0) * sx, (z1 - z0) * sz);
      if (isPark) {
        c.strokeStyle = 'rgba(240,230,200,0.7)'; c.lineWidth = 2.2;
        c.beginPath(); c.moveTo(px(x0 + 4), pz(z0 + 4)); c.lineTo(px(x1 - 4), pz(z1 - 4));
        c.moveTo(px(x1 - 4), pz(z0 + 4)); c.lineTo(px(x0 + 4), pz(z1 - 4)); c.stroke();
      }
    }
  }

  // Roads: asphalt slabs, edge lines, dashed centre lines.
  const drawRoad = (vertical, at) => {
    c.fillStyle = '#3a3742';
    if (vertical) c.fillRect(px(at - CITY.roadHalf), 0, CITY.roadHalf * 2 * sx, H);
    else c.fillRect(0, pz(at - CITY.roadHalf), W, CITY.roadHalf * 2 * sz);
    c.strokeStyle = '#e8e0c8'; c.lineWidth = 1.6;
    c.setLineDash([]);
    c.beginPath();
    if (vertical) {
      c.moveTo(px(at - CITY.roadHalf + 0.5), 0); c.lineTo(px(at - CITY.roadHalf + 0.5), H);
      c.moveTo(px(at + CITY.roadHalf - 0.5), 0); c.lineTo(px(at + CITY.roadHalf - 0.5), H);
    } else {
      c.moveTo(0, pz(at - CITY.roadHalf + 0.5)); c.lineTo(W, pz(at - CITY.roadHalf + 0.5));
      c.moveTo(0, pz(at + CITY.roadHalf - 0.5)); c.lineTo(W, pz(at + CITY.roadHalf - 0.5));
    }
    c.stroke();
    c.strokeStyle = '#ffd166'; c.lineWidth = 1.4; c.setLineDash([14, 12]);
    c.beginPath();
    if (vertical) { c.moveTo(px(at), 0); c.lineTo(px(at), H); }
    else { c.moveTo(0, pz(at)); c.lineTo(W, pz(at)); }
    c.stroke();
    c.setLineDash([]);
  };
  CITY.avenues.forEach((x) => drawRoad(true, x));
  CITY.streets.forEach((z) => drawRoad(false, z));

  // Crosswalks at every intersection.
  c.fillStyle = 'rgba(245,242,230,0.85)';
  for (const ax of CITY.avenues) {
    for (const szv of CITY.streets) {
      for (let s = -2; s <= 2; s++) {
        if (s === 0) continue;
        c.fillRect(px(ax + s * 2.6 - 0.9), pz(szv - CITY.roadHalf - 2.2), 1.8 * sx, 2.2 * sz);
        c.fillRect(px(ax + s * 2.6 - 0.9), pz(szv + CITY.roadHalf), 1.8 * sx, 2.2 * sz);
        c.fillRect(px(ax - CITY.roadHalf - 2.2), pz(szv + s * 2.6 - 0.9), 2.2 * sx, 1.8 * sz);
        c.fillRect(px(ax + CITY.roadHalf), pz(szv + s * 2.6 - 0.9), 2.2 * sx, 1.8 * sz);
      }
    }
  }

  // Promenade boardwalk, then sand, then the wet shine at the waterline.
  c.fillStyle = '#9a6a4a'; c.fillRect(px(234), 0, (CITY.beachX - 234) * sx, H);
  c.strokeStyle = 'rgba(60,35,20,0.35)'; c.lineWidth = 1;
  for (let x = 236; x < CITY.beachX; x += 3) { c.beginPath(); c.moveTo(px(x), 0); c.lineTo(px(x), H); c.stroke(); }
  c.fillStyle = '#eed49f'; c.fillRect(px(CITY.beachX), 0, (GROUND_MAX_X - CITY.beachX) * sx, H);
  c.fillStyle = 'rgba(220,189,133,0.9)'; c.fillRect(px(288), 0, (GROUND_MAX_X - 288) * sx, H);
  // Marina apron.
  c.fillStyle = '#cbbd9d'; c.fillRect(px(258), pz(128), (292 - 258) * sx, (168 - 128) * sz);
  // The lock-up garage's concrete yard, north-west block.
  c.fillStyle = '#b8ab90'; c.fillRect(px(-210), pz(119), 28 * sx, 23 * sz);

  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

export function createCity(scene, rng) {
  const group = new THREE.Group();
  scene.add(group);
  const colliders = [];

  // --- Sky, fog, lights -------------------------------------------------
  const skyCv = document.createElement('canvas'); skyCv.width = 4; skyCv.height = 256;
  const sctx = skyCv.getContext('2d');
  const grad = sctx.createLinearGradient(0, 0, 0, 256);
  grad.addColorStop(0, '#2e1a47'); grad.addColorStop(0.45, '#7a2d5e');
  grad.addColorStop(0.72, '#b84a6e'); grad.addColorStop(0.92, '#ff9e5e'); grad.addColorStop(1, '#ffc46b');
  sctx.fillStyle = grad; sctx.fillRect(0, 0, 4, 256);
  const skyTex = new THREE.CanvasTexture(skyCv);
  skyTex.colorSpace = THREE.SRGBColorSpace;
  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(880, 24, 14),
    new THREE.MeshBasicMaterial({ map: skyTex, side: THREE.BackSide, fog: false, depthWrite: false }),
  );
  group.add(sky);
  const sunDisc = new THREE.Mesh(
    new THREE.CircleGeometry(46, 24),
    new THREE.MeshBasicMaterial({ color: 0xfff0b3, fog: false, depthWrite: false }),
  );
  sunDisc.position.set(760, 128, 190);
  sunDisc.lookAt(0, 40, 0);
  group.add(sunDisc);

  scene.fog = new THREE.Fog(PALETTE.fog, 200, 780);
  const hemi = new THREE.HemisphereLight(0xffd9a0, 0x7a4a5e, 1.15);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(PALETTE.sun, 2.5);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  sun.shadow.camera.left = -130; sun.shadow.camera.right = 130;
  sun.shadow.camera.top = 130; sun.shadow.camera.bottom = -130;
  sun.shadow.camera.near = 10; sun.shadow.camera.far = 520;
  sun.shadow.bias = -0.0008;
  scene.add(sun); scene.add(sun.target);

  // --- Ground and water ---------------------------------------------------
  const parks = [{ i: 1, j: 1 }, { i: 4, j: 2 }, { i: 2, j: 3 }];
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(GROUND_MAX_X - GROUND_MIN_X, GROUND_HALF_Z * 2),
    new THREE.MeshLambertMaterial({ map: paintGround(rng, parks) }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.set((GROUND_MIN_X + GROUND_MAX_X) / 2, 0, 0);
  ground.receiveShadow = true;
  group.add(ground);

  const waveCv = document.createElement('canvas'); waveCv.width = 128; waveCv.height = 128;
  const wctx = waveCv.getContext('2d');
  wctx.fillStyle = '#2a9d8f'; wctx.fillRect(0, 0, 128, 128);
  wctx.strokeStyle = 'rgba(255,255,255,0.20)'; wctx.lineWidth = 2;
  for (let i = 0; i < 9; i++) {
    wctx.beginPath();
    const y = i * 16 + 6;
    wctx.moveTo(0, y); wctx.bezierCurveTo(32, y - 5, 80, y + 5, 128, y); wctx.stroke();
  }
  const waveTex = new THREE.CanvasTexture(waveCv);
  waveTex.wrapS = waveTex.wrapT = THREE.RepeatWrapping;
  waveTex.repeat.set(26, 16);
  const water = new THREE.Mesh(
    new THREE.PlaneGeometry(760, 460),
    new THREE.MeshPhongMaterial({ map: waveTex, color: 0x9fd8d2, specular: 0xffd9a0, shininess: 90, transparent: true, opacity: 0.94 }),
  );
  water.rotation.x = -Math.PI / 2;
  water.position.set(CITY.waterX + 372, -0.25, 0);
  group.add(water);

  // --- Buildings ----------------------------------------------------------
  const facades = [makeFacade(rng, 0.42), makeFacade(rng, 0.3), makeFacade(rng, 0.55)];
  const placements = facades.map(() => []);
  const roofMatrices = [];
  const dummy = new THREE.Object3D();
  const tint = new THREE.Color();
  const HOTEL_BLOCK = { i: 4, j: 1 }; // avenues 148..222 x streets -74..0 -> centre (185,-37) is j=1? streets[-74,0] centre -37, i=4 is avenues[148,222] centre 185
  // NOTE: hotel sits on the beachfront block centred (185,-37); drop-off is on avenue 148 side.
  for (let i = 0; i < CITY.avenues.length - 1; i++) {
    for (let j = 0; j < CITY.streets.length - 1; j++) {
      if (parks.some((p) => p.i === i && p.j === j)) continue;
      const cx = (CITY.avenues[i] + CITY.avenues[i + 1]) / 2;
      const cz = (CITY.streets[j] + CITY.streets[j + 1]) / 2;
      if (i === HOTEL_BLOCK.i && j === HOTEL_BLOCK.j) continue;
      const inner = CITY.blockPitch - CITY.roadHalf * 2 - 5; // 55 m of buildable block
      const pattern = rng.pick(['single', 'twinX', 'twinZ', 'quad', 'twinX', 'quad']);
      const lots = [];
      if (pattern === 'single') lots.push([0, 0, inner, inner]);
      else if (pattern === 'twinX') { lots.push([-inner / 4 - 1, 0, inner / 2 - 2, inner]); lots.push([inner / 4 + 1, 0, inner / 2 - 2, inner]); }
      else if (pattern === 'twinZ') { lots.push([0, -inner / 4 - 1, inner, inner / 2 - 2]); lots.push([0, inner / 4 + 1, inner, inner / 2 - 2]); }
      else { for (const ox of [-1, 1]) for (const oz of [-1, 1]) lots.push([ox * (inner / 4 + 1), oz * (inner / 4 + 1), inner / 2 - 2, inner / 2 - 2]); }
      const downtown = Math.max(0, 1 - Math.hypot(cx, cz) / 320);
      for (const [ox, oz, lw, ld] of lots) {
        const w = lw - rng.range(1, 5), d = ld - rng.range(1, 5);
        let h = (13 + downtown * 46) * rng.range(0.65, 1.2);
        if (cx > 150) h *= 0.8; // beachfront stays lower
        h = Math.max(9, h);
        const bx = cx + ox, bz = cz + oz;
        // Tito's lock-up owns its yard in the north-west block: no random
        // building may crowd the garage footprint or its forecourt.
        if (bx + w / 2 > -210 && bx - w / 2 < -182 && bz + d / 2 > 118 && bz - d / 2 < 138) continue;
        const v = rng.int(0, 2);
        dummy.position.set(bx, h / 2, bz);
        dummy.scale.set(w, h, d);
        dummy.rotation.set(0, 0, 0);
        dummy.updateMatrix();
        placements[v].push({ matrix: dummy.matrix.clone(), colour: rng.pick(PALETTE.stucco) });
        dummy.position.set(bx, h + 0.4, bz);
        dummy.scale.set(w + 0.6, 0.8, d + 0.6);
        dummy.updateMatrix();
        roofMatrices.push({ matrix: dummy.matrix.clone(), colour: rng.pick(PALETTE.roofs) });
        colliders.push({ minX: bx - w / 2, maxX: bx + w / 2, minZ: bz - d / 2, maxZ: bz + d / 2 });
      }
    }
  }
  const unitBox = new THREE.BoxGeometry(1, 1, 1);
  placements.forEach((list, v) => {
    if (!list.length) return;
    const mat = new THREE.MeshLambertMaterial({
      map: facades[v].faceTex, emissive: 0xffc98a, emissiveMap: facades[v].glowTex, emissiveIntensity: 0.85,
    });
    const mesh = new THREE.InstancedMesh(unitBox, mat, list.length);
    list.forEach((p, k) => { mesh.setMatrixAt(k, p.matrix); mesh.setColorAt(k, tint.set(p.colour)); });
    mesh.castShadow = true; mesh.receiveShadow = true;
    group.add(mesh);
  });
  {
    const roofMesh = new THREE.InstancedMesh(unitBox, new THREE.MeshLambertMaterial({}), roofMatrices.length);
    roofMatrices.forEach((p, k) => { roofMesh.setMatrixAt(k, p.matrix); roofMesh.setColorAt(k, tint.set(p.colour)); });
    roofMesh.castShadow = true;
    group.add(roofMesh);
  }

  // --- Hotel Alba: the drop-off, with its name in lights ------------------
  {
    const parts = [];
    pushBox(parts, 36, 30, 22, 185, 15, -37, 0xfdf6e3);            // tower
    pushBox(parts, 38, 1.2, 24, 185, 30.6, -37, 0x6e3b4e);         // crown
    pushBox(parts, 12, 3.2, 6, 169, 1.6, -37, 0x14524e);           // entrance canopy (avenue side)
    pushBox(parts, 36, 2.2, 22, 185, 1.1, -37, 0x2a9d8f);          // teal base band
    const hotel = new THREE.Mesh(mergeParts(parts), vertexMaterial());
    hotel.castShadow = true; hotel.receiveShadow = true;
    group.add(hotel);
    const signCv = document.createElement('canvas'); signCv.width = 512; signCv.height = 96;
    const sg = signCv.getContext('2d');
    sg.fillStyle = '#123332'; sg.fillRect(0, 0, 512, 96);
    sg.font = '900 56px Georgia, serif'; sg.textAlign = 'center'; sg.textBaseline = 'middle';
    sg.fillStyle = '#ffd166'; sg.fillText('HOTEL  ALBA', 256, 52);
    const signTex = new THREE.CanvasTexture(signCv); signTex.colorSpace = THREE.SRGBColorSpace;
    const sign = new THREE.Mesh(
      new THREE.PlaneGeometry(24, 4.5),
      new THREE.MeshBasicMaterial({ map: signTex }),
    );
    sign.position.set(166.8, 24, -37);
    sign.rotation.y = -Math.PI / 2;
    group.add(sign);
    colliders.push({ minX: 185 - 18, maxX: 185 + 18, minZ: -37 - 11, maxZ: -37 + 11 });
  }

  // --- Marina: pier, kiosk and boats --------------------------------------
  const boats = [];
  {
    const parts = [];
    pushBox(parts, 36, 1.1, 11, 300, 0.55, 148, 0x8a6844);          // pier deck
    pushBox(parts, 8, 4.5, 7, 266, 2.25, 133, 0xfdf6e3);           // dock kiosk
    pushBox(parts, 9.5, 0.5, 8.5, 266, 4.9, 133, 0xd64550);         // kiosk awning
    const marinaMesh = new THREE.Mesh(mergeParts(parts), vertexMaterial());
    marinaMesh.castShadow = true; marinaMesh.receiveShadow = true;
    group.add(marinaMesh);
    colliders.push({ minX: 262, maxX: 270, minZ: 129.5, maxZ: 136.5 });
    const boatCols = [0xf4f1de, 0x2ec4b6, 0xd64550, 0xffd166];
    for (let i = 0; i < 4; i++) {
      const bp = [];
      const bx = 303 + (i % 2) * 13, bz = 138 + i * 7.5;
      pushBox(bp, 5.6, 1.1, 2.0, 0, 0.4, 0, boatCols[i]);
      pushBox(bp, 2.2, 0.9, 1.5, -0.6, 1.3, 0, 0xfdf6e3);
      pushBox(bp, 0.12, 4.6, 0.12, 0.9, 3.4, 0, 0x8a6844);
      pushBox(bp, 0.08, 3.4, 1.7, 1.05, 3.6, 0, 0xffffff, 0);
      const boat = new THREE.Mesh(mergeParts(bp), vertexMaterial());
      boat.position.set(bx, 0.1, bz);
      boat.rotation.y = Math.PI / 2 + (i % 2 ? 0.06 : -0.05);
      group.add(boat);
      boats.push({ mesh: boat, phase: i * 1.7 });
    }
  }

  // --- Tito's lock-up garage: the green door in the north-west -----------
  {
    const parts = [];
    pushBox(parts, 17, 6.5, 11, -196, 3.25, 128, 0xd8cfb8);          // shell
    pushBox(parts, 18, 0.7, 12, -196, 6.85, 128, 0x54486e);          // roof slab
    pushBox(parts, 9, 4.4, 0.5, -196, 2.2, 133.6, 0x2e7d6b);         // the green door
    pushBox(parts, 9.6, 0.5, 0.6, -196, 4.65, 133.6, 0x22304a);      // door lintel
    pushBox(parts, 0.5, 3.0, 4.5, -187.2, 1.5, 128, 0x8a6844);        // side door
    pushBox(parts, 2.6, 1.6, 0.3, -201, 4.6, 133.55, 0x33404f);      // office window
    pushBox(parts, 2.6, 1.6, 0.3, -191, 4.6, 133.55, 0x8a6a42);      // lit office window
    const garageMesh = new THREE.Mesh(mergeParts(parts), vertexMaterial());
    garageMesh.castShadow = true; garageMesh.receiveShadow = true;
    group.add(garageMesh);
    const gCv = document.createElement('canvas'); gCv.width = 512; gCv.height = 80;
    const gg = gCv.getContext('2d');
    gg.fillStyle = '#17352c'; gg.fillRect(0, 0, 512, 80);
    gg.font = '900 44px Georgia, serif'; gg.textAlign = 'center'; gg.textBaseline = 'middle';
    gg.fillStyle = '#ffd166'; gg.fillText("TITO'S  LOCK-UP", 256, 42);
    const gTex = new THREE.CanvasTexture(gCv); gTex.colorSpace = THREE.SRGBColorSpace;
    const gSign = new THREE.Mesh(new THREE.PlaneGeometry(11, 1.7), new THREE.MeshBasicMaterial({ map: gTex }));
    gSign.position.set(-196, 5.6, 133.85);
    group.add(gSign);
    colliders.push({ minX: -204.5, maxX: -187.5, minZ: 122.5, maxZ: 133.5 });
  }

  // --- Palms and lamps (instanced) ----------------------------------------
  {
    const spots = [];
    for (let z = -186; z <= 186; z += 13) {
      if (CITY.streets.some((s) => Math.abs(s - z) < 10)) continue;
      spots.push([238.5, z + rng.range(-2, 2)]);
      if (rng.chance(0.7)) spots.push([251, z + rng.range(-3, 6)]);
      if (rng.chance(0.45)) spots.push([264 + rng.range(0, 14), z + rng.range(-4, 4)]);
    }
    for (const p of parks) {
      const cx = (CITY.avenues[p.i] + CITY.avenues[p.i + 1]) / 2;
      const cz = (CITY.streets[p.j] + CITY.streets[p.j + 1]) / 2;
      for (let k = 0; k < 7; k++) spots.push([cx + rng.range(-22, 22), cz + rng.range(-22, 22)]);
    }
    const trunkGeo = new THREE.CylinderGeometry(0.16, 0.30, 4.8, 6);
    trunkGeo.translate(0, 2.4, 0);
    const frondParts = [];
    for (let k = 0; k < 6; k++) {
      const a = (k / 6) * Math.PI * 2;
      // Drooped fronds: each leaf tips half a radian down at the end, the
      // way a real palm sags in the evening heat.
      pushBox(frondParts, 3.6, 0.13, 0.7, Math.cos(a) * 1.5, 4.35, Math.sin(a) * 1.5, 0x3f9142, -a, -0.5);
    }
    pushBox(frondParts, 1.1, 0.9, 1.1, 0, 4.95, 0, 0x55a04a);
    const frondGeo = mergeParts(frondParts);
    const trunks = new THREE.InstancedMesh(trunkGeo, new THREE.MeshLambertMaterial({ color: 0x8a6844 }), spots.length);
    const fronds = new THREE.InstancedMesh(frondGeo, vertexMaterial(), spots.length);
    spots.forEach(([x, z], k) => {
      dummy.position.set(x, 0, z);
      dummy.rotation.set(rng.range(-0.05, 0.05), rng.range(0, Math.PI * 2), rng.range(-0.05, 0.05));
      const s = rng.range(0.85, 1.3);
      dummy.scale.set(s, s * rng.range(0.9, 1.25), s);
      dummy.updateMatrix();
      trunks.setMatrixAt(k, dummy.matrix);
      fronds.setMatrixAt(k, dummy.matrix);
    });
    trunks.castShadow = true; fronds.castShadow = true;
    group.add(trunks); group.add(fronds);

    const lampSpots = [];
    for (let z = -170; z <= 170; z += 34) lampSpots.push([231, z], [213, z + 17]);
    for (let x = -200; x <= 130; x += 37) lampSpots.push([x, -83], [x + 18, 83]);
    const poleGeo = new THREE.CylinderGeometry(0.09, 0.12, 5.6, 5);
    poleGeo.translate(0, 2.8, 0);
    const poles = new THREE.InstancedMesh(poleGeo, new THREE.MeshLambertMaterial({ color: 0x2f3542 }), lampSpots.length);
    const headGeo = new THREE.SphereGeometry(0.32, 8, 6);
    headGeo.translate(0, 5.7, 0);
    const heads = new THREE.InstancedMesh(headGeo, new THREE.MeshBasicMaterial({ color: 0xffd9a0 }), lampSpots.length);
    lampSpots.forEach(([x, z], k) => {
      dummy.position.set(x, 0, z); dummy.rotation.set(0, 0, 0); dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      poles.setMatrixAt(k, dummy.matrix);
      heads.setMatrixAt(k, dummy.matrix);
    });
    group.add(poles); group.add(heads);
  }

  // --- Queries and collision ----------------------------------------------
  function isRoad(x, z) {
    if (x > 232 && x < CITY.beachX) return true; // promenade apron drives like a road for AI
    return CITY.avenues.some((a) => Math.abs(x - a) < CITY.roadHalf) ||
           CITY.streets.some((s) => Math.abs(z - s) < CITY.roadHalf);
  }

  function collide(pos, radius, isVehicle = false) {
    for (const b of colliders) {
      const nx = Math.max(b.minX, Math.min(pos.x, b.maxX));
      const nz = Math.max(b.minZ, Math.min(pos.z, b.maxZ));
      const dx = pos.x - nx, dz = pos.z - nz;
      const d2 = dx * dx + dz * dz;
      if (d2 < radius * radius) {
        if (d2 > 0.0001) {
          const d = Math.sqrt(d2);
          pos.x = nx + (dx / d) * radius;
          pos.z = nz + (dz / d) * radius;
        } else {
          // Centre inside the box: push out along the smallest penetration.
          const pl = pos.x - b.minX, pr = b.maxX - pos.x, pn = pos.z - b.minZ, pf = b.maxZ - pos.z;
          const m = Math.min(pl, pr, pn, pf);
          if (m === pl) pos.x = b.minX - radius;
          else if (m === pr) pos.x = b.maxX + radius;
          else if (m === pn) pos.z = b.minZ - radius;
          else pos.z = b.maxZ + radius;
        }
      }
    }
    const maxX = isVehicle ? 284 : 296;
    pos.x = Math.max(CITY.landMinX + 2, Math.min(pos.x, maxX));
    pos.z = Math.max(-CITY.landHalfZ + 2, Math.min(pos.z, CITY.landHalfZ - 2));
  }

  return {
    group,
    colliders,
    parks,
    sun,
    isRoad,
    collide,
    followShadow(x, z) {
      sun.position.set(x + 150, 120, z + 36);
      sun.target.position.set(x, 0, z);
    },
    update(frame) {
      waveTex.offset.x = (frame * 0.0006) % 1;
      waveTex.offset.y = Math.sin(frame * 0.004) * 0.01;
      for (const b of boats) {
        b.mesh.position.y = 0.1 + Math.sin(frame * 0.02 + b.phase) * 0.09;
        b.mesh.rotation.z = Math.sin(frame * 0.016 + b.phase) * 0.03;
      }
    },
  };
}
