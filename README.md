# Euphoria Adventure

Game 3D open-world action RPG (web) — spin-off dari Euphoria Online. Karakter pertama: **Luby**.
Konsep & roadmap: [`GAME_DESIGN.md`](GAME_DESIGN.md).

## Jalankan

```bash
npm install
npm run dev        # buka http://localhost:5173
```

Tes di iPhone/Android (satu Wi-Fi): `npm run dev` lalu buka alamat `Network:` yang tampil di terminal.

Build produksi: `npm run build` → folder `dist/` (bisa di-host statis, atau dibungkus Capacitor untuk app).

## Kontrol

| PC | HP |
|---|---|
| WASD gerak, mouse kamera (klik layar dulu untuk mengunci kursor) | Joystick kiri, geser layar untuk kamera |
| Klik kiri serang (tahan = charged, di udara = plunge) · E skill · Q burst · Tab/klik tengah lock-on | Tombol 🐾 (tahan = charged) / E / Q / 🎯 |
| Spasi lompat (2x = Cat Leap, 3x = glider) · Shift lari · Klik kanan/Ctrl dash | ⤒ · ⚡ · » |
| 1–4 ganti hero (atur party di menu ☰) · F interaksi · Z berry · X ikan · C Ikan Bakar · V Jus Sejuk · B Sup Pedas · Esc menu · scroll zoom | Tap potret hero di kanan · tombol F muncul saat dekat objek |

Progres tersimpan otomatis di browser (localStorage).
