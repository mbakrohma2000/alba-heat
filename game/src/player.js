// player.js — Marina Solano herself: walking and running on foot, climbing
// into any car and driving it with arcade physics, the third-person camera,
// and her health. One job: own the player character and the car she is in;
// crimes are reported outward through the game context, never judged here.

import * as THREE from 'three';
import { CITY, TUNING } from './config.js';
import { buildPerson } from './pedestrians.js';

const CAR_MAX_SPEED = 34;
const CAM_FOOT = { dist: 7.5, height: 3.1 };
const CAM_CAR = { dist: 11, height: 4.4 };

export function createPlayer(scene, camera, rng) {
  const built = buildPerson(rng, { player: true });
  scene.add(built.group);

  const player = {
    ...built,
    x: CITY.playerStart.x, z: CITY.playerStart.z, heading: CITY.playerStart.heading,
    mode: 'foot', car: null, speed: 0, health: 100,
    camYaw: 0, camPitch: 0, walkPhase: 0, calmTime: 0, hurtFlash: 0,

    placeAt(x, z, heading) {
      this.x = x; this.z = z; this.heading = heading;
      if (this.car) { this.car.x = x; this.car.z = z; this.car.heading = heading; }
      this.syncMesh();
    },

    syncMesh() {
      if (this.mode === 'car' && this.car) {
        this.car.mesh.position.set(this.car.x, 0, this.car.z);
        this.car.mesh.rotation.y = this.car.heading - Math.PI / 2;
        this.group.visible = false;
      } else {
        this.group.visible = true;
        this.group.position.set(this.x, 0, this.z);
        this.group.rotation.y = this.heading;
      }
    },

    damage(amount, G) {
      if (this.health <= 0) return;
      this.health = Math.max(0, this.health - amount);
      this.calmTime = 0;
      this.hurtFlash = 1;
      if (this.health <= 0 && G.onPlayerDown) G.onPlayerDown();
    },

    enterCar(car, G) {
      this.mode = 'car';
      this.car = car;
      car.kind = 'player';
      car.speed = 0;
      this.x = car.x; this.z = car.z; this.heading = car.heading;
      if (G.onSteal) G.onSteal(car);
      this.syncMesh();
    },

    exitCar() {
      const car = this.car;
      if (!car) return;
      const rx = Math.cos(car.heading), rz = -Math.sin(car.heading); // right of the car
      this.x = car.x + rx * 2.4; this.z = car.z + rz * 2.4;
      this.heading = car.heading;
      car.kind = 'parked';
      car.speed = 0;
      this.car = null;
      this.mode = 'foot';
      this.syncMesh();
    },

    update(dt, G) {
      const input = G.input;
      // Mouse-drag look-around, easing back behind the actor.
      const drag = input.takeDrag();
      this.camYaw -= drag.dx * 0.0052;
      this.camPitch = THREE.MathUtils.clamp(this.camPitch + drag.dy * 0.003, -0.12, 0.38);
      this.camYaw *= Math.max(0, 1 - dt * 1.1);
      this.camPitch *= Math.max(0, 1 - dt * 0.7);

      this.calmTime += dt;
      if (this.calmTime > 8 && this.health > 0) this.health = Math.min(100, this.health + 3 * dt);
      this.hurtFlash = Math.max(0, this.hurtFlash - dt * 1.6);

      if (this.mode === 'foot') this.updateOnFoot(dt, G);
      else this.updateDriving(dt, G);
      this.updateCamera(dt);
      if (G.audio) G.audio.setEngine(this.mode === 'car', this.mode === 'car' ? Math.abs(this.car.speed) / CAR_MAX_SPEED : 0);
    },

    updateOnFoot(dt, G) {
      const input = G.input;
      const axis = input.axis();
      const camHeading = this.heading + this.camYaw;
      let mx = 0, mz = 0;
      if (axis.x !== 0 || axis.y !== 0) {
        const fx = Math.sin(camHeading), fz = Math.cos(camHeading);
        const rx = Math.cos(camHeading), rz = -Math.sin(camHeading);
        mx = fx * axis.y + rx * axis.x;
        mz = fz * axis.y + rz * axis.x;
        const len = Math.hypot(mx, mz) || 1;
        mx /= len; mz /= len;
        const running = input.down('ShiftLeft', 'ShiftRight');
        const speed = running ? TUNING.runSpeed : TUNING.walkSpeed;
        const want = Math.atan2(mx, mz);
        let dh = want - this.heading;
        while (dh > Math.PI) dh -= Math.PI * 2;
        while (dh < -Math.PI) dh += Math.PI * 2;
        this.heading += THREE.MathUtils.clamp(dh, -11 * dt, 11 * dt);
        this.x += mx * speed * dt;
        this.z += mz * speed * dt;
        this.walkPhase += dt * (running ? 11 : 8);
      }
      const swing = Math.sin(this.walkPhase) * ((axis.x || axis.y) ? 0.6 : 0);
      this.legL.rotation.x = swing;
      this.legR.rotation.x = -swing;
      // Do not walk through cars.
      for (const car of G.allCars()) {
        const dx = this.x - car.x, dz = this.z - car.z;
        const d = Math.hypot(dx, dz);
        if (d < 2.6 && d > 0.001) { this.x = car.x + (dx / d) * 2.6; this.z = car.z + (dz / d) * 2.6; }
      }
      const pos = { x: this.x, z: this.z };
      G.city.collide(pos, 0.5, false);
      this.x = pos.x; this.z = pos.z;
      this.speed = 0;
      this.syncMesh();
    },

    updateDriving(dt, G) {
      const input = G.input;
      const car = this.car;
      const axis = input.axis();
      const handbrake = input.down('Space');
      if (axis.y > 0) {
        car.speed += TUNING.carAccel * (1 - car.speed / (CAR_MAX_SPEED * 1.15)) * dt;
      } else if (axis.y < 0) {
        if (car.speed > 0.6) car.speed -= TUNING.carBrake * dt;
        else car.speed = Math.max(-TUNING.carReverseMax, car.speed - 9 * dt);
      }
      if (handbrake) {
        car.speed -= Math.sign(car.speed) * Math.min(Math.abs(car.speed), 26 * dt);
        // A sliding car writes on the road: stamp a skid quad every few
        // metres of slide, under the rear axle.
        this._skidT = (this._skidT || 0) - dt;
        if (Math.abs(car.speed) > 8 && this._skidT <= 0 && G.vehicles && G.vehicles.addSkid) {
          this._skidT = 0.055;
          const fx = Math.sin(car.heading), fz = Math.cos(car.heading);
          G.vehicles.addSkid(car.x - fx * (car.model.len / 2 - 0.9), car.z - fz * (car.model.len / 2 - 0.9), car.heading);
        }
      }
      car.speed -= car.speed * TUNING.carDrag * 0.32 * dt;
      if (Math.abs(car.speed) < 0.02 && axis.y === 0) car.speed = 0;

      const steerAuthority = THREE.MathUtils.clamp(car.speed * 0.052, -1.65, 1.65) * (handbrake ? 1.6 : 1);
      car.heading += axis.x * steerAuthority * dt;

      const preX = car.x, preZ = car.z;
      car.x += Math.sin(car.heading) * car.speed * dt;
      car.z += Math.cos(car.heading) * car.speed * dt;

      // Cars: shove and be shoved.
      for (const other of G.allCars()) {
        if (other === car) continue;
        const dx = car.x - other.x, dz = car.z - other.z;
        const d = Math.hypot(dx, dz);
        const minD = car.radius + other.radius - 0.35;
        if (d < minD && d > 0.001) {
          const push = (minD - d);
          car.x += (dx / d) * push * 0.7;
          car.z += (dz / d) * push * 0.7;
          if (other.kind === 'traffic') {
            other.x -= (dx / d) * push * 0.3;
            other.z -= (dz / d) * push * 0.3;
            other.speed = Math.min(other.speed || 0, Math.abs(car.speed) * 0.5);
          }
          const impact = Math.abs(car.speed);
          if (impact > 5) {
            car.damage = Math.min(1, (car.damage || 0) + Math.min(0.3, impact * 0.012));
            if (other) other.damage = Math.min(1, (other.damage || 0) + Math.min(0.2, impact * 0.008));
            if (G.onCarCrash) G.onCarCrash(impact, other);
            car.speed *= 0.45;
          }
        }
      }
      // Buildings and the sea wall: a hard stop is a crash.
      const pos = { x: car.x, z: car.z };
      G.city.collide(pos, car.radius, true);
      const correction = Math.hypot(pos.x - car.x, pos.z - car.z);
      car.x = pos.x; car.z = pos.z;
      if (correction > 0.35 && Math.abs(car.speed) > 9) {
        car.damage = Math.min(1, (car.damage || 0) + 0.18);
        if (G.onCarCrash) G.onCarCrash(Math.abs(car.speed), null);
        this.damage((Math.abs(car.speed) - 8) * 0.55, G);
        car.speed *= 0.25;
      }
      this.x = car.x; this.z = car.z; this.heading = car.heading;
      this.speed = car.speed;
      void preX; void preZ;
      this.syncMesh();
    },

    updateCamera(dt) {
      const inCar = this.mode === 'car';
      const spec = inCar ? CAM_CAR : CAM_FOOT;
      const heading = this.heading + this.camYaw;
      const fx = Math.sin(heading), fz = Math.cos(heading);
      const tx = (inCar && this.car ? this.car.x : this.x);
      const tz = (inCar && this.car ? this.car.z : this.z);
      const desired = new THREE.Vector3(
        tx - fx * spec.dist,
        spec.height + this.camPitch * 6,
        tz - fz * spec.dist,
      );
      if (desired.y < 1.1) desired.y = 1.1;
      const k = 1 - Math.exp(-dt * (inCar ? 4.2 : 5.5));
      camera.position.lerp(desired, k);
      const look = new THREE.Vector3(tx + fx * 5, 1.7, tz + fz * 5);
      camera.lookAt(look);
      this.cityRef && this.cityRef.followShadow(tx, tz);
    },
  };

  player.syncMesh();
  return player;
}
