// shots.js — the deterministic screenshot scenes behind
// ?shot=start|drive|chase|mission&seed=N. One job: freeze the living game
// into four staged frames that each show several systems at once — the
// title over the coast city, a drive down the coast avenue with the
// mission beacon ahead, a five-star chase running into a roadblock, and
// Marina's arrival at Tito's lock-up at the end of Mission 3. Everything
// is placed by hand from the same seeded world the game builds, so the
// same seed always stages the same frame.

function setCam(G, x, y, z, lx, ly, lz) {
  G.camera.position.set(x, y, z);
  G.camera.lookAt(lx, ly, lz);
}

function putCar(car, x, z, heading) {
  car.x = x; car.z = z; car.heading = heading; car.speed = 0;
  car.mesh.position.set(x, 0, z);
  car.mesh.rotation.y = heading - Math.PI / 2;
}

function putPed(ped, x, z, heading) {
  ped.x = x; ped.z = z; ped.heading = heading;
  ped.group.position.set(x, 0, z);
  ped.group.rotation.y = heading;
}

function putPlayerInCar(G, car, x, z, heading) {
  putCar(car, x, z, heading);
  car.kind = 'player';
  G.player.mode = 'car';
  G.player.car = car;
  G.player.x = x; G.player.z = z; G.player.heading = heading;
  G.player.syncMesh();
}

export function stageShot(G, name) {
  const { player, vehicles, police, missions } = G;
  const peds = G.pedestrians.list;
  G.city.followShadow(player.x, player.z);

  if (name === 'start') {
    // The title over the coast: promenade, palms, traffic on the coast
    // avenue, the Hotel Alba sign and the whole stucco city behind.
    player.placeAt(238, 26, Math.PI / 2);
    putCar(vehicles.parked[0], 227.7, 46, 0);
    putCar(vehicles.parked[3], 227.7, -8, 0);
    putCar(vehicles.traffic[5], 225.1, 84, Math.PI);
    putCar(vehicles.traffic[6], 218.9, -34, 0);
    putPed(peds[0], 241, 10, Math.PI);
    putPed(peds[1], 239.5, 46, 0);
    putPed(peds[2], 240.5, -14, Math.PI);
    putPed(peds[3], 243, 30, 0);
    setCam(G, 276, 15, 52, 138, 9, -34);
    return { overlay: 'start' };
  }

  if (name === 'drive') {
    // North up the coast avenue in traffic, the marina beacon pillar
    // standing over the beach ahead, sea on the right, city on the left.
    missions.setStage('meet');
    putPlayerInCar(G, vehicles.parked[2], 225.1, -28, 0);
    G.player.car.speed = 16; // the speedo reads a rolling 58 km/h
    putCar(vehicles.traffic[0], 225.1, -6, 0);
    putCar(vehicles.traffic[1], 225.1, 40, 0);
    putCar(vehicles.traffic[2], 218.9, 2, Math.PI);
    putCar(vehicles.traffic[3], 218.9, -52, Math.PI);
    putPed(peds[2], 240.5, -4, Math.PI);
    putPed(peds[3], 241.5, 34, 0);
    putPed(peds[4], 239, 66, Math.PI);
    G.city.followShadow(225, -6);
    setCam(G, 225.1, 5.2, -41.5, 225.1, 1.3, 6);
    return { overlay: null };
  }

  if (name === 'chase') {
    // Five stars, one intersection: three patrol cars on her tail, two
    // more parked across the avenue ahead with a spike strip between —
    // and a bystander already flat on the pavement.
    const heroCar = vehicles.parked.find((c) => c.paint === 0xd64550) || vehicles.parked[5];
    putPlayerInCar(G, heroCar, 77.1, 2, 0.2);
    heroCar.damage = 0.55;
    G.player.car.speed = 22; // running at 79 km/h, no "get out" prompt
    police.setHeatAtLeast(5);
    const p0 = police.spawnNear(player);
    const p1 = police.spawnNear(player);
    const p2 = police.spawnNear(player);
    putCar(p0, 73.8, -10, 0.12);
    putCar(p1, 80.6, -7, -0.08);
    putCar(p2, 68.5, 15, Math.PI * 0.85);
    police.stageRoadblock(74, 34, 'z', -3.4);
    putCar(vehicles.traffic[3], 81.5, 26, 0.3);
    putCar(vehicles.traffic[4], 70.9, 58, Math.PI);
    putPed(peds[5], 83.5, 10, -Math.PI / 2);
    peds[5].group.rotation.x = -Math.PI / 2; // down, mid-dive
    peds[5].group.position.y = 0.25;
    putPed(peds[6], 66.5, 12, -Math.PI / 2);
    missions.setStage('deliver');
    G.city.followShadow(77, 8);
    setCam(G, 88, 7.5, -15, 73, 1.2, 16);
    return { overlay: null };
  }

  if (name === 'mission') {
    // The end of Mission 3: Marina rolls up to Tito's lock-up with the
    // beacon gold on the forecourt, her car steaming beside her, Tito
    // waiting at the green door — and one last patrol car just arriving
    // on the street behind, a breath too late.
    missions.setStage('m3escape');
    player.placeAt(-193.5, 137.5, Math.PI);
    putPed(peds[0], -198.5, 135.5, 2.2); // Tito, at the green door
    const herCar = vehicles.parked[1];
    putCar(herCar, -188.5, 141.5, -0.5);
    herCar.damage = 0.7;
    police.setHeatAtLeast(4);
    const late = police.spawnNear(player);
    putCar(late, -230, 144.5, Math.PI / 2); // rolling in along the street, too late
    putPed(peds[6], -206, 142, Math.PI / 2);
    G.city.followShadow(-196, 139);
    setCam(G, -174, 5.2, 154, -196, 1.6, 133);
    return { overlay: null };
  }

  return { overlay: null };
}
