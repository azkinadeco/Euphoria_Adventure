// Light pool: the world declares many "virtual" point lights (campfires, lava, braziers, chests…),
// but only the nearest few are backed by real THREE.PointLights.
// Optimized for mobile & desktop to keep shader lighting cost constant while providing
// warm, stylized anime ambient point light diffusion.
import * as THREE from 'three';

const ALL = [];
export class VLight extends THREE.Object3D {
  constructor(color = 0xffffff, intensity = 1, distance = 14, decay = 1.6) {
    super();
    this.color = new THREE.Color(color);
    this.intensity = intensity;
    this.distance = distance;
    this.decay = decay;
    this._wp = new THREE.Vector3();
    ALL.push(this);
  }
}

export class LightPool {
  constructor(scene, n = 8) {
    this.real = [];
    for (let i = 0; i < n; i++) {
      const l = new THREE.PointLight(0xffffff, 0, 14, 1.6);
      scene.add(l);
      this.real.push(l);
    }
    this.assigned = [];
    this.t = 0;
  }

  setSize(n) {
    this.limit = Math.min(n, this.real.length);
  }

  update(dt, focus) {
    this.t -= dt;
    const limit = this.limit ?? this.real.length;
    if (this.t <= 0) {
      this.t = 0.2;
      const cand = [];
      for (const v of ALL) {
        if (!v.parent) continue;
        let vis = true;
        v.traverseAncestors((a) => { if (!a.visible) vis = false; });
        if (!vis) continue;
        v.getWorldPosition(v._wp);
        const d = v._wp.distanceTo(focus);
        if (d > v.distance + 40) continue;
        cand.push([d - v.distance * 0.5, v]);
      }
      cand.sort((a, b) => a[0] - b[0]);
      this.assigned = cand.slice(0, limit).map((c) => c[1]);
    }

    this.real.forEach((l, i) => {
      const v = this.assigned[i];
      if (!v) {
        l.intensity = 0;
        return;
      }
      l.position.copy(v._wp);
      l.color.copy(v.color);
      l.intensity = v.intensity;
      l.distance = v.distance;
      l.decay = v.decay;
    });
  }
}
