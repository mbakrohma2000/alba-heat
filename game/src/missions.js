// missions.js — the story of Alba Heat as one small stage machine:
// Mission 1 "First Run" (meet Tito, deliver the suitcase), Mission 2
// "Cold Open" (a timed pickup run across the city) and Mission 3
// "Four Stars" (shake a full pursuit and roll into Tito's lock-up with
// nobody on her tail). Story cards pause the world between missions.
// One job: own the mission state, its objective text, its timer and the
// golden beacon that marks the current target in the world.

import * as THREE from 'three';
import { CITY, STORY } from './config.js';

const STAGES = ['meet', 'deliver', 'card2', 'm2pickup', 'm2deliver', 'card3', 'm3escape', 'cardEnd', 'done'];

export function createMissions(scene, G) {
  // The beacon: a gold ring, a pillar of light and a floating marker letter,
  // visible across the city so the objective is never a guessing game.
  const beacon = new THREE.Group();
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(3.6, 0.22, 10, 44),
    new THREE.MeshBasicMaterial({ color: 0xffd166 }),
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.25;
  beacon.add(ring);
  const pillar = new THREE.Mesh(
    new THREE.CylinderGeometry(1.6, 1.6, 36, 18, 1, true),
    new THREE.MeshBasicMaterial({
      color: 0xffd166, transparent: true, opacity: 0.26,
      side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending,
    }),
  );
  pillar.position.y = 18;
  beacon.add(pillar);
  const markCv = document.createElement('canvas'); markCv.width = 128; markCv.height = 128;
  const mg = markCv.getContext('2d');
  mg.fillStyle = 'rgba(18,10,32,0.88)';
  mg.beginPath(); mg.arc(64, 64, 52, 0, Math.PI * 2); mg.fill();
  mg.lineWidth = 6; mg.strokeStyle = '#ffd166'; mg.stroke();
  mg.font = '900 74px Arial'; mg.textAlign = 'center'; mg.textBaseline = 'middle';
  mg.fillStyle = '#ffd166'; mg.fillText('!', 64, 68);
  const markTex = new THREE.CanvasTexture(markCv);
  const mark = new THREE.Sprite(new THREE.SpriteMaterial({ map: markTex, depthTest: false }));
  mark.scale.set(3.6, 3.6, 1);
  mark.position.y = 6.4;
  beacon.add(mark);
  scene.add(beacon);

  const missions = {
    stage: 'meet', // meet -> deliver -> card2 -> m2pickup -> m2deliver -> card3 -> m3escape -> cardEnd -> done
    timeLeft: null, // seconds left on the Mission 2 delivery leg, else null
    hotWarnT: 0,    // cooldown on the Mission 3 "too hot" warning

    target() {
      switch (this.stage) {
        case 'meet': return CITY.marina;
        case 'deliver': return CITY.hotelDropoff;
        case 'm2pickup': return CITY.plazaKiosk;
        case 'm2deliver': return CITY.marina;
        case 'm3escape': return CITY.hideout;
        default: return null;
      }
    },

    objective() {
      switch (this.stage) {
        case 'meet': return STORY.objectiveMeet;
        case 'deliver': return STORY.objectiveDeliver;
        case 'card2': return `Next: MISSION 2 — ${STORY.mission2Title}`;
        case 'm2pickup': return STORY.objectiveM2Pickup;
        case 'm2deliver': {
          const t = Math.max(0, Math.ceil(this.timeLeft || 0));
          const mm = Math.floor(t / 60), ss = String(t % 60).padStart(2, '0');
          return `${STORY.objectiveM2Deliver} (${mm}:${ss})`;
        }
        case 'card3': return `Next: MISSION 3 — ${STORY.mission3Title}`;
        case 'm3escape': return STORY.objectiveM3;
        case 'cardEnd': return STORY.objectiveAllDone;
        case 'done': return STORY.objectiveAllDone;
        default: return STORY.objectiveDone;
      }
    },

    // Silent stage change for save-loading and screenshot staging:
    // no banners, no rewards, no cards.
    setStage(stage) {
      if (!STAGES.includes(stage)) stage = 'meet';
      this.stage = stage;
      this.timeLeft = stage === 'm2deliver' ? STORY.m2TimeLimit : null;
    },

    // After a bust or a takedown, the current job restarts at its last
    // honest checkpoint. Returns true when Mission 3's heat must be
    // re-applied by the caller (the pursuit restarts at the station).
    onRespawn() {
      if (this.stage === 'deliver') this.stage = 'meet';
      else if (this.stage === 'm2deliver') { this.stage = 'm2pickup'; this.timeLeft = null; }
      else if (this.stage === 'card3') this.stage = 'm2pickup';
      else if (this.stage === 'card2') this.stage = 'deliver';
      return this.stage === 'm3escape';
    },

    update(dt) {
      if (this.hotWarnT > 0) this.hotWarnT -= dt;
      if (!G.cardOpen && G.state === 'playing') {
        if (this.stage === 'm2deliver' && this.timeLeft !== null) {
          this.timeLeft -= dt;
          if (this.timeLeft <= 0) {
            this.timeLeft = null;
            this.stage = 'm2pickup';
            G.showBanner(STORY.bannerM2LateBig, STORY.bannerM2LateSub);
            if (G.audio) G.audio.thud(6);
            G.saveGame();
          }
        }
        const target = this.target();
        if (target) {
          const d = Math.hypot(G.player.x - target.x, G.player.z - target.z);
          if (d < 7.5) this.tryAdvance();
        }
      }
      this.updateBeacon();
    },

    tryAdvance() {
      // Mission 3's door only opens for a driver nobody is chasing.
      if (this.stage === 'm3escape') {
        let nearest = Infinity;
        for (const car of G.police.cars) {
          nearest = Math.min(nearest, Math.hypot(car.x - G.player.x, car.z - G.player.z));
        }
        if (nearest < STORY.m3ClearRadius) {
          if (this.hotWarnT <= 0) {
            this.hotWarnT = 6;
            G.showBanner(STORY.bannerM3HotBig, STORY.bannerM3HotSub, 2.6);
            if (G.audio) G.audio.click();
          }
          return;
        }
      }
      this.advance();
    },

    advance() {
      if (this.stage === 'meet') {
        this.stage = 'deliver';
        G.police.setHeatAtLeast(2.2);
        if (G.audio) G.audio.chime();
        G.showBanner(STORY.bannerPickupBig, STORY.bannerPickupSub);
      } else if (this.stage === 'deliver') {
        G.addCash(STORY.reward);
        if (G.audio) G.audio.success();
        this.stage = 'card2';
        G.saveGame();
        G.showStoryCard(
          { kicker: STORY.card2Kicker, title: STORY.card2Title, body: STORY.card2Body },
          () => {
            this.stage = 'm2pickup';
            G.showBanner(`MISSION 2 — ${STORY.mission2Title}`, STORY.objectiveM2Pickup, 4.2);
            G.saveGame();
          },
        );
      } else if (this.stage === 'm2pickup') {
        this.stage = 'm2deliver';
        this.timeLeft = STORY.m2TimeLimit;
        G.police.setHeatAtLeast(2);
        if (G.audio) G.audio.chime();
        G.showBanner(STORY.bannerM2PickupBig, STORY.bannerM2PickupSub);
      } else if (this.stage === 'm2deliver') {
        this.timeLeft = null;
        G.addCash(STORY.reward2);
        if (G.audio) G.audio.success();
        G.showBanner(STORY.bannerM2DoneBig, STORY.bannerM2DoneSub);
        this.stage = 'card3';
        G.saveGame();
        G.showStoryCard(
          { kicker: STORY.card3Kicker, title: STORY.card3Title, body: STORY.card3Body },
          () => {
            this.stage = 'm3escape';
            G.police.setHeatAtLeast(STORY.m3Heat);
            G.showBanner(`MISSION 3 — ${STORY.mission3Title}`, 'Every siren in Puerto Alba just woke up.', 4.2);
            G.saveGame();
          },
        );
      } else if (this.stage === 'm3escape') {
        G.addCash(STORY.reward3);
        if (G.audio) G.audio.success();
        G.showBanner(STORY.bannerM3DoneBig, STORY.bannerM3DoneSub, 5);
        G.police.clear(); // the garage door closes on the whole pursuit
        this.stage = 'cardEnd';
        G.saveGame();
        G.showStoryCard(
          { kicker: STORY.cardEndKicker, title: STORY.cardEndTitle, body: STORY.cardEndBody },
          () => {
            this.stage = 'done';
            G.showBanner('STORY COMPLETE', STORY.objectiveAllDone, 4.5);
            G.saveGame();
          },
        );
      }
    },

    updateBeacon() {
      const target = this.target();
      beacon.visible = !!target && G.state !== 'menu';
      if (!target) return;
      beacon.position.set(target.x, 0, target.z);
      const pulse = 1 + Math.sin(G.frame * 0.07) * 0.07;
      ring.scale.set(pulse, pulse, 1);
      mark.position.y = 6.4 + Math.sin(G.frame * 0.05) * 0.35;
      pillar.material.opacity = 0.22 + Math.sin(G.frame * 0.07) * 0.06;
    },
  };

  return missions;
}
