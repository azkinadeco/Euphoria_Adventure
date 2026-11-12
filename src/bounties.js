// Euphoria Adventure — wanted board: elite world targets with immunities and big rewards.
import * as THREE from 'three';
import { upgrade } from './assets.js';
import { sfx } from './sfx.js';
import { dropRandomArtifact } from './artifacts.js';
import { LOC } from './world.js';
import { Enemy } from './enemies.js';

export const BOUNTIES = [
  {
    id: 'glacial',
    name: 'Glacial Sovereign',
    title: 'Penguasa Badai Salju Purba',
    locName: 'Frostvale · Lereng Barat',
    pos: { x: -565, y: 0, z: 10 },
    type: 'frostwolf',
    unlock: 'frostCamp',
    unlockText: 'Terbuka setelah mencapai Frostvale',
    icon: '🐺',
    elem: 'ICE',
    desc: 'Serigala es raksasa bermutasi akibat anomali kristal beku. Kebal terhadap elemen ICE, perisainya pecah oleh FIRE.',
    weakness: 'Perisai pecah oleh FIRE',
    resist: 'Kebal terhadap ICE',
    hp: 6500,
    atk: 52,
    color: '#70d6ff',
    rewardStarlight: 400,
    rewardArtifactSet: 'blizzard',
  },
  {
    id: 'magma',
    name: 'Magma Colossus',
    title: 'Titan Lahar Berpijar',
    locName: 'Pulau Vulkanik · Lembah Lahar',
    pos: { x: -110, y: 0, z: -545 },
    type: 'lavafox',
    unlock: 'volcCamp',
    unlockText: 'Terbuka setelah mencapai Pulau Vulkanik',
    icon: '🌋',
    elem: 'FIRE',
    desc: 'Binatang lahar yang bangkit dari kawah berapi. Kulit magmanya menyerap api, tapi perisainya pecah oleh WATER dan ICE.',
    weakness: 'Perisai pecah oleh WATER & ICE',
    resist: 'Kebal terhadap FIRE',
    hp: 7200,
    atk: 58,
    color: '#ff4757',
    rewardStarlight: 400,
    rewardArtifactSet: 'crimson',
  },
  {
    id: 'storm',
    name: 'Abyssal Stormherald',
    title: 'Utusan Badai Hampa',
    locName: 'Whispering Woods · Tepi Utara',
    pos: { x: 55, y: 0, z: -105 },
    type: 'anchorguard',
    unlock: 'reefDone',
    unlockText: 'Terbuka setelah Bab 1 selesai',
    icon: '⚡',
    elem: 'LIGHTNING',
    desc: 'Entitas petir hampa yang merobek langit Whispering Woods. Mengeluarkan sambaran petir berkala. Perisainya pecah oleh WIND dan LIGHT.',
    weakness: 'Perisai pecah oleh WIND & LIGHT',
    resist: 'Pertahanan poise tinggi',
    hp: 8000,
    atk: 64,
    color: '#bf55ec',
    rewardStarlight: 500,
    rewardArtifactSet: 'celestial',
  },
];

export class BountyManager {
  constructor(game) {
    this.g = game;
    this.activeBounty = null;
    this.spawnedMob = null;
    this._buildBoardProp();
  }

  _buildBoardProp() {
    // Bulletin board at Sunbeam Workshop camp
    const W = this.g.world;
    const x = LOC.workshop.x + 3.8;
    const z = LOC.workshop.z - 2.8;
    const y = W.groundAt ? W.groundAt(x, z) : 0;

    const group = new THREE.Group();
    group.position.set(x, y, z);
    group.rotation.y = -0.4;

    // Wooden posts
    const postGeo = new THREE.BoxGeometry(0.18, 2.4, 0.18);
    const woodMat = new THREE.MeshToonMaterial({ color: 0x6e4726 });
    const p1 = new THREE.Mesh(postGeo, woodMat); p1.position.set(-0.75, 1.2, 0);
    const p2 = new THREE.Mesh(postGeo, woodMat); p2.position.set(0.75, 1.2, 0);

    // Board back
    const boardGeo = new THREE.BoxGeometry(1.7, 1.1, 0.1);
    const boardMat = new THREE.MeshToonMaterial({ color: 0xb58a57 });
    const board = new THREE.Mesh(boardGeo, boardMat); board.position.set(0, 1.5, 0);

    // Roof eaves
    const roofGeo = new THREE.ConeGeometry(1.2, 0.4, 4);
    roofGeo.rotateY(Math.PI / 4);
    roofGeo.scale(1.2, 1, 0.6);
    const roofMat = new THREE.MeshToonMaterial({ color: 0x3d2817 });
    const roof = new THREE.Mesh(roofGeo, roofMat); roof.position.set(0, 2.2, 0);

    // Paper notices with glowing seal
    const noticeGeo = new THREE.PlaneGeometry(0.38, 0.48);
    const noticeMat = new THREE.MeshBasicMaterial({ color: 0xfff3d4, side: THREE.DoubleSide });
    const sealMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0xff4757).multiplyScalar(2.0), side: THREE.DoubleSide });
    const sealGeo = new THREE.CircleGeometry(0.06, 8);

    for (let i = 0; i < 3; i++) {
      const n = new THREE.Mesh(noticeGeo, noticeMat);
      n.position.set(-0.45 + i * 0.45, 1.5 + (i % 2 === 0 ? 0.05 : -0.05), 0.06);
      const s = new THREE.Mesh(sealGeo, sealMat);
      s.position.set(0, 0.14, 0.01);
      n.add(s);
      group.add(n);
    }

    group.add(p1, p2, board, roof);
    upgrade('bounty_board', group, [p1, p2, board, roof], () => {}, { outline: 0.02 });
    this.g.scene.add(group);

    // Interactable registration
    W.interactables.push({
      pos: group.position,
      radius: 2.8,
      label: 'Papan Buronan',
      kind: 'bounty_board',
      enabled: () => true,
    });
  }

  openBoard() {
    this.g.ui.openBounties();
  }

  isCompleted(bId) {
    return !!(this.g.state.bounties && this.g.state.bounties[bId]);
  }

  startBounty(bId) {
    const b = BOUNTIES.find((x) => x.id === bId);
    if (!b) return;

    if (!this.isUnlocked(b)) { this.g.ui.toast(b.unlockText); return; }
    if (this.isCompleted(bId)) {
      this.g.ui.toast(`Buronan ${b.name} sudah diselesaikan!`, '');
      return;
    }

    this.activeBounty = b;
    this.g.state.activeBountyId = bId;

    // Spawn or activate the elite target mob
    this._spawnBountyTarget(b);

    this.g.ui.toast(`🎯 Buronan dimulai: ${b.name}! Periksa peta untuk lokasi.`, 'gold');
    sfx.ui();
  }

  _spawnBountyTarget(b) {
    const G = this.g, W = G.world;
    if (this.spawnedMob && !this.spawnedMob.dead) this.spawnedMob.remove();
    G.enemies = G.enemies.filter((e) => e !== this.spawnedMob);
    const spot = W.findLand(b.pos.x, b.pos.z) || new THREE.Vector3(b.pos.x, W.heightAt(b.pos.x, b.pos.z), b.pos.z);
    const mob = new Enemy(G, b.type, spot, { elite: b.elem, leash: 45 });
    mob.root.scale.multiplyScalar(1.5); mob.tall *= 1.5; mob.radius *= 1.3;
    mob.maxHp = mob.hp = b.hp;
    mob.dmg = b.atk;
    mob.shield.hp = mob.shield.max = b.hp * 0.45;
    mob.def = { ...mob.def, name: b.name, exp: 600 };
    mob.bountyId = b.id;
    mob.isBountyBoss = true;

    // immune to its own element
    const origHit = mob.hit.bind(mob);
    mob.hit = (amount, opts = {}) => {
      if (opts.element === b.elem) {
        G.ui.damageNumber(mob.pos.clone().add(new THREE.Vector3(0, mob.tall, 0)), 'KEBAL!', 'resist');
        return 0;
      }
      return origHit(amount, opts);
    };

    G.enemies.push(mob);
    this.spawnedMob = mob;
  }

  isUnlocked(b) { return !!this.g.state[b.unlock]; }
  /** marker for the tracked target (only in the open world) */
  target() {
    const m = this.spawnedMob;
    return m && !m.dead && !this.g.world.realm && !this.g.world.arenaFloor ? m.pos : null;
  }
  /** a hunt survives saving and reloading */
  onLoad() {
    const b = BOUNTIES.find((x) => x.id === this.g.state.activeBountyId);
    if (b && !this.isCompleted(b.id)) { this.activeBounty = b; this._spawnBountyTarget(b); }
  }

  onBountyKilled(mob) {
    const b = BOUNTIES.find((x) => x.id === mob.bountyId);
    if (!b) return;

    if (!this.g.state.bounties) this.g.state.bounties = {};
    this.g.state.bounties[b.id] = true;
    this.activeBounty = null;
    this.g.state.activeBountyId = null;

    // Award Starlight Crystals
    this.g.state.starlight = (this.g.state.starlight || 0) + b.rewardStarlight;
    this.g.ui.updateStarlightHUD();

    // Drop guaranteed 5-star artifact
    const art = dropRandomArtifact(5, b.rewardArtifactSet);
    if (!this.g.state.inventoryArtifacts) this.g.state.inventoryArtifacts = [];
    this.g.state.inventoryArtifacts.push(art);

    sfx.wishGold();
    this.g.ui.banner(`BURONAN SELESAI!\n${b.name} Ditumbangkan!`);
    this.g.ui.toast(`✦ +${b.rewardStarlight} Starlight Crystals & 1 Artifak 5★ ${art.setName} diperoleh!`, 'gold');
    this.g.save();
  }
}
