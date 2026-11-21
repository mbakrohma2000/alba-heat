// pedestrians.js — the people of Puerto Alba: how a person is built from
// coloured boxes, and the sidewalk loops and promenade strolls they walk,
// pausing for traffic and falling when a car finds them. One job: own the
// pedestrians; getting hit is reported through a callback, never decided here.

import * as THREE from 'three';
import { CITY, PALETTE, TUNING } from './config.js';
import { pushBox, mergeParts, vertexMaterial } from './geometry.js';

// A low-poly person: merged torso/head/arms, with separate legs so the walk
// can swing them. Local space: faces +Z, feet at y=0.
export function buildPerson(rng, { player = false } = {}) {
  const shirt = player ? 0x2ec4b6 : rng.pick(PALETTE.shirt);
  const pants = player ? 0x22304a : rng.pick(PALETTE.pants);
  const skin = rng.pick(PALETTE.skin);
  const parts = [];
  pushBox(parts, 0.54, 0.64, 0.27, 0, 1.14, 0, shirt);            // torso
  pushBox(parts, 0.15, 0.55, 0.16, -0.35, 1.12, 0, shirt);        // arms
  pushBox(parts, 0.15, 0.55, 0.16, 0.35, 1.12, 0, shirt);
  pushBox(parts, 0.15, 0.16, 0.16, -0.35, 0.82, 0, skin);         // hands
  pushBox(parts, 0.15, 0.16, 0.16, 0.35, 0.82, 0, skin);
  pushBox(parts, 0.31, 0.34, 0.30, 0, 1.63, 0, skin);             // head
  pushBox(parts, 0.34, 0.10, 0.33, 0, 1.83, 0, player ? 0xffd166 : 0x2b2118); // cap / hair
  if (player) pushBox(parts, 0.36, 0.05, 0.22, 0, 1.79, 0.22, 0xffd166);     // cap brim
  const body = new THREE.Mesh(mergeParts(parts), vertexMaterial());
  body.castShadow = true;
  const group = new THREE.Group();
  group.add(body);
  const legGeo = new THREE.BoxGeometry(0.17, 0.82, 0.19);
  legGeo.translate(0, -0.41, 0);
  const legMat = new THREE.MeshLambertMaterial({ color: pants });
  const legL = new THREE.Mesh(legGeo, legMat); legL.position.set(-0.14, 0.84, 0);
  const legR = new THREE.Mesh(legGeo, legMat); legR.position.set(0.14, 0.84, 0);
  legL.castShadow = legR.castShadow = true;
  group.add(legL); group.add(legR);
  return { group, legL, legR };
}

export function createPedestrians(scene, rng) {
  const peds = [];

  function blockLoopPath() {
    const i = rng.int(0, CITY.avenues.length - 2);
    const j = rng.int(0, CITY.streets.length - 2);
    const inset = CITY.roadHalf + 2.6;
    return {
      type: 'loop',
      minX: CITY.avenues[i] + inset, maxX: CITY.avenues[i + 1] - inset,
      minZ: CITY.streets[j] + inset, maxZ: CITY.streets[j + 1] - inset,
    };
  }

  function loopPoint(path, s) {
    const w = path.maxX - path.minX, d = path.maxZ - path.minZ;
    const per = 2 * (w + d);
    s = ((s % per) + per) % per;
    if (s < w) return { x: path.minX + s, z: path.minZ, h: Math.PI / 2 };
    if (s < w + d) return { x: path.maxX, z: path.minZ + (s - w), h: 0 };
    if (s < 2 * w + d) return { x: path.maxX - (s - w - d), z: path.maxZ, h: -Math.PI / 2 };
    return { x: path.minX, z: path.maxZ - (s - 2 * w - d), h: Math.PI };
  }

  for (let i = 0; i < TUNING.pedCount; i++) {
    const built = buildPerson(rng);
    scene.add(built.group);
    const onPromenade = i % 3 === 0;
    const ped = {
      ...built,
      x: 0, z: 0, heading: 0, speed: rng.range(1.05, 1.7),
      path: onPromenade ? { type: 'line' } : blockLoopPath(),
      s: rng.range(0, 300), dir: rng.sign(), phase: rng.range(0, 6),
      state: 'walk', downTimer: 0, wait: 0,
      panicT: 0, panicMode: null, // 'flee' | 'cower' while panicT runs down
      radius: 0.45,
    };
    if (ped.path.type === 'line') { ped.x = 240 + rng.range(-3, 4); ped.z = rng.range(-180, 180); }
    else { const p = loopPoint(ped.path, ped.s); ped.x = p.x; ped.z = p.z; ped.heading = p.h; }
    ped.group.position.set(ped.x, 0, ped.z);
    peds.push(ped);
  }

  // Lay a pedestrian out flat (a punch, a bullet, a bumper all end here).
  // Returns false if they were already down. The caller reports the crime.
  function knockDown(ped) {
    if (ped.state === 'down') return false;
    ped.state = 'down';
    ped.downTimer = 7;
    ped.panicT = 0; ped.panicMode = null;
    ped.group.scale.y = 1;
    ped.group.rotation.x = -Math.PI / 2;
    ped.group.position.y = 0.25;
    return true;
  }

  return {
    list: peds,
    knockDown,
    // Everybody near a violent moment reacts: some run, some fold up small.
    panic(x, z, radius) {
      for (const ped of peds) {
        if (ped.state === 'down') continue;
        if (Math.hypot(ped.x - x, ped.z - z) > radius) continue;
        ped.panicT = rng.range(2.4, 4.6);
        ped.panicMode = rng.chance(0.45) ? 'cower' : 'flee';
      }
    },
    // blockers: [{x, z, speed}] — cars and the player; onHit(ped) fires once per fall.
    update(dt, blockers, onHit) {
      for (const ped of peds) {
        if (ped.state === 'down') {
          ped.downTimer -= dt;
          if (ped.downTimer <= 0) {
            ped.state = 'walk';
            ped.group.rotation.x = 0;
            if (ped.path.type === 'line') { ped.z = rng.range(-180, 180); ped.x = 240; }
            else { const p = loopPoint(ped.path, ped.s); ped.x = p.x; ped.z = p.z; }
          }
          continue;
        }
        // Hit by something moving fast and close?
        let hit = false;
        for (const b of blockers) {
          const d = Math.hypot(b.x - ped.x, b.z - ped.z);
          if (d < 1.25 && Math.abs(b.speed || 0) > 2.5) { hit = true; break; }
          if (d < 3.4 && Math.abs(b.speed || 0) > 1) ped.wait = Math.max(ped.wait, 0.5);
        }
        if (hit) {
          knockDown(ped);
          if (onHit) onHit(ped);
          continue;
        }
        // Panic: cowering folds a person up small and still; fleeing sends
        // them sprinting along their route until the fright burns off.
        let moveScale = 1;
        let holding = ped.wait > 0;
        if (ped.panicT > 0) {
          ped.panicT -= dt;
          if (ped.panicMode === 'cower') {
            holding = true;
            ped.group.scale.y = Math.max(0.72, ped.group.scale.y - dt * 2.4);
          } else if (ped.panicMode === 'flee') {
            moveScale = 2.7;
            holding = false;
          }
          if (ped.panicT <= 0) { ped.panicMode = null; ped.group.scale.y = 1; }
        }
        if (ped.wait > 0) { ped.wait -= dt; }
        if (!holding) {
          ped.s += ped.speed * moveScale * ped.dir * dt;
          if (ped.path.type === 'line') {
            ped.z += ped.speed * moveScale * ped.dir * dt;
            if (ped.z > 186) { ped.z = 186; ped.dir = -1; }
            if (ped.z < -186) { ped.z = -186; ped.dir = 1; }
            ped.x = 240 + Math.sin(ped.s * 0.05) * 2.5;
            ped.heading = ped.dir > 0 ? 0 : Math.PI;
          } else {
            const p = loopPoint(ped.path, ped.s);
            ped.x = p.x; ped.z = p.z;
            ped.heading = ped.dir > 0 ? p.h : p.h + Math.PI;
          }
        }
        const swing = holding ? 0 : Math.sin(ped.s * 4.4 + ped.phase) * 0.55 * (moveScale > 1 ? 1.4 : 1);
        ped.legL.rotation.x = swing;
        ped.legR.rotation.x = -swing;
        ped.group.position.set(ped.x, Math.abs(Math.sin(ped.s * 4.4 + ped.phase)) * 0.045, ped.z);
        ped.group.rotation.y = ped.heading;
      }
    },
  };
}
