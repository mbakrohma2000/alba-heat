// main.js — boot and the one loop for Alba Heat: build the city and every
// actor system, wire the crimes and consequences between them, run the
// state machine (menu / playing / paused / busted), keep the HUD and the
// minimap honest, and save Marina's progress. Shot mode (?shot=...) stages
// a frozen frame from shots.js instead of running the simulation.

import * as THREE from 'three';
import { CITY, STORY, TUNING } from './config.js';
import { makeRng, seedFromString } from './random.js';
import { createInput } from './input.js';
import { createCity } from './city.js';
import { createVehicles } from './vehicles.js';
import { createPedestrians } from './pedestrians.js';
import { createPlayer } from './player.js';
import { createPolice } from './police.js';
import { createMissions } from './missions.js';
import { createCombat } from './combat.js';
import { createAudio } from './audio.js';
import { stageShot } from './shots.js';

const SAVE_KEY = 'albaheat.save.v1';
const params = new URLSearchParams(location.search);
const shotName = params.get('shot');
const rng = makeRng(seedFromString(params.get('seed') || '1'));

const app = document.getElementById('app');
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.24;
app.appendChild(renderer.domElement);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.1, 2200);
camera.position.set(276, 15, 52);
camera.lookAt(138, 9, -34);

const input = createInput(renderer.domElement);
const city = createCity(scene, rng);
const vehicles = createVehicles(scene, city, rng);
const pedestrians = createPedestrians(scene, rng);
const player = createPlayer(scene, camera, rng);
player.cityRef = city;
const police = createPolice(scene, rng);
const audio = createAudio();

// --- DOM handles -----------------------------------------------------------
const $ = (id) => document.getElementById(id);
const hud = $('hud'), cashVal = $('cashVal'), healthFill = $('healthFill');
const starsEl = $('stars'), objectiveText = $('objectiveText');
const promptEl = $('prompt'), promptText = $('promptText');
const speedo = $('speedo'), speedoNum = $('speedoNum'), speedoCar = $('speedoCar');
const bannerEl = $('banner'), bannerBig = $('bannerBig'), bannerSub = $('bannerSub');
const vignette = $('vignette'), statusEl = $('status');
const ammoPanel = $('ammoPanel'), ammoText = $('ammoText'), timerChip = $('timerChip');
const storyCardEl = $('storyCard'), storyKicker = $('storyKicker');
const storyTitle = $('storyTitle'), storyBody = $('storyBody');
const minimapCtx = $('minimap').getContext('2d');
let bannerTimer = 0;
let storyCallback = null;

// --- The shared game context every system reads ----------------------------
const G = {
  state: 'menu', // menu | playing | paused | busted
  frame: 0,
  cash: STORY.startCash,
  frozen: !!shotName,
  cardOpen: false, // a story card is up: the world holds its breath
  ownedCar: null,  // the last car Marina climbed into — hers until it isn't
  input, city, vehicles, pedestrians, player, police, audio, camera, scene,
  allCars() { return [...vehicles.all, ...police.cars]; },
  addCash(n) { G.cash = Math.max(0, G.cash + n); },
  showBanner(big, sub, seconds = 4.2) {
    bannerBig.textContent = big;
    bannerSub.textContent = sub || '';
    bannerEl.classList.add('show');
    bannerTimer = seconds;
    statusEl.textContent = `${big}. ${sub || ''}`;
  },
  // A story card: the world freezes behind it until Marina rolls out.
  showStoryCard(card, onGo) {
    storyKicker.textContent = card.kicker;
    storyTitle.textContent = card.title;
    storyBody.textContent = card.body;
    storyCallback = onGo || null;
    storyCardEl.classList.remove('hidden');
    G.cardOpen = true;
    statusEl.textContent = `${card.title}. ${card.body}`;
  },
  saveGame() {
    try {
      const car = G.ownedCar;
      localStorage.setItem(SAVE_KEY, JSON.stringify({
        cash: G.cash,
        stage: missions.stage,
        x: player.x, z: player.z, heading: player.heading,
        car: car ? {
          model: car.model.name, paint: car.paint,
          x: Math.round(car.x * 10) / 10, z: Math.round(car.z * 10) / 10, heading: car.heading,
        } : null,
        settings: { muted: audio.muted },
      }));
    } catch (err) { /* storage off: the run lasts this visit only */ }
  },
  // --- consequences, wired once -------------------------------------------
  onSteal(car) {
    const seen = police.cars.some((p) => Math.hypot(p.x - car.x, p.z - car.z) < 48);
    if (car.wasTraffic || seen) police.addHeat(car.wasTraffic ? 0.8 : 0.35);
    audio.click();
  },
  onCarCrash(impact, other) {
    audio.thud(impact);
    if (other && impact > 7) {
      police.addHeat(other.kind === 'police' ? TUNING.crimeCarHit + 0.5 : TUNING.crimeCarHit);
    }
  },
  onPedHit(ped) {
    pedestrians.panic(ped.x, ped.z, 9);
    if (player.mode === 'car' && player.car && Math.hypot(player.car.x - ped.x, player.car.z - ped.z) < 3.2) {
      police.addHeat(TUNING.crimePedHit);
      audio.thud(9);
      G.showBanner('YOU HIT SOMEONE', 'The Alba PD is on its way. Drive!', 2.6);
    }
  },
  onPoliceRam(speed) {
    player.damage((speed - 6) * 0.85, G);
    if (player.car) player.car.damage = Math.min(1, (player.car.damage || 0) + 0.12);
    audio.thud(speed);
  },
  onBusted() { endRun(true); },
  onPlayerDown() { endRun(false); },
};
const missions = createMissions(scene, G);
G.missions = missions;
const combat = createCombat(G);
G.combat = combat;
window.__alba = G; // a handle for scripted smoke tests

// Track whether a claimed car was moving traffic (for the steal heat),
// and remember it as Marina's current car for the save file.
const baseEnter = player.enterCar.bind(player);
player.enterCar = (car, ctx) => {
  car.wasTraffic = car.kind === 'traffic';
  G.ownedCar = car;
  baseEnter(car, ctx);
};

function loadSave() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (err) { return null; }
}

function endRun(busted) {
  if (G.state !== 'playing') return;
  G.state = 'busted';
  const fine = busted ? Math.min(G.cash, 200) : Math.min(G.cash, 150);
  G.cash -= fine;
  $('bustedTitle').textContent = busted ? 'BUSTED' : 'TAKEN DOWN';
  $('bustedText').textContent = busted
    ? `The Alba PD took Marina in. The station charges a $${fine} processing fee — and Tito's suitcase is gone.`
    : `Marina wakes up at the coast clinic with a $${fine} bill and a ringing head. The suitcase is gone.`;
  $('bustedScreen').classList.remove('hidden');
  audio.setEngine(false, 0);
  audio.setSiren(false, 0);
  statusEl.textContent = busted ? 'Busted by the Alba PD.' : 'Marina was taken down.';
}

function respawn() {
  $('bustedScreen').classList.add('hidden');
  police.clear();
  if (player.car) { player.car.kind = 'parked'; player.car.speed = 0; player.car = null; player.mode = 'foot'; }
  player.health = 100;
  const reapplyHeat = missions.onRespawn();
  player.placeAt(CITY.station.x, CITY.station.z, -Math.PI / 2);
  if (reapplyHeat) police.setHeatAtLeast(STORY.m3Heat); // Mission 3 restarts hot
  G.state = 'playing';
  G.saveGame();
}

function startGame(fromSave) {
  audio.init();
  audio.click();
  const save = fromSave ? loadSave() : null;
  if (save) {
    G.cash = typeof save.cash === 'number' ? save.cash : STORY.startCash;
    if (save.settings && typeof save.settings.muted === 'boolean') audio.setMuted(save.settings.muted);
    if (save.stage) {
      missions.setStage(save.stage);
      // A save taken while a story card was up resumes at the mission the
      // card was introducing — the card itself is not replayed.
      if (missions.stage === 'card2') missions.setStage('m2pickup');
      else if (missions.stage === 'card3') { missions.setStage('m3escape'); police.setHeatAtLeast(STORY.m3Heat); }
      else if (missions.stage === 'cardEnd') missions.setStage('done');
    }
    player.placeAt(
      THREE.MathUtils.clamp(save.x ?? CITY.playerStart.x, -250, 290),
      THREE.MathUtils.clamp(save.z ?? CITY.playerStart.z, -190, 190),
      save.heading ?? CITY.playerStart.heading,
    );
    // Her car is where she left it: same model, same colour, same corner.
    if (save.car) {
      const match = vehicles.parked.find((c) => c.model.name === save.car.model && c.paint === save.car.paint)
        || vehicles.parked.find((c) => c.model.name === save.car.model);
      if (match) {
        match.x = save.car.x; match.z = save.car.z; match.heading = save.car.heading || 0;
        match.speed = 0;
        vehicles.syncMesh(match);
        G.ownedCar = match;
      }
    }
  } else {
    G.cash = STORY.startCash;
    missions.setStage('meet');
    player.placeAt(CITY.playerStart.x, CITY.playerStart.z, CITY.playerStart.heading);
  }
  $('startScreen').classList.add('hidden');
  $('pauseScreen').classList.add('hidden');
  hud.classList.remove('hidden');
  G.state = 'playing';
  G.showBanner(
    missions.stage === 'meet' ? `MISSION 1 — ${STORY.mission1Title}` : 'WELCOME BACK',
    missions.objective(), 3.6,
  );
}

$('btnStart').addEventListener('click', () => startGame(false));
$('btnContinue').addEventListener('click', () => startGame(true));
$('btnStoryGo').addEventListener('click', () => {
  storyCardEl.classList.add('hidden');
  G.cardOpen = false;
  audio.click();
  const cb = storyCallback;
  storyCallback = null;
  if (cb) cb();
});
$('btnResume').addEventListener('click', () => {
  $('pauseScreen').classList.add('hidden');
  G.state = 'playing';
});
$('btnRespawn').addEventListener('click', respawn);
if (loadSave()) $('btnContinue').classList.remove('hidden');

// --- HUD -------------------------------------------------------------------
let lastCash = -1, lastStars = -1, lastObjective = '', lastHealth = -1, lastAmmo = '', lastTimer = -2;
function updateHud() {
  if (G.cash !== lastCash) { cashVal.textContent = String(G.cash); lastCash = G.cash; }
  const hp = Math.round(player.health);
  if (hp !== lastHealth) { healthFill.style.width = `${hp}%`; lastHealth = hp; }
  const ammo = combat.ammoText();
  if (ammo !== lastAmmo) {
    ammoText.textContent = ammo;
    ammoPanel.classList.toggle('low', combat.ammo <= 3 && !combat.reloading);
    lastAmmo = ammo;
  }
  const t = missions.timeLeft;
  const tSec = t === null ? -1 : Math.max(0, Math.ceil(t));
  if (tSec !== lastTimer) {
    lastTimer = tSec;
    if (tSec < 0) timerChip.classList.add('hidden');
    else {
      timerChip.classList.remove('hidden');
      timerChip.textContent = `${Math.floor(tSec / 60)}:${String(tSec % 60).padStart(2, '0')}`;
      timerChip.classList.toggle('late', tSec <= 20);
    }
  }
  const stars = police.stars;
  if (stars !== lastStars) {
    [...starsEl.children].forEach((s, i) => { s.className = i < stars ? 'on' : 'off'; });
    lastStars = stars;
  }
  const obj = missions.objective();
  if (obj !== lastObjective) { objectiveText.textContent = obj; lastObjective = obj; }
  vignette.style.opacity = String(player.hurtFlash * 0.95);
  if (player.mode === 'car' && player.car) {
    speedo.classList.remove('hidden');
    speedoNum.textContent = String(Math.round(Math.abs(player.car.speed) * 3.6));
    speedoCar.textContent = player.car.model.name;
  } else {
    speedo.classList.add('hidden');
  }
}

function drawMinimap() {
  const c = minimapCtx;
  const S = 188, C = S / 2, R = 92, view = 100, scale = R / view;
  const mx = (wx) => C + (wx - player.x) * scale;
  const mz = (wz) => C + (wz - player.z) * scale;
  c.clearRect(0, 0, S, S);
  c.save();
  c.beginPath(); c.arc(C, C, R, 0, Math.PI * 2); c.clip();
  c.fillStyle = '#6f5c40'; c.fillRect(0, 0, S, S);                       // land
  c.fillStyle = '#2a9d8f'; c.fillRect(mx(CITY.waterX), 0, S, S);        // sea
  c.fillStyle = '#eed49f'; c.fillRect(mx(CITY.beachX), 0, mx(CITY.waterX) - mx(CITY.beachX), S); // sand
  // Building blocks: pale slabs for built blocks, green for the parks.
  for (let i = 0; i < CITY.avenues.length - 1; i++) {
    for (let j = 0; j < CITY.streets.length - 1; j++) {
      const x0 = CITY.avenues[i] + CITY.roadHalf, x1 = CITY.avenues[i + 1] - CITY.roadHalf;
      const z0 = CITY.streets[j] + CITY.roadHalf, z1 = CITY.streets[j + 1] - CITY.roadHalf;
      c.fillStyle = city.parks.some((p) => p.i === i && p.j === j) ? '#5d8a4a' : '#8a7554';
      c.fillRect(mx(x0), mz(z0), (x1 - x0) * scale, (z1 - z0) * scale);
    }
  }
  c.strokeStyle = '#45424e'; c.lineWidth = CITY.roadHalf * 2 * scale;
  for (const a of CITY.avenues) { c.beginPath(); c.moveTo(mx(a), 0); c.lineTo(mx(a), S); c.stroke(); }
  for (const s of CITY.streets) { c.beginPath(); c.moveTo(0, mz(s)); c.lineTo(S, mz(s)); c.stroke(); }
  // Traffic: pale dots. Police: flashing red/blue. 
  c.fillStyle = 'rgba(255,246,220,0.85)';
  for (const car of vehicles.all) {
    if (Math.abs(car.x - player.x) > view || Math.abs(car.z - player.z) > view) continue;
    c.fillRect(mx(car.x) - 1.6, mz(car.z) - 1.6, 3.2, 3.2);
  }
  const phase = (G.frame >> 4) % 2 === 0;
  for (const car of police.cars) {
    if (Math.abs(car.x - player.x) > view || Math.abs(car.z - player.z) > view) continue;
    c.fillStyle = phase ? '#ff4757' : '#3b6cff';
    c.beginPath(); c.arc(mx(car.x), mz(car.z), 3.6, 0, Math.PI * 2); c.fill();
  }
  // Mission target: a gold ring, clamped to the rim when far away.
  const target = missions.target();
  if (target) {
    let tx = mx(target.x), tz = mz(target.z);
    const dx = tx - C, dz = tz - C, d = Math.hypot(dx, dz);
    if (d > R - 8) { tx = C + (dx / d) * (R - 8); tz = C + (dz / d) * (R - 8); }
    c.strokeStyle = '#ffd166'; c.lineWidth = 2.4;
    c.beginPath(); c.arc(tx, tz, 5.5 + Math.sin(G.frame * 0.09) * 1.2, 0, Math.PI * 2); c.stroke();
    c.fillStyle = '#ffd166';
    c.beginPath(); c.arc(tx, tz, 2, 0, Math.PI * 2); c.fill();
  }
  // The player: a white arrow at the centre, turned to her heading.
  c.translate(C, C);
  c.rotate(-player.heading);
  c.fillStyle = '#ffffff';
  c.beginPath(); c.moveTo(0, 8); c.lineTo(-5, -6); c.lineTo(0, -2.6); c.lineTo(5, -6); c.closePath(); c.fill();
  c.restore();
  c.fillStyle = '#ffe9bd';
  c.font = '700 11px Arial'; c.textAlign = 'center';
  c.fillText('N', C, 14);
}

// --- Interaction prompt ------------------------------------------------------
function updatePrompt() {
  if (G.state !== 'playing') { promptEl.classList.add('hidden'); return; }
  if (player.mode === 'foot') {
    const car = vehicles.nearestStealable(player.x, player.z, 3.6);
    if (car) {
      promptText.textContent = car.kind === 'traffic' ? `Steal the ${car.model.name}` : `Enter the ${car.model.name}`;
      promptEl.classList.remove('hidden');
      return;
    }
  } else if (Math.abs(player.car.speed) < 2) {
    promptText.textContent = 'Get out';
    promptEl.classList.remove('hidden');
    return;
  }
  promptEl.classList.add('hidden');
}

// --- Shot staging --------------------------------------------------------------
let staged = null;
if (shotName) {
  staged = stageShot(G, shotName);
  if (staged.overlay === 'start') {
    hud.classList.add('hidden');
  } else {
    $('startScreen').classList.add('hidden');
    hud.classList.remove('hidden');
    G.state = 'playing';
  }
  try { audio.init(); } catch (err) { /* headless: no audio needed */ }
}

// --- The loop --------------------------------------------------------------------
let last = performance.now();
let autosave = 0;
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  G.frame++;

  if (G.frozen) {
    missions.updateBeacon();
  } else if (G.state === 'playing' && G.cardOpen) {
    // A story card is up: the beacon breathes, everything else holds still.
    missions.updateBeacon();
    audio.setEngine(false, 0);
  } else if (G.state === 'playing') {
    if (input.hit('KeyP', 'Escape')) {
      G.state = 'paused';
      $('pauseScreen').classList.remove('hidden');
    }
    if (input.hit('KeyM')) {
      statusEl.textContent = audio.toggleMute() ? 'Sound off.' : 'Sound on.';
      G.saveGame(); // the mute setting is part of the save now
    }
    if (input.hit('KeyF')) {
      if (player.mode === 'foot') {
        const car = vehicles.nearestStealable(player.x, player.z, 3.6);
        if (car) player.enterCar(car, G);
      } else if (Math.abs(player.car.speed) < 2.5) {
        player.exitCar();
      }
    }
    const blockers = [...police.cars];
    if (player.mode === 'foot') blockers.push({ x: player.x, z: player.z, speed: 0 });
    vehicles.update(dt, blockers);
    const pedBlockers = G.allCars().map((c) => ({ x: c.x, z: c.z, speed: c.speed || 0 }));
    pedBlockers.push({ x: player.x, z: player.z, speed: player.mode === 'car' ? player.car.speed : 0 });
    pedestrians.update(dt, pedBlockers, (ped) => G.onPedHit(ped));
    player.update(dt, G);
    combat.update(dt);
    police.update(dt, G);
    missions.update(dt);
    vehicles.updateEffects(dt, G.allCars());
    if (bannerTimer > 0) {
      bannerTimer -= dt;
      if (bannerTimer <= 0) bannerEl.classList.remove('show');
    }
    autosave += dt;
    if (autosave > 12) { autosave = 0; G.saveGame(); }
  } else if (G.state === 'menu') {
    // The living city behind the title: traffic rolls, people stroll.
    vehicles.update(dt, []);
    pedestrians.update(dt, [], null);
    const a = G.frame * 0.0009;
    camera.position.set(196 + Math.cos(a) * 66, 21, -6 + Math.sin(a) * 66);
    camera.lookAt(178, 7, -8);
    city.followShadow(196, -6);
    if (input.hit('KeyP', 'Escape')) { /* nothing to pause in the menu */ }
  } else if (G.state === 'paused') {
    if (input.hit('KeyP', 'Escape')) {
      $('pauseScreen').classList.add('hidden');
      G.state = 'playing';
    }
    audio.setEngine(false, 0);
  }

  city.update(G.frame);
  if (G.state !== 'menu' || shotName) { updateHud(); drawMinimap(); updatePrompt(); }
  renderer.render(scene, camera);
  input.endFrame();
  if (shotName && G.frame === 6) window.__shotReady = true;
}

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

if (!shotName) player.placeAt(CITY.playerStart.x, CITY.playerStart.z, CITY.playerStart.heading);
requestAnimationFrame(frame);
