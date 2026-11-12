// Chapter 3 — FROSTVALE EXPANSE: story objects, quests, cold, blizzard, Aurora Shrine.
import { softDot } from './nature.js';
import * as THREE from 'three';
import { applyKit, loadGeometry } from './assets.js';
import { FLOC, FROST, FLOES, coldAt } from './frost.js';
import { VOLC } from './volcano.js';
import { makeChest } from './reef.js';
import { Enemy } from './enemies.js';
import { ValeriaRig, GlyttaRig } from './heroes3d.js';
import { toon, part } from './toon.js';
import { SCRIPTS } from './story.js';
import { sfx, setMusicMood } from './sfx.js';
import { rng } from './noise.js';

export class Chapter3 {
  constructor(game) {
    this.g = game;
    const G = game, W = game.world, S = game.scene;

    const Vg = FLOC.village;
    this.valNpc = new ValeriaRig(); this.valNpc.root.position.set(Vg.x + 4, Vg.y, Vg.z + 3); this.valNpc.root.rotation.y = 1.4; S.add(this.valNpc.root);
    this.glyNpc = new GlyttaRig(); this.glyNpc.root.position.set(Vg.x + 4, Vg.y, Vg.z - 3); this.glyNpc.root.rotation.y = 1.8; S.add(this.glyNpc.root);
    W.animated.push({ update: (dt) => {
      if (this.valNpc.root.visible) this.valNpc.update(dt, { speed: 0, grounded: true });
      if (this.glyNpc.root.visible) this.glyNpc.update(dt, { speed: 0, grounded: true });
    } });
    const rest = { pos: W.frostCampfire.pos, radius: 3, kind: 'frost_rest', label: 'Istirahat di api unggun desa' };
    rest.enabled = () => G.state.frostCamp;
    W.interactables.push(rest);
    const shrine = { pos: FLOC.peak, radius: 5, kind: 'shrine', label: 'Nyalakan Kuil Aurora' };
    shrine.enabled = () => G.state.step === 'frost_peak';
    W.interactables.push(shrine);

    // Fire Peppers grow on the volcanic island (ingredient for Sup Pedas)
    const r = rng(321);
    const bushMat = toon(0x4a3a2a), pepMat = toon(0xff3a1a, { emissive: 0x4a0a00 });
    let made = 0;
    for (let i = 0; i < 400 && made < 10; i++) {
      const x = VOLC.x + (r() * 2 - 1) * 110, z = VOLC.z + (r() * 2 - 1) * 110, h = W.heightAt(x, z);
      if (h < 1.5 || h > 14 || G.lavaAt(x, z)) continue;
      made++;
      const g = new THREE.Group();
      const b = part(new THREE.IcosahedronGeometry(0.5, 0), bushMat, { ol: 0.02 }); b.position.y = 0.4; b.scale.y = 0.8; g.add(b);
      const peppers = new THREE.Group();
      for (let k = 0; k < 5; k++) { const p = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.24, 6), pepMat); const a = k * 1.25; p.position.set(Math.cos(a) * 0.4, 0.5 + (k % 2) * 0.2, Math.sin(a) * 0.4); p.rotation.x = Math.PI; peppers.add(p); }
      g.add(peppers); g.position.set(x, h, z); S.add(g);
      applyKit('kit_pepper_bush', g, { bush: bushMat }, [b], { ol: 0.015 });
      loadGeometry('pepper').then((pg) => { if (pg) peppers.children.forEach((p) => { p.geometry = pg; p.rotation.x = 0; }); });
      const it = { pos: g.position, radius: 2.2, label: 'Petik Cabai Api', kind: 'pepper', regrowAt: 0, peppers };
      it.enabled = () => peppers.visible;
      W.interactables.push(it);
      W.animated.push({ update: () => { if (!peppers.visible && W.time > it.regrowAt) peppers.visible = true; } });
    }

    // treasure chests (continue indices)
    const land = (x, z) => {
      for (let rr = 0; rr < 30; rr += 1.5) for (let a = 0; a < 6.28; a += 0.7) {
        const px = x + Math.cos(a) * rr, pz = z + Math.sin(a) * rr;
        if (W.heightAt(px, pz) > 1) return new THREE.Vector3(px, W.groundAt(px, pz), pz);
      }
      return new THREE.Vector3(x, W.groundAt(x, z), z);
    };
    const base = G.state.chestTotal || 12;
    const spots = [land(FLOC.peak.x + 2.5, FLOC.peak.z + 2.5), land(FLOC.islet.x, FLOC.islet.z), land(-560, 120), land(-400, -90)];
    G.state.chestTotal = base + spots.length;
    spots.forEach((p, k) => {
      const i = base + k;
      const ch = makeChest(W, p, k * 1.7);
      const it = { pos: ch.group.position, radius: 2.4, kind: 'chest', idx: i, label: 'Buka peti harta', chest: ch };
      it.enabled = () => !G.state.chests[i];
      W.interactables.push(it);
      W.animated.push({ update: (dt) => { if (G.state.chests[i]) { ch.lid.rotation.x = Math.max(ch.lid.rotation.x - dt * 4, -1.9); ch.glow.intensity = 0; } } });
    });

    // falling snow around the player while in Frostvale
    const sg = new THREE.BufferGeometry(), sp = [];
    for (let k = 0; k < 700; k++) sp.push((Math.random() - 0.5) * 70, Math.random() * 30, (Math.random() - 0.5) * 70);
    sg.setAttribute('position', new THREE.Float32BufferAttribute(sp, 3));
    this.snow = new THREE.Points(sg, new THREE.PointsMaterial({ map: softDot(), color: 0xffffff, size: 0.18, transparent: true, opacity: 0.9, depthWrite: false }));
    S.add(this.snow);

    this._spawnEnemies();
  }

  _spawnEnemies() {
    const G = this.g, v = (x, z) => new THREE.Vector3(x, 0, z);
    const zones = [
      { c: v(-400, 20), r: 12, type: 'frostwolf', n: 2 },
      { c: FLOC.souls[0].clone(), r: 9, type: 'frostsoul', n: 2 },
      { c: FLOC.souls[1].clone(), r: 9, type: 'frostwolf', n: 3 },
      { c: FLOC.souls[2].clone(), r: 9, type: 'frostsoul', n: 3 },
      { c: FLOC.souls[3].clone(), r: 9, type: 'frostwolf', n: 2 },
      { c: v(-510, -20), r: 10, type: 'frostwolf', n: 2 },
      { c: v(-560, 60), r: 12, type: 'frostsoul', n: 2 },
    ];
    for (const z of zones) { z.alive = []; z.respawnT = 0; G.zones.push(z); for (let i = 0; i < z.n; i++) G._spawnIn(z); }
    this.blocks = FLOC.souls.map((p, i) => {
      const pos = p.clone(); pos.y = G.world.groundAt(p.x, p.z);
      const e = new Enemy(G, 'iceblock', pos, { leash: 999 }); e.soulIdx = i; G.enemies.push(e); return e;
    });
    const c = FLOC.lake.clone(); c.y = G.world.groundAt(c.x, c.z);
    this.phantom = new Enemy(G, 'phantom', c, { leash: 999 });
    G.enemies.push(this.phantom);
  }

  questTarget(step) {
    const S = this.g.state, P = this.g.player;
    if (step === 'frost_go') return P.pos.x > -170 ? new THREE.Vector3(FLOES[0].x, 0, FLOES[0].z) : FLOC.village;
    if (step === 'frost_souls') { let b = null, bd = Infinity; FLOC.souls.forEach((p, i) => { if (!S.souls[i]) { const d = p.distanceTo(P.pos); if (d < bd) { bd = d; b = p; } } }); return b; }
    if (step === 'frost_peak') return FLOC.peak;
    if (step === 'frost_boss') return FLOC.lake;
    return null;
  }

  async interact(it) {
    const G = this.g, S = G.state;
    if (it.kind === 'pepper') {
      const n = 2 + Math.floor(Math.random() * 2);
      S.inv.pepper = (S.inv.pepper || 0) + n; it.peppers.visible = false; it.regrowAt = G.world.time + 150;
      G.ui.toast(`+${n} 🌶️ Cabai Api`); sfx.pickup();
      return true;
    }
    if (it.kind === 'frost_rest') {
      G.player.healAll(1, true); S.spawn = 'frost';
      G.ui.toast('Istirahat di desa Frostvale. HP pulih! (Tersimpan)', 'gold');
      G._sleepIfNight(); G.save();
      return true;
    }
    if (it.kind === 'shrine') {
      G.world.shrineOrb.material.color.set(0x7fffc0); sfx.quest();
      G.vfx.pillar(FLOC.peak, 0x7fffc0, 30, 2);
      S.shrineLit = true;
      await G.ui.dialog(SCRIPTS.shrine);
      G._advance('frost_boss');
      G.save();
      return true;
    }
    return false;
  }

  onKilled(e) {
    const G = this.g, S = G.state;
    if (e.type === 'iceblock') {
      S.souls[e.soulIdx] = true;
      G.vfx.pillar(e.pos, 0xbff6ff, 12, 1.2); G.vfx.particles(e.pos.clone().setY(e.pos.y + 2), 50, 0xe8fbff, { speed: 6, up: 6, life: 1 }); sfx.quest();
      G.ui.toast(`Warga Frostvale dibebaskan! (${S.souls.filter(Boolean).length}/4)`, 'gold');
      if (S.step === 'frost_souls' && S.souls.every(Boolean)) G.ui.dialog(SCRIPTS.frostMid).then(() => G._advance('frost_peak'));
      G.save();
    }
    if (e.type === 'phantom') this._victory();
  }

  async _victory() {
    const G = this.g, S = G.state;
    setMusicMood('normal');
    G.blizzard = 0;
    for (const e of G.enemies) if (e.isAdd && !e.dead) e.die();
    S.frostDone = true; S.inv.fish += 10; S.inv.pepper = (S.inv.pepper || 0) + 5;
    G.ui.toast('MENANG! Frost Phantom dikalahkan', 'gold big');
    await new Promise((r) => setTimeout(r, 1800));
    await G.ui.dialog(SCRIPTS.frostVictory);
    S.voidOpen = true;
    G._advance('void_go');
  }

  startBlizzard(dur) {
    this.g.blizzard = dur;
    this.g.ui.toast('🌨 BADAI SALJU! Berlindung di dekat anglo api di tepi danau!', 'gold big');
  }

  mood(dt) {
    const G = this.g, P = G.player, W = G.world;
    const k = Math.min(1, coldAt(P.pos.x, P.pos.z) + (G.blizzard > 0 ? 1 : 0));
    this.moodK = (this.moodK ?? 0) + (k - (this.moodK ?? 0)) * (1 - Math.exp(-2 * dt));
    if (this.moodK > 0.01) {
      const bl = G.blizzard > 0 ? 1 : 0;
      W.scene.fog.color.lerp(new THREE.Color(0xdfe8f4), this.moodK * 0.6);
      W.skyUniforms.horizon.value.lerp(new THREE.Color(0xe6eef8), this.moodK * 0.5);
      W.scene.fog.near = bl ? 4 : 50; W.scene.fog.far = bl ? 45 : (G.gfx === 'low' ? 300 : 520) * (1 - this.moodK * 0.3);
    }
    W.auroraMat.uniforms.uStrength.value = (0.25 + W.nightAmt * 0.75) * Math.min(1, this.moodK * 2 + 0.2);
    this.snow.visible = this.moodK > 0.05;
    if (this.snow.visible) {
      this.snow.position.set(P.pos.x, P.pos.y, P.pos.z);
      const a = this.snow.geometry.attributes.position, wind = G.blizzard > 0 ? 9 : 0.6;
      for (let i = 0; i < a.count; i++) {
        let y = a.getY(i) - dt * (G.blizzard > 0 ? 6 : 1.6), x = a.getX(i) + dt * wind;
        if (y < 0) y = 30; if (x > 35) x = -35;
        a.setY(i, y); a.setX(i, x);
      }
      a.needsUpdate = true;
      this.snow.material.size = G.blizzard > 0 ? 0.3 : 0.18;
    }
  }

  update(dt) {
    const G = this.g, S = G.state, P = G.player, W = G.world;
    if (G.blizzard > 0) { G.blizzard -= dt; if (G.blizzard <= 0) G.ui.toast('Badai salju mereda.'); }
    // blizzard wall on the floes until Chapter 2 is cleared
    W.floeBarrier.visible = !S.floesOpen;
    const bp = W.floeBarrierPos;
    if (!S.floesOpen && Math.hypot(P.pos.x - bp.x, P.pos.z - bp.z) < 9.5) {
      const d = new THREE.Vector3(P.pos.x - bp.x, 0, P.pos.z - bp.z); if (d.x < 0) d.x = 1; d.normalize();
      P.pos.x = bp.x + d.x * 9.6; P.pos.z = bp.z + d.z * 9.6;
      if (!this._barMsg || W.time - this._barMsg > 4) { this._barMsg = W.time; G.ui.toast('Badai salju menghalangi jalur es… selesaikan Bab 2 dulu.'); }
    }
    const recruited = !!P.cache.valeria;
    this.valNpc.root.visible = !recruited; this.glyNpc.root.visible = !recruited;
    if (G.inputLocked || P.dead) return;
    if (S.step === 'frost_go' && P.pos.distanceTo(FLOC.village) < 18) {
      G.ui.dialog(SCRIPTS.frostIntro).then(() => {
        S.frostCamp = true; S.spawn = 'frost';
        for (const id of ['valeria', 'glytta']) { const m = P.addMember(id); m.level = P.level; m.maxHp = m.calcMaxHp(P.level); m.hp = m.maxHp; }
        S.party = P.roster.map((x) => x.id);
        S.inv.soup = (S.inv.soup || 0) + 2;
        G.ui.toast('Valeria & Glytta bergabung! Glytta memberimu 2 🍲 Sup Pedas (B)', 'gold big');
        G.ui.buildParty();
        G._advance('frost_souls');
      });
    }
    const B = this.phantom;
    if (B && S.step === 'frost_boss' && !B.started && !B.dead && Math.hypot(P.pos.x - B.home.x, P.pos.z - B.home.z) < 26) {
      G.ui.dialog(S.phantomIntro ? SCRIPTS.phantomRetry : SCRIPTS.phantomIntro).then(() => {
        S.phantomIntro = true;
        B.started = true; B.aggro = true; B.state = 'rest'; B.t = 0;
        sfx.roar(); G.shake(0.6); setMusicMood('boss');
      });
    }
  }

  onRespawn() {
    const B = this.phantom;
    this.g.blizzard = 0;
    if (B && B.started && !B.dead) { B.started = false; B.hp = B.maxHp; B.pos.copy(B.home); B.state = 'idle'; B.enraged = false; B.phased = false; B.blizCD = 99; setMusicMood('normal'); }
  }

  onLoad() {
    const G = this.g, S = G.state;
    if (S.frostDone && this.phantom) { this.phantom.dead = true; this.phantom.remove(); G.enemies = G.enemies.filter((e) => e !== this.phantom); this.phantom = null; }
    this.blocks.forEach((e, i) => { if (S.souls[i]) { e.dead = true; e.remove(); G.enemies = G.enemies.filter((x) => x !== e); } });
    if (S.shrineLit) G.world.shrineOrb.material.color.set(0x7fffc0);
  }
}

export { coldAt, FROST };
