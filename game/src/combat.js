// combat.js — Marina's two arguments: her fists and the pistol Tito left
// in the marina kiosk drawer. Punching is close, quiet and personal; the
// pistol is a hitscan with a muzzle flash, a tracer, a 12-round magazine
// and a reload — and every shot fired in the open street is a crime the
// whole neighbourhood hears. One job: own combat and report its crimes
// outward through the game context, like every other system.

import * as THREE from 'three';
import { TUNING } from './config.js';

const MAG_SIZE = 12;
const PUNCH_RANGE = 2.35;
const SHOT_RANGE = 58;

function makeFlashTexture() {
  const cv = document.createElement('canvas'); cv.width = 64; cv.height = 64;
  const c = cv.getContext('2d');
  const g = c.createRadialGradient(32, 32, 1, 32, 32, 30);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.3, 'rgba(255,220,150,0.75)');
  g.addColorStop(1, 'rgba(255,180,80,0)');
  c.fillStyle = g; c.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(cv);
}

export function createCombat(G) {
  const scene = G.scene;
  const tex = makeFlashTexture();

  const flash = new THREE.Sprite(new THREE.SpriteMaterial({
    map: tex, color: 0xffd9a0, transparent: true, opacity: 0,
    blending: THREE.AdditiveBlending, depthWrite: false,
  }));
  flash.scale.set(1.5, 1.5, 1);
  flash.visible = false;
  scene.add(flash);

  const puff = new THREE.Sprite(new THREE.SpriteMaterial({
    map: tex, color: 0xcfc4b0, transparent: true, opacity: 0, depthWrite: false,
  }));
  puff.visible = false;
  scene.add(puff);

  const tracerGeo = new THREE.BufferGeometry();
  tracerGeo.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0, 0, 0, 0], 3));
  const tracer = new THREE.Line(tracerGeo, new THREE.LineBasicMaterial({
    color: 0xffe6a8, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false,
  }));
  tracer.visible = false;
  tracer.frustumCulled = false;
  scene.add(tracer);

  let ammo = MAG_SIZE;
  let reserve = 60;
  let punchCd = 0, shotCd = 0, reloadT = 0;
  let flashT = 0, puffT = 0, tracerT = 0, lungeT = 0;

  function witnessed(x, z, radius) {
    for (const car of G.police.cars) {
      if (Math.hypot(car.x - x, car.z - z) < radius) return true;
    }
    return false;
  }

  function impactAt(x, y, z, scale) {
    puff.position.set(x, y, z);
    puff.scale.set(scale, scale, 1);
    puff.material.opacity = 0.75;
    puff.visible = true;
    puffT = 0.22;
  }

  function punch() {
    const player = G.player;
    punchCd = 0.45;
    lungeT = 0.16;
    if (G.audio) G.audio.punch();
    const fx = Math.sin(player.heading), fz = Math.cos(player.heading);
    let best = null, bestD = PUNCH_RANGE;
    for (const ped of G.pedestrians.list) {
      if (ped.state === 'down') continue;
      const dx = ped.x - player.x, dz = ped.z - player.z;
      const d = Math.hypot(dx, dz);
      if (d > bestD) continue;
      if (d > 0.4 && (dx * fx + dz * fz) / d < 0.35) continue; // must be in front of her
      best = ped; bestD = d;
    }
    if (best && G.pedestrians.knockDown(best)) {
      const seen = witnessed(best.x, best.z, 52);
      G.police.addHeat(seen ? TUNING.crimePunch : TUNING.crimePunch * 0.4);
      G.pedestrians.panic(best.x, best.z, 11);
      impactAt(best.x, 1.1, best.z, 0.9);
      if (G.audio) G.audio.thud(4);
    } else {
      G.pedestrians.panic(player.x + fx * 2, player.z + fz * 2, 5);
    }
  }

  function startReload() {
    if (reloadT > 0 || ammo >= MAG_SIZE || reserve <= 0) return;
    reloadT = 1.15;
    if (G.audio) G.audio.reload();
  }

  function shoot() {
    const player = G.player;
    shotCd = 0.24;
    if (ammo <= 0) {
      if (G.audio) G.audio.dryFire();
      startReload();
      return;
    }
    ammo--;
    if (G.audio) G.audio.shot();
    const fx = Math.sin(player.heading), fz = Math.cos(player.heading);
    const ox = player.x + fx * 0.55, oz = player.z + fz * 0.55;
    flash.position.set(ox, 1.28, oz);
    flash.visible = true;
    flash.material.opacity = 0.95;
    flashT = 0.055;

    // Hitscan: walk the ray past every person and car, take the closest hit.
    let hitT = SHOT_RANGE, hitKind = null, hitObj = null;
    const test = (x, z, lateral, kind, obj) => {
      const dx = x - player.x, dz = z - player.z;
      const along = dx * fx + dz * fz;
      if (along < 0.6 || along > hitT) return;
      const side = Math.abs(dx * fz - dz * fx);
      if (side < lateral) { hitT = along; hitKind = kind; hitObj = obj; }
    };
    for (const ped of G.pedestrians.list) {
      if (ped.state === 'down') continue;
      test(ped.x, ped.z, 0.85, 'ped', ped);
    }
    for (const car of G.allCars()) test(car.x, car.z, car.radius + 0.5, 'car', car);

    const hx = player.x + fx * hitT, hz = player.z + fz * hitT;
    const pos = tracer.geometry.getAttribute('position');
    pos.setXYZ(0, ox, 1.28, oz);
    pos.setXYZ(1, hx, 1.15, hz);
    pos.needsUpdate = true;
    tracer.visible = true;
    tracer.material.opacity = 0.85;
    tracerT = 0.07;

    G.police.addHeat(TUNING.crimeShot); // a gunshot is never a secret
    G.pedestrians.panic(player.x, player.z, 15);
    if (hitKind === 'ped') {
      if (G.pedestrians.knockDown(hitObj)) {
        G.police.addHeat(TUNING.crimeShotHit);
        impactAt(hitObj.x, 1.1, hitObj.z, 1.1);
      }
    } else if (hitKind === 'car') {
      hitObj.damage = Math.min(1, (hitObj.damage || 0) + 0.22);
      if (hitObj.kind === 'police') G.police.addHeat(0.8);
      impactAt(hx, 0.8, hz, 1.2);
    }
    if (ammo <= 0) startReload();
  }

  return {
    get ammo() { return ammo; },
    get reserve() { return reserve; },
    get reloading() { return reloadT > 0; },
    ammoText() {
      if (reloadT > 0) return 'RELOADING…';
      return `PISTOL ${ammo} / ${reserve}`;
    },

    update(dt) {
      punchCd -= dt; shotCd -= dt;
      if (reloadT > 0) {
        reloadT -= dt;
        if (reloadT <= 0) {
          const take = Math.min(MAG_SIZE - ammo, reserve);
          ammo += take; reserve -= take;
        }
      }
      if (flashT > 0) { flashT -= dt; if (flashT <= 0) { flash.visible = false; flash.material.opacity = 0; } }
      if (puffT > 0) { puffT -= dt; puff.material.opacity = Math.max(0, puffT * 3); if (puffT <= 0) puff.visible = false; }
      if (tracerT > 0) { tracerT -= dt; tracer.material.opacity = Math.max(0, tracerT * 10); if (tracerT <= 0) tracer.visible = false; }

      const player = G.player;
      // The punch lunge: a short forward lean drawn over the synced mesh.
      if (lungeT > 0 && player.mode === 'foot') {
        lungeT -= dt;
        const off = Math.sin(Math.max(0, lungeT) / 0.16 * Math.PI) * 0.3;
        player.group.position.x += Math.sin(player.heading) * off;
        player.group.position.z += Math.cos(player.heading) * off;
      } else {
        lungeT = 0;
      }

      if (G.state !== 'playing' || G.cardOpen || player.mode !== 'foot') return;
      if (G.input.hit('KeyJ') && punchCd <= 0 && reloadT <= 0) punch();
      else if (G.input.hit('KeyK') && shotCd <= 0 && reloadT <= 0) shoot();
      if (G.input.hit('KeyR')) startReload();
    },
  };
}
