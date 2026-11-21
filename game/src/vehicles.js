// vehicles.js — every car in Puerto Alba: how a car mesh is built from
// coloured boxes, the parked cars waiting to be stolen, and the traffic
// that drives the grid with right-hand lanes, intersection turns and
// car-ahead braking. One job: own the cars and their ordinary driving;
// the player and the police borrow the same meshes for their own cars.

import * as THREE from 'three';
import { CITY, PALETTE, CAR_MODELS, TUNING } from './config.js';
import { pushBox, mergeParts, vertexMaterial } from './geometry.js';

const LANE = 3.1; // lane offset from a road centre line, right-hand traffic

// One soft radial sprite texture, tinted per use: headlight halos, tail
// light bloom and damage smoke all share the same falloff.
function makeGlowTexture() {
  const cv = document.createElement('canvas'); cv.width = 64; cv.height = 64;
  const c = cv.getContext('2d');
  const g = c.createRadialGradient(32, 32, 2, 32, 32, 31);
  g.addColorStop(0, 'rgba(255,255,255,0.95)');
  g.addColorStop(0.35, 'rgba(255,255,255,0.42)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  c.fillStyle = g; c.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(cv);
}
let sharedGlowTex = null;
function glowSprite(colour, scale, opacity) {
  if (!sharedGlowTex) sharedGlowTex = makeGlowTexture();
  const mat = new THREE.SpriteMaterial({
    map: sharedGlowTex, color: colour, transparent: true, opacity,
    blending: THREE.AdditiveBlending, depthWrite: false,
  });
  const sprite = new THREE.Sprite(mat);
  sprite.scale.set(scale, scale, 1);
  return sprite;
}

// Build one car's mesh. Local space: length along +X (the nose), width
// along Z, ground at y=0. Police cars get a working light bar on top.
export function buildCarMesh(rng, { police = false, paint = null, model = null } = {}) {
  const spec = model || rng.pick(CAR_MODELS);
  const colour = police ? 0xf4f1de : (paint != null ? paint : rng.pick(PALETTE.carPaint));
  const dark = new THREE.Color(colour).multiplyScalar(0.62).getHex();
  const parts = [];
  const L = spec.len, W = spec.wid;
  pushBox(parts, L, 0.30, W + 0.04, 0, 0.34, 0, dark);                       // skirt
  pushBox(parts, L, spec.bodyH, W, 0, 0.36 + spec.bodyH / 2, 0, colour);     // body
  pushBox(parts, L * 0.94, 0.10, W - 0.1, 0, 0.42 + spec.bodyH, 0, colour);  // shoulder line
  pushBox(parts, spec.cabLen, spec.cabH, W - 0.34, -0.15, 0.48 + spec.bodyH + spec.cabH / 2, 0, 0x1d2733); // glasshouse
  pushBox(parts, 0.5, 0.16, W - 0.2, L / 2 - 0.1, 0.30, 0, 0x22242c);         // front bumper
  pushBox(parts, 0.5, 0.16, W - 0.2, -L / 2 + 0.1, 0.30, 0, 0x22242c);       // rear bumper
  pushBox(parts, 0.08, 0.13, 0.42, L / 2 + 0.02, 0.52, W / 2 - 0.34, 0xfff3b0);  // headlights
  pushBox(parts, 0.08, 0.13, 0.42, L / 2 + 0.02, 0.52, -W / 2 + 0.34, 0xfff3b0);
  pushBox(parts, 0.08, 0.13, 0.42, -L / 2 - 0.02, 0.52, W / 2 - 0.34, 0xd92038); // taillights
  pushBox(parts, 0.08, 0.13, 0.42, -L / 2 - 0.02, 0.52, -W / 2 + 0.34, 0xd92038);
  for (const wx of [L / 2 - 0.85, -L / 2 + 0.85]) {
    for (const wz of [W / 2 - 0.05, -W / 2 + 0.05]) {
      pushBox(parts, 0.62, 0.68, 0.24, wx, 0.34, wz, 0x14151a);              // wheels
    }
  }
  if (police) {
    pushBox(parts, L * 0.5, spec.bodyH * 0.7, W + 0.02, -0.2, 0.36 + spec.bodyH / 2, 0, 0x22242c); // black band
    pushBox(parts, 0.9, 0.10, W - 0.5, -0.15, 0.52 + spec.bodyH + spec.cabH + 0.05, 0, 0x22242c);   // light bar base
  }
  const mesh = new THREE.Mesh(mergeParts(parts), vertexMaterial());
  mesh.castShadow = true;
  const group = new THREE.Group();
  group.add(mesh);
  // Dusk glow: a warm halo on each headlight, a red bloom on each tail light.
  for (const side of [W / 2 - 0.34, -W / 2 + 0.34]) {
    const head = glowSprite(0xffdf9e, 1.7, 0.55);
    head.position.set(L / 2 + 0.18, 0.52, side);
    group.add(head);
    const tail = glowSprite(0xff2a3c, 1.15, 0.5);
    tail.position.set(-L / 2 - 0.18, 0.52, side);
    group.add(tail);
  }
  let lightBar = null;
  if (police) {
    const mkLamp = (hex) => {
      const lamp = new THREE.Mesh(
        new THREE.BoxGeometry(0.42, 0.14, 0.5),
        new THREE.MeshBasicMaterial({ color: hex }),
      );
      lamp.position.set(-0.15, 0.60 + spec.bodyH + spec.cabH + 0.10, 0);
      return lamp;
    };
    const red = mkLamp(0xff2038); red.position.z = 0.28;
    const blue = mkLamp(0x2255ff); blue.position.z = -0.28;
    group.add(red); group.add(blue);
    lightBar = { red, blue };
  }
  return { group, spec, lightBar, paint: colour };
}

function laneOffset(axis, dir) {
  // Right-hand traffic: avenue (axis z) dir +1 keeps east; street (axis x) dir +1 keeps north side.
  if (axis === 'z') return dir > 0 ? LANE : -LANE;
  return dir > 0 ? -LANE : LANE;
}

function makeTrafficRoute(rng) {
  const onAvenue = rng.chance(0.55);
  if (onAvenue) {
    const line = rng.pick(CITY.avenues);
    const dir = rng.sign();
    return { axis: 'z', line, dir, fixed: line + laneOffset('z', dir), along: rng.range(-180, 180) };
  }
  const line = rng.pick(CITY.streets);
  const dir = rng.sign();
  return { axis: 'x', line, dir, fixed: line + laneOffset('x', dir), along: rng.range(-240, 230) };
}

export function createVehicles(scene, city, rng) {
  const traffic = [];
  const parked = [];

  function placeMesh(car) {
    car.mesh.position.set(car.x, 0, car.z);
    car.mesh.rotation.y = car.heading - Math.PI / 2;
  }

  for (let i = 0; i < TUNING.trafficCount; i++) {
    const built = buildCarMesh(rng);
    scene.add(built.group);
    const route = makeTrafficRoute(rng);
    const car = {
      kind: 'traffic', mesh: built.group, model: built.spec, paint: built.paint, route,
      x: route.axis === 'z' ? route.fixed : route.along,
      z: route.axis === 'z' ? route.along : route.fixed,
      heading: route.axis === 'z' ? (route.dir > 0 ? 0 : Math.PI) : (route.dir > 0 ? Math.PI / 2 : -Math.PI / 2),
      speed: 0, cruise: rng.range(8.5, 13), radius: 2.3, lastCross: '', damage: 0,
    };
    if (Math.hypot(car.x - CITY.playerStart.x, car.z - CITY.playerStart.z) < 30) { car.x += 60; car.z += 40; }
    placeMesh(car);
    traffic.push(car);
  }

  for (let i = 0; i < TUNING.parkedCount; i++) {
    const built = buildCarMesh(rng);
    scene.add(built.group);
    let x, z, heading;
    if (rng.chance(0.6)) {
      const a = rng.pick(CITY.avenues);
      const side = rng.sign();
      x = a + side * 5.7;
      heading = side > 0 ? Math.PI : 0;
      do { z = rng.range(-185, 185); } while (CITY.streets.some((s) => Math.abs(s - z) < 11));
    } else {
      const s = rng.pick(CITY.streets);
      const side = rng.sign();
      z = s + side * 5.7;
      heading = side > 0 ? -Math.PI / 2 : Math.PI / 2;
      do { x = rng.range(-250, 225); } while (CITY.avenues.some((a) => Math.abs(a - x) < 11));
    }
    const car = { kind: 'parked', mesh: built.group, model: built.spec, paint: built.paint, x, z, heading, speed: 0, radius: 2.3, damage: 0 };
    placeMesh(car);
    parked.push(car);
  }

  // Is there anything solid in the corridor just ahead of this car?
  function blockedAhead(car, blockers, lookDist) {
    const fx = Math.sin(car.heading), fz = Math.cos(car.heading);
    let nearest = Infinity;
    const test = (o) => {
      if (o === car) return;
      const dx = o.x - car.x, dz = o.z - car.z;
      const ahead = dx * fx + dz * fz;
      if (ahead < 0.5 || ahead > lookDist) return;
      const side = Math.abs(dx * fz - dz * fx);
      if (side < 2.1 && ahead < nearest) nearest = ahead;
    };
    traffic.forEach(test);
    parked.forEach(test);
    blockers.forEach(test);
    return nearest;
  }

  function driveTraffic(car, dt, blockers) {
    const r = car.route;
    const gap = blockedAhead(car, blockers, 9);
    let target = car.cruise;
    if (gap < 9) target = gap < 4.2 ? 0 : car.cruise * (gap - 4) / 5;
    car.speed += Math.max(-22 * dt, Math.min(9 * dt, target - car.speed));

    // Lane keeping: steer gently toward the lane line.
    const cross = r.axis === 'z' ? car.x : car.z;
    const err = r.fixed - cross;
    const base = r.axis === 'z' ? (r.dir > 0 ? 0 : Math.PI) : (r.dir > 0 ? Math.PI / 2 : -Math.PI / 2);
    const corr = THREE.MathUtils.clamp((r.axis === 'z' ? err : -err) * 0.09, -0.55, 0.55);
    let want = base + corr;
    let dh = want - car.heading;
    while (dh > Math.PI) dh -= Math.PI * 2;
    while (dh < -Math.PI) dh += Math.PI * 2;
    car.heading += THREE.MathUtils.clamp(dh, -1.6 * dt, 1.6 * dt);

    car.x += Math.sin(car.heading) * car.speed * dt;
    car.z += Math.cos(car.heading) * car.speed * dt;

    // Intersection decisions and city-edge U-turns.
    const along = r.axis === 'z' ? car.z : car.x;
    const crosses = r.axis === 'z' ? CITY.streets : CITY.avenues;
    for (const cl of crosses) {
      if (Math.abs(along - cl) < 1.4) {
        const key = `${r.axis}:${cl}`;
        if (car.lastCross !== key) {
          car.lastCross = key;
          if (rng.chance(0.42)) {
            const newDir = rng.sign();
            const newAxis = r.axis === 'z' ? 'x' : 'z';
            r.axis = newAxis; r.line = cl; r.dir = newDir;
            r.fixed = cl + laneOffset(newAxis, newDir);
          }
        }
      }
    }
    const limit = r.axis === 'z' ? CITY.landHalfZ - 8 : 252;
    if ((r.dir > 0 && along > limit) || (r.dir < 0 && along < -limit)) {
      r.dir = -r.dir;
      r.fixed = r.line + laneOffset(r.axis, r.dir);
    }
    city.collide(car, car.radius, true);
    placeMesh(car);
  }

  // --- Ground and air dressing: skid marks and damage smoke ---------------
  // Skids are a ring of fading dark quads stamped under a sliding car;
  // smoke is a ring of soft sprites that hurt cars breathe out.
  const skidPool = [];
  {
    const geo = new THREE.PlaneGeometry(1.05, 2.3);
    for (let i = 0; i < 130; i++) {
      const mat = new THREE.MeshBasicMaterial({ color: 0x14100c, transparent: true, opacity: 0, depthWrite: false });
      const quad = new THREE.Mesh(geo, mat);
      quad.rotation.x = -Math.PI / 2;
      quad.position.y = 0.03;
      quad.visible = false;
      scene.add(quad);
      skidPool.push({ mesh: quad, life: 0 });
    }
  }
  let skidCursor = 0;
  function addSkid(x, z, heading) {
    const slot = skidPool[skidCursor];
    skidCursor = (skidCursor + 1) % skidPool.length;
    slot.mesh.position.x = x; slot.mesh.position.z = z;
    slot.mesh.rotation.z = -heading;
    slot.mesh.visible = true;
    slot.life = 7;
  }

  const puffPool = [];
  for (let i = 0; i < 42; i++) {
    const puff = glowSprite(0x8a8378, 1, 0);
    puff.material.blending = THREE.NormalBlending;
    puff.visible = false;
    scene.add(puff);
    puffPool.push({ sprite: puff, life: 0, max: 1, vx: 0, vz: 0 });
  }
  let puffCursor = 0;
  function spawnPuff(x, y, z, darkness) {
    const slot = puffPool[puffCursor];
    puffCursor = (puffCursor + 1) % puffPool.length;
    slot.sprite.position.set(x, y, z);
    slot.sprite.material.color.setScalar(0.32 + darkness * 0.3);
    slot.sprite.visible = true;
    slot.max = slot.life = 1.15;
    slot.vx = rng.range(-0.25, 0.25);
    slot.vz = rng.range(-0.25, 0.25);
  }

  function updateEffects(dt, cars) {
    for (const s of skidPool) {
      if (s.life <= 0) continue;
      s.life -= dt;
      s.mesh.material.opacity = Math.min(0.5, s.life * 0.35);
      if (s.life <= 0) s.mesh.visible = false;
    }
    for (const car of cars) {
      const dmg = car.damage || 0;
      if (dmg < 0.4) { car._smokeT = 0; continue; }
      car._smokeT = (car._smokeT || 0) - dt;
      if (car._smokeT <= 0) {
        car._smokeT = 0.13;
        const fx = Math.sin(car.heading), fz = Math.cos(car.heading);
        spawnPuff(car.x + fx * car.model.len * 0.42, 0.95, car.z + fz * car.model.len * 0.42, dmg);
      }
    }
    for (const p of puffPool) {
      if (p.life <= 0) continue;
      p.life -= dt;
      const t = 1 - p.life / p.max;
      p.sprite.position.y += dt * 1.6;
      p.sprite.position.x += p.vx * dt;
      p.sprite.position.z += p.vz * dt;
      const s = 0.8 + t * 2.1;
      p.sprite.scale.set(s, s, 1);
      p.sprite.material.opacity = 0.42 * (1 - t);
      if (p.life <= 0) p.sprite.visible = false;
    }
  }

  return {
    traffic,
    parked,
    all: [...traffic, ...parked],
    addSkid,
    updateEffects,
    update(dt, blockers = []) {
      for (const car of traffic) if (car.kind === 'traffic') driveTraffic(car, dt, blockers);
    },
    nearestStealable(x, z, maxDist) {
      let best = null, bestD = maxDist;
      for (const car of [...parked, ...traffic]) {
        const d = Math.hypot(car.x - x, car.z - z);
        if (d < bestD) { bestD = d; best = car; }
      }
      return best;
    },
    syncMesh(car) { placeMesh(car); },
  };
}
