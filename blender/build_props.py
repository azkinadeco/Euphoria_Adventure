"""
Euphoria Adventure — procedural prop builder for Blender 3.6+.

Builds stylized, vertex-coloured props and exports one .glb per asset into
public/assets/models/. The game loads them at runtime (src/assets.js) and
falls back to its built-in primitive meshes if a file is missing.

Run (from the project root):
  /Applications/Blender.app/Contents/MacOS/Blender -b -P blender/build_props.py -- public/assets/models [asset ...]
  (or: npm run models)

Conventions
  * Blender Z-up, origin on the ground; the glTF exporter converts to Y-up.
  * +X is the "front" of directional props (tent opening).
  * All colour lives in a single sRGB vertex-colour layer "Col".
  * Material "toon"  -> cel-shaded + outlined in game.
    Material "emit"  -> unlit glowing surface (embers, lantern glass).
"""
import bpy, bmesh, math, random, os, sys
from mathutils import Vector, noise

ARGV = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
OUT = os.path.abspath(ARGV[0] if ARGV else 'public/assets/models')
ONLY = set(ARGV[1:])
os.makedirs(OUT, exist_ok=True)
C = bpy.context
TAU = math.pi * 2


# ------------------------------------------------------------------ helpers
def H(h):
    return ((h >> 16 & 255) / 255, (h >> 8 & 255) / 255, (h & 255) / 255)


def mix(a, b, t):
    t = max(0.0, min(1.0, t))
    return tuple(a[i] + (b[i] - a[i]) * t for i in range(3))


def mul(a, k):
    return tuple(max(0.0, min(1.0, c * k)) for c in a)


def nz(p, f=1.0, seed=0.0):
    return noise.noise(Vector((p[0] * f + seed, p[1] * f + seed * 1.37, p[2] * f + seed * 2.11)))


def reset():
    bpy.ops.wm.read_factory_settings(use_empty=True)


def link(ob):
    C.scene.collection.objects.link(ob)
    return ob


def sel(obs):
    for o in C.scene.objects:
        o.select_set(False)
    for o in obs:
        o.select_set(True)
    C.view_layer.objects.active = obs[0]


def apply_tf(ob):
    sel([ob])
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    return ob


def modify(ob, kind, **props):
    m = ob.modifiers.new(kind.lower(), kind)
    for k, v in props.items():
        setattr(m, k, v)
    sel([ob])
    bpy.ops.object.modifier_apply(modifier=m.name)
    return ob


def material(name):
    m = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    m.diffuse_color = (1, 1, 1, 1)
    return m


def set_mat(ob, name='toon'):
    ob.data.materials.clear()
    ob.data.materials.append(material(name))
    return ob


def mesh(name, verts, faces):
    me = bpy.data.meshes.new(name)
    me.from_pydata([tuple(v) for v in verts], [], faces)
    me.update()
    return set_mat(link(bpy.data.objects.new(name, me)))


def prim(kind, mat='toon', **kw):
    getattr(bpy.ops.mesh, 'primitive_' + kind + '_add')(**kw)
    ob = C.active_object
    apply_tf(ob)
    return set_mat(ob, mat)


def box(size, loc, rot=(0, 0, 0), bevel=0.0, mat='toon'):
    ob = prim('cube', mat=mat, size=1, location=(0, 0, 0))
    for v in ob.data.vertices:
        v.co = Vector((v.co.x * size[0], v.co.y * size[1], v.co.z * size[2]))
    ob.data.update()
    ob.rotation_euler = rot
    ob.location = loc
    apply_tf(ob)
    if bevel > 0:
        modify(ob, 'BEVEL', width=bevel, segments=1, limit_method='NONE')
    return ob


def cyl(r, depth, loc, rot=(0, 0, 0), verts=10, mat='toon', r2=None):
    if r2 is None:
        ob = prim('cylinder', mat=mat, vertices=verts, radius=r, depth=depth, location=loc, rotation=rot)
    else:
        ob = prim('cone', mat=mat, vertices=verts, radius1=r, radius2=r2, depth=depth, location=loc, rotation=rot)
    return ob


def rod(a, b, r, verts=8, mat='toon'):
    """cylinder between two points"""
    a, b = Vector(a), Vector(b)
    d = b - a
    ob = prim('cylinder', mat=mat, vertices=verts, radius=r, depth=d.length, location=(0, 0, 0))
    rot = Vector((0, 0, 1)).rotation_difference(d.normalized())
    for v in ob.data.vertices:
        v.co = rot @ v.co + (a + b) / 2
    ob.data.update()
    return ob


def blob(r, loc, scale=(1, 1, 1), sub=2, amp=0.18, freq=1.6, seed=0.0, mat='toon'):
    ob = prim('ico_sphere', mat=mat, subdivisions=sub, radius=r, location=(0, 0, 0))
    for v in ob.data.vertices:
        n = v.co.normalized()
        v.co += n * nz(v.co, freq / r, seed) * amp * r
        v.co = Vector((v.co.x * scale[0], v.co.y * scale[1], v.co.z * scale[2])) + Vector(loc)
    ob.data.update()
    return ob


def paint(ob, fn, linear=False):
    """fn(world_pos, normal, poly_center) -> rgb (sRGB 0..1, or raw linear multipliers if linear)"""
    me = ob.data
    while me.color_attributes:
        me.color_attributes.remove(me.color_attributes[0])
    ca = me.color_attributes.new('Col', 'BYTE_COLOR', 'CORNER')
    me.color_attributes.active_color = ca
    mw = ob.matrix_world
    nm = mw.to_3x3()
    for poly in me.polygons:
        n = (nm @ poly.normal).normalized()
        pc = mw @ poly.center
        for li in poly.loop_indices:
            p = mw @ me.vertices[me.loops[li].vertex_index].co
            c = fn(p, n, pc)
            if linear:
                ca.data[li].color = (c[0], c[1], c[2], 1.0)
            else:
                ca.data[li].color_srgb = (c[0], c[1], c[2], 1.0)
    return ob


def flat(color, jitter=0.0, freq=3.0, seed=0.0):
    return lambda p, n, pc: mul(color, 1 + nz(p, freq, seed) * jitter)


def smooth(ob, angle=42):
    sel([ob])
    bpy.ops.object.shade_smooth()
    ob.data.use_auto_smooth = True
    ob.data.auto_smooth_angle = math.radians(angle)
    return ob


def join(obs, name, angle=42):
    sel(obs)
    bpy.ops.object.join()
    ob = C.active_object
    ob.name = name
    return smooth(ob, angle)


def export(name, obs):
    sel(obs)
    path = os.path.join(OUT, name + '.glb')
    bpy.ops.export_scene.gltf(filepath=path, export_format='GLB', use_selection=True, export_apply=True,
                              export_colors=True, export_normals=True, export_yup=True,
                              export_materials='EXPORT', export_texcoords=any(o.data.uv_layers for o in obs))
    tris = sum(len(p.vertices) - 2 for o in obs for p in o.data.polygons)
    print(f'[props] {name}.glb  {tris} tris  {os.path.getsize(path) // 1024} KB')


def grid(nu, nv, fn):
    verts, faces = [], []
    for j in range(nv + 1):
        for i in range(nu + 1):
            verts.append(fn(i / nu, j / nv))
    for j in range(nv):
        for i in range(nu):
            a = j * (nu + 1) + i
            faces.append((a, a + 1, a + nu + 2, a + nu + 1))
    return verts, faces


def gear(r_out, r_in, r_hole, teeth, thick, loc, rot=(0, 0, 0)):
    ring, hole = [], []
    n = teeth * 4
    for i in range(n):
        a = i / n * TAU
        rr = r_out if (i % 4) in (1, 2) else r_in
        ring.append((math.cos(a) * rr, math.sin(a) * rr, 0))
        hole.append((math.cos(a) * r_hole, math.sin(a) * r_hole, 0))
    faces = [(i, (i + 1) % n, n + (i + 1) % n, n + i) for i in range(n)]
    ob = mesh('gear', ring + hole, faces)
    modify(ob, 'SOLIDIFY', thickness=thick, offset=0)
    ob.rotation_euler = rot
    ob.location = loc
    return apply_tf(ob)


def wood(base, grain_axis=0, tint=0.0, seed=0.0):
    dark = mul(base, 0.72)

    def f(p, n, pc):
        g = math.sin(p[(grain_axis + 1) % 3] * 38 + nz(p, 1.3, seed) * 5) * 0.5 + 0.5
        k = mix(base, dark, g * 0.45 + max(0, nz(p, 0.8, seed + 9)) * 0.4)
        return mul(k, 1 + tint)
    return f


# ------------------------------------------------------------------ assets
def build_sunbeam_rock():
    random.seed(3)
    # lathe-style boulder: steep stratified sides, rounded rim, flat sunny top at z = 1.0
    seg, prof = 40, [(-0.45, 5.05), (-0.1, 5.15), (0.2, 5.0), (0.45, 4.95), (0.62, 4.8), (0.8, 4.68), (0.93, 4.5), (1.0, 4.2), (1.0, 3.2), (1.0, 2.0), (1.0, 0.8), (1.0, 0.0)]
    verts, faces = [], []
    for j, (z, r) in enumerate(prof):
        for i in range(seg):
            a = i / seg * TAU
            ex = 1.0 if r < 0.01 else 1.0
            rr = r * (1 + nz((math.cos(a) * 2, math.sin(a) * 2, 0), 1.0, 1) * 0.09 + nz((math.cos(a), math.sin(a), z), 2.5, 6) * 0.035 * (z < 0.99))
            layer = math.floor((z + 0.45) * 3.2)
            rr += (nz((layer, a * 0.5, 0), 1.0, 9) * 0.12) if z < 0.95 else 0
            verts.append((math.cos(a) * rr * 1.04, math.sin(a) * rr * 0.94, z + (nz((math.cos(a) * 3, math.sin(a) * 3, 0), 1, 2) * 0.02 if z > 0.99 else 0)))
    for j in range(len(prof) - 1):
        for i in range(seg):
            a, b = j * seg + i, j * seg + (i + 1) % seg
            faces.append((a, b, b + seg, a + seg))
    rock = mesh('rock', verts, faces)
    sel([rock]); bpy.ops.object.mode_set(mode='EDIT'); bpy.ops.mesh.select_all(action='SELECT')
    bpy.ops.mesh.remove_doubles(threshold=0.001); bpy.ops.mesh.normals_make_consistent(inside=False)
    bpy.ops.object.mode_set(mode='OBJECT')

    grassA, grassB = H(0x5d8f3a), H(0x86ad4a)
    stoneA, stoneB, stoneD = H(0x857c6e), H(0xa99f8c), H(0x4f4a43)

    def rock_col(p, n, pc):
        band = math.sin((p.z + 0.45) * 3.2 * TAU + nz(p, 0.7, 4) * 1.5) * 0.5 + 0.5
        st = mix(stoneA, stoneB, band * 0.8 + nz(p, 1.2, 7) * 0.3)
        if band < 0.12:
            st = mul(st, 0.62)                                         # strata crevice
        st = mix(st, stoneD, max(0, 0.35 - p.z) * 1.3)                # damp, dark base
        if nz(p, 2.2, 11) > 0.42:
            st = mul(st, 0.72)                                         # cracks
        drip = nz((p.x * 0.6, p.y * 0.6, 0), 1.0, 3) * 0.9 + 0.35
        moss = max(0, n.z - 0.45) * 2.2 + (1.0 if p.z > 1.0 - max(0, drip) * 0.6 else 0) - (1.0 - min(1.0, p.z)) * 1.2
        g = mix(grassA, grassB, nz(p, 0.55, 8) * 0.5 + 0.5)
        if n.z > 0.92 and p.z > 0.97:
            # warm sun-baked stone top with moss islands and lichen speckles
            top = mix(H(0xb9ae98), H(0xcfc3a8), nz(p, 0.6, 21) * 0.5 + 0.5)
            if nz(p, 3.5, 13) > 0.35:
                top = mul(top, 0.85)
            rim = max(0.0, Vector((p.x / 1.04, p.y / 0.94)).length - 3.2)
            m = nz(p, 0.42, 17) * 1.4 + rim * 0.9 - 0.15
            if nz(p, 5, 19) > 0.5:
                top = mix(top, H(0xd8c56a), 0.55)
            return mix(top, mix(g, mul(g, 0.8), nz(p, 2, 5) * 0.5 + 0.5), max(0.0, min(1.0, m * 2.5)))
        return mix(st, mul(g, 0.85), moss)
    paint(rock, rock_col)

    parts = [rock]
    for i in range(9):
        a = i / 9 * TAU + random.random() * 0.4
        rr = 4.9 + random.random() * 0.8
        s = 0.25 + random.random() * 0.45
        b = blob(s, (math.cos(a) * rr * 1.02, math.sin(a) * rr * 0.95, s * 0.25), (1.3, 1.0, 0.75), sub=2, seed=i * 3.1)
        paint(b, lambda p, n, pc: mix(mix(stoneA, stoneB, nz(p, 2, 3) * 0.5 + 0.5), H(0x6f9a45), max(0, n.z - 0.6) * 1.5))
        parts.append(b)
    # Luby's nap blanket + pillow on the warm top
    blanket = mesh('blanket', *grid(10, 8, lambda u, v: (-0.3 + u * 1.7, -1.4 + v * 1.25, 1.03 + math.sin(u * 9) * 0.015 + (0.04 if v > 0.88 else 0))))
    modify(blanket, 'SOLIDIFY', thickness=0.04, offset=1)
    paint(blanket, lambda p, n, pc: H(0xf3e6c8) if (int((p.x + 2) * 3.2) + int((p.y + 2) * 3.2)) % 2 else H(0xd86f74))
    pillow = blob(0.32, (1.15, -0.78, 1.12), (1.0, 1.55, 0.42), sub=2, amp=0.05, seed=4)
    paint(pillow, flat(H(0xfff4dc), 0.04))
    parts += [blanket, pillow]
    ob = join(parts, 'sunbeam_rock', 50)
    export('sunbeam_rock', [ob])


def build_tent():
    random.seed(5)
    L, W, Ht = 3.6, 3.3, 2.55
    canvas, canvasD, dirt = H(0xe3d2ab), H(0x8a7a5e), H(0xa58f6c)

    def panel(side):
        def f(u, v):
            x = -L / 2 + u * L
            sag = math.sin(math.pi * u) * math.sin(math.pi * v) * 0.12
            y = side * (v * W / 2 + v * v * 0.08 + sag * 0.4)
            z = Ht * (1 - v) - sag + math.sin(u * 31 + v * 4) * 0.012 * v
            return (x, y, max(0.02, z))
        return mesh('panel', *grid(18, 9, f))

    def canvas_col(p, n, pc):
        inward = (Vector((p.x, p.y, 0)).normalized().dot(Vector((n.x, n.y, 0))) < -0.2) and abs(p.x) < L / 2 - 0.02
        seam = (abs(((p.x + L / 2) / L * 4) % 1 - 0.5) > 0.47)
        c = mix(canvas, dirt, max(0, 0.45 - p.z) * 2.2 + nz(p, 1.5, 2) * 0.12)
        if seam:
            c = mul(c, 0.82)
        if -1.2 < p.x < -0.35 and 0.7 < p.z < 1.5 and p.y > 0:      # patch
            c = mix(H(0xb59b74), H(0x9a815f), (int(p.x * 18) % 2) * 0.3)
        return mul(c, 0.55) if inward else c

    cloth = [panel(1), panel(-1)]
    # closed back wall
    verts, faces = [], []
    rows = 8
    for j in range(rows + 1):
        t = j / rows
        n = j
        for i in range(n + 1):
            s = (i / n if n else 0.5) * 2 - 1
            verts.append((-L / 2 + 0.05 * math.sin(math.pi * t) * (1 - abs(s)), s * t * W / 2, max(0.02, Ht * (1 - t))))
    idx = lambda j, i: j * (j + 1) // 2 + i
    for j in range(rows):
        for i in range(j + 1):
            faces.append((idx(j, i), idx(j + 1, i), idx(j + 1, i + 1)))
            if i < j:
                faces.append((idx(j, i), idx(j + 1, i + 1), idx(j, i + 1)))
    cloth.append(mesh('back', verts, faces))
    # front flaps, tied back
    for side in (1, -1):
        def flap(u, v, side=side):
            top = Vector((L / 2, 0, Ht))
            edge = top.lerp(Vector((L / 2, side * W / 2, 0.02)), v)
            tie = Vector((L / 2 + 0.25, side * (W / 2 - 0.1), 1.0))
            p = edge.lerp(tie, u * (1 - v * 0.6))
            p.x += math.sin(u * math.pi) * 0.12
            return (p.x, p.y, max(0.02, p.z))
        cloth.append(mesh('flap', *grid(4, 8, flap)))
    for c in cloth:
        modify(c, 'SOLIDIFY', thickness=0.035, offset=0)
        paint(c, canvas_col)

    woodC = H(0x7a5536)
    parts = list(cloth)
    for x in (L / 2 + 0.03, -L / 2 - 0.03):
        parts.append(paint(cyl(0.055, Ht + 0.35, (x, 0, (Ht + 0.35) / 2), verts=8), wood(woodC, 2)))
        stake = (x + math.copysign(1.3, x), 0, 0.0)
        parts.append(paint(rod((x, 0, Ht + 0.2), stake, 0.014, 6), flat(H(0xcbb68a))))
        parts.append(paint(cyl(0.04, 0.3, (stake[0], 0, 0.08), rot=(0, math.copysign(0.4, x), 0), verts=6, r2=0.005), flat(H(0x5e4129))))
    for s in (1, -1):
        for x in (-1.1, 1.1):
            a = (x, s * (W / 2 + 0.02), 0.05)
            stake = (x, s * (W / 2 + 0.45), 0.0)
            parts.append(paint(cyl(0.03, 0.22, stake, verts=6, r2=0.004), flat(H(0x5e4129))))
    # ridge pennant
    pen = mesh('pennant', [(L / 2 + 0.03, 0, Ht + 0.34), (L / 2 + 0.03, 0, Ht + 0.06), (L / 2 + 0.75, 0.05, Ht + 0.2)], [(0, 1, 2)])
    modify(pen, 'SOLIDIFY', thickness=0.02, offset=0)
    parts.append(paint(pen, lambda p, n, pc: mix(H(0x8a5cff), H(0xc9b2ff), (p.x - L / 2) * 0.6)))
    # bedroll peeking from the doorway + a rug in front
    roll = cyl(0.2, 1.3, (0.9, 0.55, 0.2), rot=(math.pi / 2, 0, 0.15), verts=12)
    parts.append(paint(roll, lambda p, n, pc: H(0x4b6f9e) if int((p.y + 3) * 6) % 3 else H(0xe9e2cf)))
    rug = mesh('rug', *grid(8, 6, lambda u, v: (L / 2 + 0.2 + u * 1.3, -0.8 + v * 1.6, 0.03 + math.sin(u * 7) * 0.006)))
    modify(rug, 'SOLIDIFY', thickness=0.02, offset=1)
    parts.append(paint(rug, lambda p, n, pc: [H(0xb8473f), H(0xe8d6a8), H(0x3f6a8a)][int((p.y + 1) * 5) % 3]))

    # supplies stacked beside the tent (local -Y side)
    sx, sy = -0.4, -2.55
    for k, (dx, dy, dz, s, r) in enumerate([(0, 0, 0, 0.62, 0.1), (0.72, 0.1, 0, 0.55, -0.2), (0.25, 0.02, 0.62, 0.5, 0.35)]):
        cr = box((s, s, s), (sx + dx, sy + dy, dz + s / 2), rot=(0, 0, r), bevel=0.03)
        def crate_col(p, n, pc, k=k):
            base = H(0xa8784a) if k != 2 else H(0x9a6c40)
            plank = int((p.z + p.x * 0.3) * 9) % 2
            edge = max(abs(n.x), abs(n.y), abs(n.z)) < 0.97
            return mul(base, 0.7) if edge else mix(base, mul(base, 0.8), plank * 0.6 + nz(p, 4, k) * 0.2)
        parts.append(paint(cr, crate_col))
    barrel = prim('cylinder', vertices=14, radius=0.36, depth=0.95, location=(sx - 0.85, sy + 0.15, 0.475))
    modify(barrel, 'SUBDIVIDE' if False else 'BEVEL', width=0.03, segments=1, limit_method='ANGLE')
    for v in barrel.data.vertices:
        t = (v.co.z) / 0.95
        k = 1 + math.sin(t * math.pi) * 0.12
        v.co.x = sx - 0.85 + (v.co.x - (sx - 0.85)) * k
        v.co.y = sy + 0.15 + (v.co.y - (sy + 0.15)) * k
    barrel.data.update()
    parts.append(paint(barrel, lambda p, n, pc: H(0x55585a) if abs(((p.z - 0.04) / 0.95 * 4) % 1 - 0.5) > 0.42 else wood(H(0x93653d), 2)(p, n, pc)))
    # firewood stack
    for i in range(9):
        row = 0 if i < 4 else (1 if i < 7 else 2)
        col = i - (0, 4, 7)[row]
        x = sx + 1.25 + col * 0.2 + row * 0.1
        lg = cyl(0.09, 0.85, (x, sy - 0.1, 0.09 + row * 0.16), rot=(math.pi / 2, 0, random.uniform(-0.08, 0.08)), verts=8)
        parts.append(paint(lg, lambda p, n, pc: mix(H(0xd9b07a), H(0x9b6b3f), 0.3) if abs(n.y) > 0.8 else wood(H(0x6b4428), 0)(p, n, pc)))
    sack = blob(0.3, (sx - 0.2, sy + 0.75, 0.25), (1.0, 0.85, 0.9), sub=2, amp=0.1, seed=7)
    parts.append(paint(sack, flat(H(0xcdb386), 0.08, 5)))
    ob = join(parts, 'tent', 35)
    export('tent', [ob])


def build_campfire():
    random.seed(7)
    parts, emit = [], []
    for i in range(11):
        a = i / 11 * TAU + random.uniform(-0.1, 0.1)
        r = 0.86 + random.uniform(-0.05, 0.06)
        s = random.uniform(0.16, 0.24)
        st = blob(s, (math.cos(a) * r, math.sin(a) * r, s * 0.45), (1.2, 1.0, 0.8), sub=1, amp=0.25, seed=i * 1.7)
        def scol(p, n, pc):
            soot = max(0, -(n.x * p.x + n.y * p.y)) * 1.8
            return mix(mix(H(0x938c80), H(0xb2ab9c), nz(p, 4, 2) * 0.5 + 0.5), H(0x3b3530), min(0.7, soot))
        parts.append(paint(st, scol))
    for i in range(6):
        a = i / 6 * TAU + 0.3
        base = (math.cos(a) * 0.55, math.sin(a) * 0.55, 0.04)
        top = (math.cos(a + 0.6) * 0.06, math.sin(a + 0.6) * 0.06, 0.78)
        lg = rod(base, top, 0.07 - (i % 2) * 0.01, 7)
        def lcol(p, n, pc):
            t = p.z / 0.78
            barkc = wood(H(0x6b4428), 2)(p, n, pc)
            return mix(barkc, H(0x231914), t * 1.4 - 0.2)
        parts.append(paint(lg, lcol))
    for i in range(2):
        a = i * math.pi + 0.7
        lg = rod((math.cos(a) * 0.7, math.sin(a) * 0.7, 0.08), (math.cos(a + math.pi) * 0.25, math.sin(a + math.pi) * 0.25, 0.14), 0.08, 8)
        parts.append(paint(lg, lambda p, n, pc: mix(wood(H(0x5e3d24), 2)(p, n, pc), H(0x231914), 1 - Vector((p.x, p.y)).length * 1.4)))
    ash = mesh('ash', *grid(10, 10, lambda u, v: ((u - 0.5) * 1.4, (v - 0.5) * 1.4, 0.015)))
    for vt in ash.data.vertices:
        d = Vector((vt.co.x, vt.co.y)).length
        if d > 0.7:
            vt.co.x *= 0.7 / d
            vt.co.y *= 0.7 / d
        vt.co.z = 0.02 + max(0, 0.6 - d) * 0.06
    parts.append(paint(ash, lambda p, n, pc: mix(H(0x2a2522), H(0x6a625a), Vector((p.x, p.y)).length * 1.2 + nz(p, 6, 3) * 0.2)))
    for i in range(14):
        a = random.random() * TAU
        r = random.random() * 0.38
        c = blob(random.uniform(0.05, 0.09), (math.cos(a) * r, math.sin(a) * r, 0.05), (1.3, 1.1, 0.6), sub=1, amp=0.3, seed=i, mat='emit')
        emit.append(paint(c, lambda p, n, pc: mix(H(0xffd36a), H(0xd8401c), Vector((p.x, p.y)).length * 2.2 + nz(p, 9, 1) * 0.3)))
    body = join(parts, 'campfire', 40)
    glow = join(emit, 'campfire_embers', 60)
    export('campfire', [body, glow])


def build_log_seat():
    random.seed(9)
    R, Lh, ring_n, seg = 0.29, 0.8, 16, 9
    verts, faces = [], []
    for j in range(seg + 1):
        x = -Lh + j / seg * 2 * Lh
        for i in range(ring_n):
            a = i / ring_n * TAU
            r = R * (1 + nz((x, a, 0), 1.5, 3) * 0.05) + abs(math.sin(a * 7 + x * 1.3)) * 0.018
            verts.append((x, math.cos(a) * r, math.sin(a) * r))
    for j in range(seg):
        for i in range(ring_n):
            a, b = j * ring_n + i, j * ring_n + (i + 1) % ring_n
            faces.append((a, b, b + ring_n, a + ring_n))
    for end, j in ((-1, 0), (1, seg)):
        base = len(verts)
        x = end * (Lh + 0.004)
        for i in range(ring_n):
            a = i / ring_n * TAU
            verts.append((x, math.cos(a) * R * 0.78, math.sin(a) * R * 0.78))
        verts.append((x, 0, 0))
        c = base + ring_n
        for i in range(ring_n):
            o0, o1 = j * ring_n + i, j * ring_n + (i + 1) % ring_n
            i0, i1 = base + i, base + (i + 1) % ring_n
            faces.append((o0, o1, i1, i0) if end > 0 else (o1, o0, i0, i1))
            faces.append((i0, i1, c) if end > 0 else (i1, i0, c))
    lg = mesh('log', verts, faces)
    lg.location = (0, 0, R - 0.02)
    apply_tf(lg)
    barkc, cut = H(0x6e4a2e), H(0xd2a974)

    def col(p, n, pc):
        if abs(n.x) > 0.7:
            rr = Vector((p.y, p.z - R)).length
            ring = math.sin(rr * 70) * 0.5 + 0.5
            return mix(mix(cut, H(0xa97b48), ring * 0.45), H(0x6b4428), max(0, rr - R * 0.82) * 25)
        c = mix(barkc, mul(barkc, 0.6), abs(math.sin(math.atan2(p.z - R, p.y) * 7 + p.x * 1.3)) ** 6)
        if n.z > 0.55 and nz(p, 2.5, 4) > 0.05:
            c = mix(c, H(0x6f9a45), 0.8)
        return c
    paint(lg, col)
    stub = rod((0.25, 0.1, R + 0.15), (0.35, 0.32, R + 0.32), 0.05, 7)
    paint(stub, lambda p, n, pc: mix(barkc, cut, 1.0 if p.z > R + 0.3 else 0))
    sw = blob(0.12, (-0.5, -0.33, 0.06), (1.4, 1.0, 0.5), sub=1, seed=2)
    paint(sw, flat(H(0x6f9a45), 0.15))
    ob = join([lg, stub, sw], 'log_seat', 40)
    export('log_seat', [ob])


def build_workbench():
    random.seed(11)
    parts, emit = [], []
    # plank top
    for k in range(3):
        y = -0.36 + k * 0.36
        pl = box((2.3, 0.34, 0.08), (0, y, 0.9), bevel=0.012)
        parts.append(paint(pl, wood(H(0x9e6d42), 0, tint=(k - 1) * 0.07, seed=k)))
    for x in (-1.0, 1.0):
        for y in (-0.42, 0.42):
            parts.append(paint(box((0.11, 0.11, 0.86), (x, y, 0.43), bevel=0.01), wood(H(0x6b4428), 2)))
        parts.append(paint(box((0.08, 0.84, 0.08), (x, 0, 0.22), bevel=0.008), wood(H(0x6b4428), 1)))
    shelf = box((2.0, 0.8, 0.05), (0, 0, 0.27), bevel=0.008)
    parts.append(paint(shelf, wood(H(0x8a5a36), 0, seed=4)))
    # vise on the +X end
    steel, steelD = H(0x7d8b94), H(0x4f5a62)
    for dy in (-0.08, 0.08):
        parts.append(paint(box((0.18, 0.06, 0.16), (1.02, -0.28 + dy, 1.02), bevel=0.01), flat(H(0x3f6d8f), 0.05)))
    parts.append(paint(rod((1.02, -0.28, 0.98), (1.02, -0.6, 0.98), 0.018, 8), flat(steel)))
    parts.append(paint(rod((0.95, -0.6, 0.98), (1.09, -0.6, 0.98), 0.014, 6), flat(steelD)))
    # gears
    g1 = gear(0.24, 0.2, 0.07, 12, 0.05, (-0.55, 0.12, 0.965))
    g2 = gear(0.15, 0.125, 0.045, 9, 0.045, (-0.2, 0.25, 0.962), rot=(0, 0, 0.2))
    g3 = gear(0.19, 0.16, 0.05, 10, 0.05, (-0.85, -0.25, 1.05), rot=(1.3, 0, 0.4))
    paint(g1, flat(H(0xc9a24a), 0.08, 6))
    paint(g2, flat(H(0xb8c0c6), 0.06, 6))
    paint(g3, flat(H(0xb08a3a), 0.08, 6))
    parts += [g1, g2, g3]
    # wrench + hammer
    parts.append(paint(box((0.42, 0.045, 0.02), (0.5, 0.22, 0.95), rot=(0, 0, 0.55)), flat(H(0xd04545))))
    wh = gear(0.06, 0.06, 0.028, 2, 0.02, (0.68, 0.33, 0.95))
    parts.append(paint(wh, flat(steel)))
    parts.append(paint(rod((0.1, -0.15, 0.96), (0.48, -0.32, 0.96), 0.022, 8), wood(H(0xb88a55), 0)))
    parts.append(paint(box((0.1, 0.2, 0.08), (0.5, -0.33, 0.97), rot=(0, 0, -0.42), bevel=0.01), flat(steelD)))
    # blueprint sheet
    bp = mesh('bp', *grid(6, 4, lambda u, v: (0.05 + u * 0.55, 0.0 + v * 0.38, 0.946)))
    modify(bp, 'SOLIDIFY', thickness=0.004, offset=1)
    parts.append(paint(bp, lambda p, n, pc: H(0xe8f1ff) if (abs((p.x * 22) % 1 - 0.5) > 0.45 or abs((p.y * 22) % 1 - 0.5) > 0.45) else H(0x3c6fae)))
    # toolbox on the shelf
    parts.append(paint(box((0.55, 0.3, 0.26), (0.45, 0.05, 0.43), bevel=0.02), lambda p, n, pc: H(0xc4443a) if p.z < 0.53 else H(0xa8362e)))
    parts.append(paint(rod((0.3, 0.05, 0.58), (0.6, 0.05, 0.58), 0.016, 6), flat(steelD)))
    # lantern
    parts.append(paint(box((0.16, 0.16, 0.03), (-0.95, 0.35, 0.955)), flat(H(0x3a3a40))))
    parts.append(paint(box((0.16, 0.16, 0.03), (-0.95, 0.35, 1.2)), flat(H(0x3a3a40))))
    for dx in (-0.07, 0.07):
        for dy in (-0.07, 0.07):
            parts.append(paint(box((0.018, 0.018, 0.24), (-0.95 + dx, 0.35 + dy, 1.075)), flat(H(0x3a3a40))))
    parts.append(paint(rod((-1.0, 0.35, 1.22), (-0.95, 0.35, 1.3), 0.01, 5), flat(H(0x3a3a40))))
    parts.append(paint(rod((-0.9, 0.35, 1.22), (-0.95, 0.35, 1.3), 0.01, 5), flat(H(0x3a3a40))))
    glass = box((0.12, 0.12, 0.2), (-0.95, 0.35, 1.075), mat='emit')
    emit.append(paint(glass, lambda p, n, pc: mix(H(0xfff2b0), H(0xffa53a), (1.17 - p.z) * 4)))
    # scrap pile at the -X side
    sp = (-1.75, 0.0)
    cols = [H(0x8d9aa0), H(0x6f7b80), H(0xc4a35a), H(0x9a6a4a)]
    for i in range(10):
        s = (random.uniform(0.2, 0.55), random.uniform(0.2, 0.5), random.uniform(0.03, 0.08))
        plate = box(s, (sp[0] + random.uniform(-0.35, 0.35), sp[1] + random.uniform(-0.45, 0.45), 0.05 + i * 0.035),
                    rot=(random.uniform(-0.5, 0.5), random.uniform(-0.5, 0.5), random.uniform(0, 3)), bevel=0.006)
        c = cols[i % 4]
        parts.append(paint(plate, lambda p, n, pc, c=c: mix(c, H(0xa8603a), max(0, nz(p, 6, 2)) * 0.9)))
    for i in range(3):
        pipe = rod((sp[0] - 0.4, sp[1] - 0.3 + i * 0.25, 0.08 + i * 0.05), (sp[0] + 0.45, sp[1] - 0.1 + i * 0.2, 0.18 + i * 0.06), 0.045, 10)
        parts.append(paint(pipe, flat(H(0x9aa5ab), 0.1, 5)))
    big = gear(0.33, 0.27, 0.1, 14, 0.07, (sp[0] + 0.1, sp[1] + 0.35, 0.35), rot=(1.2, 0.2, 0.3))
    parts.append(paint(big, lambda p, n, pc: mix(H(0xa88a4a), H(0x8f5432), max(0, nz(p, 5, 9)) * 1.2)))
    body = join(parts, 'workbench', 35)
    glow = join(emit, 'workbench_glow', 60)
    export('workbench', [body, glow])


# ------------------------------------------------------------------ batch 2: forest
def tube_mesh(name, pts, radii, sides=8, vscale=0.5, cap_top=False):
    """tube along a polyline with per-loop UVs (u around, v along) — no seam split"""
    pts = [Vector(p) for p in pts]
    verts, faces, fuv = [], [], []
    a = None
    length = 0.0
    vs = []
    for i, pt in enumerate(pts):
        d = (pts[min(i + 1, len(pts) - 1)] - pts[max(i - 1, 0)]).normalized()
        if a is None:
            a = Vector((1, 0, 0)) if abs(d.x) < 0.9 else Vector((0, 1, 0))
        a = (a - d * a.dot(d)).normalized()
        b = d.cross(a)
        if i:
            length += (pt - pts[i - 1]).length
        vs.append(length * vscale)
        for k in range(sides):
            th = k / sides * TAU
            n = a * math.cos(th) + b * math.sin(th)
            verts.append(pt + n * radii[i])
    for i in range(len(pts) - 1):
        for k in range(sides):
            k2 = (k + 1) % sides
            faces.append((i * sides + k, i * sides + k2, (i + 1) * sides + k2, (i + 1) * sides + k))
            u0, u1 = k / sides, (k + 1) / sides
            fuv.append(((u0, vs[i]), (u1, vs[i]), (u1, vs[i + 1]), (u0, vs[i + 1])))
    if cap_top:
        c = len(verts)
        verts.append(pts[-1])
        i = len(pts) - 1
        for k in range(sides):
            faces.append((i * sides + k, i * sides + (k + 1) % sides, c))
            fuv.append(((0.5, 0.5), (0.5, 0.5), (0.5, 0.5)))
    ob = mesh(name, verts, faces)
    uvl = ob.data.uv_layers.new(name='UVMap')
    for poly, uv in zip(ob.data.polygons, fuv):
        for li, t in zip(poly.loop_indices, uv):
            uvl.data[li].uv = t
    return ob


def root_parts(seed, n=5, scale=1.0, r0=0.46):
    rnd = random.Random(seed)
    parts = [tube_mesh('flare', [(0, 0, -0.3 * scale), (0, 0, 0.08 * scale), (0, 0, 0.45 * scale), (0, 0, 0.9 * scale)],
                       [r0 * 1.45, r0 * 1.32, r0 * 1.08, r0], 12)]
    for i in range(n):
        a = i / n * TAU + rnd.uniform(-0.35, 0.35)
        L = rnd.uniform(1.25, 1.75) * scale
        side = rnd.uniform(-0.25, 0.25)
        pts = []
        for j, t in enumerate((0.0, 0.3, 0.62, 1.0)):
            aa = a + side * t
            rr = r0 * 0.7 + L * t
            z = 0.5 * scale * (1 - t) ** 1.6 - 0.22 * scale * t + math.sin(t * 7 + i) * 0.03
            pts.append((math.cos(aa) * rr, math.sin(aa) * rr, z))
        parts.append(tube_mesh('root', pts, [r0 * 0.42, r0 * 0.3, r0 * 0.15, r0 * 0.04], 7))
    return parts


def bark_ao(p, n, pc):
    k = 0.52 + min(1.0, max(0.0, p.z) / 2.5) * 0.5 + nz(p, 3, 5) * 0.05
    return (k, k, k)


def build_tree_roots():
    parts = root_parts(21)
    for o in parts:
        paint(o, bark_ao, linear=True)
    ob = join(parts, 'tree_roots', 60)
    export('tree_roots', [ob])


def build_rocks():
    for idx, (seed, squash, chips) in enumerate([(2.0, 0.7, 10), (5.0, 0.6, 7), (9.0, 0.82, 13)]):
        rnd = random.Random(seed)
        ob = prim('ico_sphere', subdivisions=4, radius=1)
        planes = []
        for i in range(chips):
            v = Vector((rnd.uniform(-1, 1), rnd.uniform(-0.6, 1), rnd.uniform(-1, 1))).normalized()
            planes.append((v, rnd.uniform(0.6, 0.86)))
        for v in ob.data.vertices:
            t = v.co.copy()
            for pv, d in planes:
                k = t.dot(pv)
                if k > d:
                    t -= pv * (k - d) * 0.92
            t *= 1 + nz(t, 1.6, seed) * 0.08
            # sedimentary steps: quantise height a little
            step = 0.16
            t.z = t.z * 0.75 + (math.floor(t.z / step) * step) * 0.25
            v.co = Vector((t.x * 1.08, t.y, t.z * squash))
        ob.data.update()
        # crisp chipped facets
        smooth(ob, 32)
        paint(ob, lambda p, n, pc: (1, 1, 1))
        ob.name = f'rock_{"abc"[idx]}'
        export(ob.name, [ob])
        reset()


def mushroom(loc, h, cap_r, cap_col, spot=None, lean=(0, 0), seed=0):
    x, y, z = loc
    top = (x + lean[0], y + lean[1], z + h)
    stem = tube_mesh('stem', [(x, y, z - 0.02), ((x + top[0]) / 2, (y + top[1]) / 2, z + h * 0.5), top], [cap_r * 0.3, cap_r * 0.24, cap_r * 0.22], 7)
    paint(stem, lambda p, n, pc: mix(H(0xf3ead6), H(0xcbbd9f), 1 - (p.z - z) / h))
    cap = prim('uv_sphere', segments=12, ring_count=6, radius=1)
    for v in cap.data.vertices:
        zz = v.co.z
        if zz < 0:
            v.co.z = zz * 0.15
        v.co = Vector((v.co.x * cap_r + top[0], v.co.y * cap_r + top[1], v.co.z * cap_r * 0.62 + top[2] - cap_r * 0.05))
    cap.data.update()
    rnd = random.Random(seed)
    spots = [Vector((rnd.uniform(-1, 1), rnd.uniform(-1, 1), rnd.uniform(0.3, 1))).normalized() for _ in range(7)]

    def ccol(p, n, pc):
        if n.z < -0.3:
            return H(0xe9dcc0)                                    # gills
        c = mix(cap_col, mul(cap_col, 1.25), (p.z - top[2]) / (cap_r * 0.6))
        if spot:
            d = Vector((p.x - top[0], p.y - top[1], (p.z - top[2]) * 1.6)).normalized()
            if any(d.dot(sv) > 0.95 for sv in spots):
                return spot
        return c
    paint(cap, ccol)
    return [stem, cap]


def build_mushrooms():
    for name, col, spot in (('mushrooms_red', H(0xd8392b), H(0xfff6e6)), ('mushrooms_brown', H(0xa8703c), None)):
        rnd = random.Random(name)
        parts = []
        for i in range(5):
            a = i / 5 * TAU + rnd.uniform(0, 0.8)
            r = 0 if i == 0 else rnd.uniform(0.1, 0.2)
            h = (0.26 if i == 0 else rnd.uniform(0.08, 0.17)) * (1.0 if spot else 0.85)
            cr = h * rnd.uniform(0.55, 0.75) + 0.02
            parts += mushroom((math.cos(a) * r, math.sin(a) * r, 0), h, cr, col, spot, (math.cos(a) * r * 0.25, math.sin(a) * r * 0.25), i)
        g = blob(0.16, (0, 0, 0.0), (1.6, 1.4, 0.35), sub=1, seed=3)
        paint(g, flat(H(0x5c8a3a), 0.15, 6))
        parts.append(g)
        ob = join(parts, name, 50)
        export(name, [ob])
        reset()


def build_stump():
    parts = root_parts(33, n=4, scale=0.75, r0=0.42)
    body = tube_mesh('stump', [(0, 0, 0.5), (0, 0, 0.62), (0.01, 0, 0.7)], [0.43, 0.42, 0.41], 12, cap_top=True)
    parts.append(body)
    barkc, cut = H(0x6e4a2e), H(0xd2a974)

    def col(p, n, pc):
        if n.z > 0.8 and p.z > 0.66:
            rr = Vector((p.x, p.y)).length
            return mix(mix(cut, H(0xa97b48), (math.sin(rr * 60) * 0.5 + 0.5) * 0.5), H(0x7a5232), max(0, rr - 0.33) * 12)
        c = mix(barkc, mul(barkc, 0.65), abs(math.sin(math.atan2(p.y, p.x) * 9 + p.z * 3)) ** 5)
        if n.z > 0.3 and nz(p, 2.2, 4) > 0.1:
            c = mix(c, H(0x6f9a45), 0.85)
        return mul(c, 0.7 + min(1.0, max(0.0, p.z) / 0.7) * 0.3)
    for o in parts:
        paint(o, col)
    # bracket fungus
    for i, (a, z) in enumerate(((0.6, 0.35), (1.1, 0.25), (3.9, 0.42))):
        f = blob(0.13, (math.cos(a) * 0.45, math.sin(a) * 0.45, z), (1.1, 1.1, 0.3), sub=1, seed=i)
        paint(f, lambda p, n, pc: H(0xe6c27a) if n.z > 0 else H(0xf2e3c2))
        parts.append(f)
    parts += mushroom((0.62, -0.35, 0.0), 0.16, 0.1, H(0xd8392b), H(0xfff6e6), seed=9)
    ob = join(parts, 'stump', 45)
    export('stump', [ob])


def build_fallen_log():
    rnd = random.Random(7)
    pts, radii = [], []
    for i in range(10):
        t = i / 9
        pts.append((-1.7 + t * 3.4, math.sin(t * 3) * 0.06, 0.3 + math.sin(t * 2.2) * 0.03))
        radii.append(0.33 - t * 0.06)
    lg = tube_mesh('log', pts, radii, 12)
    # jagged broken end
    for v in lg.data.vertices:
        if v.co.x > 1.6:
            v.co.x += rnd.uniform(-0.05, 0.22)
    lg.data.update()
    barkc = H(0x5f4029)

    def col(p, n, pc):
        c = mix(barkc, mul(barkc, 0.6), abs(math.sin(math.atan2(p.z - 0.3, p.y) * 8 + p.x * 0.8)) ** 5)
        if p.x > 1.62:
            c = H(0x8a6440)
        if n.z > 0.35 and nz(p, 1.4, 2) > -0.15:
            c = mix(c, mix(H(0x5f8f3a), H(0x86ad4a), nz(p, 4, 1) * 0.5 + 0.5), 0.9)
        return c
    paint(lg, col)
    parts = [lg]
    # cut end cap (left)
    cap = cyl(radii[0] * 0.98, 0.02, (-1.71, 0, 0.3), rot=(0, math.pi / 2, 0), verts=12)
    paint(cap, lambda p, n, pc: mix(H(0xc99c66), H(0x9a6c40), (math.sin(Vector((p.y, p.z - 0.3)).length * 55) * 0.5 + 0.5) * 0.6))
    parts.append(cap)
    br = tube_mesh('branch', [(0.4, 0.15, 0.48), (0.6, 0.45, 0.75), (0.75, 0.62, 0.86)], [0.08, 0.05, 0.02], 6)
    paint(br, flat(barkc, 0.1))
    parts.append(br)
    for i, x in enumerate((-0.9, -0.55, 0.2)):
        f = blob(0.12, (x, -0.33, 0.32 + i * 0.03), (1.0, 1.2, 0.28), sub=1, seed=i + 4)
        paint(f, lambda p, n, pc: H(0xe8b25c) if n.z > 0 else H(0xf3e3c0))
        parts.append(f)
    parts += mushroom((1.2, 0.36, 0.0), 0.15, 0.09, H(0xa8703c), None, seed=3)
    parts += mushroom((1.32, 0.42, 0.0), 0.1, 0.07, H(0xa8703c), None, seed=4)
    for i in range(4):
        g = blob(0.2, (-1.4 + i * 0.95, rnd.uniform(-0.38, 0.38), 0.02), (1.6, 1.0, 0.35), sub=1, seed=i * 2)
        paint(g, flat(H(0x5c8a3a), 0.15, 6))
        parts.append(g)
    ob = join(parts, 'fallen_log', 45)
    export('fallen_log', [ob])



# ------------------------------------------------------------------ batch 3: chapter landmarks
def ring(r, z, sides, phase=0.0, rfn=None, off=(0, 0)):
    pts = []
    for k in range(sides):
        a = phase + k / sides * TAU
        rr = rfn(a, z, r) if rfn else r
        pts.append(Vector((math.cos(a) * rr + off[0], math.sin(a) * rr + off[1], z)))
    return pts


def loft(name, rings, cap_bot=True, cap_top=True, mat='toon'):
    """quad strip through CCW rings of equal size, optional n-gon caps"""
    n = len(rings[0])
    verts = [v for r in rings for v in r]
    faces = []
    for i in range(len(rings) - 1):
        for k in range(n):
            k2 = (k + 1) % n
            faces.append((i * n + k, i * n + k2, (i + 1) * n + k2, (i + 1) * n + k))
    if cap_bot:
        faces.append(tuple(reversed(range(n))))
    if cap_top:
        m = (len(rings) - 1) * n
        faces.append(tuple(range(m, m + n)))
    return set_mat(mesh(name, verts, faces), mat)


def lathe(name, profile, sides, phase=0.0, rfn=None, mat='toon', caps=(True, True)):
    """profile = [(z, r), ...] bottom to top"""
    return loft(name, [ring(r, z, sides, phase, rfn) for z, r in profile], caps[0], caps[1], mat)


def crystal(loc, h, r, tilt=0.0, yaw=0.0, col=H(0xc77dff), mat='emit'):
    a = h * 0.35
    ob = mesh('crystal', [(0, 0, h), (r, 0, a), (0, r, a), (-r, 0, a), (0, -r, a), (0, 0, -0.1)],
              [(0, 1, 2), (0, 2, 3), (0, 3, 4), (0, 4, 1), (5, 2, 1), (5, 3, 2), (5, 4, 3), (5, 1, 4)])
    set_mat(ob, mat)
    ob.rotation_euler = (tilt, 0, yaw)
    ob.location = loc
    apply_tf(ob)
    return paint(ob, lambda p, n, pc: mix(col, (1, 1, 1), max(0.0, n.z) * 0.35))


def rune(loc, angle, w, h, d=0.04, col=H(0xd59bff)):
    """small glowing bar facing outwards along `angle` (radians around Z)"""
    ob = box((d, w, h), loc, rot=(0, 0, angle), mat='emit')
    return paint(ob, lambda p, n, pc: col)


def glyph(cx, cy, z, angle, r, scale=1.0, col=H(0xd59bff), seed=0):
    """3-stroke carved rune on a surface at radius r"""
    rnd = random.Random(seed)
    out = []
    ca, sa = math.cos(angle), math.sin(angle)
    tx, ty = -sa, ca
    for j in range(3):
        u = rnd.uniform(-0.12, 0.12) * scale
        hh = rnd.uniform(0.18, 0.4) * scale
        zz = z + rnd.uniform(-0.2, 0.2) * scale
        tilt = rnd.choice((0.0, 0.0, 0.6, -0.6))
        ob = box((0.14, 0.07 * scale, hh), (cx + ca * r + tx * u, cy + sa * r + ty * u, zz), rot=(tilt, 0, angle), mat='emit')
        out.append(paint(ob, lambda p, n, pc: col))
    return out


def rubble(n, r0, r1, z, size, col, seed=0):
    rnd = random.Random(seed)
    out = []
    for i in range(n):
        a = rnd.uniform(0, TAU)
        rr = rnd.uniform(r0, r1)
        s = size * rnd.uniform(0.6, 1.3)
        b = blob(s, (math.cos(a) * rr, math.sin(a) * rr, z + s * 0.25), (1.2, 1.0, 0.65), sub=1, amp=0.35, seed=seed + i)
        out.append(paint(b, flat(col, 0.18, 4, seed + i)))
    return out


# ---- Nine Tails Den: corrupted rune menhirs
def den_block(r0, r1, z0, z1, seed, sides=7, jag=0.0):
    rnd = random.Random(seed)
    phase = rnd.uniform(0, TAU)
    rad = [1 + rnd.uniform(-0.13, 0.1) for _ in range(sides)]
    rings = []
    for zi, (z, r) in enumerate(((z0, r0), ((z0 + z1) / 2, (r0 + r1) / 2 * 1.03), (z1, r1))):
        rg = ring(r, z, sides, phase, lambda a, zz, rr, zi=zi: rr * rad[int(round((a - phase) / TAU * sides)) % sides])
        if zi == 2 and jag:
            for v in rg:
                v.z -= rnd.uniform(0, jag)
        rings.append(rg)
    ob = loft('block', rings)
    modify(ob, 'BEVEL', width=0.045, segments=1, limit_method='ANGLE', angle_limit=math.radians(35))
    return ob, phase


def den_paint(seed):
    def f(p, n, pc):
        c = mix(H(0x524a62), H(0x8b829c), nz(p, 1.1, seed) * 0.5 + 0.5)
        c = mul(c, (1 + nz(p, 6, seed + 3) * 0.1) * (0.72 + 0.28 * min(1.0, max(0.0, p.z) / 2.5)))
        if n.z > 0.55 and nz(p, 1.8, seed + 7) > -0.2:
            c = mix(c, H(0x56743f), 0.85)                              # moss on ledges
        elif p.z < 0.35 + nz(p, 2.2, seed) * 0.3:
            c = mix(c, H(0x46603a), 0.7)                               # damp moss at the foot
        if abs(nz(p, 2.6, seed + 11)) < 0.035:
            c = mul(c, 0.55)                                           # hairline cracks
        return c
    return f


def den_pillar(name, blocks, rune_block, fallen=None):
    parts, emit = [], []
    for i, (r0, r1, z0, z1, jag) in enumerate(blocks):
        ob, phase = den_block(r0, r1, z0, z1, 40 + i * 7 + len(name), jag=jag)
        paint(ob, den_paint(i))
        parts.append(ob)
        if i == rune_block:
            ap = (r0 + r1) / 2 * math.cos(math.pi / 7) * 0.98
            for k in (0, 2, 4):
                a = phase + (k + 0.5) / 7 * TAU
                emit += glyph(0, 0, (z0 + z1) / 2, a, ap + 0.04, 1.3, seed=k + i)
    if fallen:
        x, y, rz = fallen
        ob, _ = den_block(0.62, 0.55, -0.55, 0.55, 99, jag=0.2)
        ob.rotation_euler = (math.pi / 2 - 0.12, 0, rz)
        ob.location = (x, y, 0.5)
        apply_tf(ob)
        paint(ob, den_paint(5))
        parts.append(ob)
    for i, (a, h, t) in enumerate(((0.5, 0.9, 0.35), (2.4, 0.6, -0.4), (4.4, 0.75, 0.3))):
        emit.append(crystal((math.cos(a) * 1.0, math.sin(a) * 1.0, 0.0), h, 0.17, t, a + math.pi / 2, H(0xb86bff)))
    parts += rubble(5, 1.0, 1.6, 0.0, 0.18, H(0x5d566c), seed=len(name))
    g = blob(1.1, (0, 0, -0.05), (1.25, 1.25, 0.22), sub=2, amp=0.25, seed=2)
    paint(g, lambda p, n, pc: mix(H(0x3f5a33), H(0x5a4a6a), nz(p, 1.5, 4) * 0.5 + 0.5))
    parts.append(g)
    ob = join(parts, name, 32)
    glow = join(emit, name + '_runes', 30)
    export(name, [ob, glow])
    reset()


def build_den_pillars():
    den_pillar('den_pillar', [(0.95, 0.88, 0.0, 2.2, 0), (0.87, 0.8, 2.26, 4.3, 0), (0.79, 0.66, 4.36, 6.0, 0.3)], 1)
    den_pillar('den_pillar_broken', [(0.95, 0.9, 0.0, 1.55, 0), (0.88, 0.8, 1.61, 3.0, 0.75)], 0, fallen=(1.55, 0.5, 0.7))


# ---- Sunken Reef: sea-worn fluted columns with coral
def reef_stone(seed, flutes=0):
    def f(p, n, pc):
        c = mix(H(0xd8cdb4), H(0xf0e9d8), nz(p, 1.3, seed) * 0.5 + 0.5)
        if flutes:
            c = mul(c, 0.9 + 0.1 * math.cos(math.atan2(p.y, p.x) * flutes))
        algae = 0.55 + nz(p, 1.6, seed + 2) * 0.35
        if p.z < algae:
            c = mix(c, H(0x5fbfa8), 0.45 * min(1.0, (algae - p.z) * 2.5))  # tide-line algae
        if n.z > 0.5 and p.z > 0.5 and nz(p, 2, seed + 5) > 0.2:
            c = mix(c, H(0x6fbf8a), 0.75)
        if abs(nz(p, 2.4, seed + 9)) < 0.03:
            c = mul(c, 0.7)
        return c
    return f


def flute_fn(n, depth):
    return lambda a, z, r: r * (1 - depth * (0.5 + 0.5 * math.cos(a * n)))


def coral_cluster(cx, cy, seed, scale=1.0):
    rnd = random.Random(seed)
    out = []
    pal = [H(0xff7f9a), H(0xff9f6a), H(0xc78bff), H(0xff6f7f)]
    col = pal[seed % len(pal)]
    for i in range(4):
        a = rnd.uniform(0, TAU)
        L = rnd.uniform(0.25, 0.5) * scale
        pts = [(cx, cy, 0.0), (cx + math.cos(a) * L * 0.3, cy + math.sin(a) * L * 0.3, L * 0.5), (cx + math.cos(a) * L * 0.55, cy + math.sin(a) * L * 0.55, L)]
        t = tube_mesh('coral', pts, [0.055 * scale, 0.045 * scale, 0.03 * scale], 6, cap_top=True)
        out.append(paint(t, lambda p, n, pc, col=col: mix(mul(col, 0.75), mix(col, (1, 1, 1), 0.3), p.z / (0.5 * scale))))
    fan = blob(0.22 * scale, (cx + 0.1, cy - 0.05, 0.25 * scale), (1.0, 0.18, 1.1), sub=1, amp=0.3, seed=seed)
    out.append(paint(fan, flat(pal[(seed + 1) % 4], 0.15, 9)))
    return out


def barnacles(n, r, z0, z1, seed):
    rnd = random.Random(seed)
    out = []
    for i in range(n):
        a = rnd.uniform(0, TAU)
        z = rnd.uniform(z0, z1)
        s = rnd.uniform(0.04, 0.08)
        b = cyl(s, s * 1.1, (math.cos(a) * (r + s * 0.3), math.sin(a) * (r + s * 0.3), z), rot=(0, math.pi / 2, a), verts=6, r2=s * 0.45)
        out.append(paint(b, flat(H(0xe8e0cc), 0.12, 20, i)))
    return out


def starfish(loc, r, yaw, col=H(0xff8a3a)):
    verts = [(0, 0, 0.05)]
    for k in range(10):
        a = yaw + k / 10 * TAU
        rr = r if k % 2 == 0 else r * 0.42
        verts.append((math.cos(a) * rr, math.sin(a) * rr, 0.0))
    faces = [(0, 1 + k, 1 + (k + 1) % 10) for k in range(10)]
    ob = mesh('star', [(v[0] + loc[0], v[1] + loc[1], v[2] + loc[2]) for v in verts], faces)
    return paint(ob, lambda p, n, pc: mix(col, H(0xffd2a0), max(0, p.z - loc[2]) * 14))


def reef_column(name, top, broken):
    rnd = random.Random(name)
    parts = []
    base = lathe('base', [(0, 0.86), (0.22, 0.86), (0.26, 0.8), (0.34, 0.76), (0.42, 0.66)], 16)
    paint(base, reef_stone(1))
    parts.append(base)
    prof = []
    nseg = 7
    for i in range(nseg + 1):
        t = i / nseg
        prof.append((0.42 + t * (top - 0.42), 0.62 - t * 0.07))
    erode = lambda a, z, r: flute_fn(14, 0.07)(a, z, r) * (1 - max(0.0, nz(Vector((math.cos(a), math.sin(a), z * 0.7)), 1.4, 3) - 0.3) * 0.5)
    rings = [ring(r, z, 28, 0, erode) for z, r in prof]
    if broken:
        for v in rings[-1]:
            v.z -= rnd.uniform(0, 0.45) + (0.5 + 0.5 * math.sin(math.atan2(v.y, v.x) * 2)) * 0.25
    shaft = loft('shaft', rings)
    paint(shaft, reef_stone(2, 14))
    parts.append(shaft)
    if not broken:
        ech = lathe('echinus', [(top, 0.56), (top + 0.12, 0.6), (top + 0.24, 0.74)], 16)
        aba = lathe('abacus', [(top + 0.24, 0.82 * 1.3), (top + 0.42, 0.82 * 1.3)], 4, math.pi / 4)
        modify(aba, 'BEVEL', width=0.04, segments=1, limit_method='ANGLE', angle_limit=math.radians(40))
        for o in (ech, aba):
            paint(o, reef_stone(3))
            parts.append(o)
        sw = tube_mesh('kelp', [(0.62, 0.2, top + 0.42), (0.75, 0.25, top + 0.1), (0.7, 0.2, top - 0.4), (0.66, 0.24, top - 0.8)], [0.06, 0.05, 0.04, 0.02], 5)
        parts.append(paint(sw, flat(H(0x3f9a6a), 0.15, 6)))
    else:
        drum = lathe('drum', [(-0.35, 0.58), (0.35, 0.56)], 28, rfn=flute_fn(14, 0.07))
        drum.rotation_euler = (math.pi / 2, 0, 0.9)
        drum.location = (1.35, -0.6, 0.5)
        apply_tf(drum)
        paint(drum, reef_stone(4, 0))
        parts.append(drum)
    parts += coral_cluster(0.7, 0.35, len(name), 1.0)
    parts += coral_cluster(-0.55, -0.6, len(name) + 1, 0.8)
    parts += barnacles(16, 0.6, 0.45, 1.3, len(name))
    parts.append(starfish((0.25, -0.78, 0.22), 0.16, 0.4))
    parts += rubble(3, 0.9, 1.3, 0.0, 0.13, H(0xd2c7ae), seed=3)
    ob = join(parts, name, 35)
    export(name, [ob])
    reset()


def build_reef_ruins():
    reef_column('reef_column', 3.95, False)
    reef_column('reef_column_broken', 2.6, True)
    # carved pedestal for the giant clam (top must stay at z = 0.8)
    scallop = lambda a, z, r: r * (1 + 0.035 * math.cos(a * 12))
    parts = [lathe('step', [(0, 2.05), (0.32, 2.0), (0.36, 1.86)], 36, rfn=scallop),
             lathe('top', [(0.36, 1.72), (0.7, 1.66), (0.74, 1.6), (0.8, 1.56)], 36, rfn=scallop)]
    for o in parts:
        def col(p, n, pc):
            c = reef_stone(6)(p, n, pc)
            rr = Vector((p.x, p.y)).length
            if n.z > 0.8 and p.z > 0.78 and 1.1 < rr < 1.3:
                c = H(0x3fa9a0)                                   # inlaid teal ring
            return c
        paint(o, col)
    parts += coral_cluster(1.7, 0.6, 2, 1.1) + coral_cluster(-1.3, -1.3, 3, 0.9)
    parts += barnacles(20, 1.95, 0.05, 0.3, 4)
    parts.append(starfish((-1.85, 0.4, 0.31), 0.18, 1.0, H(0xffb04a)))
    ob = join(parts, 'reef_pedestal', 35)
    export('reef_pedestal', [ob])


# ---- Celestial Asgard: marble & gold temple columns, throne dais
GOLD = H(0xffd866)


def gold_paint(p, n, pc):
    return mix(mix(GOLD, H(0xb07a26), max(0.0, -n.z) * 0.6 + (1 - abs(n.z)) * 0.25), H(0xfff2b8), max(0.0, n.z - 0.6) * 0.8)


def marble(seed):
    def f(p, n, pc):
        v = abs(math.sin(p.z * 0.9 + p.x * 0.6 + nz(p, 0.9, seed) * 5)) ** 10
        c = mix(H(0xf1ebde), H(0xbdb4a2), v * 0.7)
        return mul(c, 0.92 + 0.08 * math.cos(math.atan2(p.y, p.x) * 16))
    return f


def build_asgard():
    parts, emit = [], []
    plinth = lathe('plinth', [(0, 1.27), (0.35, 1.27)], 4, math.pi / 4)
    modify(plinth, 'BEVEL', width=0.05, segments=1, limit_method='ANGLE', angle_limit=math.radians(40))
    gold = [plinth,
            lathe('torus', [(0.35, 0.86), (0.42, 0.9), (0.5, 0.86), (0.55, 0.76), (0.6, 0.78), (0.66, 0.72)], 24),
            lathe('band1', [(3.1, 0.71), (3.16, 0.75), (3.34, 0.75), (3.4, 0.71)], 24),
            lathe('band2', [(6.2, 0.68), (6.26, 0.72), (6.44, 0.72), (6.5, 0.68)], 24),
            lathe('capital', [(8.9, 0.64), (8.98, 0.7), (9.05, 0.66), (9.2, 0.74), (9.4, 0.98)], 24),
            lathe('abacus', [(9.4, 1.38), (9.72, 1.38)], 4, math.pi / 4)]
    modify(gold[-1], 'BEVEL', width=0.05, segments=1, limit_method='ANGLE', angle_limit=math.radians(40))
    for o in gold:
        paint(o, gold_paint)
    parts += gold
    prof = [(0.66, 0.72), (2.0, 0.71), (3.1, 0.7), (3.4, 0.69), (5.0, 0.67), (6.2, 0.66), (6.5, 0.65), (7.8, 0.63), (8.9, 0.6)]
    shaft = lathe('shaft', prof, 32, rfn=flute_fn(16, 0.06), caps=(False, False))
    parts.append(paint(shaft, marble(1)))
    for z in (3.25, 6.35):
        for k in range(6):
            a = k / 6 * TAU
            r = 0.75 if z < 4 else 0.72
            emit.append(crystal((math.cos(a) * r, math.sin(a) * r, z - 0.07), 0.14, 0.05, math.pi / 2, a - math.pi / 2, H(0x9fe8ff)))
    for k in range(4):
        a = k / 4 * TAU + math.pi / 4 * 0
        emit.append(crystal((math.cos(a) * 0.99, math.sin(a) * 0.99, 9.48), 0.18, 0.07, math.pi / 2, a - math.pi / 2, H(0x9fe8ff)))
    ob = join(parts, 'asgard_column', 40)
    glow = join(emit, 'asgard_column_gems', 30)
    export('asgard_column', [ob, glow])
    reset()

    # stepped octagonal throne dais (top at z = 1.6), radius 10 -> 8
    parts, emit = [], []
    ph = math.pi / 8
    for i, (r, z0, z1) in enumerate(((10.0, 0.0, 0.55), (9.0, 0.55, 1.1), (8.0, 1.1, 1.6))):
        st = lathe('step', [(z0 - (0.02 if i else 0), r), (z1, r)], 8, ph)

        def col(p, n, pc, r=r):
            if n.z > 0.7:
                rr = Vector((p.x, p.y)).length
                a = math.atan2(p.y, p.x)
                c = marble(i)(p, n, pc)
                if abs(math.sin(rr * 1.6)) < 0.07 or abs(math.sin(a * 8)) < 0.04:
                    c = mul(c, 0.82)                               # tile grout
                return c
            return mul(marble(i + 3)(p, n, pc), 0.9)
        parts.append(paint(st, col))
        trim = lathe('trim', [(z1 - 0.1, r + 0.03), (z1 + 0.02, r + 0.03)], 8, ph, caps=(False, False))
        parts.append(paint(trim, gold_paint))
    star = []
    for k in range(16):
        a = k / 16 * TAU
        rr = 6.2 if k % 2 == 0 else 2.6
        star.append((math.cos(a) * rr, math.sin(a) * rr))
    sm = loft('star', [[Vector((x, y, 1.6)) for x, y in star], [Vector((x, y, 1.63)) for x, y in star]])
    parts.append(paint(sm, gold_paint))
    inner = lathe('ring', [(1.6, 2.2), (1.645, 2.2)], 32, mat='emit')
    emit.append(paint(inner, lambda p, n, pc: H(0xbff0ff)))
    for k in range(8):
        a = k / 8 * TAU + ph
        emit.append(crystal((math.cos(a) * 9.55, math.sin(a) * 9.55, 1.1), 0.5, 0.14, 0, a, H(0x9fe8ff)))
    ob = join(parts, 'asgard_dais', 30)
    glow = join(emit, 'asgard_dais_glow', 30)
    export('asgard_dais', [ob, glow])


# ---- Ashen Battlefield: Altar of a Hundred Blades
def blade_ring(z, w, t, groove):
    g = t * groove
    pts = [(w, 0), (0.6 * w, t), (0.18 * w, g), (-0.18 * w, g), (-0.6 * w, t), (-w, 0),
           (-0.6 * w, -t), (-0.18 * w, -g), (0.18 * w, -g), (0.6 * w, -t)]
    return [Vector((x, y, z)) for x, y in pts]


def build_kali_altar():
    parts, emit = [], []
    rings = []
    prof = [(-0.7, 0.02, 0.02), (-0.2, 0.2, 0.07), (0.5, 0.34, 0.09), (1.5, 0.38, 0.095), (3.0, 0.39, 0.095),
            (5.0, 0.4, 0.095), (7.0, 0.41, 0.095), (7.6, 0.42, 0.1), (8.0, 0.44, 0.11)]
    for z, w, t in prof:
        rings.append(blade_ring(z, w, t, 0.45 if 1.2 < z < 7.7 else 1.0))
    bl = loft('blade', rings)

    def steel(p, n, pc):
        c = mix(H(0x7c7c8c), H(0x9c9cad), nz(p, 1.5, 1) * 0.5 + 0.5)
        if abs(p.x) > 0.8 * 0.38:
            c = H(0xd2d6e2)                                        # honed edge
        elif abs(p.x) < 0.09 and p.z > 1.2:
            c = H(0x4a4656)                                        # fuller
        c = mul(c, 0.55 + 0.45 * min(1.0, max(0.0, p.z - 0.6) / 1.6))  # ash-buried foot
        if nz(p, 2.2, 6) > 0.35:
            c = mix(c, H(0x6a4a3e), 0.5)                           # scorch / rust
        return c
    parts.append(paint(bl, steel))
    for side in (1, -1):
        for j, z in enumerate((2.0, 2.8, 3.6, 4.4, 5.2, 6.0, 6.8)):
            ob = box((0.05, 0.02, 0.32 if j % 2 else 0.22), (0, side * 0.04, z), rot=(0, 0.3 if j % 3 == 0 else 0, 0), mat='emit')
            emit.append(paint(ob, lambda p, n, pc: H(0xb35cff)))
    dark = H(0x2a2430)
    guard = box((0.8, 0.46, 0.46), (0, 0, 8.2), bevel=0.06)
    parts.append(paint(guard, lambda p, n, pc: mix(dark, H(0x6a5a78), max(0.0, n.z))))
    for sx in (1, -1):
        q = tube_mesh('quillon', [(sx * 0.28, 0, 8.2), (sx * 0.75, 0, 8.22), (sx * 1.05, 0, 8.36), (sx * 1.22, 0, 8.62), (sx * 1.22, 0, 8.78)],
                      [0.15, 0.13, 0.1, 0.07, 0.04], 7, cap_top=True)
        parts.append(paint(q, lambda p, n, pc: mix(dark, H(0x8a7a9a), max(0.0, n.z) * 0.6)))
        tip = blob(0.09, (sx * 1.22, 0, 8.82), sub=1, amp=0.1, seed=sx + 3)
        parts.append(paint(tip, gold_paint))
    for sy in (1, -1):
        emit.append(crystal((0, sy * 0.22, 8.05), 0.32, 0.11, sy * math.pi / 2, 0, H(0xb35cff)))
    grip = tube_mesh('grip', [(0, 0, 8.4), (0, 0, 8.9), (0, 0, 9.4), (0, 0, 10.05)], [0.15, 0.17, 0.17, 0.15], 10)
    parts.append(paint(grip, lambda p, n, pc: H(0x3a2a2a) if math.sin((p.z * 9 + math.atan2(p.y, p.x) * 1.6)) > 0 else H(0x5a3e34)))
    ring_ = lathe('ferrule', [(10.03, 0.2), (10.12, 0.22)], 12)
    parts.append(paint(ring_, gold_paint))
    pom = blob(0.27, (0, 0, 10.38), (1.0, 0.8, 1.15), sub=2, amp=0.08, seed=9)
    parts.append(paint(pom, lambda p, n, pc: mix(dark, H(0x7a6a88), max(0.0, n.z) * 0.7)))
    for sy in (1, -1):
        emit.append(crystal((0, sy * 0.2, 10.38), 0.12, 0.08, sy * math.pi / 2, 0, H(0xd08cff)))
    # ash mound where the blade meets the ground (the model sinks 1 m into the terrain)
    m = blob(1.1, (0, 0, 0.9), (1.3, 1.1, 0.3), sub=2, amp=0.3, seed=4)
    parts.append(paint(m, lambda p, n, pc: mix(H(0x3a3438), H(0x6a6266), nz(p, 2.5, 1) * 0.5 + 0.5)))
    parts += [o for o in rubble(4, 0.5, 1.1, 0.95, 0.15, H(0x4a4248), seed=5)]
    ob = join(parts, 'giant_sword', 35)
    glow = join(emit, 'giant_sword_runes', 30)
    export('giant_sword', [ob, glow])
    reset()

    # cracked basalt dais (top at z = 1.2), radius 8.5 -> 7
    parts, emit = [], []
    rnd = random.Random(12)
    chip = [1 + rnd.uniform(-0.04, 0.02) for _ in range(10)]
    rf = lambda a, z, r: r * chip[int(round(a / TAU * 10)) % 10]
    lo = lathe('lower', [(0, 8.5), (0.55, 8.3), (0.6, 8.15)], 10, rfn=rf)
    hi = lathe('upper', [(0.6, 7.4), (1.15, 7.05), (1.2, 6.95)], 10, rfn=rf)
    hi2 = lathe('slab', [(1.18, 5.0), (1.24, 5.0)], 10, math.pi / 10)

    def basalt(p, n, pc):
        c = mix(H(0x221c24), H(0x3a3240), nz(p, 0.8, 3) * 0.5 + 0.5)
        if n.z > 0.7:
            rr = Vector((p.x, p.y)).length
            if abs(math.sin(math.atan2(p.y, p.x) * 5 + rr * 0.15)) < 0.05:
                c = mul(c, 0.6)
        return mul(c, 1 + nz(p, 5, 7) * 0.12)
    for o in (lo, hi, hi2):
        parts.append(paint(o, basalt))
    # glowing cracks across the top
    for i in range(7):
        a = rnd.uniform(0, TAU)
        pts = []
        rr = rnd.uniform(1.5, 2.5)
        while rr < 6.8:
            a += rnd.uniform(-0.25, 0.25)
            pts.append((math.cos(a) * rr, math.sin(a) * rr))
            rr += rnd.uniform(0.6, 1.1)
        verts, faces = [], []
        for j, (x, y) in enumerate(pts):
            w = 0.09 * (1 - j / len(pts)) + 0.02
            tx, ty = -math.sin(a), math.cos(a)
            verts += [(x - tx * w, y - ty * w, 1.205), (x + tx * w, y + ty * w, 1.205)]
            if j:
                k = j * 2
                faces.append((k - 2, k - 1, k + 1, k))
        if faces:
            cr = set_mat(mesh('crack', verts, faces), 'emit')
            emit.append(paint(cr, lambda p, n, pc: H(0xa040ff)))
    for i in range(10):
        a = (i + 0.5) / 10 * TAU
        emit.append(crystal((math.cos(a) * 8.2, math.sin(a) * 8.2, 0.55), 0.45, 0.12, 0.3, a + math.pi / 2, H(0x9a3aff)))
    # broken blade shards stuck in the stone
    for i, (a, rr) in enumerate(((0.7, 6.2), (2.9, 5.6), (4.6, 6.4))):
        sh = box((0.3, 0.06, 1.0 + i * 0.25), (math.cos(a) * rr, math.sin(a) * rr, 1.5 + i * 0.1), rot=(0.25, 0.3 - i * 0.2, a))
        parts.append(paint(sh, lambda p, n, pc: mix(H(0x6c6c7a), H(0xb8bcc8), max(0.0, n.z))))
    parts += rubble(8, 8.4, 9.4, 0.0, 0.3, H(0x3a3240), seed=8)
    ob = join(parts, 'blade_dais', 30)
    glow = join(emit, 'blade_dais_glow', 30)
    export('blade_dais', [ob, glow])



# ------------------------------------------------------------------ batch 4: frost shrine, infernal citadel, slime lair
def blocks(base, seed=0, amt=0.22, freq=2.3):
    """per-face tonal variation -> reads as cut stone blocks under cel shading"""
    return lambda p, n, pc: mul(base, 1 + nz(pc, freq, seed) * amt + (0.08 if (int(pc.z * 1.7) % 2) else 0))


def rect_ring(hx, hy, z, nx=4, ny=1):
    pts = []
    for i in range(nx):
        pts.append((-hx + 2 * hx * i / nx, -hy))
    for i in range(ny):
        pts.append((hx, -hy + 2 * hy * i / ny))
    for i in range(nx):
        pts.append((hx - 2 * hx * i / nx, hy))
    for i in range(ny):
        pts.append((-hx, hy - 2 * hy * i / ny))
    return [Vector((x, y, z)) for x, y in pts]


def snowy(base, seed=0, thresh=0.55):
    def f(p, n, pc):
        c = mul(base, 1 + nz(pc, 2.5, seed) * 0.15)
        if n.z > thresh and nz(p, 1.3, seed + 4) > -0.35:
            c = mix(H(0xf4f8ff), H(0xd6e6f7), nz(p, 4, seed) * 0.5 + 0.5)
        return c
    return f


def build_frost():
    # ---- Aurora Shrine (origin = shrine group origin; platform top at z 0.5)
    parts, emit = [], []
    stone = H(0xb9c6d8)
    lo = lathe('lower', [(-0.5, 4.75), (0.05, 4.65), (0.12, 4.5)], 10, math.pi / 10)
    hi = lathe('upper', [(0.12, 4.15), (0.44, 4.05), (0.5, 3.95)], 10, math.pi / 10)
    for o in (lo, hi):
        parts.append(paint(o, snowy(stone, 1, 0.6)))
    disc = lathe('disc', [(0.5, 2.6), (0.56, 2.6)], 30)
    parts.append(paint(disc, lambda p, n, pc: mix(H(0x8fa4c4), H(0xa9bcd8), nz(pc, 3, 2) * 0.5 + 0.5)))
    rr = lathe('rune_ring', [(0.56, 2.25), (0.6, 2.25)], 30, mat='emit')
    emit.append(paint(rr, lambda p, n, pc: H(0x8ff6ff)))
    for k in range(12):
        a = k / 12 * TAU
        g = box((0.5, 0.08, 0.04), (math.cos(a) * 3.3, math.sin(a) * 3.3, 0.52), rot=(0, 0, a + math.pi / 2), mat='emit')
        emit.append(paint(g, lambda p, n, pc: H(0x8ff6ff)))
    # stairs on the +X side (towards the trail)
    for i in range(3):
        st = box((0.5, 2.4, 0.2), (4.55 + i * 0.45, 0, 0.35 - i * 0.2), bevel=0.03)
        parts.append(paint(st, snowy(stone, 7 + i, 0.6)))
    for k in range(6):
        a = k * math.pi / 3
        cx, cy = math.cos(a) * 3.4, math.sin(a) * 3.4
        b = lathe('plinth', [(0.45, 0.48), (0.85, 0.44), (0.9, 0.36)], 6, a)
        parts.append(paint(b, snowy(H(0x9aa9c0), k, 0.6)))
        ice = lathe('ice', [(0.9, 0.3), (2.0, 0.34), (3.0, 0.27), (3.55, 0.0)], 6, a + 0.3, caps=(True, False))
        for v in ice.data.vertices:
            v.co.x += cx
            v.co.y += cy
        ice.data.update()
        parts.append(paint(ice, lambda p, n, pc: mix(H(0x7fd6f5), H(0xe6fbff), (p.z - 0.9) / 2.6 + max(0.0, n.x * 0.3))))
        emit.append(crystal((cx, cy, 3.75), 0.35, 0.12, 0, a, H(0xbff6ff)))
        core = rod((cx, cy, 1.1), (cx, cy, 3.0), 0.07, 5, mat='emit')
        emit.append(paint(core, lambda p, n, pc: H(0x9ff0ff)))
    for i in range(7):
        a = i / 7 * TAU + 0.4
        d = blob(0.55, (math.cos(a) * 4.7, math.sin(a) * 4.7, -0.15), (1.6, 1.0, 0.5), sub=2, amp=0.2, seed=i)
        parts.append(paint(d, lambda p, n, pc: mix(H(0xf4f8ff), H(0xcfe0f2), max(0.0, -n.z) + 0.2)))
    ob = join(parts, 'aurora_shrine', 35)
    glow = join(emit, 'aurora_shrine_glow', 30)
    export('aurora_shrine', [ob, glow])
    reset()

    # ---- village gate arch: posts at y=±4, beam at z 6, sign facing +X
    parts, emit = [], []
    woodc = H(0x6b4a2e)
    for sy in (-1, 1):
        foot = lathe('foot', [(0, 0.8), (0.5, 0.7), (0.6, 0.55)], 8)
        foot.location = (0, sy * 4, 0)
        apply_tf(foot)
        parts.append(paint(foot, snowy(H(0x8a8f9c), sy + 3)))
        post = tube_mesh('post', [(0, sy * 4, 0.4), (0, sy * 4, 3.5), (0, sy * 4, 6.6)], [0.42, 0.4, 0.37], 10)
        parts.append(paint(post, wood(woodc, 2, 0, sy)))
        for z in (1.2, 4.6):
            band = lathe('band', [(z, 0.44), (z + 0.18, 0.44)], 10, caps=(False, False))
            band.location = (0, sy * 4, 0)
            apply_tf(band)
            parts.append(paint(band, flat(H(0x3a3a44), 0.1)))
    beam = tube_mesh('beam', [(0, -5.6, 6.65), (0, -4.6, 6.35), (0, 0, 6.2), (0, 4.6, 6.35), (0, 5.6, 6.65)], [0.3, 0.36, 0.38, 0.36, 0.3], 8, cap_top=True)
    parts.append(paint(beam, snowy(woodc, 3, 0.35)))
    tie = box((0.4, 9.0, 0.36), (0, 0, 5.2), bevel=0.04)
    parts.append(paint(tie, wood(woodc, 1, -0.1, 5)))
    sign = box((0.18, 3.0, 1.0), (0.12, 0, 4.55), bevel=0.04)

    def signcol(p, n, pc):
        if n.x > 0.7:
            d = Vector((p.y, (p.z - 4.55) * 1.0))
            ang = math.atan2(d.y, d.x)
            if d.length < 0.36 and (abs(math.sin(ang * 3)) < 0.22 or d.length < 0.08):
                return H(0xf4fbff)                                  # snowflake emblem
            return H(0x4f9fe8)
        return H(0x2d5f99)
    parts.append(paint(sign, signcol))
    for sy in (-1, 1):
        ch = rod((0.1, sy * 1.2, 5.05), (0.1, sy * 1.2, 5.02), 0.02)
        parts.append(paint(ch, flat(H(0x2a2a30))))
        lan = cyl(0.16, 0.34, (0.35, sy * 2.6, 4.75), verts=6, mat='emit')
        emit.append(paint(lan, lambda p, n, pc: H(0xffc46b)))
        cap = cyl(0.22, 0.1, (0.35, sy * 2.6, 4.97), verts=6, r2=0.05)
        parts.append(paint(cap, flat(H(0x2a2a30))))
        hk = rod((0.2, sy * 2.6, 5.05), (0.35, sy * 2.6, 5.0), 0.02)
        parts.append(paint(hk, flat(H(0x2a2a30))))
    for sy in (-1, 1):
        d = blob(0.6, (0.2, sy * 4.2, 0.0), (1.4, 1.3, 0.45), sub=2, amp=0.2, seed=sy + 9)
        parts.append(paint(d, lambda p, n, pc: H(0xeef5ff)))
    ob = join(parts, 'frost_arch', 40)
    glow = join(emit, 'frost_arch_glow', 30)
    export('frost_arch', [ob, glow])
    reset()

    # ---- brazier (bowl rim at z ~1.32), shared by Frostvale and the Citadel
    parts, emit = [], []
    iron = H(0x34323a)
    bowl = lathe('bowl', [(0.9, 0.12), (1.0, 0.36), (1.15, 0.52), (1.32, 0.6), (1.36, 0.56), (1.2, 0.48)], 12, caps=(True, False))
    parts.append(paint(bowl, lambda p, n, pc: mix(iron, H(0x7a5a4a), max(0.0, n.z) * 0.4 + max(0.0, p.z - 1.25) * 3)))
    stem = lathe('stem', [(0.0, 0.42), (0.12, 0.4), (0.18, 0.18), (0.75, 0.12), (0.92, 0.16)], 8)
    parts.append(paint(stem, flat(iron, 0.1)))
    for k in range(3):
        a = k / 3 * TAU
        claw = tube_mesh('claw', [(math.cos(a) * 0.3, math.sin(a) * 0.3, 0.12), (math.cos(a) * 0.5, math.sin(a) * 0.5, 0.1), (math.cos(a) * 0.58, math.sin(a) * 0.58, 0.0)], [0.08, 0.06, 0.03], 5)
        parts.append(paint(claw, flat(H(0x55525c))))
    rim = lathe('rimring', [(1.02, 0.4), (1.1, 0.42)], 12, caps=(False, False))
    parts.append(paint(rim, gold_paint))
    for i in range(9):
        a = i / 9 * TAU
        r = 0.0 if i == 0 else 0.3
        c = blob(0.13, (math.cos(a) * r, math.sin(a) * r, 1.2), (1.2, 1.1, 0.7), sub=1, amp=0.3, seed=i, mat='emit')
        emit.append(paint(c, lambda p, n, pc: mix(H(0xffd36a), H(0xc8361a), Vector((p.x, p.y)).length * 2.5 + nz(p, 9, 1) * 0.3)))
    ob = join(parts, 'brazier', 40)
    glow = join(emit, 'brazier_coals', 40)
    export('brazier', [ob, glow])


def build_citadel():
    wallc, trim, roofc = H(0x4a3438), H(0x8a2a2a), H(0x9a1a1a)
    # ---- wall segment: length 4.74 along X, 1.6 thick, ground z -0.2 -> parapet top 7.7
    parts = []
    rings = [rect_ring(2.37, 0.95, -0.2, 4), rect_ring(2.37, 0.95, 0.5, 4)]
    w1 = loft('plinth', rings)
    parts.append(paint(w1, blocks(mul(wallc, 0.85), 1)))
    rings = [rect_ring(2.37, 0.8, z, 4) for z in (0.5, 1.6, 2.7, 3.8, 4.9, 6.0)]
    w2 = loft('wall', rings)
    parts.append(paint(w2, blocks(wallc, 2)))
    cor = loft('corbel', [rect_ring(2.37, 0.8, 6.0, 4), rect_ring(2.37, 0.98, 6.35, 4), rect_ring(2.37, 0.98, 6.8, 4)])
    parts.append(paint(cor, lambda p, n, pc: trim if p.z > 6.4 else mul(wallc, 0.9)))
    for x in (-1.5, 0.3):
        for sy in (-1, 1):
            m = box((1.0, 0.35, 1.1), (x + 0.4, sy * 0.8, 7.2), bevel=0.04)
            parts.append(paint(m, blocks(wallc, 4 + int(x * 3))))
    slit = box((0.24, 0.1, 1.0), (0.0, -0.82, 3.2), mat='emit')
    sl = paint(slit, lambda p, n, pc: H(0xff6a2a))
    ob = join(parts, 'citadel_wall', 30)
    export('citadel_wall', [ob, sl])
    reset()

    # ---- round corner tower: 0 -> 12 body, roof to ~17.6
    parts, emit = [], []
    body = lathe('tower', [(-0.5, 3.75), (0.9, 3.6), (1.0, 3.42)] + [(1.0 + i * 1.25, 3.42 - i * 0.05) for i in range(1, 9)], 14)
    parts.append(paint(body, blocks(wallc, 5)))
    cor = lathe('corbel', [(11.0, 3.0), (11.5, 3.65), (12.6, 3.65), (12.7, 3.3)], 14)
    parts.append(paint(cor, lambda p, n, pc: trim if 11.45 < p.z < 11.75 else blocks(wallc, 6)(p, n, pc)))
    for k in range(10):
        a = k / 10 * TAU
        m = box((0.75, 0.6, 0.8), (math.cos(a) * 3.35, math.sin(a) * 3.35, 13.0), rot=(0, 0, a), bevel=0.04)
        parts.append(paint(m, blocks(wallc, k)))
    roof = lathe('roof', [(13.35, 3.0), (13.4, 3.95), (13.9, 3.35), (15.9, 1.5), (17.8, 0.12)], 14, caps=(True, False))
    parts.append(paint(roof, lambda p, n, pc: mix(roofc, H(0x5a0e10), (1 - abs(n.z)) * 0.2 + (0.25 if int(p.z * 2.2) % 2 else 0))))
    sp = rod((0, 0, 17.7), (0, 0, 19.0), 0.06)
    parts.append(paint(sp, flat(H(0x2a2228))))
    fl = mesh('flag', [(0, 0, 18.9), (0, 0, 18.4), (0.0, -1.1, 18.7)], [(0, 1, 2)])
    parts.append(paint(fl, lambda p, n, pc: H(0xc0182a)))
    for z in (4.5, 8.0):
        for k in range(4):
            a = k / 4 * TAU + (0.4 if z > 6 else 0)
            r = 3.42 - (z - 1) / 1.25 * 0.05
            sl = box((0.12, 0.3, 1.0), (math.cos(a) * r, math.sin(a) * r, z), rot=(0, 0, a), mat='emit')
            emit.append(paint(sl, lambda p, n, pc: H(0xff6a2a)))
    ob = join(parts, 'citadel_tower', 30)
    glow = join(emit, 'citadel_tower_glow', 30)
    export('citadel_tower', [ob, glow])
    reset()

    # ---- square gate tower 3x3, top at 10 (flame sits above), banner on -Y (outer, +z in game)
    parts, emit = [], []
    t = loft('gt', [rect_ring(1.65, 1.65, -0.5, 2, 2), rect_ring(1.55, 1.55, 1.0, 2, 2)] + [rect_ring(1.5 - i * 0.02, 1.5 - i * 0.02, 1.0 + i * 1.6, 2, 2) for i in range(1, 6)])
    parts.append(paint(t, blocks(wallc, 7)))
    top = loft('gtop', [rect_ring(1.42, 1.42, 9.0, 2, 2), rect_ring(1.75, 1.75, 9.35, 2, 2), rect_ring(1.75, 1.75, 9.7, 2, 2)])
    parts.append(paint(top, lambda p, n, pc: trim if p.z > 9.3 else mul(wallc, 0.9)))
    for i in range(4):
        for j in (-1, 1):
            for (x, y) in ((j * 1.5, -1.5 + i), (-1.5 + i, j * 1.5)):
                if (i % 2) == 0:
                    m = box((0.5, 0.5, 0.6), (x, y, 10.0), bevel=0.03)
                    parts.append(paint(m, blocks(wallc, i + j)))
    bw = mesh('banner', [(-0.6, -1.54, 8.6), (0.6, -1.54, 8.6), (0.6, -1.54, 4.2), (0, -1.54, 3.7), (-0.6, -1.54, 4.2)], [(0, 4, 3, 2, 1)])
    modify(bw, 'SOLIDIFY', thickness=0.04, offset=0)

    def ban(p, n, pc):
        d = Vector((p.x, p.z - 6.6))
        if 0.28 < d.length < 0.4 or (d.length < 0.4 and abs(p.x) < 0.05):
            return H(0xffb030)
        return H(0x9a1a1a) if abs(p.x) < 0.5 else H(0x5a0e10)
    parts.append(paint(bw, ban))
    for z in (5.0,):
        for (x, y, a) in ((0, -1.5, -math.pi / 2), (1.5, 0, 0), (-1.5, 0, math.pi), (0, 1.5, math.pi / 2)):
            if y < 0:
                continue
            sl = box((0.1, 0.3, 1.0), (x, y, z), rot=(0, 0, a), mat='emit')
            emit.append(paint(sl, lambda p, n, pc: H(0xff6a2a)))
    bowl = lathe('bowl', [(9.7, 0.3), (10.0, 0.55), (10.15, 0.6)], 8, caps=(True, False))
    parts.append(paint(bowl, flat(H(0x2a2228))))
    co = blob(0.4, (0, 0, 10.0), (1.0, 1.0, 0.4), sub=1, amp=0.3, seed=1, mat='emit')
    emit.append(paint(co, lambda p, n, pc: H(0xff8a2a)))
    ob = join(parts, 'citadel_gatetower', 30)
    glow = join(emit, 'citadel_gatetower_glow', 30)
    export('citadel_gatetower', [ob, glow])
    reset()

    # ---- portcullis: centred, 11 wide (X), 7 tall (Z -3.5..3.5), slides into the ground
    parts, emit = [], []
    ironc = H(0x55535e)
    for i in range(-4, 5):
        b = box((0.16, 0.16, 6.6), (i * 1.2, 0, 0.2))
        parts.append(paint(b, lambda p, n, pc: mix(ironc, H(0x8a8894), max(0.0, n.x) * 0.5)))
        sp = cyl(0.12, 0.5, (i * 1.2, 0, -3.35), rot=(math.pi, 0, 0), verts=4, r2=0.0)
        parts.append(paint(sp, flat(H(0x9a98a4))))
    for z in (-2.6, -0.9, 0.8, 2.4):
        b = box((10.8, 0.24, 0.18), (0, 0.0, z))
        parts.append(paint(b, lambda p, n, pc: mix(H(0x3a2a24), ironc, 0.4)))
    beam = box((11.2, 0.7, 0.7), (0, 0, 3.15), bevel=0.06)
    parts.append(paint(beam, wood(H(0x3a2418), 0, 0, 2)))
    for x in (-5.2, 5.2):
        for z in (3.15,):
            st = cyl(0.1, 0.78, (x, 0, z), rot=(math.pi / 2, 0, 0), verts=6)
            parts.append(paint(st, flat(H(0x8a8894))))
    plate = cyl(0.95, 0.12, (0, 0, 0.0), rot=(math.pi / 2, 0, 0), verts=12)
    parts.append(paint(plate, flat(H(0x2a2228))))
    for sy in (-1, 1):
        rg = lathe('sigil', [(0, 0.62), (0.03, 0.62)], 24, mat='emit', caps=(False, False))
        rg.rotation_euler = (math.pi / 2, 0, 0)
        rg.location = (0, sy * 0.08, 0)
        apply_tf(rg)
        emit.append(paint(rg, lambda p, n, pc: H(0xff3a2a)))
        for k in range(3):
            a = k / 3 * TAU + math.pi / 2
            s_ = box((0.9, 0.03, 0.06), (math.cos(a) * 0.25, sy * 0.08, math.sin(a) * 0.25), rot=(0, -a - math.pi / 6, 0), mat='emit')
            emit.append(paint(s_, lambda p, n, pc: H(0xff5a2a)))
    ob = join(parts, 'portcullis', 30)
    glow = join(emit, 'portcullis_sigil', 30)
    export('portcullis', [ob, glow])


def build_lair_crystals():
    for name, col, dark in (('crystal_teal', H(0x7ff0e0), H(0x1a8f80)), ('crystal_pink', H(0xff8fd0), H(0x9a2a7a)), ('crystal_violet', H(0xc98bff), H(0x5a1fa0))):
        rnd = random.Random(name)
        parts, emit = [], []
        for i in range(6):
            a = i / 6 * TAU + rnd.uniform(-0.3, 0.3)
            r = 0.0 if i == 0 else rnd.uniform(0.25, 0.45)
            h = 2.3 if i == 0 else rnd.uniform(0.7, 1.5)
            w = 0.32 if i == 0 else rnd.uniform(0.14, 0.24)
            c = lathe('xtal', [(-0.2, w * 0.85), (h * 0.78, w), (h, 0.0)], 6, rnd.uniform(0, 1), mat='emit', caps=(True, False))
            c.rotation_euler = (math.cos(a) * (0 if i == 0 else 0.45), math.sin(a) * (0 if i == 0 else 0.45) * -1, 0)
            c.rotation_euler = (-math.sin(a) * (0 if i == 0 else 0.5), math.cos(a) * (0 if i == 0 else 0.5), 0)
            c.location = (math.cos(a) * r, math.sin(a) * r, 0)
            apply_tf(c)
            emit.append(paint(c, lambda p, n, pc, h=h: mix(dark, mix(col, (1, 1, 1), max(0.0, n.x) * 0.35), 0.35 + p.z / 2.2)))
        parts += rubble(5, 0.35, 0.75, -0.1, 0.22, H(0x6a6478), seed=len(name))
        b = blob(0.6, (0, 0, -0.1), (1.3, 1.2, 0.4), sub=2, amp=0.25, seed=3)
        parts.append(paint(b, lambda p, n, pc: mix(H(0x5a5468), H(0x7a7090), nz(p, 2, 1) * 0.5 + 0.5)))
        ob = join(parts, name, 35)
        glow = join(emit, name + '_glow', 20)
        export(name, [ob, glow])
        reset()



# ------------------------------------------------------------------ batch 5: world props (reef, volcano, frost)
def fix_normals(ob):
    bm = bmesh.new()
    bm.from_mesh(ob.data)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.to_mesh(ob.data)
    bm.free()
    ob.data.update()
    return ob


GOLDC = H(0xf0c35a)


def build_chest():
    plank = H(0x9a5a2a)
    parts = []
    body = box((1.0, 0.65, 0.53), (0, 0, 0.275), bevel=0.025)
    parts.append(paint(body, lambda p, n, pc: mul(plank, 0.85 + 0.15 * math.sin(p.z * 60) ** 2 + nz(p, 4, 1) * 0.08) if abs(n.z) < 0.5 else mul(plank, 0.8)))
    for x in (-0.42, 0.42):
        b = box((0.08, 0.69, 0.56), (x, 0, 0.28))
        parts.append(paint(b, gold_paint))
    for x, y in ((-0.5, -0.33), (0.5, -0.33), (-0.5, 0.33), (0.5, 0.33)):
        c = box((0.1, 0.1, 0.12), (x, y, 0.06), bevel=0.02)
        parts.append(paint(c, gold_paint))
    lock = box((0.18, 0.06, 0.2), (0, -0.345, 0.44), bevel=0.02)
    parts.append(paint(lock, lambda p, n, pc: H(0x2a1a10) if n.y < -0.7 and abs(p.x) < 0.025 and p.z < 0.45 else gold_paint(p, n, pc)))
    ob = join(parts, 'chest_base', 35)
    export('chest_base', [ob])
    reset()
    # lid: hinge on the origin, opens towards -Y (game +z)
    parts = []
    rings = []
    for x in (-0.5, -0.17, 0.17, 0.5):
        pts = []
        for k in range(9):
            th = k / 8 * math.pi
            pts.append(Vector((x, -0.33 - math.cos(th) * 0.33, math.sin(th) * 0.3)))
        rings.append(pts)
    lid = fix_normals(loft('lid', rings))
    parts.append(paint(lid, lambda p, n, pc: mul(plank, 0.88 + 0.12 * math.sin(math.atan2(p.z, p.y + 0.33) * 14) ** 2)))
    for x in (-0.42, 0.42):
        bd = fix_normals(loft('band', [[Vector((x + dx, -0.33 - math.cos(k / 8 * math.pi) * 0.345, math.sin(k / 8 * math.pi) * 0.315)) for k in range(9)] for dx in (-0.045, 0.045)]))
        parts.append(paint(bd, gold_paint))
    gem = crystal((0, -0.33, 0.29), 0.12, 0.07, 0, 0, H(0xff6a9a), mat='toon')
    parts.append(gem)
    ob = join(parts, 'chest_lid', 40)
    export('chest_lid', [ob])
    reset()


def build_fish_crate():
    parts = []
    slat = H(0xb07a45)
    for z in (0.12, 0.35, 0.58):
        for sy in (-1, 1):
            b = box((0.92, 0.05, 0.19), (0, sy * 0.34, z), bevel=0.012)
            parts.append(paint(b, wood(slat, 0, 0, z)))
        for sx in (-1, 1):
            b = box((0.05, 0.66, 0.19), (sx * 0.44, 0, z), bevel=0.012)
            parts.append(paint(b, wood(slat, 1, -0.05, z + 1)))
    for sx in (-1, 1):
        for sy in (-1, 1):
            c = box((0.08, 0.08, 0.7), (sx * 0.43, sy * 0.33, 0.35))
            parts.append(paint(c, wood(H(0x8a5a32), 2)))
    fl = box((0.86, 0.62, 0.05), (0, 0, 0.04))
    parts.append(paint(fl, flat(H(0x7a5030))))
    ice = blob(0.32, (0, 0, 0.62), (1.3, 0.95, 0.25), sub=2, amp=0.25, seed=2)
    parts.append(paint(ice, lambda p, n, pc: mix(H(0xd6f0ff), H(0xffffff), max(0.0, n.z))))
    rope = tube_mesh('rope', [(-0.47, -0.2, 0.62), (-0.52, -0.05, 0.45), (-0.47, 0.15, 0.62)], [0.025, 0.03, 0.025], 6)
    parts.append(paint(rope, flat(H(0xd8c08a))))
    ob = join(parts, 'fish_crate', 35)
    export('fish_crate', [ob])
    reset()
    # fish on ice (lies along X), kept as its own model so it can be hidden when the crate is looted
    parts = []
    body = blob(0.1, (0, 0, 0), (2.2, 0.75, 0.9), sub=2, amp=0.05, seed=1)
    parts.append(paint(body, lambda p, n, pc: mix(H(0x3f7fb8), H(0xdff0ff), max(0.0, -n.z * 0.8 + 0.3 - p.z * 3)) if True else None))
    tail = mesh('tail', [(-0.2, 0, 0), (-0.33, 0, 0.1), (-0.33, 0, -0.1)], [(0, 1, 2)])
    modify(tail, 'SOLIDIFY', thickness=0.02, offset=0)
    parts.append(paint(tail, flat(H(0x5f9fd8))))
    for sy in (-1, 1):
        e = blob(0.018, (0.15, sy * 0.06, 0.025), sub=1, amp=0.0)
        parts.append(paint(e, flat(H(0x10141a))))
    ob = join(parts, 'fish_prop', 45)
    export('fish_prop', [ob])


def build_reef_props():
    # ---- coral bridge pavilion: deck top z 0.2, origin on the deck underside
    parts, emit = [], []
    deck = lathe('deck', [(0, 4.05), (0.2, 4.05)], 8, math.pi / 8)
    parts.append(paint(deck, lambda p, n, pc: mul(H(0xb08254), 0.85 + 0.15 * math.sin((p.x * 0.7 + p.y * 0.7) * 9) ** 2) if n.z > 0.5 else H(0x8a6040)))
    rim = lathe('rim', [(0.12, 4.12), (0.26, 4.12)], 8, math.pi / 8, caps=(False, False))
    parts.append(paint(rim, flat(H(0x6a4a30))))
    for k in range(4):
        a = k * math.pi / 2 + math.pi / 4
        cx, cy = math.cos(a) * 3.2, math.sin(a) * 3.2
        pl = lathe('pillar', [(0.2, 0.26), (0.4, 0.22), (2.9, 0.17), (3.1, 0.24), (3.35, 0.24)], 8, rfn=flute_fn(4, 0.12))
        for v in pl.data.vertices:
            v.co.x += cx
            v.co.y += cy
        pl.data.update()
        parts.append(paint(pl, lambda p, n, pc: mix(H(0xf2eee4), H(0xd8d0c0), nz(p, 3, 1) * 0.5 + 0.5)))
        parts += coral_cluster(cx * 1.05, cy * 1.05, k, 0.6) if False else []
    roof1 = lathe('roof', [(3.25, 0.4), (3.3, 4.9), (3.45, 4.75), (3.9, 3.4), (4.4, 2.1)], 8, math.pi / 8, rfn=lambda a, z, r: r * (1 + 0.06 * abs(math.cos(a * 4)) if z < 3.5 else 1))
    roof2 = lathe('roof2', [(4.3, 2.35), (4.4, 2.6), (4.55, 2.5), (5.2, 1.2), (5.75, 0.05)], 8, math.pi / 8)
    for o in (roof1, roof2):
        parts.append(paint(o, lambda p, n, pc: H(0xf4f1ea) if (n.z < -0.3) else mix(H(0x3fa9a0), H(0x2f8a88), (0.5 if (int(math.atan2(p.y, p.x) / TAU * 16 + 16)) % 2 else 0))))
    pearl = blob(0.22, (0, 0, 5.85), sub=2, amp=0.0)
    parts.append(paint(pearl, lambda p, n, pc: mix(H(0xfff4f8), H(0xf0c8e0), max(0.0, -n.z))))
    ch = rod((0, 0, 3.3), (0, 0, 2.95), 0.02)
    parts.append(paint(ch, flat(H(0x3a2a20))))
    lan = cyl(0.2, 0.36, (0, 0, 2.75), verts=8, mat='emit')
    emit.append(paint(lan, lambda p, n, pc: H(0xffc46b)))
    for z, r in ((2.98, 0.26), (2.52, 0.22)):
        c = cyl(r, 0.06, (0, 0, z), verts=8)
        parts.append(paint(c, flat(H(0x3a2a20))))
    ob = join(parts, 'gazebo', 35)
    glow = join(emit, 'gazebo_lantern', 30)
    export('gazebo', [ob, glow])
    reset()

    # ---- striped beach tent (base at z 0, apex 2.8)
    parts = []
    stripe = lambda p, n, pc: (H(0x3fa9c9) if int((math.atan2(pc.y, pc.x) + TAU) / (TAU / 8)) % 2 else H(0xf4f1ea))
    t = lathe('tent', [(0.0, 2.45), (0.25, 2.38), (1.0, 1.75), (2.0, 0.75), (2.75, 0.08)], 16, caps=(False, False),
              rfn=lambda a, z, r: r * (1 - 0.05 * (1 - abs(math.cos(a * 4))) * min(1.0, z)))
    parts.append(paint(t, lambda p, n, pc: mul(stripe(p, n, pc), 0.9 + 0.1 * min(1.0, p.z))))
    val = lathe('valance', [(1.1, 1.72), (0.9, 1.92)], 32, caps=(False, False), rfn=lambda a, z, r: r + (0.0 if z > 1.0 else 0.04 * math.cos(a * 16)))
    fix_normals(val)
    parts.append(paint(val, lambda p, n, pc: H(0xff8a5a)))
    door = mesh('door', [(2.4, 0, 0.02), (1.55, -0.55, 0.02), (1.25, 0, 1.25), (1.55, 0.55, 0.02)], [(0, 1, 2), (0, 2, 3)])
    for v in door.data.vertices:
        v.co.x += 0.07
    door.data.update()
    door.rotation_euler = (0, 0, 0)
    fix_normals(door)
    parts.append(paint(door, flat(H(0x1d3a48))))
    pole = rod((0, 0, 2.6), (0, 0, 3.3), 0.04)
    parts.append(paint(pole, flat(H(0x6b4428))))
    fl = mesh('pennant', [(0, 0, 3.3), (0, 0, 3.05), (0.6, 0.05, 3.18)], [(0, 1, 2)])
    modify(fl, 'SOLIDIFY', thickness=0.015, offset=0)
    parts.append(paint(fl, flat(H(0xff6f91))))
    for k in range(6):
        a = k / 6 * TAU + 0.3
        st = rod((math.cos(a) * 2.42, math.sin(a) * 2.42, 0.25), (math.cos(a) * 2.9, math.sin(a) * 2.9, -0.05), 0.03)
        parts.append(paint(st, flat(H(0xe8dcc0))))
    ob = join(parts, 'beach_tent', 40)
    export('beach_tent', [ob])
    reset()

    # ---- rowboat: rim at z 0, keel at -0.7, length along Y
    W, D, L = 0.95, 0.68, 2.5

    def hull(u, v):
        th = (u - 0.5) * math.pi
        w = W * max(0.02, math.sin(math.pi * v)) ** 0.55
        d = D * max(0.15, math.sin(math.pi * v)) ** 0.35
        y = (v - 0.5) * 2 * L
        return (math.sin(th) * w, y, -d * math.cos(th) + 0.18 * (2 * v - 1) ** 2)
    vs, fs = grid(10, 16, hull)
    hb = mesh('hull', vs, fs)
    modify(hb, 'SOLIDIFY', thickness=0.07, offset=1)
    fix_normals(hb)
    hb_paint = lambda p, n, pc: (mul(H(0x9a5a2a), 0.85 + 0.15 * ((int((p.z + 1) * 9)) % 2)) if (abs(p.x) > 0.3 or n.z < 0) else H(0xc08a52))
    parts = [paint(hb, hb_paint)]
    gun = tube_mesh('gunwale', [hull(0, v / 16) for v in range(17)], [0.05] * 17, 5)
    gun2 = tube_mesh('gunwale', [hull(1, v / 16) for v in range(17)], [0.05] * 17, 5)
    for g in (gun, gun2):
        parts.append(paint(g, flat(H(0x5a3418))))
    for y in (-0.9, 0.2, 1.2):
        w = W * math.sin(math.pi * (y / (2 * L) + 0.5)) ** 0.55
        b = box((w * 1.9, 0.26, 0.06), (0, y, -0.18), bevel=0.01)
        parts.append(paint(b, wood(H(0xb08254), 0)))
    for sx in (-1, 1):
        oar = rod((sx * 0.3, -0.6, 0.0), (sx * 0.15, 1.6, -0.15), 0.035)
        parts.append(paint(oar, flat(H(0xd8b07a))))
        bl = box((0.16, 0.6, 0.03), (sx * 0.13, 1.85, -0.17), rot=(0.07, 0, 0))
        parts.append(paint(bl, flat(H(0xd8b07a))))
    ob = join(parts, 'rowboat', 35)
    export('rowboat', [ob])
    reset()

    # ---- coral shapes (instanced, tinted per instance: geometry only matters)
    pts = []
    br = []
    rnd = random.Random(4)

    def branch(p0, d, L, r, depth):
        p1 = Vector(p0) + d * L
        mid = (Vector(p0) + p1) / 2 + Vector((rnd.uniform(-1, 1), rnd.uniform(-1, 1), 0)) * L * 0.12
        br.append(tube_mesh('cb', [p0, mid, p1], [r, r * 0.85, r * 0.7], 5, cap_top=True))
        if depth:
            for k in range(2):
                a = rnd.uniform(0, TAU)
                nd = (d + Vector((math.cos(a), math.sin(a), 0)) * 0.7).normalized()
                branch(p1, nd, L * 0.72, r * 0.7, depth - 1)
    for k in range(3):
        a = k / 3 * TAU
        branch((0, 0, -0.1), Vector((math.cos(a) * 0.3, math.sin(a) * 0.3, 1)).normalized(), 0.45, 0.08, 1)
    for o in br:
        paint(o, lambda p, n, pc: (1, 1, 1))
    export('coral_branch', [join(br, 'coral_branch', 50)])
    reset()
    fan = blob(0.6, (0, 0, 0.55), (1.0, 0.1, 0.85), sub=2, amp=0.12, freq=3, seed=2)
    for v in fan.data.vertices:
        v.co.y += math.sin(v.co.x * 5) * 0.05 + (v.co.z - 0.55) * 0.05
        if v.co.z < 0:
            v.co.z = 0.0
    fan.data.update()
    stem = rod((0, 0, -0.1), (0, 0, 0.25), 0.06, 6)
    parts = [paint(fan, lambda p, n, pc: (1, 1, 1)), paint(stem, lambda p, n, pc: (0.8, 0.8, 0.8))]
    export('coral_fan', [join(parts, 'coral_fan', 50)])
    reset()
    br = prim('uv_sphere', segments=14, ring_count=7, radius=0.45)
    for v in br.data.vertices:
        if v.co.z < 0:
            v.co.z *= 0.2
        n = v.co.normalized()
        g = math.sin(math.atan2(v.co.y, v.co.x) * 7 + v.co.z * 18) * 0.035
        v.co = v.co + n * g
        v.co.z *= 0.68
    br.data.update()
    smooth(br, 60)
    export('coral_brain', [paint(br, lambda p, n, pc: (1, 1, 1))])


def build_volcano_props():
    # ---- dead tree (instanced, single colour): ~3.9 m
    rnd = random.Random(8)
    parts = [tube_mesh('trunk', [(0, 0, -0.2), (0.05, 0.02, 1.0), (-0.08, 0.05, 2.0), (0.04, -0.02, 2.9), (0.12, 0.0, 3.6)], [0.3, 0.22, 0.17, 0.11, 0.04], 7, cap_top=True)]
    for k in range(5):
        a = k * 2.3 + rnd.uniform(-0.3, 0.3)
        z = 1.5 + k * 0.42
        L = 1.4 - k * 0.15
        p0 = (math.cos(a) * 0.08, math.sin(a) * 0.08, z)
        p1 = (math.cos(a) * L * 0.5, math.sin(a) * L * 0.5, z + L * 0.45)
        p2 = (math.cos(a + 0.4) * L, math.sin(a + 0.4) * L, z + L * 0.55 + rnd.uniform(-0.2, 0.3))
        parts.append(tube_mesh('br', [p0, p1, p2], [0.09, 0.05, 0.015], 5, cap_top=True))
        tw = (p1[0] + math.cos(a - 0.9) * 0.4, p1[1] + math.sin(a - 0.9) * 0.4, p1[2] + 0.35)
        parts.append(tube_mesh('tw', [p1, tw], [0.035, 0.01], 4, cap_top=True))
    parts += root_parts(17, n=4, scale=0.55, r0=0.3)[1:]
    for o in parts:
        paint(o, lambda p, n, pc: (1, 1, 1))
    export('dead_tree', [join(parts, 'dead_tree', 50)])
    reset()

    # ---- obsidian spire cluster (instanced, tinted): ~4 m
    parts = []
    for i, (x, y, h, r, tx, ty) in enumerate(((0, 0, 4.0, 0.62, 0, 0), (0.55, 0.25, 2.3, 0.36, 0.3, 0.1), (-0.4, 0.45, 1.6, 0.3, -0.2, 0.25), (0.1, -0.55, 1.2, 0.26, 0.05, -0.3))):
        sp = lathe('sp', [(-0.4, r), (h * 0.55, r * 0.75), (h, 0.0)], 5, i * 0.7, caps=(True, False))
        sp.rotation_euler = (ty, tx, 0)
        sp.location = (x, y, 0)
        apply_tf(sp)
        parts.append(paint(sp, lambda p, n, pc: (1, 1, 1)))
    export('obsidian_spire', [join(parts, 'obsidian_spire', 20)])
    reset()

    # ---- causeway fire pillar: ground at 0 (sunk 0.3), top bowl rim at 4.0
    parts, emit = [], []
    pl = lathe('pillar', [(0, 0.95), (0.4, 0.85), (0.5, 0.7), (3.4, 0.55), (3.55, 0.7), (3.65, 0.7)], 6, rfn=lambda a, z, r: r)
    parts.append(paint(pl, lambda p, n, pc: mix(H(0x241e2a), H(0x463a4e), nz(pc, 2.5, 1) * 0.5 + 0.5 + max(0.0, n.z) * 0.3)))
    bowl = lathe('bowl', [(3.62, 0.35), (3.8, 0.6), (4.0, 0.68)], 8, caps=(True, False))
    parts.append(paint(bowl, flat(H(0x1a1418))))
    for k in range(6):
        a = (k + 0.5) / 6 * TAU
        ap = 0.62 * math.cos(math.pi / 6)
        g = box((0.04, 0.08, 1.6), (math.cos(a) * ap, math.sin(a) * ap, 2.0), rot=(0, 0, a), mat='emit')
        emit.append(paint(g, lambda p, n, pc: H(0xff5a1a)))
    co = blob(0.45, (0, 0, 3.82), (1.0, 1.0, 0.35), sub=1, amp=0.3, seed=3, mat='emit')
    emit.append(paint(co, lambda p, n, pc: H(0xffa040)))
    ob = join(parts, 'fire_pillar', 25)
    glow = join(emit, 'fire_pillar_glow', 25)
    export('fire_pillar', [ob, glow])
    reset()

    # ---- spirit lantern: post to 2.3, cage around the flame at 2.6
    parts, emit = [], []
    base = lathe('base', [(-0.2, 0.42), (0.15, 0.38), (0.3, 0.22)], 6)
    parts.append(paint(base, blocks(H(0x4a4048), 2)))
    post = lathe('post', [(0.3, 0.1), (2.3, 0.08)], 6)
    parts.append(paint(post, flat(H(0x2a2224))))
    for z0, z1, r0, r1 in ((2.28, 2.36, 0.34, 0.34), (2.88, 2.95, 0.36, 0.2), (2.95, 3.25, 0.2, 0.02)):
        c = lathe('cage', [(z0, r0), (z1, r1)], 6)
        parts.append(paint(c, flat(H(0x5a4a3a))))
    for k in range(6):
        a = k / 6 * TAU
        b = rod((math.cos(a) * 0.32, math.sin(a) * 0.32, 2.34), (math.cos(a) * 0.33, math.sin(a) * 0.33, 2.9), 0.02, 4)
        parts.append(paint(b, flat(H(0x5a4a3a))))
    rg = lathe('ring', [(3.25, 0.06), (3.35, 0.06)], 6)
    parts.append(paint(rg, flat(H(0x5a4a3a))))
    for k, a in enumerate((0.3, 2.4, 4.4)):
        tal = box((0.12, 0.01, 0.42), (math.cos(a) * 0.36, math.sin(a) * 0.36, 2.05), rot=(0, 0, a + math.pi / 2))
        parts.append(paint(tal, lambda p, n, pc: H(0xc82a2a) if abs(p.z - 2.05) < 0.05 else H(0xf2e6c8)))
    for k in range(3):
        a = k / 3 * TAU
        g = box((0.04, 0.12, 0.12), (math.cos(a) * 0.4, math.sin(a) * 0.4, 0.0), rot=(0.6, 0, a), mat='emit')
        emit.append(paint(g, lambda p, n, pc: H(0x9a7aff)))
    ob = join(parts, 'spirit_lantern', 30)
    glow = join(emit, 'spirit_lantern_glyph', 30)
    export('spirit_lantern', [ob, glow])
    reset()

    # ---- outpost banner pole: pole at origin, cloth hangs towards -X
    parts = []
    pole = lathe('pole', [(0, 0.07), (4.2, 0.055)], 6)
    parts.append(paint(pole, flat(H(0x5a3a1a))))
    bar = rod((0.05, 0, 3.55), (-1.25, 0, 3.55), 0.04)
    parts.append(paint(bar, flat(H(0x5a3a1a))))
    tip = crystal((0, 0, 4.2), 0.3, 0.09, 0, 0, H(0xf0c35a), mat='toon')
    parts.append(tip)

    def cl(u, v):
        x = -0.05 - u * 1.15
        z = 3.5 - v * 1.9
        return (x, math.sin(u * 5 + v * 2) * 0.08 + v * 0.1, z - (0.15 * math.sin(u * math.pi) if v > 0.95 else 0))
    vs, fs = grid(14, 18, cl)
    c = mesh('cloth', vs, fs)
    modify(c, 'SOLIDIFY', thickness=0.02, offset=0)

    def bcol(p, n, pc):
        d = Vector((p.x + 0.62, p.z - 2.55))
        if d.length < 0.26:
            return H(0xd8401c)                                   # sun emblem
        if 0.3 < d.length < 0.36 and int(math.atan2(d.y, d.x) / TAU * 16 + 16) % 2:
            return H(0xd8401c)
        if p.z < 1.75 or p.z > 3.4:
            return H(0x8a2a1a)
        return H(0xe6b84a)
    parts.append(paint(c, bcol))
    ob = join(parts, 'outpost_banner', 40)
    export('outpost_banner', [ob])


def build_frost_props():
    # ---- snowy cottage: 5 (X) x 4 (Y); door on -Y (game +z); ridge ~5.8
    parts, emit = [], []
    found = box((5.3, 4.3, 0.5), (0, 0, 0.0), bevel=0.05)
    parts.append(paint(found, blocks(H(0x8a8f9c), 3)))
    walls = box((5.0, 4.0, 2.9), (0, 0, 1.7))
    parts.append(paint(walls, lambda p, n, pc: mul(H(0xd8c8a8), 0.88 + 0.12 * ((int(p.z * 4.2)) % 2))))
    timber = H(0x5a3a22)
    for x in (-2.5, 0, 2.5):
        for y in (-2.0, 2.0):
            b = box((0.22, 0.22, 2.95), (x, y, 1.72))
            parts.append(paint(b, wood(timber, 2)))
    for y in (-2.0, 2.0):
        for z in (0.32, 3.1):
            b = box((5.2, 0.2, 0.2), (0, y, z))
            parts.append(paint(b, wood(timber, 0)))
        bx = rod((-2.4, y, 0.4), (-0.15, y, 3.0), 0.08)
        parts.append(paint(bx, wood(timber, 0)))
    # gable roof along X
    gable = mesh('gable', [(-2.5, -2.0, 3.15), (-2.5, 2.0, 3.15), (-2.5, 0, 5.0), (2.5, -2.0, 3.15), (2.5, 2.0, 3.15), (2.5, 0, 5.0)], [(0, 1, 2), (5, 4, 3)])
    parts.append(paint(gable, lambda p, n, pc: mul(H(0xd8c8a8), 0.95)))
    for sy in (-1, 1):
        rf = box((5.9, 2.85, 0.22), (0, sy * 1.12, 4.18), rot=(-sy * math.atan2(1.85, 2.0), 0, 0))
        parts.append(paint(rf, lambda p, n, pc: mix(H(0xf6faff), H(0xd6e6f7), nz(p, 3, 2) * 0.5 + 0.5) if n.z > 0.2 else H(0x5a3a22)))
    ridge = rod((-2.95, 0, 5.12), (2.95, 0, 5.12), 0.16, 6)
    parts.append(paint(ridge, flat(H(0xf6faff))))
    chim = box((0.6, 0.6, 1.6), (1.4, 0.9, 4.8), bevel=0.03)
    parts.append(paint(chim, lambda p, n, pc: H(0xf4f8ff) if n.z > 0.7 else blocks(H(0x7a6a64), 5)(p, n, pc)))
    door = box((1.0, 0.12, 1.8), (0, -2.02, 1.15), bevel=0.03)
    parts.append(paint(door, lambda p, n, pc: H(0xd8a840) if (n.y < -0.7 and abs(p.x - 0.35) < 0.06 and abs(p.z - 1.1) < 0.06) else wood(H(0x7a5232), 2)(p, n, pc)))
    for x, y, rot in ((1.6, -2.02, 0), (-1.6, -2.02, 0), (2.52, 0, math.pi / 2), (-2.52, 0, math.pi / 2)):
        w = box((0.8, 0.06, 0.7), (x, y, 1.95), rot=(0, 0, rot), mat='emit')
        emit.append(paint(w, lambda p, n, pc: H(0xffc46b)))
        fr = box((0.95, 0.04, 0.85), (x, y * 1.0 + (0.01 if y > 0 else -0.01) if y else y, 1.95), rot=(0, 0, rot))
        fr.location.x += (0.02 if x > 0 else -0.02) if abs(x) > 2.5 else 0
        parts.append(paint(fr, flat(H(0x5a3a22))))
        sill = box((1.0, 0.25, 0.08), (x + (0.1 if x > 2.5 else -0.1 if x < -2.5 else 0), y - (0.1 if y < 0 else 0), 1.55), rot=(0, 0, rot))
        parts.append(paint(sill, lambda p, n, pc: H(0xf4f8ff) if n.z > 0.5 else H(0x5a3a22)))
    rnd = random.Random(5)
    for sy in (-1, 1):
        for i in range(10):
            x = -2.7 + i * 0.6 + rnd.uniform(-0.1, 0.1)
            ic = cyl(0.06, rnd.uniform(0.25, 0.55), (x, sy * 2.6, 3.0), verts=5, r2=0.0, rot=(math.pi, 0, 0))
            parts.append(paint(ic, lambda p, n, pc: H(0xcff2ff)))
    for x, y, s in ((2.8, -1.5, 0.7), (-2.9, 1.0, 0.6), (-1.5, -2.5, 0.45)):
        d = blob(s, (x, y, 0.1), (1.5, 1.2, 0.5), sub=2, amp=0.2, seed=int(x * 10))
        parts.append(paint(d, lambda p, n, pc: H(0xf2f7ff)))
    wp = box((0.8, 0.6, 0.6), (-2.0, -2.45, 0.3))
    parts.append(paint(wp, wood(H(0x8a5a32), 0)))
    ob = join(parts, 'frost_house', 30)
    glow = join(emit, 'frost_house_windows', 30)
    export('frost_house', [ob, glow])
    reset()

    # ---- ice crystal cluster (instanced, tinted): ~3 m, base just below 0
    parts = []
    rnd = random.Random(11)
    for i, (h, r, tilt, a) in enumerate(((2.9, 0.42, 0.0, 0), (1.8, 0.3, 0.45, 0.6), (1.4, 0.26, 0.5, 2.6), (1.0, 0.2, 0.55, 4.4))):
        c = lathe('ic', [(-0.5, r * 0.9), (h * 0.8, r), (h, 0.0)], 6, rnd.uniform(0, 1), caps=(True, False))
        c.rotation_euler = (-math.sin(a) * tilt, math.cos(a) * tilt, 0)
        c.location = (math.cos(a) * (0.25 if i else 0), math.sin(a) * (0.25 if i else 0), 0)
        apply_tf(c)
        parts.append(paint(c, lambda p, n, pc: (1, 1, 1)))
    export('ice_crystal', [join(parts, 'ice_crystal', 20)])
    reset()

    # ---- ice floe: unit radius, top at +0.5 (flat for walking), bottom -0.5
    rnd = random.Random(3)
    rad = [1 + rnd.uniform(-0.08, 0.05) for _ in range(11)]
    rf = lambda a, z, r: r * rad[int(round(a / TAU * 11)) % 11]
    fl = lathe('floe', [(-0.5, 0.82), (0.0, 0.92), (0.38, 1.0), (0.46, 0.97), (0.5, 0.93)], 11, rfn=rf)
    snow = lathe('snow', [(0.5, 0.86), (0.54, 0.8), (0.56, 0.6)], 11, rfn=rf)

    def icec(p, n, pc):
        if n.z > 0.6:
            return mix(H(0xf4f9ff), H(0xdde9f7), nz(p, 3, 1) * 0.5 + 0.5)
        return mix(H(0x7fc8ec), H(0xcfeeff), (p.z + 0.5) * 0.9 + nz(pc, 3, 2) * 0.2)
    parts = [paint(fl, icec), paint(snow, icec)]
    export('ice_floe', [join(parts, 'ice_floe', 30)])



# ------------------------------------------------------------------ batch 6: realms (void rift, asgard, spire, starlight rift, ashen), fishing, bounties
def island(name, top_fn, under_fn, glow_col, seed, sides=28):
    """unit-radius floating island; walkable top at z=0"""
    rnd = random.Random(seed)
    rad = [1 + rnd.uniform(-0.035, 0.02) for _ in range(sides)]
    rf = lambda a, z, r: r * rad[int(round(a / TAU * sides)) % sides]
    parts, emit = [], []
    top = lathe('top', [(-0.16, 0.95), (-0.05, 1.0), (-0.01, 0.995), (0.0, 0.975)], sides, rfn=rf)
    parts.append(paint(top, top_fn))
    lumps = [rnd.uniform(0.75, 1.15) for _ in range(16)]
    uf = lambda a, z, r: r * lumps[int(round(a / TAU * 16)) % 16] if z < -0.3 else r
    prof = [(-0.16, 0.95), (-0.35, 0.86), (-0.6, 0.66), (-0.9, 0.45), (-1.2, 0.26), (-1.5, 0.11), (-1.75, 0.02)]
    un = lathe('under', prof, 16, 0.2, rfn=uf, caps=(False, True))
    parts.append(paint(un, under_fn))
    for k in range(5):
        a = rnd.uniform(0, TAU)
        rr = rnd.uniform(0.35, 0.7)
        h = rnd.uniform(0.35, 0.6)
        sp = lathe('spike', [(-0.3, 0.14), (-0.3 - h, 0.0)], 5, caps=(True, False))
        sp.location = (math.cos(a) * rr, math.sin(a) * rr, -0.4 * rr / 0.7)
        apply_tf(sp)
        fix_normals(sp)
        parts.append(paint(sp, under_fn))
    for k in range(7):
        a = rnd.uniform(0, TAU)
        rr = rnd.uniform(0.3, 0.8)
        z = -0.25 - (1 - rr) * 0.9
        emit.append(crystal((math.cos(a) * rr, math.sin(a) * rr, z), -rnd.uniform(0.12, 0.25), 0.04, rnd.uniform(-0.4, 0.4), a, glow_col))
    ob = join(parts, name, 30)
    glow = join(emit, name + '_glow', 30)
    export(name, [ob, glow])
    reset()


def build_realms():
    # ---- Void Rift island
    def vtop(p, n, pc):
        if n.z > 0.7:
            c = mix(H(0x4a3a6a), H(0x5e4a86), nz(p, 4, 1) * 0.5 + 0.5)
            if nz(p, 7, 3) > 0.35:
                c = mix(c, H(0x7a5aa8), 0.7)                     # violet moss
            return c
        return mix(H(0x3a2e52), H(0x2a2236), max(0.0, -p.z) * 6)
    vunder = lambda p, n, pc: mix(H(0x2a2236), H(0x15101e), min(1.0, -p.z / 1.6)) if nz(pc, 5, 2) < 0.4 else H(0x3a2e52)
    island('void_island', vtop, vunder, H(0xb07aff), 1)

    # ---- Asgard golden-marble island (also the Spire arena)
    def atop(p, n, pc):
        if n.z > 0.7:
            rr = Vector((p.x, p.y)).length
            if 0.84 < rr < 0.875:
                return H(0xffd866)
            c = mix(H(0xe2d8c2), H(0xcdc3ae), nz(p, 3, 1) * 0.5 + 0.5)
            if abs(math.sin(rr * 18)) < 0.08 or abs(math.sin(math.atan2(p.y, p.x) * 12)) < 0.03:
                c = mul(c, 0.86)
            return c
        return mix(H(0xd8cdb4), H(0xb0a690), max(0.0, -p.z) * 6)
    aunder = lambda p, n, pc: mix(H(0x4a4252), H(0x24202c), min(1.0, -p.z / 1.6)) if nz(pc, 4, 5) < 0.45 else H(0xc9a24a)
    island('asgard_island', atop, aunder, H(0xffe08a), 2)

    # ---- void star anchor: base around 0, core floats at 4.6 (kept in game)
    parts, emit = [], []
    rock = H(0x2a2236)
    b = lathe('base', [(-0.45, 1.3), (0.2, 1.15), (0.42, 0.85)], 6)
    parts.append(paint(b, blocks(H(0x3a2e52), 1)))
    for k in range(3):
        a = k / 3 * TAU
        pts = []
        for j in range(6):
            t = j / 5
            aa = a + t * 1.6
            r = 0.38 * (1 - t) + 0.12
            pts.append((math.cos(aa) * r, math.sin(aa) * r, 0.35 + t * 3.5))
        sh = tube_mesh('shard', pts, [0.28, 0.26, 0.23, 0.2, 0.16, 0.1], 4, cap_top=True)
        parts.append(paint(sh, lambda p, n, pc: mix(rock, H(0x4a3a6a), max(0.0, n.z) + nz(pc, 3, 1) * 0.3)))
    for k in range(3):
        a = k / 3 * TAU + 0.5
        cl = tube_mesh('claw', [(math.cos(a) * 0.2, math.sin(a) * 0.2, 3.8), (math.cos(a) * 0.75, math.sin(a) * 0.75, 4.3), (math.cos(a) * 0.62, math.sin(a) * 0.62, 5.0), (math.cos(a) * 0.3, math.sin(a) * 0.3, 5.3)], [0.1, 0.09, 0.06, 0.02], 5, cap_top=True)
        parts.append(paint(cl, lambda p, n, pc: H(0xc9a24a)))
    for k in range(6):
        a = (k + 0.5) / 6 * TAU
        g = box((0.05, 0.3, 0.18), (math.cos(a) * 1.0, math.sin(a) * 1.0, 0.05), rot=(0, -0.6, a), mat='emit')
        emit.append(paint(g, lambda p, n, pc: H(0xffe08a)))
    ob = join(parts, 'void_anchor', 35)
    glow = join(emit, 'void_anchor_glow', 30)
    export('void_anchor', [ob, glow])
    reset()

    # ---- jump pad (top at 0.13; glow ring sits on top)
    parts, emit = [], []
    pd = lathe('pad', [(-0.15, 1.55), (0.06, 1.5), (0.13, 1.38)], 18)
    parts.append(paint(pd, lambda p, n, pc: mix(H(0x3a2a5a), H(0x54407a), 0.5 + 0.5 * math.sin(Vector((p.x, p.y)).length * 12)) if n.z > 0.6 else H(0x2a2040)))
    for k in range(6):
        a = k / 6 * TAU
        ch = mesh('chev', [(math.cos(a) * 1.3, math.sin(a) * 1.3, 0.135), (math.cos(a + 0.12) * 1.45, math.sin(a + 0.12) * 1.45, 0.11), (math.cos(a - 0.12) * 1.45, math.sin(a - 0.12) * 1.45, 0.11)], [(0, 2, 1)])
        set_mat(ch, 'emit')
        fix_normals(ch)
        emit.append(paint(ch, lambda p, n, pc: H(0x8fffe0)))
        st = box((0.18, 0.18, 0.3), (math.cos(a) * 1.55, math.sin(a) * 1.55, 0.0), rot=(0, 0, a), bevel=0.03)
        parts.append(paint(st, flat(H(0x6a5a8a))))
    ob = join(parts, 'jump_pad', 30)
    glow = join(emit, 'jump_pad_glow', 30)
    export('jump_pad', [ob, glow])
    reset()

    # ---- floating debris rock (unit radius) with crystal growth
    parts, emit = [], []
    rk = blob(1.0, (0, 0, 0), (1.15, 1.0, 0.8), sub=2, amp=0.35, freq=1.2, seed=7)
    smooth(rk, 25)
    parts.append(paint(rk, lambda p, n, pc: mix(H(0x3a2f50), H(0x2a2236), max(0.0, -n.z)) if nz(pc, 3, 1) < 0.35 else H(0x5a4a7a)))
    for k, (a, t) in enumerate(((0.3, 0.5), (2.2, 0.8), (4.0, 0.3))):
        emit.append(crystal((math.cos(a) * 0.6, math.sin(a) * 0.6, 0.45), 0.7, 0.18, t, a + math.pi / 2, H(0xc8a0ff)))
    ob = join(parts, 'void_debris', 25)
    glow = join(emit, 'void_debris_glow', 25)
    export('void_debris', [ob, glow])
    reset()

    # ---- Starlight Rift arena base: unit radius at z 0 -> 0.35 at z -12 (game scales X/Z by arena radius)
    parts, emit = [], []
    base = lathe('base', [(-0.02, 1.0), (-0.6, 0.98), (-0.9, 0.9), (-4, 0.7), (-8, 0.52), (-11.4, 0.38), (-12, 0.2)], 24,
                 rfn=lambda a, z, r: r * (1 + (0.05 * math.sin(a * 7 + z) if z < -1 else 0)), caps=(False, True))
    parts.append(paint(base, lambda p, n, pc: mix(H(0x3a2a5a), H(0x1e1630), min(1.0, -p.z / 10)) if abs(p.z + 0.75) > 0.15 else H(0xb48fff)))
    band = lathe('band', [(-0.82, 0.995), (-0.68, 0.995)], 48, mat='emit', caps=(False, False))
    emit.append(paint(band, lambda p, n, pc: H(0xb48fff)))
    for k in range(10):
        a = k / 10 * TAU
        r = 0.6 - (k % 3) * 0.06
        emit.append(crystal((math.cos(a) * r, math.sin(a) * r, -5 - (k % 3) * 2.5), -2.2, 0.06, 0.3, a, H(0xc8a0ff)))
    ob = join(parts, 'rift_base', 30)
    glow = join(emit, 'rift_base_glow', 30)
    export('rift_base', [ob, glow])
    reset()

    # ---- Asgard prism pedestal (top at 2.4)
    parts, emit = [], []
    ped = lathe('ped', [(0, 2.25), (0.4, 2.2), (0.5, 1.85), (2.0, 1.6), (2.1, 1.75), (2.4, 1.75)], 6, math.pi / 6)
    parts.append(paint(ped, lambda p, n, pc: H(0xffd866) if (0.4 < p.z < 0.5 or 2.0 < p.z < 2.12) else marble(3)(p, n, pc)))
    for k in range(3):
        a = k / 3 * TAU + 0.5
        pr = tube_mesh('prong', [(math.cos(a) * 1.2, math.sin(a) * 1.2, 2.35), (math.cos(a) * 1.45, math.sin(a) * 1.45, 2.9), (math.cos(a) * 1.05, math.sin(a) * 1.05, 3.5)], [0.12, 0.09, 0.03], 6, cap_top=True)
        parts.append(paint(pr, gold_paint))
    for k in range(6):
        a = k / 6 * TAU
        g = box((0.04, 0.5, 0.5), (math.cos(a) * 1.7 * math.cos(math.pi / 6), math.sin(a) * 1.7 * math.cos(math.pi / 6), 1.2), rot=(0, 0, a), mat='emit')
        emit.append(paint(g, lambda p, n, pc: H(0xfff0b0)))
    ob = join(parts, 'prism_pedestal', 35)
    glow = join(emit, 'prism_pedestal_glow', 30)
    export('prism_pedestal', [ob, glow])
    reset()

    # ---- Spire rune monolith (1.6 square, cap gem at 12.8)
    parts, emit = [], []
    mono = loft('mono', [rect_ring(0.9, 0.9, 0, 1, 1), rect_ring(0.85, 0.85, 0.6, 1, 1), rect_ring(0.78, 0.78, 0.7, 1, 1), rect_ring(0.66, 0.66, 11.0, 1, 1), rect_ring(0.8, 0.8, 11.2, 1, 1), rect_ring(0.8, 0.8, 11.6, 1, 1), rect_ring(0.1, 0.1, 12.2, 1, 1)])
    parts.append(paint(mono, lambda p, n, pc: H(0xffd866) if (p.z < 0.62 or p.z > 11.05) else marble(4)(p, n, pc)))
    for sy in (-1, 1):
        for sx in (0,):
            for j, z in enumerate((2.5, 4.4, 6.3, 8.2)):
                w = 0.78 - 0.12 * (z - 0.7) / 10.3 + 0.012
                for (x, y, r) in ((0, sy * w, 0), (sy * w, 0, math.pi / 2)):
                    g = box((0.36, 0.04, 0.9), (x, y, z), rot=(0, 0, r), mat='emit')
                    emit.append(paint(g, lambda p, n, pc: H(0xffe08a)))
    emit.append(crystal((0, 0, 12.25), 1.1, 0.5, 0, 0.4, H(0xffe680)))
    ob = join(parts, 'spire_monolith', 30)
    glow = join(emit, 'spire_monolith_glow', 30)
    export('spire_monolith', [ob, glow])
    reset()

    # ---- portal frames: ring radius 2.5 centred at z 2.8 in the XZ plane (game: faces +z)
    for name, stone, accent, glowc in (('portal_frame', H(0xe2d8c2), H(0xffd866), H(0xfff0b0)), ('portal_frame_dark', H(0x2e2438), H(0x6a4a8a), H(0xc070ff))):
        parts, emit = [], []
        n = 11
        for k in range(n):
            span = math.pi + 1.0
            a0 = span * (k / n) - 0.5
            a1 = span * ((k + 0.9) / n) - 0.5
            pts = []
            for (r, a) in ((2.75, a0), (3.35, a0), (3.35, a1), (2.75, a1)):
                pts.append((math.cos(a) * r, math.sin(a) * r))
            verts = [(x, -0.35, z + 2.8) for x, z in pts] + [(x, 0.35, z + 2.8) for x, z in pts]
            vb = mesh('vou', verts, [(0, 1, 2, 3), (7, 6, 5, 4), (0, 4, 5, 1), (1, 5, 6, 2), (2, 6, 7, 3), (3, 7, 4, 0)])
            fix_normals(vb)
            modify(vb, 'BEVEL', width=0.04, segments=1, limit_method='NONE')
            parts.append(paint(vb, (lambda p, n_, pc: accent) if k == n // 2 else blocks(stone, k, 0.15)))
        for sx in (-1, 1):
            leg = loft('leg', [rect_ring(0.42, 0.42, 0.0, 1, 1), rect_ring(0.36, 0.36, 1.2, 1, 1), rect_ring(0.42, 0.42, 1.35, 1, 1)])
            leg.location = (sx * 3.05, 0, 0)
            apply_tf(leg)
            parts.append(paint(leg, blocks(stone, 9 + sx, 0.15)))
            g = box((0.12, 0.05, 0.6), (sx * 3.05, -0.43, 0.7), mat='emit')
            emit.append(paint(g, lambda p, n_, pc: glowc))
        emit.append(crystal((0, -0.38, 6.15 - 0.05), 0.45, 0.2, math.pi / 2, 0, glowc))
        step = box((4.6, 1.3, 0.12), (0, 0, 0.0), bevel=0.03)
        parts.append(paint(step, blocks(mul(stone, 0.85), 4, 0.1)))
        ob = join(parts, name, 30)
        glow = join(emit, name + '_glow', 30)
        export(name, [ob, glow])
        reset()

    # ---- small rusty sword for the Ashen sword field (instanced, Lambert + vertex colours)
    parts = []
    bl = loft('blade', [blade_ring(-0.05, 0.005, 0.005, 1), blade_ring(0.12, 0.045, 0.014, 1), blade_ring(1.45, 0.052, 0.016, 0.6), blade_ring(1.5, 0.055, 0.016, 1)])
    parts.append(paint(bl, lambda p, n, pc: mix(H(0xb8b8c4), H(0x7a4a32), max(0.0, nz(p, 6, 2)) * 1.6 + max(0.0, 0.5 - p.z))))
    gd = box((0.42, 0.09, 0.07), (0, 0, 1.53), bevel=0.015)
    parts.append(paint(gd, flat(H(0x2a2228))))
    gp = cyl(0.035, 0.36, (0, 0, 1.75), verts=6)
    parts.append(paint(gp, lambda p, n, pc: H(0x4a2a22) if int(p.z * 30) % 2 else H(0x2a1a18)))
    pm = blob(0.055, (0, 0, 1.95), sub=1, amp=0.0)
    parts.append(paint(pm, flat(H(0x6a5a50))))
    ob = join(parts, 'rusty_sword', 40)
    export('rusty_sword', [ob])


def build_misc_props():
    # ---- fishing pier: deck top 0.225, extends towards -Y (game +z, over the water)
    parts = []
    plankc = H(0x6d4c30)
    for i in range(9):
        y = -2.0 + i * 0.47
        pl = box((2.4, 0.42, 0.08), (0, y, 0.18), rot=(0, 0.0, (i % 3 - 1) * 0.01), bevel=0.012)
        parts.append(paint(pl, wood(mul(plankc, 1 + (i % 3) * 0.06), 0, 0, i)))
    for sy in (-1, 1):
        j = box((0.12, 4.3, 0.14), (sy * 0.95, 0, 0.07))
        parts.append(paint(j, wood(H(0x4a321e), 1)))
    for x, y in ((-1.0, -1.8), (1.0, -1.8), (-1.0, 1.8), (1.0, 1.8), (-1.0, 0), (1.0, 0)):
        po = cyl(0.12, 2.3, (x, y, -0.65), verts=7)
        parts.append(paint(po, lambda p, n, pc: mix(H(0x4a321e), H(0x2f5a3a), max(0.0, -p.z - 0.6) * 1.2)))
        if abs(y) > 1:
            cap = cyl(0.13, 0.04, (x, y, 0.5), verts=7)
            parts.append(paint(cap, flat(H(0x3a2614))))
            po2 = cyl(0.11, 0.35, (x, y, 0.35), verts=7)
            parts.append(paint(po2, wood(H(0x4a321e), 2)))
    rope = tube_mesh('rope', [(-1.0, -1.8, 0.45), (-1.0, -0.9, 0.32), (-1.0, 0.0, 0.42)], [0.025] * 3, 5)
    rope2 = tube_mesh('rope', [(1.0, -1.8, 0.45), (1.0, -0.9, 0.32), (1.0, 0.0, 0.42)], [0.025] * 3, 5)
    for r in (rope, rope2):
        parts.append(paint(r, flat(H(0xd8c08a))))
    tb = box((0.5, 0.4, 0.33), (0.7, -0.8, 0.39), bevel=0.02)
    parts.append(paint(tb, lambda p, n, pc: H(0x2d5bb8) if p.z < 0.5 else H(0x3867d6)))
    hd = tube_mesh('handle', [(0.55, -0.8, 0.55), (0.7, -0.8, 0.68), (0.85, -0.8, 0.55)], [0.02] * 3, 4)
    parts.append(paint(hd, flat(H(0x2a2a30))))
    bk = lathe('bucket', [(0.22, 0.17), (0.55, 0.21)], 10, caps=(True, False))
    bk.location = (-0.7, -0.4, 0.0)
    apply_tf(bk)
    parts.append(paint(bk, lambda p, n, pc: H(0x8a8f9c) if abs(p.z - 0.4) > 0.04 else H(0x5a5f6c)))
    water = cyl(0.19, 0.02, (-0.7, -0.4, 0.5), verts=10)
    parts.append(paint(water, flat(H(0x5fb0e0))))
    rod_ = rod((0.7, -0.6, 0.25), (0.7, -2.6, 2.1), 0.025, 5)
    parts.append(paint(rod_, lambda p, n, pc: H(0xeb3b5a) if p.z < 1.5 else H(0xf2e6c8)))
    reel = cyl(0.06, 0.05, (0.75, -0.85, 0.5), rot=(0, math.pi / 2, 0), verts=8)
    parts.append(paint(reel, flat(H(0xd0d0d8))))
    ln = tube_mesh('line', [(0.7, -2.6, 2.1), (0.7, -3.0, 1.0), (0.7, -3.1, -0.1)], [0.006] * 3, 3)
    parts.append(paint(ln, flat(H(0xf0f0f0))))
    lp = cyl(0.05, 1.4, (-1.05, -1.8, 1.0), verts=6)
    parts.append(paint(lp, flat(H(0x3a2614))))
    ob = join(parts, 'fishing_pier', 35)
    lan = cyl(0.12, 0.22, (-1.05, -1.95, 1.55), verts=6, mat='emit')
    paint(lan, lambda p, n, pc: H(0xffc46b))
    export('fishing_pier', [ob, lan])
    reset()

    # ---- bounty board: front face at y = -0.05 (game +z), notices attached in game
    parts, emit = [], []
    for sx in (-1, 1):
        po = box((0.2, 0.2, 2.5), (sx * 0.78, 0, 1.2), bevel=0.02)
        parts.append(paint(po, wood(H(0x6e4726), 2, 0, sx)))
        ft = box((0.4, 0.4, 0.25), (sx * 0.78, 0, 0.05), bevel=0.03)
        parts.append(paint(ft, blocks(H(0x8a8378), sx + 3)))
    bd = box((1.62, 0.08, 1.06), (0, 0.0, 1.5))
    parts.append(paint(bd, lambda p, n, pc: mul(H(0xb58a57), 0.9 + 0.1 * math.sin(p.z * 40) ** 2)))
    for z in (0.94, 2.06):
        fr = box((1.8, 0.14, 0.1), (0, 0, z), bevel=0.02)
        parts.append(paint(fr, wood(H(0x5a3a1e), 0)))
    for sy in (-1, 1):
        rf = box((2.2, 0.62, 0.07), (0, sy * 0.24, 2.36), rot=(-sy * 0.5, 0, 0))
        parts.append(paint(rf, lambda p, n, pc: mul(H(0x3d2817), 0.9 + 0.2 * (int(p.x * 6) % 2)) if n.z > 0 else H(0x2a1a10)))
    ridge = rod((-1.12, 0, 2.5), (1.12, 0, 2.5), 0.05, 6)
    parts.append(paint(ridge, flat(H(0x2a1a10))))
    for i, (x, z) in enumerate(((-0.6, 1.2), (0.62, 1.82), (0.0, 1.05))):
        pin = blob(0.025, (x, -0.07, z), sub=1, amp=0.0)
        parts.append(paint(pin, flat(H(0xd04040))))
    hook = rod((0.95, 0, 2.15), (1.15, -0.0, 2.15), 0.02)
    parts.append(paint(hook, flat(H(0x2a2a30))))
    lan = cyl(0.09, 0.18, (1.15, 0, 1.98), verts=6, mat='emit')
    emit.append(paint(lan, lambda p, n, pc: H(0xffc46b)))
    ob = join(parts, 'bounty_board', 35)
    glow = join(emit, 'bounty_board_lamp', 30)
    export('bounty_board', [ob, glow])



# ------------------------------------------------------------------ batch 7: enemy "kits"
# Kits are greyscale-shaded meshes split by material ROLE (object name). The game gives each role the
# enemy's own material (with vertexColors on), so variant colours, hit-flash and opacity keep working.
def B(x, y, z):
    """three.js (Y-up, +Z forward) -> Blender (Z-up, -Y forward)"""
    return (x, -z, y)


def grey(lo=0.7, hi=1.0, seed=0, f=3.0, top=0.6):
    def fn(p, n, pc):
        k = lo + (hi - lo) * (top * (max(0.0, n.z) * 0.5 + 0.5) + (1 - top) * (nz(p, f, seed) * 0.5 + 0.5))
        return (k, k, k)
    return fn


WHITE = lambda p, n, pc: (1, 1, 1)


def kit(name, roles):
    """roles: {role: [objects]} -> one object per role, exported together"""
    obs = []
    for role, parts in roles.items():
        if parts:
            obs.append(join(parts, role, 45))
    export(name, obs)
    reset()


def ell(r, loc3, scale3=(1, 1, 1), sub=2, amp=0.0, seed=0):
    """ellipsoid given in three.js space"""
    x, y, z = scale3
    return blob(r, B(*loc3), (x, z, y), sub=sub, amp=amp, seed=seed)


def build_enemy_kits():
    # ---------------- fox family ----------------
    fur, belly = [], []
    torso = ell(0.36, (0, 0.72, -0.02), (0.92, 0.86, 1.6), sub=3, amp=0.06, seed=1)
    fur.append(paint(torso, grey(0.62, 1.0, 1)))
    ruff = ell(0.3, (0, 0.86, 0.34), (1.15, 1.05, 0.9), sub=2, amp=0.22, seed=2)
    fur.append(paint(ruff, grey(0.7, 1.0, 2)))
    neck = tube_mesh('neck', [B(0, 0.82, 0.3), B(0, 0.95, 0.48), B(0, 1.02, 0.6)], [0.2, 0.18, 0.16], 10)
    fur.append(paint(neck, grey(0.7, 1.0, 3)))
    chest = ell(0.25, (0, 0.68, 0.4), (1.0, 1.15, 0.75), sub=2, amp=0.15, seed=3)
    belly.append(paint(chest, grey(0.8, 1.0, 4)))
    bel = ell(0.3, (0, 0.52, 0.0), (0.7, 0.4, 1.3), sub=2)
    belly.append(paint(bel, grey(0.8, 1.0, 5)))
    kit('kit_fox_body', {'fur': fur, 'belly': belly})

    fur, belly, dark, glow = [], [], [], []
    sk = ell(0.25, (0, 0.02, -0.02), (1.1, 0.92, 1.05), sub=3, seed=4)
    fur.append(paint(sk, grey(0.7, 1.0, 6)))
    for sx in (-1, 1):
        ck = ell(0.13, (sx * 0.2, -0.06, 0.02), (1.0, 0.8, 1.0), sub=2, amp=0.3, seed=sx + 7)
        fur.append(paint(ck, grey(0.75, 1.0, 7)))
    sn = tube_mesh('snout', [B(0, -0.04, 0.12), B(0, -0.06, 0.28), B(0, -0.07, 0.44)], [0.13, 0.085, 0.035], 10, cap_top=True)
    belly.append(paint(sn, grey(0.8, 1.0, 8)))
    nose = ell(0.04, (0, -0.045, 0.45), (1.2, 0.9, 1.0), sub=1)
    dark.append(paint(nose, WHITE))
    for sx in (-1, 1):
        base = B(sx * 0.14, 0.16, -0.03)
        tip = B(sx * 0.22, 0.45, -0.07)
        ear = lathe('ear', [(0, 0.1), (0.3, 0.0)], 4, math.pi / 4, caps=(True, False))
        d = Vector(tip) - Vector(base)
        ear.rotation_euler = Vector((0, 0, 1)).rotation_difference(d.normalized()).to_euler()
        ear.location = base
        apply_tf(ear)
        fur.append(paint(ear, grey(0.7, 1.0, 9)))
        inner = lathe('inner', [(0.02, 0.06), (0.24, 0.0)], 4, math.pi / 4, caps=(True, False))
        inner.rotation_euler = Vector((0, 0, 1)).rotation_difference(d.normalized()).to_euler()
        inner.location = Vector(base) + Vector(B(0, 0, 0.035))
        apply_tf(inner)
        belly.append(paint(inner, grey(0.85, 1.0, 10)))
        eye = ell(0.05, (sx * 0.115, 0.055, 0.22), (1.4, 0.6, 0.45), sub=1)
        eye.rotation_euler = (0, sx * 0.35, 0)
        apply_tf(eye)
        glow.append(paint(eye, WHITE))
    kit('kit_fox_head', {'fur': fur, 'belly': belly, 'dark': dark, 'glow': glow})

    thigh = tube_mesh('leg', [B(0, 0.06, 0), B(0, -0.18, 0.0), B(0, -0.42, 0.02), B(0, -0.58, 0.03)], [0.11, 0.085, 0.055, 0.05], 8)
    paw = ell(0.075, (0, -0.6, 0.05), (1.0, 0.65, 1.35), sub=2)
    kit('kit_fox_leg', {'fur': [paint(thigh, grey(0.65, 1.0, 11))], 'dark': [paint(paw, WHITE)]})

    tail = lathe('tail', [(0.0, 0.08), (0.15, 0.15), (0.4, 0.21), (0.65, 0.19), (0.8, 0.14), (0.88, 0.09)], 10,
                 rfn=lambda a, z, r: r * (1 + 0.12 * math.sin(a * 5 + z * 9)))
    tip = lathe('tip', [(0.84, 0.11), (0.98, 0.15), (1.15, 0.1), (1.32, 0.0)], 10, caps=(True, False),
                rfn=lambda a, z, r: r * (1 + 0.15 * math.sin(a * 5 + z * 7)))
    kit('kit_fox_tail', {'fur': [paint(tail, grey(0.7, 1.0, 12))], 'glow': [paint(tip, lambda p, n, pc: (1, 1, 1))]})

    # ---------------- slime ----------------
    prof = [(0.0, 0.6), (0.04, 0.68), (0.12, 0.67)]
    for z in (0.22, 0.35, 0.48, 0.6, 0.72, 0.82, 0.9, 0.95):
        prof.append((z, 0.64 * math.sqrt(max(0.0, 1 - ((z - 0.46) / 0.51) ** 2))))
    prof.append((0.97, 0.0))
    gel = lathe('gel', prof, 22, rfn=lambda a, z, r: r * (1 + 0.035 * math.sin(a * 6) * max(0.0, 0.5 - z) * 2), caps=(True, False))
    fix_normals(gel)
    smooth(gel, 80)
    paint(gel, lambda p, n, pc: (lambda k: (k, k, k))(0.72 + 0.28 * max(0.0, n.z) + (0.15 if (n.z > 0.6 and p.x < -0.1 and p.y > 0.0) else 0)))
    drips = []
    for i, (a, z, r) in enumerate(((0.5, 0.1, 0.12), (2.4, 0.07, 0.1), (4.0, 0.12, 0.09))):
        rr = 0.66
        d = blob(r, (math.cos(a) * rr, math.sin(a) * rr, z), (1, 1, 1.5), sub=2)
        drips.append(paint(d, grey(0.8, 1.0, i)))
    kit('kit_slime', {'gel': [gel] + drips})

    # ---------------- ghost family ----------------
    rnd = random.Random(5)
    rings = []
    prof = [(1.42, 0.0), (1.4, 0.12), (1.33, 0.23), (1.2, 0.3), (1.0, 0.31), (0.7, 0.35), (0.3, 0.46), (-0.2, 0.6), (-0.62, 0.74), (-0.78, 0.8)]
    sides = 18
    for j, (y, r) in enumerate(prof):
        rg = []
        for k in range(sides):
            a = k / sides * TAU
            rr = r * (1 + (0.08 * math.sin(a * 3 + y * 4) if y < 0.8 else 0))
            yy = y
            if j == len(prof) - 1:
                yy += -0.18 * (0.5 + 0.5 * math.sin(a * 5)) + rnd.uniform(-0.05, 0.05)   # tattered hem
            rg.append(Vector(B(math.sin(a) * rr, yy, math.cos(a) * rr)))
        rings.append(rg)
    cloak = loft('cloak', rings, cap_bot=False, cap_top=False)
    fix_normals(cloak)
    smooth(cloak, 70)
    paint(cloak, lambda p, n, pc: (lambda k: (k, k, k))(0.7 + 0.3 * min(1.0, max(0.0, (p.z + 0.8) / 2.2))))
    sleeves = []
    for sx in (-1, 1):
        sl = tube_mesh('sleeve', [B(sx * 0.25, 0.95, 0.0), B(sx * 0.5, 0.75, 0.08), B(sx * 0.62, 0.42, 0.12), B(sx * 0.64, 0.18, 0.12)], [0.1, 0.13, 0.17, 0.2], 8)
        for v in sl.data.vertices:
            if v.co.z < 0.25:
                v.co.z -= abs(math.sin(v.co.x * 25 + v.co.y * 19)) * 0.08
        sl.data.update()
        sleeves.append(paint(sl, grey(0.72, 1.0, sx)))
    hair = []
    for i in range(5):
        x = (i - 2) * 0.09
        h = tube_mesh('hair', [B(x * 0.8, 1.38, -0.12), B(x, 1.0, -0.3), B(x * 1.2, 0.55, -0.36), B(x * 1.4 + 0.03, 0.1, -0.3)], [0.07, 0.08, 0.065, 0.02], 6, cap_top=True)
        hair.append(paint(h, grey(0.75, 1.0, i)))
    cap = ell(0.29, (0, 1.22, -0.03), (1.08, 0.9, 1.05), sub=2)
    hair.append(paint(cap, grey(0.8, 1.0, 9)))
    kit('kit_ghost', {'cloak': [cloak] + sleeves, 'hair': hair})

    # ---------------- jelly ----------------
    bell = lathe('bell', [(0.0, 0.6), (0.06, 0.6), (0.22, 0.52), (0.36, 0.4), (0.44, 0.2), (0.45, 0.02)], 24,
                 rfn=lambda a, z, r: r * (1 + (0.07 * math.cos(a * 8) if z < 0.12 else 0.02 * math.cos(a * 8))), caps=(False, True))
    for v in bell.data.vertices:
        if v.co.z < 0.05:
            a = math.atan2(v.co.y, v.co.x)
            v.co.z -= 0.06 * (0.5 + 0.5 * math.cos(a * 8))
    bell.data.update()
    fix_normals(bell)
    smooth(bell, 80)
    paint(bell, lambda p, n, pc: (lambda k: (k, k, k))(0.75 + 0.25 * max(0.0, n.z) + (0.12 if abs(math.sin(math.atan2(p.y, p.x) * 4)) < 0.15 else 0)))
    frills = []
    for k in range(4):
        a = k / 4 * TAU + 0.4
        fr = tube_mesh('frill', [(math.cos(a) * 0.08, math.sin(a) * 0.08, 0.02), (math.cos(a) * 0.12, math.sin(a) * 0.12, -0.2), (math.cos(a + 0.4) * 0.1, math.sin(a + 0.4) * 0.1, -0.42)], [0.06, 0.05, 0.015], 6, cap_top=True)
        frills.append(paint(fr, grey(0.8, 1.0, k)))
    kit('kit_jelly', {'gel': [bell] + frills})

    # ---------------- void eye: sclera ball + fleshy lid + tentacle segment chain ----------------
    ball = prim('uv_sphere', segments=20, ring_count=14, radius=0.55)
    smooth(ball, 80)
    paint(ball, lambda p, n, pc: (lambda k: (k, k, k))(0.85 + 0.15 * max(0.0, -p.y / 0.55)))
    veins = []
    for k in range(6):
        a = k / 6 * TAU
        vpts = [B(math.cos(a) * 0.53 * math.sin(t), math.sin(a) * 0.53 * math.sin(t), -0.53 * math.cos(t) * 1.0) for t in (0.3, 0.8, 1.3)]
        vn = tube_mesh('vein', vpts, [0.02, 0.015, 0.008], 4)
        veins.append(paint(vn, WHITE))
    lid = lathe('lid', [(0.0, 0.63), (0.18, 0.6), (0.38, 0.5), (0.52, 0.32), (0.6, 0.06)], 18,
                rfn=lambda a, z, r: r * (1 + 0.06 * math.sin(a * 5)), caps=(False, True))
    # lid hood: rotate so it covers the top/back like the placeholder (three rot.x = -0.4)
    lid.rotation_euler = (-0.4, 0, 0)
    apply_tf(lid)
    fix_normals(lid)
    smooth(lid, 60)
    paint(lid, grey(0.65, 1.0, 3))
    spikes = []
    for k in range(5):
        a = k / 5 * TAU
        sp = lathe('sp', [(0, 0.06), (0.22, 0.0)], 5, caps=(True, False))
        d = Vector((math.cos(a) * 0.5, math.sin(a) * 0.5, 0.7)).normalized()
        sp.rotation_euler = Vector((0, 0, 1)).rotation_difference(d).to_euler()
        sp.location = d * 0.55
        apply_tf(sp)
        spikes.append(paint(sp, grey(0.6, 0.9, k)))
    kit('kit_void_eye', {'sclera': [ball] + veins, 'flesh': [lid] + spikes})
    seg = []
    for k in range(4):
        r = 0.09 - k * 0.015
        e = ell(r, (0, -k * 0.16, 0), (1.0, 1.6, 1.0), sub=2)
        seg.append(paint(e, grey(0.65, 1.0, k)))
    sk2 = lathe('tip', [(-0.55, 0.035), (-0.72, 0.0)], 6, caps=(True, False))
    seg.append(paint(sk2, WHITE))
    kit('kit_eye_tentacle', {'flesh': seg})

    # ---------------- void root (static) ----------------
    pts = [B(0, -0.1, 0), B(0.15, 0.8, 0.1), B(-0.1, 1.6, -0.05), B(0.2, 2.4, 0.15), B(0.0, 3.2, 0.0), B(0.0, 3.45, 0.0)]
    trunk = tube_mesh('root', pts, [0.62, 0.52, 0.44, 0.36, 0.3, 0.12], 9)
    for v in trunk.data.vertices:
        a = math.atan2(v.co.y, v.co.x)
        v.co.x += math.cos(a) * 0.08 * math.sin(v.co.z * 4 + a * 3)
        v.co.y += math.sin(a) * 0.08 * math.sin(v.co.z * 4 + a * 3)
    trunk.data.update()
    bark = [paint(trunk, grey(0.6, 1.0, 1, 5))]
    for k in range(6):
        a = k * 1.9
        z = 0.5 + k * 0.5
        th = lathe('thorn', [(0, 0.09), (0.45, 0.0)], 5, caps=(True, False))
        d = Vector((math.cos(a), math.sin(a), 0.5)).normalized()
        th.rotation_euler = Vector((0, 0, 1)).rotation_difference(d).to_euler()
        th.location = (math.cos(a) * 0.38, math.sin(a) * 0.38, z)
        apply_tf(th)
        bark.append(paint(th, grey(0.6, 0.9, k)))
    bark += root_parts(41, n=5, scale=0.9, r0=0.55)[1:]
    for o in bark[-5:]:
        paint(o, grey(0.55, 0.9, 2))
    claws = []
    for k in range(4):
        a = k / 4 * TAU
        c = tube_mesh('cr', [(0, 0, 3.3), (math.cos(a) * 0.35, math.sin(a) * 0.35, 3.55), (math.cos(a) * 0.32, math.sin(a) * 0.32, 3.95), (math.cos(a) * 0.12, math.sin(a) * 0.12, 4.15)], [0.09, 0.07, 0.04, 0.01], 5, cap_top=True)
        claws.append(paint(c, grey(0.6, 0.9, k)))
    kit('kit_void_root', {'bark': bark + claws})

    # ---------------- blood seal (stone base + obelisk), designed at s = 1 ----------------
    base = lathe('base', [(-0.1, 1.45), (0.35, 1.3), (0.45, 1.15), (0.62, 1.05)], 6)
    paint(base, grey(0.65, 1.0, 1, 4))
    steps = [base]
    for k in range(6):
        a = (k + 0.5) / 6 * TAU
        r = box((0.08, 0.5, 0.18), (math.cos(a) * 1.22, math.sin(a) * 1.22, 0.3), rot=(0, 0.3, a))
        steps.append(paint(r, lambda p, n, pc: (0.45, 0.45, 0.45)))
    ob = lathe('obel', [(0.55, 0.62), (0.75, 0.55), (3.4, 0.3), (3.65, 0.4), (3.9, 0.0)], 4, math.pi / 4, caps=(True, False))
    paint(ob, grey(0.65, 1.0, 2, 4))
    cr = []
    for k in range(4):
        a = k / 4 * TAU + math.pi / 4
        g = box((0.06, 0.25, 0.9), (math.cos(a) * 0.42, math.sin(a) * 0.42, 1.7), rot=(0, 0.06, a))
        cr.append(paint(g, lambda p, n, pc: (0.35, 0.35, 0.35)))
    kit('kit_blood_seal', {'base': steps, 'obel': [ob] + cr})

    # ---------------- ice prison (block + spikes) ----------------
    rnd = random.Random(9)
    ice = []
    blk = prim('ico_sphere', subdivisions=1, radius=1.0)
    for v in blk.data.vertices:
        v.co = Vector((v.co.x * 1.45, v.co.y * 1.45, v.co.z * 2.15)) * (1 + rnd.uniform(-0.08, 0.08))
        v.co.z += 1.6
    blk.data.update()
    ice.append(paint(blk, lambda p, n, pc: (lambda k: (k, k, k))(0.8 + 0.2 * max(0.0, n.z) + nz(pc, 3, 1) * 0.1)))
    for k in range(7):
        a = k * 0.9 + rnd.uniform(0, 0.3)
        r = rnd.uniform(1.1, 1.5)
        h = rnd.uniform(0.8, 1.6)
        sp = lathe('sp', [(-0.2, 0.26), (h * 0.7, 0.2), (h, 0.0)], 5, caps=(True, False))
        d = Vector((math.cos(a) * 0.6, math.sin(a) * 0.6, 1)).normalized()
        sp.rotation_euler = Vector((0, 0, 1)).rotation_difference(d).to_euler()
        sp.location = (math.cos(a) * r, math.sin(a) * r, 0)
        apply_tf(sp)
        ice.append(paint(sp, lambda p, n, pc: (lambda k: (k, k, k))(0.8 + 0.2 * max(0.0, n.z))))
    kit('kit_ice_prison', {'ice': ice})

    # ---------------- corrupted coral spire (static) ----------------
    a_, b_ = [], []
    rnd = random.Random(14)
    for i in range(8):
        h = 2.2 + rnd.uniform(0, 2.4) if i else 4.2
        ang = i * 0.9
        r0 = 0.0 if i == 0 else 0.55
        x, y = math.cos(ang) * r0, math.sin(ang) * r0
        lean = Vector((math.cos(ang) * 0.35 * (1 if i else 0), math.sin(ang) * 0.35 * (1 if i else 0), 1)).normalized()
        pts = [Vector((x, y, -0.1)) + lean * h * t + Vector((math.sin(t * 5 + i) * 0.08, 0, 0)) for t in (0, 0.35, 0.7, 1.0)]
        c = tube_mesh('c', pts, [0.34, 0.24, 0.15, 0.04], 7, cap_top=True)
        (a_ if i % 2 else b_).append(paint(c, grey(0.6, 1.0, i)))
        for k in range(2):
            t = rnd.uniform(0.4, 0.8)
            p0 = pts[0] + (pts[-1] - pts[0]) * t
            d = Vector((rnd.uniform(-1, 1), rnd.uniform(-1, 1), 0.8)).normalized()
            br = tube_mesh('b', [p0, p0 + d * 0.45, p0 + d * 0.7 + Vector((0, 0, 0.2))], [0.1, 0.06, 0.02], 5, cap_top=True)
            (a_ if i % 2 else b_).append(paint(br, grey(0.6, 1.0, i + k)))
    rock = blob(0.9, (0, 0, 0), (1.3, 1.3, 0.45), sub=2, amp=0.3, seed=3)
    b_.append(paint(rock, grey(0.4, 0.7, 3)))
    kit('kit_coral_spire', {'a': a_, 'b': b_})



# ------------------------------------------------------------------ batch 7b: boss kits
def anime_head(cx, cy, cz, r=0.16, hair_len=1.2, hair_spread=0.32, bangs=True, seed=0):
    """returns (skin parts, hair parts) for an anime head centred at (cx,cy,cz) in three.js space"""
    skin, hair = [], []
    hd = ell(r, (cx, cy, cz), (0.95, 1.05, 1.0), sub=3)
    for v in hd.data.vertices:
        # taper the jaw: lower-front vertices pulled in (Blender: z up, -y forward)
        dz = v.co.z - cy
        if dz < 0:
            k = 1 + dz / r * 0.28
            v.co.x = cx + (v.co.x - cx) * k
            v.co.y = -cz + (v.co.y + cz) * (1 + dz / r * 0.12)
    hd.data.update()
    skin.append(paint(hd, grey(0.86, 1.0, seed)))
    nk = tube_mesh('neck', [B(cx, cy - r * 1.6, cz - 0.01), B(cx, cy - r * 0.6, cz - 0.01)], [r * 0.38, r * 0.34], 8)
    skin.append(paint(nk, grey(0.8, 0.95, seed)))
    cap = ell(r * 1.1, (cx, cy + r * 0.12, cz - r * 0.12), (1.02, 1.0, 1.02), sub=2)
    for v in cap.data.vertices:
        # open the face: push front-lower vertices back into the skull
        if v.co.y < -(cz) - r * 0.35 and v.co.z < cy + r * 0.45:
            v.co.y += r * 0.9
    cap.data.update()
    hair.append(paint(cap, grey(0.72, 1.0, seed + 1)))
    if bangs:
        for i in range(5):
            x = cx + (i - 2) * r * 0.36
            bg = tube_mesh('bang', [B(x * 0.9 + cx * 0.1, cy + r * 0.85, cz + r * 0.62), B(x, cy + r * 0.55, cz + r * 0.9), B(x * 1.02, cy + r * 0.22, cz + r * 0.97)],
                           [r * 0.24, r * 0.19, r * 0.04], 5, cap_top=True)
            for v in bg.data.vertices:
                v.co.y = -(cz + r * 0.82) + (v.co.y + cz + r * 0.82) * 0.55   # flatten against the forehead
            hair.append(paint(bg, grey(0.75, 1.0, seed + i)))
    n = 7
    for i in range(n):
        a = (i / (n - 1) - 0.5) * 2.4
        sx, sz = math.sin(a), -math.cos(a)
        top = B(cx + sx * r * 0.8, cy + r * 0.3, cz + sz * r * 0.8)
        mid = B(cx + sx * (r * 1.1 + hair_spread * 0.4), cy - hair_len * 0.45, cz + sz * (r * 1.0 + hair_spread * 0.35) - 0.02)
        end = B(cx + sx * (r * 0.9 + hair_spread), cy - hair_len, cz + sz * (r * 0.8 + hair_spread * 0.6) - 0.05)
        st = tube_mesh('lock', [top, mid, end], [r * 0.42, r * 0.38, r * 0.04], 6, cap_top=True)
        for v in st.data.vertices:
            # flatten the locks a little sideways into ribbons
            v.co.x = (v.co.x - cx) * 0.98 + cx
        hair.append(paint(st, grey(0.68, 1.0, seed + 10 + i)))
    return skin, hair


def robe_skirt(y_top, y_bot, r_top, r_bot, sides=20, waves=8, seed=0):
    rings = []
    rnd = random.Random(seed)
    ys = [y_top + (y_bot - y_top) * t for t in (0, 0.25, 0.5, 0.75, 1.0)]
    for j, y in enumerate(ys):
        t = j / 4
        r = r_top + (r_bot - r_top) * t ** 0.8
        rg = []
        for k in range(sides):
            a = k / sides * TAU
            rr = r * (1 + 0.07 * t * math.sin(a * waves))
            yy = y + (0.05 * math.sin(a * waves + 1) if j == 4 else 0)
            rg.append(Vector(B(math.sin(a) * rr, yy, math.cos(a) * rr)))
        rings.append(rg)
    sk = loft('skirt', rings[::-1], cap_bot=False, cap_top=False)
    fix_normals(sk)
    smooth(sk, 60)
    return paint(sk, lambda p, n, pc: (lambda k: (k, k, k))(0.72 + 0.28 * math.cos(math.atan2(p.x, -p.y) * waves) ** 2 * 0.6 + 0.12))


def torso_shape(y0, y1, r_hip, r_waist, r_chest, z_off=0.0):
    prof = [(y0, r_hip), (y0 + (y1 - y0) * 0.35, r_waist), (y0 + (y1 - y0) * 0.72, r_chest), (y1, r_chest * 0.72)]
    rings = [[Vector(B(math.sin(k / 14 * TAU) * r * 1.08, y, z_off + math.cos(k / 14 * TAU) * r * 0.85)) for k in range(14)] for y, r in prof]
    t = loft('torso', rings)
    fix_normals(t)
    smooth(t, 70)
    return paint(t, grey(0.75, 1.0, 3))


def build_boss_kits():
    # ---- Evy Blood Sage (fig space; arms stay in game)
    skin, hair = anime_head(0, 1.9, 0, 0.15, hair_len=1.15, hair_spread=0.3, seed=1)
    robe = [robe_skirt(1.22, 0.0, 0.17, 0.5, waves=9, seed=1), torso_shape(1.18, 1.72, 0.17, 0.13, 0.17)]
    sash = tube_mesh('sash', [B(0.0, 1.22, 0.17), B(0.05, 1.0, 0.25), B(0.08, 0.5, 0.33)], [0.05, 0.05, 0.03], 5)
    for o in (sash,):
        paint(o, lambda p, n, pc: (0.45, 0.45, 0.45))
    kit('kit_sage', {'skin': skin, 'robe': robe + [sash], 'hair': hair})

    # ---- Ygg-Naar: body in fig space, head in head-group space
    dark = [torso_shape(0.95, 1.68, 0.17, 0.12, 0.16), ell(0.17, (0, 1.0, 0), (1.1, 0.75, 0.9), sub=2)]
    for o in dark:
        paint(o, grey(0.6, 1.0, 2))
    legs = []
    for sx in (-1, 1):
        lg = tube_mesh('leg', [B(sx * 0.09, 1.0, 0), B(sx * 0.1, 0.55, 0.02), B(sx * 0.09, 0.05, 0)], [0.075, 0.055, 0.04], 8)
        legs.append(paint(lg, grey(0.8, 1.0, sx)))
        bt = tube_mesh('boot', [B(sx * 0.09, 0.42, 0.0), B(sx * 0.09, 0.0, 0.03)], [0.06, 0.05], 8)
        dark.append(paint(bt, grey(0.6, 0.9, sx)))
    kit('kit_ygg_body', {'dark': dark, 'skin': legs})
    skin, hair = anime_head(0, 0, 0, 0.17, hair_len=1.5, hair_spread=0.36, bangs=False, seed=3)
    kit('kit_ygg_head', {'skin': skin, 'hair': hair})
    seg = ell(0.34, (0, 0.3, 0), (1.0, 1.35, 1.0), sub=2, amp=0.08, seed=1)
    suck = []
    for k in range(3):
        sc = cyl(0.07, 0.05, B(0, 0.12 + k * 0.2, 0.31), rot=(math.pi / 2, 0, 0), verts=8)
        suck.append(paint(sc, lambda p, n, pc: (0.55, 0.55, 0.55)))
    kit('kit_ygg_seg', {'dark': [paint(seg, grey(0.6, 1.0, 4))] + suck})

    # ---- Slime Queen: giant gel body (unit sphere space, game scales it) + rider (rider space)
    prof = [(-0.93, 0.0), (-0.95, 0.9), (-0.85, 1.05), (-0.6, 1.02)]
    for z in (-0.3, 0.0, 0.3, 0.6, 0.85, 0.97):
        prof.append((z, math.sqrt(max(0.0, 1 - z * z)) * 1.0))
    prof.append((1.0, 0.0))
    gel = lathe('gel', prof, 36, rfn=lambda a, z, r: r * (1 + (0.05 * math.sin(a * 7) if z < -0.5 else 0.015 * math.sin(a * 5 + z * 4))), caps=(False, False))
    fix_normals(gel)
    smooth(gel, 80)
    paint(gel, WHITE)
    drips = []
    for i in range(6):
        a = i / 6 * TAU + 0.3
        d = blob(0.16, (math.cos(a) * 1.0, math.sin(a) * 1.0, -0.55 + (i % 3) * 0.25), (1, 1, 1.8), sub=2)
        drips.append(paint(d, WHITE))
    kit('kit_queen_gel', {'gel': [gel] + drips})
    skin, hair = anime_head(0, 0.95, 0, 0.17, hair_len=0.75, hair_spread=0.26, seed=5)
    suit = [torso_shape(0.18, 0.76, 0.17, 0.12, 0.155), ell(0.17, (0, 0.22, 0), (1.15, 0.7, 0.95), sub=2)]
    for o in suit:
        paint(o, grey(0.7, 1.0, 5))
    for sx in (-1, 1):
        lg = tube_mesh('leg', [B(sx * 0.1, 0.18, 0.05), B(sx * 0.2, 0.12, 0.42), B(sx * 0.27, -0.2, 0.62)], [0.08, 0.06, 0.045], 8)
        skin.append(paint(lg, grey(0.85, 1.0, sx)))
    gold = []
    for i in range(5):
        sp = lathe('sp', [(0, 0.04), (0.16, 0.0)], 4, caps=(True, False))
        sp.location = B((i - 2) * 0.06, 1.12, 0.06 - abs(i - 2) * 0.02)
        apply_tf(sp)
        gold.append(paint(sp, WHITE))
    band = lathe('band', [(1.1, 0.165), (1.135, 0.165)], 16)
    band.location = B(0, 0, 0.02)
    apply_tf(band)
    gold.append(paint(band, WHITE))
    kit('kit_queen_rider', {'skin': skin, 'hair': hair, 'suit': suit, 'gold': gold})

    # ---- Celestial archon (fig space; wings/halberd are separate groups)
    skin, hair = anime_head(0, 1.95, 0, 0.16, hair_len=0.7, hair_spread=0.22, seed=7)
    robe = [robe_skirt(1.15, 0.0, 0.19, 0.42, waves=10, seed=7), torso_shape(1.12, 1.75, 0.18, 0.15, 0.17)]
    silk = [lathe('sash', [(1.06, 0.21), (1.26, 0.2)], 14)]
    tails = tube_mesh('tail', [B(0.05, 1.1, 0.2), B(0.08, 0.8, 0.28), B(0.06, 0.4, 0.3)], [0.06, 0.06, 0.03], 5)
    silk.append(tails)
    for o in silk:
        paint(o, grey(0.7, 1.0, 8))
    pads = []
    for sx in (-1, 1):
        pd = ell(0.11, (sx * 0.2, 1.68, 0), (1.2, 0.7, 1.0), sub=2)
        pads.append(paint(pd, grey(0.8, 1.0, sx)))
    kit('kit_archon', {'skin': skin, 'hair': hair, 'robe': robe, 'silk': silk, 'gold': pads})

    # ---- Eclipse Sovereign: body in fig space, head in head-group space
    armor = [robe_skirt(1.12, 0.0, 0.17, 0.45, waves=6, seed=9), torso_shape(1.1, 1.8, 0.17, 0.13, 0.18)]
    for sx in (-1, 1):
        pd = lathe('pauldron', [(0.0, 0.0), (0.03, 0.1), (0.08, 0.13), (0.12, 0.0)], 8)
        pd.rotation_euler = (0, sx * 0.4, 0)
        pd.location = B(sx * 0.22, 1.66, 0)
        apply_tf(pd)
        armor.append(paint(pd, grey(0.7, 1.0, sx)))
    gold = []
    for y in (1.12, 1.4):
        rg = lathe('trim', [(y - 0.02, 0.18), (y + 0.02, 0.18)], 14)
        gold.append(paint(rg, WHITE))
    kit('kit_sovereign_body', {'armor': armor, 'gold': gold})
    skin, hair = anime_head(0, 0, 0, 0.16, hair_len=1.7, hair_spread=0.4, seed=11)
    kit('kit_sovereign_head', {'skin': skin, 'hair': hair})
    # sovereign sword: blade points down (-y), hilt at +0.7
    sw_armor = [loft('blade', [blade_ring(-1.1, 0.01, 0.01, 1), blade_ring(-0.7, 0.11, 0.03, 0.5), blade_ring(0.6, 0.14, 0.035, 0.5), blade_ring(0.66, 0.15, 0.035, 1)])]
    for o in sw_armor:
        for v in o.data.vertices:
            v.co = Vector(B(v.co.x, v.co.z, -v.co.y))
        o.data.update()
        fix_normals(o)
        paint(o, grey(0.6, 1.0, 1))
    edge = []
    for sx in (-1, 1):
        e = tube_mesh('edge', [B(sx * 0.13, 0.6, 0), B(sx * 0.11, -0.7, 0), B(0, -1.08, 0)], [0.012, 0.012, 0.004], 4)
        edge.append(paint(e, WHITE))
    hg = [box((0.6, 0.12, 0.09), B(0, 0.7, 0), bevel=0.02), cyl(0.035, 0.3, B(0, 0.9, 0), verts=6)]
    for o in hg:
        paint(o, WHITE)
    kit('kit_sov_sword', {'armor': sw_armor, 'flame': edge, 'gold': hg})

    # ---- feather blade (centred on the origin, length 1 along +y): spine + vane
    spine = tube_mesh('spine', [B(0, -0.5, 0), B(0, 0.0, 0.01), B(0, 0.5, 0)], [0.025, 0.02, 0.005], 5, cap_top=True)
    vs = []
    for i in range(7):
        t = i / 6
        y = -0.45 + t * 0.95
        w = 0.17 * math.sin(math.pi * min(1.0, t * 1.1)) + 0.02
        vs.append((y, w))
    verts, faces = [], []
    for i, (y, w) in enumerate(vs):
        verts += [B(-w * 0.35, y, 0), B(w, y - 0.04, 0.0)]
        if i:
            k = i * 2
            faces.append((k - 2, k - 1, k + 1, k))
    vane = mesh('vane', verts, faces)
    modify(vane, 'SOLIDIFY', thickness=0.02, offset=0)
    fix_normals(vane)
    kit('kit_feather', {'spine': [paint(spine, WHITE)], 'vane': [paint(vane, lambda p, n, pc: (lambda k: (k, k, k))(0.8 + 0.2 * math.sin(p.z * 60) ** 2))]})

    # ---- halberd (archon): shaft centred at y 0.2 (len 2.4), head at 1.5
    shaft = cyl(0.028, 2.4, B(0, 0.2, 0), rot=(math.pi / 2, 0, 0), verts=8)
    paint(shaft, grey(0.7, 1.0, 1))
    wraps = []
    for y in (-0.6, 0.0, 0.9):
        w = cyl(0.036, 0.08, B(0, y, 0), rot=(math.pi / 2, 0, 0), verts=8)
        wraps.append(paint(w, (lambda p, n, pc: (0.6, 0.6, 0.6))))
    head = loft('spear', [blade_ring(1.3, 0.03, 0.02, 1), blade_ring(1.45, 0.1, 0.03, 1), blade_ring(1.85, 0.0, 0.0, 1)])
    for v in head.data.vertices:
        v.co = Vector(B(v.co.x, v.co.z, -v.co.y))
    head.data.update()
    fix_normals(head)
    axe = mesh('axe', [B(0.02, 1.32, 0), B(0.32, 1.42, 0), B(0.36, 1.1, 0), B(0.02, 1.15, 0)], [(0, 1, 2, 3)])
    modify(axe, 'SOLIDIFY', thickness=0.03, offset=0)
    fix_normals(axe)
    guard = cyl(0.07, 0.06, B(0, 1.27, 0), rot=(math.pi / 2, 0, 0), verts=8)
    kit('kit_halberd', {'silk': [shaft] + wraps, 'gold': [paint(head, grey(0.8, 1.0, 1)), paint(axe, grey(0.8, 1.0, 2)), paint(guard, WHITE)]})

    # ---- prism guard: torso/skirt/head armour + gold pauldrons (body space)
    armor = []
    t = lathe('torso', [(0.85, 0.15), (1.0, 0.2), (1.35, 0.26), (1.55, 0.25), (1.72, 0.16)], 6, math.pi / 6)
    paint(t, grey(0.78, 1.0, 1))
    armor.append(t)
    sk = lathe('skirt', [(0.45, 0.36), (0.6, 0.3), (0.95, 0.17)], 6, math.pi / 6, caps=(False, True))
    fix_normals(sk)
    armor.append(paint(sk, grey(0.75, 1.0, 2)))
    hm = lathe('helm', [(1.7, 0.08), (1.75, 0.16), (1.9, 0.19), (2.02, 0.15), (2.1, 0.0)], 6, math.pi / 6)
    armor.append(paint(hm, grey(0.8, 1.0, 3)))
    crest = mesh('crest', [B(0, 2.08, -0.15), B(0, 2.35, -0.05), B(0, 2.05, 0.12)], [(0, 1, 2)])
    modify(crest, 'SOLIDIFY', thickness=0.03, offset=0)
    gold = [paint(crest, WHITE)]
    for sx in (-1, 1):
        pd = lathe('pd', [(0, 0.2), (0.1, 0.17), (0.2, 0.0)], 4, math.pi / 4)
        pd.rotation_euler = (0, sx * 0.7, 0)
        pd.location = B(sx * 0.36, 1.5, 0)
        apply_tf(pd)
        gold.append(paint(pd, grey(0.8, 1.0, sx)))
    for y in (0.85, 1.35):
        rg = lathe('trim', [(y - 0.02, 0.27 if y > 1 else 0.17), (y + 0.02, 0.27 if y > 1 else 0.17)], 6, math.pi / 6)
        gold.append(paint(rg, WHITE))
    kit('kit_prismguard', {'armor': armor, 'gold': gold})
    # prism blade group (blade points down, gold body + glow edge)
    bl = loft('pb', [blade_ring(0.05, 0.03, 0.03, 1), blade_ring(-0.2, 0.11, 0.035, 1), blade_ring(-0.85, 0.06, 0.025, 1), blade_ring(-1.1, 0.0, 0.0, 1)])
    for v in bl.data.vertices:
        v.co = Vector(B(v.co.x, v.co.z, -v.co.y))
    bl.data.update()
    fix_normals(bl)
    gl = tube_mesh('edge', [B(0.0, -0.3, 0.02), B(0.0, -1.05, 0.02)], [0.02, 0.005], 4)
    kit('kit_prism_blade', {'gold': [paint(bl, grey(0.8, 1.0, 1))], 'glow': [paint(gl, WHITE)]})

    # ---- generic sword for ash blades / cursed blades / Kali orbit blades (size 1)
    bl = loft('blade', [blade_ring(0.04, 0.06, 0.02, 1), blade_ring(0.2, 0.065, 0.02, 0.5), blade_ring(1.45, 0.06, 0.018, 0.5), blade_ring(1.75, 0.0, 0.004, 1)])
    for v in bl.data.vertices:
        v.co = Vector(B(v.co.x, v.co.z, -v.co.y))
    bl.data.update()
    fix_normals(bl)
    paint(bl, lambda p, n, pc: (lambda k: (k, k, k))(0.8 + 0.2 * max(0.0, abs(p.x) * 12 - 0.4)))
    guard = tube_mesh('guard', [B(-0.26, 0.06, 0), B(-0.12, 0.0, 0), B(0.12, 0.0, 0), B(0.26, 0.06, 0)], [0.03, 0.045, 0.045, 0.03], 6, cap_top=True)
    grip = cyl(0.04, 0.4, B(0, -0.23, 0), rot=(math.pi / 2, 0, 0), verts=8)
    pom = blob(0.06, B(0, -0.47, 0), sub=1)
    dk = [paint(guard, WHITE), paint(grip, lambda p, n, pc: (0.7, 0.7, 0.7) if int(p.z * 40) % 2 else (1, 1, 1)), paint(pom, WHITE)]
    kit('kit_blade', {'steel': [bl], 'dark': dk})

    # ---- eclipse core: faceted dark crystal + gold cage (core-local, radius ~0.65)
    cr = prim('ico_sphere', subdivisions=1, radius=0.62)
    for v in cr.data.vertices:
        v.co.z *= 1.35
    cr.data.update()
    paint(cr, lambda p, n, pc: (lambda k: (k, k, k))(0.7 + 0.3 * max(0.0, n.z)))
    cage = []
    for k in range(4):
        a = k / 4 * TAU
        c = tube_mesh('rib', [(0, 0, 0.95), (math.cos(a) * 0.55, math.sin(a) * 0.55, 0.45), (math.cos(a) * 0.62, math.sin(a) * 0.62, -0.2), (0, 0, -0.95)], [0.035, 0.04, 0.04, 0.035], 5)
        cage.append(paint(c, WHITE))
    kit('kit_eclipse_core', {'core': [cr], 'gold': cage})



# ------------------------------------------------------------------ batch 8: hero body kits (joint-local, three.js space)
def limb(pts3, radii, sides=12, sx=1.0, sz=1.0, cap=True):
    """tube through three.js points with an elliptical cross-section (sx across, sz front-back)"""
    t = tube_mesh('limb', [B(*p) for p in pts3], radii, sides, cap_top=cap)
    if sx != 1.0 or sz != 1.0:
        cs = [Vector(B(*p)) for p in pts3]
        for v in t.data.vertices:
            # nearest spine point -> scale the offset in X / Blender-Y
            c = min(cs, key=lambda q: (q - v.co).length)
            d = v.co - c
            v.co = c + Vector((d.x * sx, d.y * sz, d.z))
        t.data.update()
    smooth(t, 70)
    return t


def build_hero_kits():
    sh = lambda lo=0.82, hi=1.0, sd=0: grey(lo, hi, sd, 3.0, 0.7)
    # pelvis (hips joint)
    pel = ell(0.135, (0, -0.005, 0), (1.14, 0.82, 0.88), sub=3)
    gl = [ell(0.075, (sx * 0.055, -0.035, -0.055), (1.0, 1.0, 0.9), sub=2) for sx in (-1, 1)]
    kit('kit_b_pelvis', {'bottom': [paint(o, sh(0.8, 1.0, 1)) for o in [pel] + gl]})
    # waist (spine joint): -0.05 .. 0.17
    rings = []
    for y, r in ((-0.06, 0.122), (0.0, 0.112), (0.06, 0.097), (0.12, 0.1), (0.18, 0.108)):
        rings.append([Vector(B(math.sin(k / 16 * TAU) * r * 1.08, y, math.cos(k / 16 * TAU) * r * 0.84)) for k in range(16)])
    w = loft('waist', rings)
    fix_normals(w)
    smooth(w, 70)
    kit('kit_b_waist', {'waist': [paint(w, sh(0.82, 1.0, 2))]})
    # chest (chest joint) + neck
    rings = []
    for y, r, zf in ((-0.06, 0.11, 0.84), (0.0, 0.125, 0.86), (0.06, 0.13, 0.84), (0.12, 0.12, 0.78), (0.16, 0.09, 0.7), (0.175, 0.05, 0.7)):
        rings.append([Vector(B(math.sin(k / 18 * TAU) * r * 1.1, y, math.cos(k / 18 * TAU) * r * zf)) for k in range(18)])
    c = loft('chest', rings)
    fix_normals(c)
    smooth(c, 70)
    bust = [ell(0.058, (sx * 0.055, 0.025, 0.065), (1.0, 0.92, 0.75), sub=2) for sx in (-1, 1)]
    neck = limb([(0, 0.12, -0.005), (0, 0.17, 0.0), (0, 0.225, 0.005)], [0.052, 0.044, 0.04], 10)
    kit('kit_b_chest', {'chest': [paint(o, sh(0.82, 1.0, 3)) for o in [c] + bust], 'skin': [paint(neck, sh(0.8, 0.95, 4))]})
    # upper arm (arm joint): shoulder ball + arm to -0.24
    shd = ell(0.054, (0, 0, 0), (1.0, 1.0, 1.0), sub=2)
    ua = limb([(0, 0.0, 0), (0, -0.08, 0.004), (0, -0.17, 0.0), (0, -0.245, -0.004)], [0.047, 0.046, 0.041, 0.037], 10, 1.0, 0.92)
    kit('kit_b_upperarm', {'shoulder': [paint(shd, sh(0.82, 1.0, 5))], 'upper': [paint(ua, sh(0.82, 1.0, 6))]})
    # forearm (elbow joint)
    eb = ell(0.041, (0, 0, -0.004), sub=2)
    fa = limb([(0, 0.0, 0), (0, -0.06, 0.006), (0, -0.16, 0.002), (0, -0.235, 0)], [0.041, 0.043, 0.035, 0.03], 10, 1.0, 0.86)
    kit('kit_b_forearm', {'forearm': [paint(o, sh(0.82, 1.0, 7)) for o in (eb, fa)]})
    # hand (hand joint): palm thin along X, fingers pointing down, thumb forward
    hand = [ell(0.04, (0, -0.04, 0.0), (0.55, 1.05, 0.95), sub=2)]
    for i in range(4):
        z = -0.022 + i * 0.015
        L = (0.05, 0.056, 0.053, 0.043)[i]
        hand.append(limb([(0, -0.07, z), (0.004, -0.07 - L * 0.55, z + 0.002), (0.008, -0.07 - L, z)], [0.009, 0.008, 0.006], 6))
    hand.append(limb([(0.005, -0.03, 0.03), (0.012, -0.06, 0.045), (0.018, -0.085, 0.05)], [0.011, 0.009, 0.007], 6))
    kit('kit_b_hand', {'hand': [paint(o, sh(0.85, 1.0, 8)) for o in hand]})
    # thigh (leg joint) 0 .. -0.38
    th = limb([(0, 0.02, 0), (0, -0.08, 0.008), (0, -0.2, 0.006), (0, -0.33, 0.0), (0, -0.385, 0)], [0.08, 0.077, 0.068, 0.058, 0.055], 12, 1.0, 1.05)
    kit('kit_b_thigh', {'thigh': [paint(th, sh(0.82, 1.0, 9))]})
    # knee + shin (knee joint) 0 .. -0.34
    kn = ell(0.056, (0, 0, 0.004), (1.0, 1.0, 1.05), sub=2)
    sn = limb([(0, 0.0, 0), (0, -0.09, -0.008), (0, -0.2, -0.004), (0, -0.33, 0.0), (0, -0.36, 0.0)], [0.053, 0.055, 0.046, 0.036, 0.034], 12, 1.0, 1.0)
    kit('kit_b_shin', {'knee': [paint(kn, sh(0.82, 1.0, 10))], 'shin': [paint(sn, sh(0.82, 1.0, 11))]})
    # shoe (foot joint): sole at -0.075, toe forward
    shoe = []
    body = ell(0.07, (0, -0.035, 0.04), (0.8, 0.62, 1.65), sub=3)
    for v in body.data.vertices:
        if v.co.z < -0.072:
            v.co.z = -0.072
    body.data.update()
    shoe.append(paint(body, sh(0.82, 1.0, 12)))
    cuff = limb([(0, -0.03, -0.005), (0, 0.025, -0.004)], [0.045, 0.043], 10, 1.0, 1.0)
    shoe.append(paint(cuff, sh(0.8, 1.0, 13)))
    sole = box((0.105, 0.25, 0.022), B(0, -0.078, 0.035), bevel=0.008)
    shoe.append(paint(sole, lambda p, n, pc: (0.62, 0.62, 0.62)))
    kit('kit_b_shoe', {'shoe': shoe})

    # ---- hair (head-local, before the head group's 1.2 scale). Face stays open.
    hair, side, hair2 = [], [], []
    cap = ell(0.133, (0, 0.108, -0.014), (1.05, 1.04, 1.06), sub=3)
    for v in cap.data.vertices:
        x, y3, z3 = v.co.x, v.co.z, -v.co.y
        if z3 > 0.02 and y3 < 0.17:
            # pull the front-lower part back behind the face
            v.co.y = -(z3 - 0.11 * min(1.0, (0.17 - y3) / 0.06))
    cap.data.update()
    hair.append(paint(cap, sh(0.75, 1.0, 1)))
    for i in range(7):
        x = (i - 3) * 0.031
        L = 0.075 + (0.03 if i in (1, 4) else 0) + (0.01 if i == 3 else 0)
        z0 = 0.103 - abs(i - 3) * 0.012
        b = limb([(x * 0.85, 0.2, z0 - 0.03), (x, 0.17, z0 + 0.012), (x * 1.08, 0.17 - L, z0 + 0.008)], [0.026, 0.022, 0.004], 6)
        (hair2 if i == 2 else hair).append(paint(b, sh(0.75, 1.0, 10 + i)))
    for sx in (-1, 1):
        lk = limb([(sx * 0.105, 0.12, 0.05), (sx * 0.118, 0.04, 0.055), (sx * 0.11, -0.08, 0.05)], [0.03, 0.026, 0.004], 6)
        hair.append(paint(lk, sh(0.75, 1.0, 20 + sx)))
    for k in range(9):
        a = (k / 8 - 0.5) * 3.4
        sx_, sz_ = math.sin(a), -math.cos(a)
        lk = limb([(sx_ * 0.12, 0.17, sz_ * 0.11 - 0.015), (sx_ * 0.138, 0.08, sz_ * 0.13 - 0.02), (sx_ * 0.13, 0.02, sz_ * 0.12 - 0.025)], [0.035, 0.03, 0.006], 6)
        side.append(paint(lk, sh(0.72, 1.0, 30 + k)))
    kit('kit_b_hair', {'hair': hair, 'side': side, 'hair2': hair2})
    # long back hair: top at y 0, length 1 (game scales Y by hairLen and lifts it to y 0.1)
    lng = []
    for k in range(9):
        a = (k / 8 - 0.5) * 2.2
        sx_, sz_ = math.sin(a), -math.cos(a)
        r0, r1 = 0.13, 0.19
        pts = [(sx_ * r0, 0.0, sz_ * r0 - 0.04), (sx_ * (r0 + 0.03), -0.35, sz_ * (r0 + 0.02) - 0.05), (sx_ * (r1 - 0.01), -0.75, sz_ * (r1 - 0.03) - 0.05), (sx_ * r1 * 0.9, -1.0, sz_ * (r1 - 0.05) - 0.045)]
        lk = limb(pts, [0.05, 0.055, 0.045, 0.01], 6, 1.0, 0.55)
        lng.append(paint(lk, sh(0.72, 1.0, 40 + k)))
    kit('kit_b_hairlong', {'side': lng})



def build_companion_kits():
    sh = lambda lo=0.8, hi=1.0, sd=0: grey(lo, hi, sd, 4.0, 0.7)
    # ---- Purr-Bot body (body space): metal shell + lime stripe + bolts
    torso = ell(0.26, (0, 0.42, 0), (1.0, 0.8, 1.38), sub=3)
    for v in torso.data.vertices:
        # flatten into panels a little
        v.co.x = math.copysign(min(abs(v.co.x), 0.24), v.co.x)
    torso.data.update()
    metal = [paint(torso, lambda p, n, pc: (lambda k: (k, k, k))(0.8 + 0.2 * max(0.0, n.z) - (0.18 if abs(math.sin(-p.y * 14)) < 0.08 else 0)))]
    band = ell(0.268, (0, 0.42, 0), (1.0, 0.8, 1.38), sub=3)
    for v in band.data.vertices:
        if abs(v.co.z - 0.42) > 0.07 or v.co.z < 0.42 - 0.03:
            v.co *= 0.98
    band.data.update()
    lime = [paint(band, lambda p, n, pc: (1, 1, 1))]
    for x, z in ((-0.2, 0.25), (0.2, 0.25), (-0.2, -0.25), (0.2, -0.25)):
        b = cyl(0.025, 0.02, B(x * 1.15, 0.55, z), verts=6)
        metal.append(paint(b, lambda p, n, pc: (0.6, 0.6, 0.6)))
    vent = box((0.16, 0.12, 0.02), B(0, 0.62, -0.2), bevel=0.01)
    dark = [paint(vent, WHITE)]
    kit('kit_purr_body', {'metal': metal, 'lime': lime, 'dark': dark})
    # head (head space)
    sk = ell(0.21, (0, 0, -0.01), (1.15, 0.95, 1.0), sub=3)
    for v in sk.data.vertices:
        if -v.co.y > 0.15:   # flatter faceplate
            v.co.y = -0.15 - (-v.co.y - 0.15) * 0.3
    sk.data.update()
    hm = [paint(sk, sh(0.8, 1.0, 1))]
    cheek = [ell(0.06, (sx * 0.17, -0.05, 0.08), (1.0, 0.8, 0.9), sub=2) for sx in (-1, 1)]
    hm += [paint(c, sh(0.8, 1.0, 2)) for c in cheek]
    ears, inner = [], []
    for sx in (-1, 1):
        base, tip = Vector(B(sx * 0.13, 0.15, -0.02)), Vector(B(sx * 0.19, 0.33, -0.03))
        d = (tip - base).normalized()
        e = lathe('ear', [(0, 0.085), (0.19, 0.0)], 4, math.pi / 4, caps=(True, False))
        e.rotation_euler = Vector((0, 0, 1)).rotation_difference(d).to_euler()
        e.location = base
        apply_tf(e)
        ears.append(paint(e, sh(0.8, 1.0, 3)))
        i_ = lathe('in', [(0.02, 0.05), (0.15, 0.0)], 4, math.pi / 4, caps=(True, False))
        i_.rotation_euler = e.rotation_euler.copy()
        i_.location = base + Vector(B(0, 0, 0.03))
        apply_tf(i_)
        inner.append(paint(i_, WHITE))
    visor = box((0.32, 0.02, 0.13), B(0, 0.03, 0.2), bevel=0.02)
    kit('kit_purr_head', {'metal': hm, 'lime': ears, 'dark': inner + [paint(visor, WHITE)]})
    # leg (leg group space): piston + paw
    up = limb([(0, 0.02, 0), (0, -0.14, 0.01)], [0.05, 0.045], 8)
    lo = limb([(0, -0.14, 0.01), (0, -0.27, 0)], [0.035, 0.033], 8)
    jt = ell(0.045, (0, -0.14, 0.01), sub=2)
    paw = ell(0.065, (0, -0.3, 0.02), (1.0, 0.6, 1.25), sub=2)
    toes = [ell(0.022, (x, -0.31, 0.08), (1, 0.8, 1), sub=1) for x in (-0.03, 0, 0.03)]
    kit('kit_purr_leg', {'dark': [paint(o, sh(0.75, 1.0, 4)) for o in (up, lo, jt)], 'lime': [paint(o, sh(0.8, 1.0, 5)) for o in [paw] + toes]})
    # tail (tail group space): segmented, glowing tip kept separately in game
    segs = []
    for k in range(5):
        y0 = k * 0.08
        sg = limb([(0, y0, 0), (0, y0 + 0.065, 0)], [0.036 - k * 0.003, 0.032 - k * 0.003], 8)
        segs.append(paint(sg, sh(0.75, 1.0, k)))
    kit('kit_purr_tail', {'metal': segs})

    # ---- Luby sneaker (foot space): lime upper, white sole, dark laces, limeDark cuff
    up = ell(0.1, (0, -0.012, 0.045), (0.62, 0.5, 1.28), sub=3)
    for v in up.data.vertices:
        if v.co.z < -0.052:
            v.co.z = -0.052
    up.data.update()
    sole = []
    sl = ell(0.105, (0, -0.06, 0.045), (0.64, 0.14, 1.3), sub=2)
    sole.append(paint(sl, lambda p, n, pc: (lambda k: (k, k, k))(0.85 + 0.15 * max(0.0, n.z))))
    toe = ell(0.06, (0, -0.035, 0.135), (1.0, 0.55, 0.7), sub=2)
    sole.append(paint(toe, WHITE))
    laces = []
    for i in range(3):
        l = box((0.07, 0.012, 0.01), B(0, 0.022 - i * 0.012, 0.085 + i * 0.02), rot=(0.6, 0, 0))
        laces.append(paint(l, WHITE))
    cuff = limb([(0, -0.012, 0.0), (0, 0.035, 0.0)], [0.062, 0.06], 12)
    kit('kit_luby_shoe', {'lime': [paint(up, sh(0.82, 1.0, 6))], 'white': sole, 'dark': laces, 'limeDark': [paint(cuff, sh(0.8, 1.0, 7))]})



def build_misc_kits():
    sh = lambda lo=0.8, hi=1.0, sd=0: grey(lo, hi, sd, 3.0, 0.7)
    # ---- chibi story NPC body (body space, feet at y 0)
    outfit, accent = [], []
    for sx in (-1, 1):
        lg = limb([(sx * 0.08, 0.06, 0), (sx * 0.08, 0.4, 0.01), (sx * 0.082, 0.8, 0)], [0.045, 0.055, 0.068], 10)
        outfit.append(paint(lg, sh(0.8, 1.0, sx)))
        bt = ell(0.08, (sx * 0.08, 0.05, 0.03), (0.78, 0.72, 1.4), sub=2)
        for v in bt.data.vertices:
            if v.co.z < 0.0:
                v.co.z = 0.0
        bt.data.update()
        accent.append(paint(bt, sh(0.8, 1.0, sx + 2)))
        cuff = limb([(sx * 0.08, 0.08, 0), (sx * 0.08, 0.16, 0)], [0.058, 0.055], 10)
        accent.append(paint(cuff, sh(0.8, 1.0, sx + 4)))
    hips = ell(0.14, (0, 0.82, 0), (1.12, 0.8, 0.86), sub=3)
    outfit.append(paint(hips, sh(0.8, 1.0, 5)))
    rings = []
    for y, r in ((0.8, 0.135), (0.92, 0.115), (1.02, 0.11), (1.12, 0.13), (1.2, 0.12), (1.25, 0.06)):
        rings.append([Vector(B(math.sin(k / 16 * TAU) * r * 1.08, y, math.cos(k / 16 * TAU) * r * 0.82)) for k in range(16)])
    tor = loft('torso', rings)
    fix_normals(tor)
    smooth(tor, 70)
    outfit.append(paint(tor, sh(0.8, 1.0, 6)))
    skirt = robe_skirt(0.9, 0.62, 0.13, 0.22, sides=16, waves=8, seed=3)
    outfit.append(skirt)
    belt = lathe('belt', [(0.86, 0.135), (0.91, 0.128)], 16)
    accent.append(paint(belt, sh(0.8, 1.0, 7)))
    collar = lathe('collar', [(1.2, 0.09), (1.25, 0.075), (1.27, 0.05)], 14)
    accent.append(paint(collar, sh(0.8, 1.0, 8)))
    kit('kit_npc_body', {'outfit': outfit, 'accent': accent})
    # arm (arm-group space, shoulder at 0)
    ua = limb([(0, 0.02, 0), (0, -0.15, 0.005), (0, -0.33, 0)], [0.05, 0.044, 0.04], 10)
    gl = limb([(0, -0.3, 0), (0, -0.45, 0.004)], [0.05, 0.046], 10)
    hd = ell(0.045, (0, -0.5, 0.005), (0.7, 1.1, 0.95), sub=2)
    kit('kit_npc_arm', {'skin': [paint(ua, sh(0.82, 1.0, 1))], 'accent': [paint(gl, sh(0.8, 1.0, 2)), paint(hd, sh(0.8, 1.0, 3))]})

    # ---- wind glider (glider-group space; bar along X at y 1.75, sail forward/above)
    sail, frame = [], []
    for sx in (-1, 1):
        verts, faces = [], []
        nu, nv = 6, 3
        for j in range(nv + 1):
            for i in range(nu + 1):
                u, v = i / nu, j / nv
                x = sx * (0.05 + u * 1.3)
                zf = 0.5 - u * 0.25 - v * (0.55 - u * 0.28)      # leading edge forward (+z)
                y = 1.95 + 0.12 * math.sin(math.pi * v) - u * 0.12 + 0.05 * math.sin(math.pi * u)
                verts.append(B(x, y, zf))
        for j in range(nv):
            for i in range(nu):
                a = j * (nu + 1) + i
                faces.append((a, a + 1, a + nu + 2, a + nu + 1))
        w = mesh('sail', verts, faces)
        modify(w, 'SOLIDIFY', thickness=0.012, offset=0)
        fix_normals(w)
        sail.append(paint(w, lambda p, n, pc: (lambda k: (k, k, k))(0.75 if int(abs(p.x) * 4) % 2 else 1.0)))
        le = limb([(sx * 0.05, 1.95, 0.5), (sx * 0.7, 1.92, 0.36), (sx * 1.35, 1.83, 0.25)], [0.022, 0.02, 0.015], 6)
        frame.append(paint(le, WHITE))
        for k in range(3):
            u = (k + 1) / 4
            x = sx * (0.05 + u * 1.3)
            rb = limb([(x, 1.96 - u * 0.12 + 0.05 * math.sin(math.pi * u), 0.5 - u * 0.25), (x, 1.95 - u * 0.12, 0.5 - u * 0.25 - (0.55 - u * 0.28))], [0.01, 0.008], 5)
            frame.append(paint(rb, WHITE))
    keel = limb([(0, 1.97, 0.55), (0, 1.97, -0.1)], [0.022, 0.02], 6)
    frame.append(paint(keel, WHITE))
    for sx in (-1, 1):
        st = limb([(sx * 0.02, 1.95, 0.2), (sx * 0.5, 1.75, 0.05)], [0.012, 0.012], 5)
        frame.append(paint(st, WHITE))
    bar = limb([(-0.55, 1.75, 0.05), (0.55, 1.75, 0.05)], [0.02, 0.02], 8)
    grips = [limb([(sx * 0.42, 1.75, 0.05), (sx * 0.52, 1.75, 0.05)], [0.028, 0.028], 8) for sx in (-1, 1)]
    kit('kit_glider', {'sail': sail, 'bar': [paint(bar, WHITE)] + [paint(g, lambda p, n, pc: (0.6, 0.6, 0.6)) for g in grips] + frame})

    # ---- mecha part: cog facing +z (game), radius ~0.42
    cg = gear(0.42, 0.34, 0.12, 10, 0.12, (0, 0, 0), rot=(math.pi / 2, 0, 0))
    paint(cg, lambda p, n, pc: (lambda k: (k, k, k))(0.75 + 0.25 * abs(n.y)))
    bolts = []
    for k in range(5):
        a = k / 5 * TAU
        b = cyl(0.03, 0.15, (math.cos(a) * 0.23, 0, math.sin(a) * 0.23), rot=(math.pi / 2, 0, 0), verts=6)
        bolts.append(paint(b, lambda p, n, pc: (0.55, 0.55, 0.55)))
    kit('kit_mecha_part', {'metal': [cg] + bolts})

    # ---- fire-pepper bush (leaves) + pepper pod (geometry swap)
    lv = []
    rnd = random.Random(6)
    for k in range(7):
        a = k / 7 * TAU + rnd.uniform(0, 0.4)
        r = 0 if k == 0 else rnd.uniform(0.22, 0.32)
        b = blob(0.26 if k == 0 else 0.2, (math.cos(a) * r, math.sin(a) * r, 0.35 + (0.12 if k == 0 else rnd.uniform(-0.05, 0.08))), (1.0, 1.0, 0.85), sub=1, amp=0.3, seed=k)
        lv.append(paint(b, sh(0.7, 1.0, k)))
    stem = limb([(0, 0.0, 0), (0, 0.3, 0)], [0.04, 0.03], 6)
    lv.append(paint(stem, lambda p, n, pc: (0.5, 0.5, 0.5)))
    kit('kit_pepper_bush', {'bush': lv})
    pod = lathe('pod', [(-0.12, 0.0), (-0.09, 0.035), (0.0, 0.055), (0.08, 0.05), (0.12, 0.03)], 8,
                rfn=lambda a, z, r: r * (1 + 0.1 * math.cos(a * 3)), caps=(False, True))
    for v in pod.data.vertices:
        v.co.x += 0.03 * ((v.co.z + 0.12) / 0.24) ** 2
    pod.data.update()
    cap = limb([(0.0, 0.12, 0), (0.0, 0.17, 0.01)], [0.03, 0.01], 6)
    for o in (pod,):
        paint(o, WHITE)
    paint(cap, lambda p, n, pc: (0.4, 0.4, 0.4))
    export('pepper', [join([pod, cap], 'pepper', 50)])



def build_luby_kits():
    sh = lambda lo=0.8, hi=1.0, sd=0: grey(lo, hi, sd, 3.0, 0.7)
    # ---- hoodie sleeve: upper arm (arm joint) and forearm (elbow joint)
    shd = ell(0.066, (0, 0, 0), (1.0, 1.0, 1.0), sub=2)
    up = limb([(0, 0.0, 0), (0, -0.12, 0.003), (0, -0.24, 0)], [0.06, 0.059, 0.062], 12)
    kit('kit_luby_upperarm', {'lime': [paint(shd, sh(0.82, 1.0, 1)), paint(up, sh(0.8, 1.0, 2))]})
    eb = ell(0.063, (0, 0, 0), sub=2)
    fa = lathe('sleeve', [(-0.21, 0.083), (-0.17, 0.08), (-0.08, 0.07), (0.0, 0.064)], 14,
               rfn=lambda a, z, r: r * (1 + (0.04 * math.sin(a * 5) if z < -0.15 else 0)), caps=(False, True))
    fix_normals(fa)
    smooth(fa, 60)
    cuff = lathe('cuff', [(-0.225, 0.074), (-0.21, 0.086), (-0.18, 0.084), (-0.17, 0.07)], 14)
    kit('kit_luby_forearm', {'lime': [paint(eb, sh(0.82, 1.0, 3)), paint(fa, sh(0.78, 1.0, 4))], 'limeDark': [paint(cuff, sh(0.8, 1.0, 5))]})
    # ---- cat paw (hand joint): mitt + glowing pads + toe beans + claws, pads face +z
    mitt = ell(0.08, (0, -0.03, 0.005), (1.0, 0.98, 0.88), sub=3)
    for v in mitt.data.vertices:
        if -v.co.y > 0.04:     # flatten the palm side a touch
            v.co.y = -0.04 - (-v.co.y - 0.04) * 0.6
    mitt.data.update()
    lime = [paint(mitt, sh(0.82, 1.0, 6))]
    glow = []
    pad = ell(0.033, (0, -0.03, 0.068), (1.15, 0.95, 0.4), sub=2)
    glow.append(paint(pad, WHITE))
    white = []
    for i in range(4):
        a = (i - 1.5) * 0.42
        bx, bz = math.sin(a) * 0.056, math.cos(a) * 0.036 + 0.022
        bean = ell(0.024, (bx, -0.088, bz), (1.0, 0.9, 1.0), sub=2)
        lime.append(paint(bean, sh(0.82, 1.0, 7 + i)))
        dot = ell(0.012, (bx, -0.093, bz + 0.016), (1.0, 0.8, 0.5), sub=1)
        glow.append(paint(dot, WHITE))
        cl = limb([(bx, -0.1, bz + 0.012), (bx, -0.118, bz + 0.026)], [0.007, 0.001], 5)
        white.append(paint(cl, WHITE))
    kit('kit_luby_paw', {'lime': lime, 'glow': glow, 'white': white})
    # ---- cat hood shell (hood group space; sphere radius 0.152 kept so the mecha eyes still sit on it)
    R = 0.152
    sp = prim('uv_sphere', segments=56, ring_count=28, radius=R)
    bm = bmesh.new()
    bm.from_mesh(sp.data)
    kill = []
    for f in bm.faces:
        c = f.calc_center_median()
        x3, y3, z3 = c.x, c.z, -c.y
        if (z3 > 0.03 and y3 < 0.075 - 0.25 * max(0.0, abs(x3) - 0.02)) or y3 < -0.11:
            kill.append(f)
    bmesh.ops.delete(bm, geom=kill, context='FACES')
    bm.to_mesh(sp.data)
    bm.free()
    modify(sp, 'SOLIDIFY', thickness=0.012, offset=-1)
    fix_normals(sp)
    smooth(sp, 50)
    shell = [paint(sp, lambda p, n, pc: (lambda k: (k, k, k))(0.82 + 0.18 * max(0.0, n.z) - (0.12 if abs(p.x) < 0.006 and p.z > 0.05 else 0)))]
    deep, wh = [], []
    for sx in (-1, 1):
        base = Vector(B(sx * 0.09, 0.12, -0.01))
        tip = Vector(B(sx * 0.15, 0.255, -0.03))
        d = (tip - base).normalized()
        ear = lathe('ear', [(0, 0.066), (0.06, 0.05), (0.14, 0.0)], 4, math.pi / 4, caps=(True, False))
        ear.rotation_euler = Vector((0, 0, 1)).rotation_difference(d).to_euler()
        ear.location = base
        apply_tf(ear)
        smooth(ear, 30)
        shell.append(paint(ear, sh(0.8, 1.0, 12 + sx)))
        inn = lathe('in', [(0.015, 0.04), (0.11, 0.0)], 4, math.pi / 4, caps=(True, False))
        inn.rotation_euler = ear.rotation_euler.copy()
        inn.location = base + Vector(B(0, 0, 0.032))
        apply_tf(inn)
        deep.append(paint(inn, WHITE))
        bolt = cyl(0.013, 0.012, B(sx * 0.062, 0.135, 0.062), rot=(math.pi / 2 - 0.8, 0, 0), verts=8)
        wh.append(paint(bolt, WHITE))
        seam = limb([(sx * 0.05, 0.14, 0.08), (sx * 0.13, 0.06, 0.02)], [0.004, 0.004], 4)
        deep.append(paint(seam, WHITE))
    kit('kit_luby_hood', {'lime': shell, 'limeDeep': deep, 'white': wh})


ASSETS = {
    'sunbeam_rock': build_sunbeam_rock,
    'tent': build_tent,
    'campfire': build_campfire,
    'log_seat': build_log_seat,
    'workbench': build_workbench,
    'tree_roots': build_tree_roots,
    'rocks': build_rocks,
    'mushrooms': build_mushrooms,
    'stump': build_stump,
    'fallen_log': build_fallen_log,
    'den_pillars': build_den_pillars,
    'reef_ruins': build_reef_ruins,
    'asgard': build_asgard,
    'kali_altar': build_kali_altar,
    'frost': build_frost,
    'citadel': build_citadel,
    'lair_crystals': build_lair_crystals,
    'chest': build_chest,
    'fish_crate': build_fish_crate,
    'reef_props': build_reef_props,
    'volcano_props': build_volcano_props,
    'frost_props': build_frost_props,
    'realms': build_realms,
    'misc_props': build_misc_props,
    'enemy_kits': build_enemy_kits,
    'boss_kits': build_boss_kits,
    'hero_kits': build_hero_kits,
    'companion_kits': build_companion_kits,
    'misc_kits': build_misc_kits,
    'luby_kits': build_luby_kits,
}

for name, fn in ASSETS.items():
    if ONLY and name not in ONLY:
        continue
    reset()
    fn()
print('[props] done ->', OUT)
