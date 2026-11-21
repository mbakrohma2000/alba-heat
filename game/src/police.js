// police.js — the Alba PD: the wanted heat that crimes raise and calm time
// lowers, the patrol cars that spawn at the edge of sight and hunt the
// player down, their flashing light bars, and the bust meter that fills
// when Marina is cornered. One job: own law enforcement.

import * as THREE from 'three';
import { CITY, TUNING } from './config.js';
import { buildCarMesh } from './vehicles.js';
import { pushBox, mergeParts, vertexMaterial } from './geometry.js';

const SIREN_RED_ON = 0xff2038, SIREN_RED_OFF = 0x4d0d18;
const SIREN_BLUE_ON = 0x2b5cff, SIREN_BLUE_OFF = 0x101d4d;

export function createPolice(scene, rng) {
  const cars = [];
  let spawnCooldown = 0;
  let roadblock = null;      // { cars: [a, b], strip, cx, cz, axis, used }
  let roadblockCooldown = 8; // first block comes a little after the 4th star

  // A spike strip: a dark mat with pale studs, laid across a road.
  function buildStripMesh(width) {
    const parts = [];
    pushBox(parts, width, 0.07, 1.15, 0, 0.04, 0, 0x1c1c22);
    for (let x = -width / 2 + 0.5; x < width / 2; x += 0.85) {
      pushBox(parts, 0.16, 0.1, 0.16, x, 0.1, 0, 0xd8d8e0);
    }
    const mesh = new THREE.Mesh(mergeParts(parts), vertexMaterial());
    return mesh;
  }

  // Park two patrol cars nose-to-tail across a road and lay the strip on the
  // approach side. axis 'z': the road runs along Z (an avenue), the block
  // spans X at height cz. axis 'x': mirrored for a street running along X.
  function placeRoadblock(cx, cz, axis) {
    removeRoadblock();
    const pair = [];
    for (const off of [-3.3, 3.3]) {
      const built = buildCarMesh(rng, { police: true, model: null });
      scene.add(built.group);
      const car = {
        kind: 'police', roadblock: true, mesh: built.group, lightBar: built.lightBar,
        model: built.spec, x: axis === 'z' ? cx + off : cx, z: axis === 'z' ? cz : cz + off,
        heading: axis === 'z' ? Math.PI / 2 : 0, speed: 0, radius: 2.3, damage: 0,
      };
      built.group.position.set(car.x, 0, car.z);
      built.group.rotation.y = car.heading - Math.PI / 2;
      cars.push(car);
      pair.push(car);
    }
    const strip = buildStripMesh(13.5);
    strip.position.set(cx, 0, cz);
    if (axis === 'x') strip.rotation.y = Math.PI / 2;
    scene.add(strip);
    roadblock = { cars: pair, strip, cx, cz, axis, used: false };
    return roadblock;
  }

  function removeRoadblock() {
    if (!roadblock) return;
    for (const car of roadblock.cars) {
      scene.remove(car.mesh);
      const i = cars.indexOf(car);
      if (i >= 0) cars.splice(i, 1);
    }
    scene.remove(roadblock.strip);
    roadblock = null;
  }

  // Choose the road the player is on and block it ~60 m ahead of her.
  function buildRoadblockAhead(player) {
    const dirX = Math.sin(player.heading), dirZ = Math.cos(player.heading);
    const avenue = CITY.avenues.reduce((best, a) => (Math.abs(a - player.x) < Math.abs(best - player.x) ? a : best), CITY.avenues[0]);
    const street = CITY.streets.reduce((best, s) => (Math.abs(s - player.z) < Math.abs(best - player.z) ? s : best), CITY.streets[0]);
    if (Math.abs(avenue - player.x) <= Math.abs(street - player.z) && Math.abs(avenue - player.x) < 12) {
      const cz = THREE.MathUtils.clamp(player.z + dirZ * 62, -182, 182);
      if (CITY.streets.some((s) => Math.abs(s - cz) < 9)) return false; // not inside an intersection
      placeRoadblock(avenue, cz, 'z');
      roadblock.strip.position.z = cz - Math.sign(dirZ || 1) * 3.2;
      return true;
    }
    if (Math.abs(street - player.z) < 12) {
      const cx = THREE.MathUtils.clamp(player.x + dirX * 62, -248, 232);
      if (CITY.avenues.some((a) => Math.abs(a - cx) < 9)) return false;
      placeRoadblock(cx, street, 'x');
      roadblock.strip.position.x = cx - Math.sign(dirX || 1) * 3.2;
      return true;
    }
    return false;
  }

  const police = {
    cars,
    heat: 0,          // 0..5, fractional; stars are its ceiling
    crimeTimer: 0,
    bustMeter: 0,

    get stars() { return this.heat <= 0.02 ? 0 : Math.min(5, Math.ceil(this.heat)); },

    addHeat(amount) {
      this.heat = Math.min(5, this.heat + amount);
      this.crimeTimer = TUNING.wantedDecayDelay;
    },

    setHeatAtLeast(value) {
      if (this.heat < value) this.heat = value;
      this.crimeTimer = TUNING.wantedDecayDelay;
    },

    clear() {
      this.heat = 0; this.crimeTimer = 0; this.bustMeter = 0;
      removeRoadblock();
      for (const car of cars) scene.remove(car.mesh);
      cars.length = 0;
    },

    // Deterministic roadblock placement for screenshot staging: block the
    // road at (cx, cz), strip shifted stripOffset metres along the road.
    stageRoadblock(cx, cz, axis, stripOffset = -3.2) {
      placeRoadblock(cx, cz, axis);
      if (axis === 'z') roadblock.strip.position.z = cz + stripOffset;
      else roadblock.strip.position.x = cx + stripOffset;
    },

    get hasRoadblock() { return !!roadblock; },

    spawnNear(player) {
      const onAvenue = rng.chance(0.6);
      let x, z, heading;
      if (onAvenue) {
        const a = CITY.avenues.reduce((best, av) => (Math.abs(av - player.x) < Math.abs(best - player.x) ? av : best), CITY.avenues[0]);
        x = a + (player.z > 0 ? -3.1 : 3.1);
        z = THREE.MathUtils.clamp(player.z + rng.sign() * rng.range(52, 80), -186, 186);
        heading = z < player.z ? 0 : Math.PI;
      } else {
        const s = CITY.streets.reduce((best, st) => (Math.abs(st - player.z) < Math.abs(best - player.z) ? st : best), CITY.streets[0]);
        z = s + (player.x > 0 ? 3.1 : -3.1);
        x = THREE.MathUtils.clamp(player.x + rng.sign() * rng.range(52, 80), -252, 226);
        heading = x < player.x ? Math.PI / 2 : -Math.PI / 2;
      }
      const built = buildCarMesh(rng, { police: true, model: null });
      scene.add(built.group);
      const car = {
        kind: 'police', mesh: built.group, lightBar: built.lightBar, model: built.spec,
        x, z, heading, speed: 0, radius: 2.3, damage: 0,
      };
      built.group.position.set(x, 0, z);
      built.group.rotation.y = heading - Math.PI / 2;
      cars.push(car);
      return car;
    },

    update(dt, G) {
      const player = G.player;
      // Heat fades once Marina keeps her nose clean for a while.
      if (this.crimeTimer > 0) this.crimeTimer -= dt;
      else if (this.heat > 0) this.heat = Math.max(0, this.heat - TUNING.wantedDecayRate * dt);

      const wanted = this.stars;
      spawnCooldown -= dt;
      if (cars.length < wanted && spawnCooldown <= 0) {
        this.spawnNear(player);
        spawnCooldown = 1.6;
      }
      for (let i = cars.length - 1; i >= 0; i--) {
        const car = cars[i];
        if (car.roadblock) continue; // the block lives and dies as a unit
        const d = Math.hypot(car.x - player.x, car.z - player.z);
        if ((cars.length > wanted && d > 40) || d > 210) {
          scene.remove(car.mesh);
          cars.splice(i, 1);
        }
      }

      // Roadblocks: at four stars and up the Alba PD stops chasing fair.
      roadblockCooldown -= dt;
      if (wanted >= 4 && !roadblock && roadblockCooldown <= 0) {
        if (buildRoadblockAhead(player)) roadblockCooldown = 30;
        else roadblockCooldown = 4;
      }
      if (roadblock) {
        const dBlock = Math.hypot(roadblock.cx - player.x, roadblock.cz - player.z);
        if (dBlock > 135 || wanted < 3) removeRoadblock();
        else if (!roadblock.used && player.mode === 'car' && player.car) {
          const s = roadblock.strip.position;
          const across = roadblock.axis === 'z'
            ? Math.abs(player.car.z - s.z) < 1.7 && Math.abs(player.car.x - s.x) < 7.2
            : Math.abs(player.car.x - s.x) < 1.7 && Math.abs(player.car.z - s.z) < 7.2;
          if (across && Math.abs(player.car.speed) > 3) {
            roadblock.used = true;
            player.car.speed *= 0.3;
            if (G.audio) G.audio.screech();
            G.showBanner('SPIKE STRIP', 'Tyres shredded — she is rolling on rims and nerve.', 2.2);
          }
        }
      }

      let nearest = Infinity;
      for (const car of cars) {
        const dx = player.x - car.x, dz = player.z - car.z;
        const dist = Math.hypot(dx, dz);
        nearest = Math.min(nearest, dist);
        if (car.roadblock) {
          // Parked across the road: lights flashing, going nowhere.
          if (car.lightBar) {
            const phase = (G.frame >> 3) % 2 === 0;
            car.lightBar.red.material.color.setHex(phase ? SIREN_RED_ON : SIREN_RED_OFF);
            car.lightBar.blue.material.color.setHex(phase ? SIREN_BLUE_OFF : SIREN_BLUE_ON);
          }
          continue;
        }
        // Predict where the player is going and drive at that point.
        const lead = player.mode === 'car' ? 0.45 : 0.1;
        const tx = player.x + Math.sin(player.heading) * (player.speed || 0) * lead;
        const tz = player.z + Math.cos(player.heading) * (player.speed || 0) * lead;
        const want = Math.atan2(tx - car.x, tz - car.z);
        let dh = want - car.heading;
        while (dh > Math.PI) dh -= Math.PI * 2;
        while (dh < -Math.PI) dh += Math.PI * 2;
        car.heading += THREE.MathUtils.clamp(dh, -2.3 * dt, 2.3 * dt);
        let top = dist > 120 ? 37 : 31.5;
        if (dist < 9) top = Math.max(6, Math.abs(player.speed || 0) + 2);
        car.speed += Math.max(-26 * dt, Math.min(13.5 * dt, top - car.speed));
        car.x += Math.sin(car.heading) * car.speed * dt;
        car.z += Math.cos(car.heading) * car.speed * dt;
        const pos = { x: car.x, z: car.z };
        G.city.collide(pos, car.radius, true);
        car.x = pos.x; car.z = pos.z;
        // Ramming the player's car hurts.
        if (player.mode === 'car' && player.car) {
          const pdx = player.car.x - car.x, pdz = player.car.z - car.z;
          const pd = Math.hypot(pdx, pdz);
          if (pd < 4.35 && pd > 0.001) {
            player.car.x += (pdx / pd) * (4.35 - pd) * 0.6;
            player.car.z += (pdz / pd) * (4.35 - pd) * 0.6;
            if (car.speed > 7 && G.onPoliceRam) G.onPoliceRam(car.speed);
            car.speed *= 0.42;
          }
        }
        // Light bar: alternate red and blue on a frame clock, never on time.
        if (car.lightBar) {
          const phase = (G.frame >> 3) % 2 === 0;
          car.lightBar.red.material.color.setHex(phase ? SIREN_RED_ON : SIREN_RED_OFF);
          car.lightBar.blue.material.color.setHex(phase ? SIREN_BLUE_OFF : SIREN_BLUE_ON);
        }
        car.mesh.position.set(car.x, 0, car.z);
        car.mesh.rotation.y = car.heading - Math.PI / 2;
      }
      // Keep patrol cars out of each other's doors.
      for (let i = 0; i < cars.length; i++) {
        for (let j = i + 1; j < cars.length; j++) {
          const a = cars[i], b = cars[j];
          const dx = b.x - a.x, dz = b.z - a.z;
          const d = Math.hypot(dx, dz);
          if (d < 4.4 && d > 0.001) {
            const push = (4.4 - d) / 2;
            a.x -= (dx / d) * push; a.z -= (dz / d) * push;
            b.x += (dx / d) * push; b.z += (dz / d) * push;
          }
        }
      }

      // The bust meter: cornered and slow with a patrol car close by.
      const playerSlow = Math.abs(player.speed || 0) < 1.4;
      if (wanted > 0 && playerSlow && nearest < 7) {
        this.bustMeter += dt / 3;
        if (this.bustMeter >= 1 && G.onBusted) { G.onBusted(); this.bustMeter = 0; }
      } else {
        this.bustMeter = Math.max(0, this.bustMeter - dt * 0.7);
      }

      if (G.audio) G.audio.setSiren(cars.length > 0, nearest === Infinity ? 0 : THREE.MathUtils.clamp(1 - nearest / 70, 0, 1));
    },
  };

  return police;
}
