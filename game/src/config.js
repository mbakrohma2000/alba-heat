// config.js — every shared constant for Alba Heat: the layout of Puerto Alba,
// the sunset palette, vehicle and actor tuning, and the story strings.
// One job: be the single place the rest of the game reads its numbers from.

export const CITY = {
  // Streets run along Z at these X positions ("avenues"); along X at these Z ("streets").
  avenues: [-222, -148, -74, 0, 74, 148, 222],
  streets: [-148, -74, 0, 74, 148],
  roadHalf: 7,          // half the width of a road, in metres
  blockPitch: 74,       // distance between neighbouring street centres
  landMinX: -262,       // western edge of the city
  landMaxX: 300,        // eastern edge of the ground (under the water)
  landHalfZ: 196,       // northern/southern edge of the city
  promenadeX: 243,      // the beachfront walkway, east of the coast avenue
  beachX: 256,          // where the sand starts
  waterX: 292,          // where the open water starts
  marina: { x: 272, z: 148 },   // the marina dock, south-east corner
  hotelDropoff: { x: 141, z: -37 }, // Hotel Alba service entrance, on Avenue 148
  station: { x: 236, z: 60 },   // police station steps on the promenade (respawn)
  playerStart: { x: 233, z: 96, heading: Math.PI / 2 },
  plazaKiosk: { x: -37, z: 111 },  // the Plaza Verde kiosk, north-west park (Mission 2 pickup)
  garage: { x: -196, z: 128 },     // Tito's lock-up garage, north-west block
  hideout: { x: -196, z: 139.5 },  // the garage forecourt: Mission 3's finish line
};

export const PALETTE = {
  sky: [0x2e1a47, 0xb84a6e, 0xff9e5e],       // dusk gradient, top to horizon
  fog: 0xf2a56b,
  sun: 0xffb36b,
  stucco: [0xf6e3c2, 0xf7c8a0, 0xeeb4a0, 0xe8b4b8, 0xa8dadc, 0xfdfdf8, 0xf2d492, 0xcfe0c3, 0xe5989b, 0xfff3b0],
  roofs: [0x8a4b3a, 0x6e3b4e, 0x54486e, 0x74584a],
  carPaint: [0xd64550, 0x2ec4b6, 0xffd166, 0x457b9d, 0xf4f1de, 0x81b29a, 0xe07a5f, 0x9b5de5, 0x22223b, 0xf15bb5],
  shirt: [0xffd166, 0x2ec4b6, 0xff6b6b, 0xf4f1de, 0x81b29a, 0x4cc9f0, 0xf72585, 0xe0aaff],
  pants: [0x22304a, 0x3a2e39, 0x51403a, 0x1f3a3a, 0x5c374c],
  skin: [0xf2c09a, 0xd99e6a, 0xa96b3f, 0x7c4a26, 0x5d3620],
};

export const CAR_MODELS = [
  { name: 'CABRILLO', len: 4.4, wid: 1.9, cabLen: 2.1, cabH: 0.52, bodyH: 0.55 },
  { name: 'TIBURON',   len: 4.1, wid: 1.85, cabLen: 1.7, cabH: 0.42, bodyH: 0.48 },
  { name: 'MARISOL',   len: 3.8, wid: 1.75, cabLen: 1.9, cabH: 0.55, bodyH: 0.58 },
  { name: 'DORADO',    len: 4.7, wid: 2.0, cabLen: 2.6, cabH: 0.62, bodyH: 0.66 },
  { name: 'PALMERA',   len: 4.2, wid: 1.9, cabLen: 1.5, cabH: 0.30, bodyH: 0.50 },
];

export const TUNING = {
  walkSpeed: 3.4,
  runSpeed: 6.8,
  carAccel: 15,
  carBrake: 30,
  carReverseMax: 9,
  carDrag: 0.55,
  trafficCount: 22,
  parkedCount: 26,
  pedCount: 30,
  policeMax: 5,
  crimePedHit: 1.0,
  crimeCarHit: 0.4,
  crimePunch: 0.6,     // laying a pedestrian out by hand
  crimeShot: 0.5,      // a pistol shot fired in the open street
  crimeShotHit: 1.1,   // a pistol shot that finds a person
  wantedDecayDelay: 11,   // seconds without a crime before heat fades
  wantedDecayRate: 0.09,  // stars per second once fading
};

export const STORY = {
  mission1Title: 'FIRST RUN',
  objectiveMeet: 'Meet Tito at the marina dock, south-east waterfront',
  objectiveDeliver: 'Deliver the suitcase to the Hotel Alba service entrance',
  objectiveDone: 'Free roam — Tito owes you one. More work is coming to Puerto Alba.',
  bannerPickupBig: 'THE SUITCASE IS YOURS',
  bannerPickupSub: 'Tito: "Do not open it. And Marina — somebody called the cops."',
  bannerDoneBig: 'MISSION COMPLETE — FIRST RUN',
  bannerDoneSub: '+$750 — the debt is cleared. Puerto Alba is yours.',
  reward: 750,
  startCash: 250,

  // --- Mission 2: "Cold Open" — a timed pickup run across the city. -------
  mission2Title: 'COLD OPEN',
  objectiveM2Pickup: 'Pick up the cold package at the Plaza Verde kiosk, north-west park',
  objectiveM2Deliver: 'Get the package to Tito at the marina — before the timer dies',
  bannerM2PickupBig: 'PACKAGE ON BOARD',
  bannerM2PickupSub: 'It is ticking down in the back seat. Marina — drive like the tide is coming in.',
  bannerM2LateBig: 'TOO LATE',
  bannerM2LateSub: 'The package went cold. Tito: "Again. And this time, faster."',
  bannerM2DoneBig: 'MISSION COMPLETE — COLD OPEN',
  bannerM2DoneSub: '+$600 — Tito is starting to trust you with the real work.',
  reward2: 600,
  m2TimeLimit: 125, // seconds for the plaza -> marina leg

  // --- Mission 3: "Four Stars" — shake a full pursuit, reach the lock-up. -
  mission3Title: 'FOUR STARS',
  objectiveM3: 'Lose the heat and reach Tito\'s lock-up garage, north-west — roll in with no cop on your tail',
  bannerM3HotBig: 'TOO HOT',
  bannerM3HotSub: 'They are right behind you — break away, then roll into the garage.',
  bannerM3DoneBig: 'MISSION COMPLETE — FOUR STARS',
  bannerM3DoneSub: '+$1,200 — the garage door closes. For tonight, Marina Solano is a ghost.',
  reward3: 1200,
  m3Heat: 4.3,
  m3ClearRadius: 26, // no police car may be this close when she rolls in

  objectiveAllDone: 'Story complete — Puerto Alba is yours. Free roam, courier.',

  // --- Story cards shown between missions. --------------------------------
  card2Kicker: 'CHAPTER TWO',
  card2Title: 'COLD OPEN',
  card2Body: 'The suitcase buys Marina her freedom — and Tito\'s attention. By dusk he is on the phone: ' +
    'a second package is waiting at the Plaza Verde kiosk, and it is the kind that spoils. ' +
    '"Ninety minutes it could wait," Tito says. "You have two. The whole city between you and my dock, ' +
    'and every patrol that wants your name. Bring it cold, courier."',
  card3Kicker: 'CHAPTER THREE',
  card3Title: 'FOUR STARS',
  card3Body: 'Tito is waiting at the dock with the engine of his own car already running — and that is when ' +
    'the sirens start. Somebody talked. The whole Alba PD comes down on the marina at once, four stars ' +
    'over Marina\'s head. "My lock-up," Tito shouts, rolling away. "North-west corner, behind the green ' +
    'door. Get there with nobody on your tail and stay there. You do this, we are family."',
  cardEndKicker: 'PUERTO ALBA',
  cardEndTitle: 'FAMILY',
  cardEndBody: 'The garage door rattles down and the sirens slide past into the dark. Tito counts out ' +
    'twelve hundred in damp notes and pours two glasses of something amber. "You drive like the dawn," ' +
    'he says. Outside, Puerto Alba glows on — and from tonight, a piece of it answers to Marina Solano.',
};
