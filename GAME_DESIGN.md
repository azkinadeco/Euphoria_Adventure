# Euphoria Adventure — Konsep Game

> Spin-off 3D open-world dari **Euphoria Online** (gacha RPG Godot di `Aetheria_Foundation105_ProductionLayer_FullCinematics`).
> Karakter, dunia, dan alur cerita diambil dari game itu; gameplay diubah jadi action RPG open-world dengan elemen survival.

## 1. Pilar desain

| Pilar | Artinya |
|---|---|
| **Jelajah** | Dunia terbuka yang bisa dijelajahi bebas: hutan, danau, gunung, reruntuhan. Penanda quest ◆, minimap, siklus siang–malam. |
| **Aksi real-time** | Serangan biasa 3-hit, Skill (E), Burst (Q), dash dengan i-frame, lompat ganda. Musuh punya telegraph (lingkaran merah). |
| **Survival ringan** | Lapar turun pelan-pelan → makan berry/ikan. Stamina untuk lari, dash, Cat Leap. Istirahat di api unggun = pulih + simpan. |
| **Cerita & karakter** | Dialog bergaya visual novel memakai potret asli dari Euphoria Online; naskah mengadaptasi Arc 1. |
| **Web dulu, mobile nanti** | Three.js + Vite. Kontrol sentuh sudah ada. Nanti dibungkus Capacitor → iOS/Android. |

## 2. Premis cerita (adaptasi)

Di Euphoria Online, pemain adalah **Commander** yang memimpin para hero melawan **Eclipse**.
Di *Adventure*, sudut pandangnya dibalik:

> Setelah sinyal Eclipse pertama muncul, **Commander menghilang ke dalam Aether**.
> Mora (penjaga waktu) merasakan masa depan mulai retak dan mulai mengumpulkan para hero yang tersebar di benua Euphoria.
> Pemain mengendalikan hero secara langsung — dimulai dari **Luby** — dan tiap bab membuka hero baru yang bisa dimainkan (ganti hero dalam party).

Ini menjaga semua arc asli tetap bisa dipakai:

| Arc asli | Di Adventure |
|---|---|
| Arc 1 — 6 chapter (Whispering Woods → Celestial Asgard) | Region 1–6 open-world. **Prolog = Whispering Woods** (sudah dibuat). |
| Arc 2 — The Second Eclipse (Kali, Abadonia, Zennyo, Vexira jadi bos) | Bos "Corrupted Hero" → setelah kalah, mereka jadi karakter yang bisa dimainkan. |
| Arc 3 — The Hour of Dawn (Mirror Hero dari masa depan) | Dungeon "Fracture" dengan versi mirror. |
| Arc 4–7 | Ekspansi region (Hollow Tide, Starbound, Echoes of the First Oath, Ashes of Abaddon). |

Komitmen yang dijaga: **Commander tetap jadi poros emosional**. Pertemuan kembali dengan Commander = klimaks Arc 1.

## 3. Prolog — Whispering Woods (sudah bisa dimainkan)

| # | Quest | Isi |
|---|---|---|
| 0 | Prolog | Luby tidur siang di Sunbeam Rock. Rubah ungu menghancurkan robot kucingnya, **Purr-Bot**. |
| 1 | Onderdil yang Hilang | Kumpulkan 3 onderdil (Purr-Core, Servo Ekor, Mata Optik), dijaga slime. |
| 2 | Reboot Purr-Bot | Perbaiki di meja kerja → Purr-Bot ikut berjalan & **Burst Q terbuka**. |
| 3 | Jejak Ungu | Bertemu **Mora & Fidelia** di api unggun (dialog dengan pilihan). |
| 4 | Bersihkan Jalan | Kalahkan 8 binatang terkorupsi. |
| 5 | Sarang Nine Tails | Bos **Gumi Wolf · Nine Tails** (2 fase: gigitan, sapuan ekor, foxfire homing, lingkaran foxfire, memanggil rubah). |
| — | Penutup | Kalimat asli: "the corruption came from the sea…" → teaser **Bab 1: Sunken Reef**. |

Dialog yang ditandai `(EO)` di `src/story.js` adalah kalimat yang diambil dari naskah asli (memories, voice_lines, CHAPTERS).

## 4. Karakter pertama — Luby

Dari `character_database.json`, `profiles.json`, `voice_lines.json`, `memories.json`:

- **Gelar:** Mecha Cat Mischief · **Elemen:** WIND · **Kelas:** ASSASSIN · **Tipe:** BURST · warna tema `#8fe63a`
- **Profil:** ulang tahun 22-02, tinggi 152 cm, suka sinar matahari / camilan ikan / ngoprek; tidak suka mandi & vacuum.
- **Model 3D:** dibuat prosedural dari art aslinya — hoodie kucing lime dengan mata mekanik & telinga, simbol Ω, sarung tangan cakar dengan bantalan yang menyala, rambut hitam dengan highlight lime, mata kucing lime, stocking hitam bermotif sirkuit, sneakers lime, ekor mekanik. Toon shading + outline ala anime.

| Input | Kemampuan | Detail |
|---|---|---|
| Klik kiri | **Paw Combo** | 3 cakaran; hit ke-3 = hantaman area + stun kecil. Crit 30% ×1.9 (pasif PRECISION untuk Assassin dari game asli). |
| E | **Mecha-Cat Pounce** (nama skill asli) | Menerkam musuh terdekat dalam 14 m, damage area 240% ATK + stun 1.6 dtk. CD 6 dtk. |
| Q | **Blender Purr Storm** | Purr-Bot berubah jadi tornado 4.5 dtk: menarik & menghantam musuh. Butuh 60 energi. CD 15 dtk. Referensi memory "He purrs. Badly. It sounds like a blender." |
| Spasi ×2 | **Cat Leap** | Lompat ganda dengan salto (10 stamina). |
| Shift / klik kanan | Lari / Dash | Dash punya i-frame. |

Kelucuan dari lore yang jadi gameplay: air dalam memblokir jalan ("Aku benci mandi!"), mati = pose tidur meringkuk ("Just… a nap…"), istirahat di Sunbeam Rock = "tidur siang", camilan ikan = makanan terbaik.

## 4b. Party (v0.2)

Setelah dialog di api unggun, **Fidelia & Mora bergabung**. Tukar hero dengan 1/2/3 (HP: tap potret di kanan). HP, energi, dan cooldown per hero; stamina & lapar dipakai bersama. Hero yang tumbang otomatis diganti; istirahat menghidupkan kembali.

| Hero | Elemen · Kelas | Serangan biasa | E | Q |
|---|---|---|---|---|
| Luby | WIND · Assassin | 3 cakaran | Mecha-Cat Pounce | Blender Purr Storm |
| Fidelia | WATER · Paladin | 3 tebasan pedang | **Tidal Bulwark** (nama asli) — terjang + perisai 25% HP | Valkyrie Tide — gelombang + heal party 25% |
| Mora | LIGHT · Mage | peluru bintang jarak jauh | **Chronos Ring** (nama asli) — zona jam, musuh melambat | Hourglass of Dawn — 3 pilar cahaya, heal 15%, reset cooldown Skill party |

**Reaksi elemen:** skill/burst WATER & LIGHT memberi aura (kristal berwarna di atas musuh).
- **Pusaran** — WIND kena aura WATER/LIGHT → damage area + aura menyebar ke musuh sekitar.
- **Prism** — WATER ↔ LIGHT → damage ×1.75.
- **Purify** — LIGHT +20% ke makhluk terkorupsi.

**Grafis:** Low / Med / High di menu (☰). Mode otomatis menurunkan grafis kalau FPS < 26.

## 4c. Bab 1 — Sunken Reef (v0.3)

Diadaptasi dari Arc 1 · Chapter 2 asli. Region baru **tanpa loading**: pulau laguna di timur, dihubungkan **Jembatan Karang** (~190 m, ada paviliun di tengah). Jembatan tertutup kabut ungu sampai Prolog selesai.

| # | Quest | Isi |
|---|---|---|
| 1 | Jembatan Karang | Seberangi jembatan → bertemu **Scylla & Hyeonxa** (kalimat asli: "The tide is wrong…", "Poison? Hmph. Amateurs."). **Scylla bergabung** (slot 4). |
| 2 | Air yang Salah | Ambil 3 sampel racun dari kolam pasang (dijaga Slime Pelangi & Ubur-ubur Racun). |
| 3 | Menara Karang | Hancurkan 3 Menara Karang terkorupsi (memanggil penjaga saat HP < 60%). |
| 4 | Ratu Laguna | Bos **Slime Queen · Gelatinous Overlord**: lompatan menghantam, hujan racun (genangan DoT), semburan gelembung, **gelombang cincin yang harus dilompati** (fase 2), membelah diri di 66% & 33%. |
| — | Penutup | Kalimat asli "The reef is clean…", "…from a burning citadel." → teaser **Bab 2: Infernal Citadel**. |

**Scylla** (WATER · Assassin, data asli): E **Kraken Ambush** menyergap musuh *terjauh* (+30% crit, sama seperti skill aslinya). Q **Abyss Maw** tentakel 5×. Pasif **Queen of the Deep**: satu-satunya yang bisa **berenang** di air dalam.

**Eksplorasi:** 8 peti harta (2 di hutan, 6 di karang; 2 di pulau kecil yang hanya bisa dicapai dengan berenang) → Mutiara Laut. **Teleport** dari menu ☰ ke titik istirahat yang sudah terbuka.

## 4d. Bab 2 — Infernal Citadel (v0.4)

Diadaptasi dari Arc 1 · Chapter 3 asli. Pulau vulkanik di utara, dicapai lewat **Jalan Obsidian** (terbuka setelah Bab 1). Kabut merah, abu beterbangan, kolam lava (damage besar), gunung berapi berasap.

| # | Quest | Isi |
|---|---|---|
| 1 | Jalan Obsidian | Bertemu **Eropatra & Rumi** di pos depan (kalimat asli "The citadel burns…", "Spirits everywhere. Time for some exorcism!"). Keduanya bergabung. |
| 2 | Arwah yang Tersesat | Sucikan 5 lentera arwah — tiap lentera memanggil 3 Eroghost yang harus dikalahkan. |
| 3 | Tiga Segel Darah | Hancurkan 3 segel di depan gerbang → gerbang benteng terbuka. |
| 4 | Ritual Darah | Bos **Evy Blood Sage** (6 lengan): bola darah homing, hujan darah, **sinar darah berputar**, **tali darah** (menjauh >14 m untuk memutus), teleport, **fase perisai** di 70% & 35% (hancurkan 3 Kristal Darah). Gerbang menutup di belakang pemain. |
| — | Penutup | "The blood ritual is broken!", "…a cold land where souls are frozen in place." → teaser **Bab 3: Frostvale Expanse**. |

**Hero baru** (data asli): **Eropatra** (FIRE · Assassin — *Serpent Empress Fang* menembus garis ke musuh terjauh + Terbakar; Q ular api) dan **Rumi** (DARK · Mage — *Crimson Exorcism* ke musuh terjauh, +80% ke HP < 35%; Q talisman yang memberi "bayaran" bahan makanan).

**Sistem baru:**
- **Atur Party** (menu ☰): 6 hero, pilih 4. HP & energi tiap hero tetap tersimpan saat di cadangan.
- **Reaksi FIRE:** Uap Meledak (FIRE↔WATER ×2.0 / ×1.6), Flare (FIRE↔LIGHT, ledakan area), Pusaran juga menyebarkan api. Status **Terbakar** (damage berkala).
- **Panas:** di pulau vulkanik party kepanasan (lapar cepat, HP turun). **Memasak** di api unggun: 🍢 Ikan Bakar (2🫐 1🐟 → pulih party 35%, tombol C) dan 🧊 Jus Sejuk (3🫐 1🐟 → kebal panas 5 menit, tombol V).
- 4 peti harta baru (total 12).

## 4e. Bab 3 — Frostvale Expanse (v0.5)

Diadaptasi dari Arc 1 · Chapter 4 asli. Tanah salju di barat, dicapai dengan **melompati bongkahan es** di atas laut (terbuka setelah Bab 2). Gunung tinggi dengan **Kuil Aurora** di puncak, danau beku, desa Frostvale, aurora di langit malam.

| # | Quest | Isi |
|---|---|---|
| 1 | Jalur Bongkahan Es | Lompati bongkahan es → bertemu **Valeria & Glytta** (kalimat asli "Welcome to my homeland. Mind the cold…", "So pretty! Like dancing on crystal."). Keduanya bergabung. |
| 2 | Jiwa yang Membeku | Pecahkan 4 balok es berisi warga desa (memanggil Arwah Beku). |
| 3 | Kuil Aurora | Daki gunung (~60 m) dan nyalakan kuil di puncak. |
| 4 | Hantu Danau Beku | **Glide** turun ke danau → bos **Eroghost · Frost Phantom**: pecahan es melingkar, duri es dari tanah, napas beku, menghilang & muncul di dekatmu, **badai salju** di fase 2 (berlindung di dekat anglo api). |
| — | Penutup | "The phantom is gone. Frostvale is free.", "…the northern lights are pointing at the sky… at a rift!", sinyal Gemora → teaser **Bab 4: Void Rift**. |

**Hero baru** (data asli): **Valeria** (ICE · Knight — *Frostvale Judgement* membekukan satu kolom + perisai; Q domain es yang membekukan semua musuh; kebal dingin) dan **Glytta** (WIND · Warrior — *Crystal Waltz* menari menembus barisan; Q pusaran pedang kristal; bergerak lebih cepat & hemat stamina).

**Sistem baru:**
- **Glider:** di udara setelah lompat ganda, tekan lompat lagi. Turun pelan (stamina berkurang). Bisa terbang dari puncak ke pulau es rahasia.
- **Aturan air diperbarui:** air dalam memblokir saat berjalan, tapi boleh dilompati/di-glide. Kalau tercebur → kembali ke daratan terakhir.
- **Dingin:** di Frostvale party kedinginan (HP & stamina turun) kecuali di dekat api/anglo atau setelah makan 🍲 **Sup Pedas** (1🫐 1🐟 1🌶️, tombol B). 🌶️ **Cabai Api** dipetik di pulau vulkanik.
- **Reaksi ICE:** Freeze (ICE↔WATER, musuh membeku) dan Lebur (ICE↔FIRE ×2.0 / ×1.5).
- **Performa:** *light pool* (hanya 3–6 lampu nyata yang mengikuti sumber cahaya terdekat), AI musuh yang jauh (>120 m) dijeda, kamera tidak menembus rumah/menara.
- 4 peti harta baru (total 16), teleport ke Desa Frostvale & Kuil Aurora.

## 4f. Grafik HD (v0.6)

| Fitur | Detail |
|---|---|
| Post-processing HDR | Bloom (lava, api, kristal, kunang-kunang, matahari, efek skill), tone mapping Neutral, color grading ala anime + vignette, MSAA 4× (High/Ultra) atau FXAA (Med) |
| Ambient occlusion | GTAO di preset Ultra (bayangan kontak di rumput, pohon, karakter) |
| Air | Warna dangkal→dalam dari peta kedalaman dasar laut, buih pantai, kaustik di air dangkal, pantulan langit (Fresnel), kilau matahari di ombak |
| Langit | Awan billboard lembut berlapis yang ikut warna senja/malam, matahari & bulan dengan glow |
| Rumput | Karpet rumput lebat (hingga ~30 rb rumpun) yang mengikuti pemain + bergoyang ditiup angin |
| Tanah | Detail butiran prosedural di semua terrain |
| Karakter | Rim light anime, cel-shading 4 tingkat, highlight rambut, bayangan 4K (Ultra) |
| Kehidupan | Kupu-kupu, kunang-kunang (malam), burung terbang berkelompok, daun berguguran, ikan melompat di laguna |
| Preset | Low / Med / High / **Ultra**; otomatis turun satu tingkat kalau FPS < 26 |

## 4g. Combat v0.7 + Elite + Starlight Rift

| Fitur | Cara pakai / detail |
|---|---|
| Charged attack | Tahan serang ~0.5 dtk (20 stamina). Hero melee: putaran 2× elemental; Mora/Rumi: ledakan di target. |
| Plunge attack | Serang saat di udara (≥2 m, mis. dari glider/lompat). Makin tinggi jatuhnya, makin besar damage & radius. |
| Perfect dodge | Dash tepat sebelum terkena → slow-motion 1.8 dtk untuk musuh, +energi, +stamina. |
| Lock-on | Tab / klik tengah / tombol 🎯. Kamera menjaga target di layar, serangan & skill mengarah ke target. |
| Poise & BREAK | Musuh terhuyung/terlempar saat poise habis; bos masuk **BREAK** 3 dtk (diam, damage diterima +30%). |
| Feedback | Efek impact + percikan, warna angka damage per elemen, suara per elemen, FOV kick, hitstop, musuh terlempar saat mati. |
| Combo & rank | Combo counter + rank C→SSS; rank tinggi = energi burst lebih cepat. |
| Cut-in burst | Art asli hero meluncur masuk saat Q + slow-motion sesaat. |
| AI musuh | Tanda "!" sebelum menyerang; maksimal 2 musuh biasa menyerang bersamaan, sisanya mengitari. |
| Elite | 8 musuh Elite (mahkota emas) dengan **perisai elemen**: FIRE ← WATER/ICE, WATER ← ICE/FIRE, ICE ← FIRE, DARK ← LIGHT. Elemen yang tepat memecah perisai cepat → musuh lengah. Respawn 5 menit, hadiah besar. |
| Starlight Rift | Arena platform bintang di langit (menu ☰ → Teleport). 5 gelombang + Elite, skala dengan level. Rating ★ (≤5 menit, damage diterima <60%), hadiah & rekor tersimpan. |

## 4h. Bab 4 — Void Rift (v0.8)

Diadaptasi dari Arc 1 · Chapter 5 asli. **Alam terpisah**: pulau-pulau melayang di lautan nebula ungu, dimasuki lewat **Gerbang Aurora** di puncak Frostvale (setelah Bab 3). Antar pulau: jembatan cahaya, batu loncatan, dan **jump pad** yang meluncurkan pemain lalu otomatis membuka glider. Jatuh ke jurang → kembali ke pulau terakhir (−12% HP).

| # | Quest | Isi |
|---|---|---|
| 1 | Gerbang Aurora | Masuk Void Rift → bertemu **Gemora & Micca** (kalimat asli "Signal from beyond the rift… it's watching us."). Keduanya bergabung (total 10 hero). |
| 2 | Jangkar Bintang | Aktifkan 3 jangkar di pulau berbeda (penjaga muncul; jangkar ketiga dijaga Elite). |
| 3 | Mata Primordial | Jembatan cahaya terbentuk → bos **Ygg-Naar**: sinar mata menyapu 30 m, tembakan mata homing dari tentakel, hantaman tentakel, **tarikan gravitasi** (lari menjauh), fase **mata tertutup** di 66% & 33% (hancurkan 4 Akar Void → mata terbuka & BREAK 5 dtk). |
| — | Penutup | "Cool eye. I'm putting it in my box!", "…the true source is above us. In Asgard." → teaser **Bab 5: Celestial Asgard**. |

**Hero baru** (data asli): **Gemora** (LIGHTNING · Ranger — *Void Railgun* menembus seluruh garis 30 m; Q tembakan orbital 5×) dan **Micca** (CHAOS · Mage — palu & *Pandora Unboxed*; tiap pukulan memakai **elemen acak**, bisa memicu reaksi apa pun; Q peti mimic raksasa).

**Reaksi LIGHTNING:** Arus Berantai (↔WATER, petir merambat ke 4 musuh), Ledakan Plasma (↔FIRE, ledakan + terpental), Retak Petir (↔ICE, musuh area menerima +30% damage 8 dtk).

## 4i. Bab 5 — Celestial Asgard & sistem akhir (v0.9)

Dikerjakan dari kode Gemini CLI, lalu diaudit dan diperbaiki.

- **Bab 5:** kota langit Asgard, tiga prisma, Jembatan Bifrost, bos Eclipse Sovereign, Commander Aethel bergabung.
- **Menara Ujian:** 6 lantai berwaktu. Aturan tiap lantai benar-benar mengubah damage, energi, atau crit.
- **Papan Buronan:** 3 target elite di wilayah asli, terkunci sesuai progres cerita, tetap aktif setelah save/load.
- **Segel (artifak):** 5 slot, 6 set dengan bonus 2 dan 4 keping. Statnya masuk ke rumus damage.
- **Senjata Doa Bintang:** satu slot per hero, dipasang di layar Segel. Duplikat dikembalikan sebagai Starlight.
- **Aktivitas:** memancing, memasak di semua titik istirahat, cuaca, Kupu Kristal, cincin angin, foto, Mata Aether.

## 4j. Tampilan alam terpadu (v0.10)
Semua wilayah kini memakai satu kit visual di `src/nature.js`, sehingga dunia terasa sebagai satu tempat. Semua tekstur dibuat saat game dimuat, tidak ada yang diunduh.

- **Tanah:** `terrainMat()` memilih detail rumput, tanah, pasir, salju, atau batu dari warna vertex, lalu menambah butiran halus, nada padang yang lebih zaitun, dan pasir basah di tepi air.
- **Tumbuhan:** pohon daun lebar, pinus, palem, dan semak punya batang dan kartu daun sungguhan, dengan angin bersama lewat `world.windUniform`. Salju menempel di sapuan atas dahan pinus.
- **Rumput:** bilah tipis mengambil warna dari tanah. Preset low memakai bilah lebih sedikit dan lebih lebar (`grassGeoLow`).
- **Batu dan properti:** `rockGeo` dan `rockMat` menggantikan batu kotak. `weatherProps(root, amount)` memberi permukaan usang pada properti toon; realm memakai nilai lebih rendah supaya marmer dan emas tetap bersih.
- **Air:** garis buih tipis yang bergulung, tepi buih di pasir, dan jaring kaustik di air dangkal.
- **Post-processing:** pre-pass GTAO melewati kartu daun, objek transparan, outline, dan rumput. Tanpa ini muncul kotak di sekitar daun dan awan. Ambang bloom 1,3, jadi hanya sumber cahaya sungguhan yang berpendar.
- **Partikel:** semua `PointsMaterial` memakai `softDot()`, kecuali bintang.

**Aturan performa**
- `plantForest` membagi pohon per area. `updateForest` menukar daun dan batang versi dekat dan jauh di sekitar pemain.
- `updateFarCull` memindahkan objek yang sepenuhnya di balik kabut ke layer 1. Dipakai layer karena `visible` sudah dikendalikan logika game dan LOD hutan.
- Outline berhenti di 70 m untuk properti dunia dan 40 m untuk musuh. Properti di bawah 2 m berhenti di 170 m.
- Ukuran di kamp, satu frame penuh termasuk shadow dan post: low sekitar 829 ribu segitiga dan 1.516 draw call; high sekitar 2,7 juta dan 2.657.

## 4k. Arc 2 · Bab 6 — Ashen Battlefield (v0.11)

Diadaptasi dari Arc 2 · "Ashen Battlefield" di game asli (The Second Eclipse: hero yang terkorupsi kembali sebagai bos). Setelah Bab 5 selesai, langit meredup lagi dan sebuah **Retakan Gerhana** muncul di dekat api unggun hutan.

| # | Quest | Isi |
|---|---|---|
| 1 | Langit yang Menggelap | Teaser setelah kemenangan di Asgard (kalimat asli "…the sky is darkening again. A second Eclipse?"). Masuki retakan di dekat api unggun hutan. |
| 2 | Pedang yang Tertancap | **Alam terpisah:** padang abu di atas jurang, ratusan pedang tertancap seperti nisan, langit dengan **matahari hitam**. Cabut 5 Pedang Kali yang kerasukan; tiap pedang memanggil gelombang **Pedang Kerasukan** (menerjang lurus setelah lingkaran ungu) dan **Arwah Prajurit Abu**. Pedang ke-5 dijaga Elite (perisai DARK). |
| 3 | Altar Seratus Pedang | Bos **Kali · Saint Seratus Pedang (Terkorupsi)**: tebasan beruntun, terjangan lurus (2× saat marah), **Hujan Seratus Pedang** (lingkaran di sekitar pemain), lemparan kipas pedang, cincin pedang berputar yang melukai saat disentuh (fase marah). Di 60% & 25% ia **menyarungkan diri** (kebal + hujan pedang terus-menerus) sampai 4–5 **Pedang Terkutuk** dihancurkan → BREAK 5 dtk. |
| — | Penutup | "…Commander? My blades… I'm sorry.", "Then my hundred blades are yours." → teaser **Bab 7: Eclipse Citadel** ("The citadel moved overnight. It's following the black sun."). |

**Hero baru — Kali** (WIND · Warrior, data asli: HP/ATK/DEF tinggi, skill asli *Hundred Blade Rain* yang menurunkan DEF):
- Serangan biasa: 3 tebasan katana; tebasan ke-3 menjatuhkan 3 pedang WIND (pasif *Seratus Pedang*, bisa memicu Pusaran).
- E **Hundred Blade Rain**: hujan pedang di garis 14 m, 230% ATK WIND + DEF musuh turun (+30% damage diterima, 8 dtk).
- Q **Pedang ke-101** (dari memory asli *"The Hundred and First"*): 8 gelombang pedang ke semua musuh dalam 11 m lalu satu pedang raksasa 220% ATK.
- Model prosedural dari art asli: rambut pirang pucat sangat panjang dengan twin tail, kaus putih, katana, dan halo pedang melayang di punggung. Versi bos memakai rig yang sama dengan warna terkorupsi.

Menu ☰ → Teleport kini punya **🗡️ Ashen Battlefield**. Save lama yang sudah menamatkan Bab 5 otomatis lanjut ke quest "Langit yang Menggelap".

## 5. Struktur teknis

```
index.html          HUD, dialog, title, menu, kontrol sentuh
src/main.js         Game loop, kamera, alur story, spawn, save/load
src/reef.js         Region Sunken Reef (laguna, jembatan, reruntuhan, sarang ratu)
src/chapter1.js     Alur Bab 1, hazard bos, peti harta
src/volcano.js      Region Infernal Citadel (pulau vulkanik, benteng, lava)
src/chapter2.js     Alur Bab 2, sinar & tali darah, panas, gerbang
src/frost.js        Region Frostvale (salju, gunung, danau, desa, aurora, bongkahan es)
src/chapter3.js     Alur Bab 3, badai salju, Kuil Aurora, Cabai Api
src/lights.js       Light pool (lampu virtual → beberapa PointLight nyata)
src/graphics.js     Pipeline render HDR: bloom, GTAO, grading, AA, preset grafis
src/ambient.js      Kupu-kupu, kunang-kunang, burung, daun, ikan
src/combat.js       Combo/rank, perfect dodge, lock-on, orb energi, cut-in, perisai elemen
src/rift.js         Arena Starlight Rift (gelombang, rating, hadiah)
src/chapter4.js     Alam Void Rift (pulau melayang, jump pad, jangkar, bos Ygg-Naar)
src/chapter6.js     Arc 2 · Bab 6: alam Ashen Battlefield, Retakan Gerhana, 5 pedang, bos Kali
src/noise.js        Noise & RNG
src/world.js        Terrain prosedural, air, pohon/rumput instanced, landmark, langit, siang-malam
src/rig.js          Rig humanoid + animator bersama
src/luby.js         Model Luby
src/heroes3d.js     Model Fidelia & Mora
src/heroes.js       Data hero (kit, elemen, voice, profil)
src/player.js       Kontrol, stamina/lapar, kit tempur
src/characters.js   Purr-Bot, NPC Mora & Fidelia
src/enemies.js      Slime, Gumi Fox, bos Nine Tails (AI + telegraph)
src/story.js        Naskah, quest, profil (Bahasa Indonesia)
src/ui.js           HUD, dialog VN, minimap, angka damage
src/vfx.js, sfx.js  Efek visual & suara prosedural (tanpa file aset)
public/assets/      Potret dari Euphoria Online
```

## 6. Roadmap

1. **Model 3D asli** — ganti model prosedural dengan GLB/VRM (Blender, atau AI 3D dari art 2D lalu di-rig). `Luby` class sudah memisahkan model dari kontrol, jadi tinggal tukar loader + AnimationMixer.
2. ~~Party + switch~~ (v0.2 ✓) — hero ke-4 berikutnya: Shina (FIRE, dragon) atau Scylla (WATER).
3. ~~Reaksi elemen dasar~~ (v0.2 ✓) — tambah FIRE (Uap Meledak/Lebur-like) saat Shina masuk.
4. ~~Bab 1 Sunken Reef~~ (v0.3 ✓), ~~Bab 2 Infernal Citadel~~ (v0.4 ✓), ~~Bab 3 Frostvale~~ (v0.5 ✓), ~~Bab 4 Void Rift~~ (v0.8 ✓), ~~Bab 5 Celestial Asgard~~ (v0.9 ✓), ~~Arc 2 · Bab 6 Ashen Battlefield~~ (v0.11 ✓) — berikutnya **Bab 7: Eclipse Citadel** (bos Abadonia), lalu Shattered Continent (Zennyo) & Fallen Cathedral (Vexira).
5. ~~Memasak~~ (v0.4 ✓), ~~glider~~ (v0.5 ✓) — lanjut: memanjat, crafting senjata/artefak, puzzle lingkungan.
6. **Mobile** — `npx cap add ios/android`, LOD vegetasi, preset grafis Low/Med/High, kontrol tombol yang bisa diatur.
7. **Gacha/banner** (opsional, karena asal-usulnya gacha) — dengan sistem Bond & Memories dari game asli.

## Pipeline aset Blender (v0.12)
- `blender/build_props.py` — skrip Blender 3.6 (headless) yang memodelkan prop secara prosedural (vertex color sRGB, material `toon` / `emit`) lalu mengekspor `.glb` ke `public/assets/models/`. Jalankan: `npm run models` (atau `npm run models -- tent` untuk satu aset).
- `src/assets.js` — `loadModel()` / `upgrade()` memuat GLB, mengganti material ke toon + outline, dan menukar placeholder primitif setelah file termuat (fallback otomatis jika gagal). `flameLayers()` = api tetesan berlapis untuk semua api unggun.
- Batch 1: Sunbeam Rock (batu berlapis + selimut tidur Luby), tenda kemah + peti/tong/kayu bakar, api unggun (dipakai semua bab via `makeCampfire`), kursi kayu, meja kerja Luby (roda gigi, ragum, lentera, blueprint, tumpukan rongsokan).
- Batch 2 (hutan): `rock_a/b/c` (batu terpahat berlapis, menggantikan geometri 260 batu), `tree_roots` (pangkal + akar menjalar di bawah semua pohon, hanya chunk dekat — `addForestRoots`), `stump`, `fallen_log`, `mushrooms_red/brown` disebar di hutan lewat `scatter()` dengan collider. `World.addClearing()/isCleared()` membuat tanah bebas rumput di pangkal pohon & sekitar prop.
- Batch 3 (landmark bab): `den_pillar` / `den_pillar_broken` (menhir batu bertumpuk dengan rune ungu menyala + kristal korupsi, sarang Nine Tails), `reef_column` / `reef_column_broken` / `reef_pedestal` (kolom beralur aus laut dengan alga, teritip, karang & bintang laut — reruntuhan Sunken Reef), `asgard_column` (marmer beralur + alas/kapital/cincin emas bertatah permata; dipakai kuil Aether Sanctum dan plaza pada skala 0,8) + `asgard_dais` (dais oktagonal 3 undakan dengan bintang emas), `giant_sword` (pedang raksasa dengan rune di fuller, quillon melengkung, gundukan abu) + `blade_dais` (basal retak dengan celah ungu menyala) untuk Altar Seratus Pedang. Semua lewat `upgrade()`, collider lama tetap dipakai.
- Batch 4: `aurora_shrine` (platform batu bersalju 2 tingkat + tangga, 6 obelisk es di atas alas batu dengan inti & ujung menyala, cincin rune — orb tetap objek terpisah), `frost_arch` (gerbang kayu ala torii bersalju, papan biru berlambang kepingan salju, 2 lentera), `brazier` (anglo besi dengan bara menyala, dipakai 6 di Frostvale + 6 di halaman Citadel; api kerucut lama tetap), Infernal Citadel: `citadel_wall` (segmen tembok bermerlon + celah panah menyala, di-scale ke panjang segmen), `citadel_tower` (menara bundar, parapet, atap merah + bendera), `citadel_gatetower` (menara gerbang dengan panji), `portcullis` (jeruji besi berduri + sigil merah; menumpang di mesh gerbang lama yang dibuat tak terlihat, jadi animasi buka/tutup di chapter2 tetap jalan), `crystal_teal` / `crystal_pink` (kluster kristal sarang Slime Queen).
- Batch 5 (prop dunia): `chest_base` + `chest_lid` (tutup tetap di `lidG` sehingga animasi buka jalan), `fish_crate` + `fish_prop` (primitif lama disembunyikan, bukan dihapus — main.js memakai `children[2]`), `gazebo` (paviliun Jembatan Karang), `beach_tent`, `rowboat`, `tent` dipakai ulang di outpost vulkan, `outpost_banner`, `fire_pillar` (pilar causeway, di-scale per tinggi), `spirit_lantern` (api tetap objek terpisah), `frost_house`, `ice_floe` (unit radius, di-scale per floe), `crystal_violet` (sarang Nine Tails). Objek instanced memakai `swapInstanced()` (assets.js) yang mengganti geometri InstancedMesh + outline-nya: `coral_branch/fan/brain`, `dead_tree`, `obsidian_spire`, `ice_crystal` — warna tetap dari warna per-instance.
- Batch 6 (alam & sistem): `void_island` / `asgard_island` (pulau melayang radius-satuan, permukaan pijak di y=0, di-scale per radius; `asgard_island` juga untuk arena Spire), `void_anchor` (inti tetap objek terpisah), `jump_pad` (cincin glow tetap), `void_debris` (Void Rift + Starlight Rift), `rift_base` (di-scale X/Z ke radius arena), `prism_pedestal`, `spire_monolith`, `portal_frame` / `portal_frame_dark` lewat `portalFrame()` di assets.js untuk semua cincin portal, `rusty_sword` (menggantikan 3 lapis instanced pedang di medan Bab 6 dengan satu geometri ber-vertex-color), `fishing_pier`, `bounty_board`. Objek beranimasi (kristal Rift, monolit tengah Spire, cincin portal, kain panji) tidak diganti.
- Batch 7 (musuh, bagian 1): sistem **kit** — `applyKit(name, parent, roles, old)` di assets.js. GLB kit berisi mesh bernama sesuai *peran material* (`fur`, `belly`, `dark`, `glow`, `gel`, `cloak`, `hair`, `flesh`, `sclera`, `bark`, `base`, `obel`, `ice`, `a`, `b`) dengan shading abu-abu; tiap peran memakai material milik musuh itu sendiri (vertexColors dinyalakan, primitif sisa diberi atribut warna putih), jadi warna varian, kilat saat terkena, dan opacity fase tetap jalan. Kit: `kit_fox_body/head/leg/tail` (rubah, rubah lava, serigala salju, penjaga jangkar, Nine Tails), `kit_slime`, `kit_ghost` (Eroghost, arwah beku/void/abu, Frost Phantom), `kit_jelly`, `kit_void_eye` + `kit_eye_tentacle`, `kit_void_root`, `kit_blood_seal` (segel & kristal darah), `kit_ice_prison`, `kit_coral_spire`. Grup animasi (head, legs, tails, tents) tidak berubah — kit ditempel di dalamnya.
- Batch 7b (bos): figur anime generik (`anime_head`, `robe_skirt`, `torso_shape` di build_props.py) untuk `kit_sage`, `kit_ygg_body/head` (+ `kit_ygg_seg` per ruas tentakel), `kit_queen_rider`, `kit_archon`, `kit_sovereign_body/head`; badan Slime Queen = `kit_queen_gel` dengan warna pelangi tetap dihitung dari normal di JS; `kit_feather` (sayap Penjaga Surgawi & Sovereign, ditempel di posisi bulu lama dan dicerminkan per sisi), `kit_halberd`, `kit_sov_sword`, `kit_prismguard` + `kit_prism_blade`, `kit_blade` (Pedang Kerasukan/Terkutuk/orbit Kali), `kit_eclipse_core` (ditempel ke objek `core` yang tetap berputar).
- Batch 8 (karakter): kit per sendi di `buildBody` (semua hero): `kit_b_pelvis/waist/chest/upperarm/forearm/hand/thigh/shin/shoe`, `kit_b_hair` + `kit_b_hairlong` (di-scale ke `hairLen`). Bola kepala + tekstur wajah tidak diganti. Purr-Bot: `kit_purr_body/head/leg/tail`. Luby: `kit_luby_shoe` (kaki berstoking bertekstur tidak diganti).
- Batch 9: NPC cerita chibi (`kit_npc_body`, `kit_npc_arm`, rambut memakai ulang `kit_b_hair/hairlong`), glider (`kit_glider`), suku cadang mecha (`kit_mecha_part`), semak cabai (`kit_pepper_bush` + geometri `pepper`).
- Batch 10 (performa): ukur draw call/segitiga model vs placeholder (blokir *.glb). Hasil: model Blender justru mengurangi draw call di camp/hutan/reef/Frostvale; segmen tembok Citadel kini satu InstancedMesh + outline instanced. Pohon/kanopi sengaja tidak diganti (sudah leaf-card prosedural + shader angin + LOD).
- Batch 11 (Luby): `kit_luby_hood` (cangkang tudung radius 0.152 tetap sama sehingga mata mecha/hidung/lingkar/panel lama tetap pas, telinga mecha + bagian dalam + baut), `kit_luby_upperarm`, `kit_luby_forearm` (lengan hoodie melebar + cuff), `kit_luby_paw` (cakar dengan bantalan & jari bercahaya + kuku), rambut memakai `kit_b_hair` (garis lime di poni). Badan hoodie bertekstur & stoking tidak diganti.
- Batch 12 (VFX): `vfx_slash` (sabit tebasan meruncing), `vfx_shock` (gelombang kejut bergradasi), `vfx_pillar` (pilar cahaya berpilin + inti), `vfx_flash` (kilatan bintang 3 sumbu saat hit), `vfx_ice_shard` (kristal es heksagonal), `vfx_blade` (pedang jatuh Kali), `vfx_tentacle` (tentakel melengkung dengan pengisap), `vfx_rune_ring` (lingkaran peringatan berrune yang berputar). Kecerahan disimpan di vertex color, jadi dengan additive blending tepi hitam = transparan. Geometri dimuat sekali lewat `loadGeometry`, ditandai `userData.shared` agar tidak di-dispose; primitif lama tetap jadi fallback.
- Perbaikan HP: tombol mulai dinonaktifkan ("MEMUAT…") sampai game siap, error saat boot ditampilkan di layar judul, tombol merespons `touchend` + `click` (dengan guard satu kali), layar judul bisa di-scroll di layar pendek.
- Batch 13 (performa HP): program shader 167 → 75. Outline anime memakai satu program (`animeOutlineV3`, ketebalan = uniform), material toon tidak lagi memecah program per spec/face/rim (kunci default `onBeforeCompile.toString()` diabaikan). Tombol Start tetap "MEMUAT…" (dengan hitungan model tersisa) sampai semua GLB termuat dan shader dikompilasi lewat `compileAsync` ke render target post-processing (bukan layar), jadi tidak ada lagi jeda beku setelah tombol aktif. Saat menu/modal/peta/dapur terbuka, dunia dibekukan dan tidak di-render ulang (frame terakhir tetap tampil). `backdrop-filter` dimatikan di perangkat sentuh. Tombol judul `touch-action: none` + umpan balik "MEMULAI…" sebelum proses berat.
- Batch 14 (badan Luby, mengikuti key art V1): `kit_luby_jacket` (hoodie terbuka dengan lipatan, ritsleting kedua sisi, kelim berusuk, jahitan saku, Ω menyala di dada kiri/kanan + Ω besar di punggung; menggantikan silinder bertekstur, yoke & hem), `kit_luby_choker` (choker mecha dengan lampu), `kit_luby_tailseg` ×7 (segmen bulu dengan garis sirkuit menyala, membesar ke ujung) + `kit_luby_tailtip` (jumbai api), `kit_luby_thigh` (stoking dengan band, Ω menyala, jejak sirkuit + tempurung lutut) dan `kit_luby_shin`. Ω dibuat dari font Georgia Bold (font bawaan Blender tidak punya Ω).
- Batch 15 (culling jarak, `src/cull.js`): `cullFar(obj, maxDist?)` memasang accessor pada `visible` sehingga objek digambar hanya jika kode game ingin menampilkannya **dan** cukup dekat dengan kamera (cek 5×/detik dari `matrixWorld`). Model `upgrade()` memakai jarak dari ukurannya (60 + radius×25 m, min 70 m), rig hero/NPC dan NPC cerita 110 m, musuh min 110 m, cincin terbang 160 m; preset LOW ×0,75. Draw call: kemah 930→732, hutan 612→319, karang 662→334, citadel 1361→529, salju 742→392.
- Batch 16 (zona wilayah ala Ragnarok 2, `src/zones.js`): pulau awal Whispering Woods dibagi 5 zona — **Sunbeam Glade** (tengah, r 80 m sekitar Sunbeam Rock & kemah), **Foxfire Thicket** (utara, sarang Nine Tails), **Eastern Cliffs** (timur), **Mossy Meadow** (selatan), **Hollow Grove** (barat) — ditambah Sunken Reef, Infernal Citadel, Frostvale masing-masing satu zona. Hanya isi zona aktif yang digambar: objek di-*sweep* ke zona saat boot (`zoneSweep`), objek yang bergerak (NPC, musuh) mengikuti posisinya, dan benda zona lain yang < 45 m dari kamera tetap tampil (tidak ada lubang di perbatasan). Rumput, bunga, batu, tunggul, kayu, jamur & bayangan pohon se-pulau ditulis ulang per zona (`zoneInstanced`, margin 40 m) saat masuk wilayah. Pindah zona = layar "MEMASUKI WILAYAH" ±0,8 dtk (kompilasi shader area baru di balik layar); teleport langsung berganti. Awan: 345 sprite → 1 InstancedMesh billboard. Hasil (zona aktif vs mati): kemah 548/677 calls & 922k/1388k tris, hutan 185/449 & 769k/1271k, citadel 432/569 & 506k/1060k.
- Batch 17 (gaya rambut khas hero, mengikuti potret): 5 gaya Blender, masing-masing kit depan (`kit_hs_<gaya>_front`, pengganti `kit_b_hair`) + kit belakang (`kit_hs_<gaya>_back`, diskalakan `hairLen`): **hime** (poni rata + rambut samping terpotong lurus — Eropatra), **wavy** (poni menyamping, helai berombak — Fidelia, Scylla, Rumi), **straight** (belah tengah + ahoge, potongan V — Mora, Valeria, Gemora, Commander), **wild** (poni acak + duri di ubun-ubun — Glytta), **twin** (dua ekor tinggi dengan ikat rambut — Kali, Micca). Dipilih lewat `hairStyle` di `buildBody`; `tie` = material ikat rambut; `backOld` memungkinkan rig menambahkan rambut primitif yang ikut diganti kit.
- Batch 18 (Luby kualitas tinggi + UI): tubuh Luby kini **satu mesh skinned** dari Blender (`luby_body_skinned.glb`, `build_luby_skinned`): kulit badan + kaki, hoodie terbuka dengan lengan longgar, lipatan, ritsleting, hem & manset rib, bikini dengan tali & Ω menyala, stoking paha dengan jalur sirkuit. Tulang armature = nama joint rig, bobot dihitung prosedural per pakaian; `applySkinned()` memakai grup joint rig sebagai skeleton (`rig.bindRest`), jadi animator prosedural langsung menekuk mesh dengan mulus (lutut, siku, pinggang). Proporsi ±6,5 kepala (pinggul 0,92 m, kepala ×1,12). Kepala semua hero berdagu V (`animeHead`), tekstur wajah 512 px, mata Luby berlapis (iris berserat, highlight bintang, eyeliner bersayap). Outline inverted-hull sebelumnya tidak pernah tampil (ekstrusi tertimpa `project_vertex`) — kini benar untuk mesh biasa, instanced & skinned. UI: ikon SVG semi-transparan (`src/icons.js`) menggantikan emoji di tombol sentuh, HUD, skill, inventaris, cuaca; menu jeda dirombak (grid ikon + tab Party/Teleport/Bekal/Pengaturan, preset grafis segmented, hapus save dengan konfirmasi); di HP baris party pindah ke atas agar tidak tertutup tombol skill.
- Batch 19 (badan skinned semua hero): Fidelia, Mora, Scylla, Eropatra, Rumi, Valeria, Glytta, Gemora, Micca, Commander & Kali kini memakai satu badan skinned bersama dari Blender (`hero_body_skinned.glb`, `build_hero_skinned`) yang menggantikan 11 segmen primitif + kit kaku per hero: kulit badan/lengan/kaki menyambung mulus di bahu, siku, pinggang & lutut. Di atasnya ada lapisan pakaian per peran (`bottom`, `waist`, `chest`, `upper`, `forearm`, `thigh`, `knee`, `shin`) yang memakai material slot hero; lapisan yang materialnya kulit tidak digambar, dan hanya kulit yang membawa outline (lebih hemat draw call). `applySkinned` menerima lebar outline per peran.
- Batch 20 (outfit hero dari Blender): rok, armor pinggul & jubah tiap hero kini mesh skinned (`hero_outfits.glb`, `build_hero_outfits`) yang menggantikan silinder kaku: faulds kerang Fidelia (9 pelat bertumpuk + tepi timbul), tasset emas panjang Valeria, rok ruffle dua tingkat + renda Scylla, rok lipit Rumi, rok panjang berdrapery Eropatra dengan hem & panel emas, serta jubah Mora (tekstur bintang ber-UV), Eropatra, Rumi & Commander. Rok diberi bobot ke pinggul + kedua paha sehingga ikut ayunan kaki; jubah memakai joint baru `capeA`/`capeB` yang dikibarkan `Rig.update` (mengembang sesuai kecepatan, terangkat saat di udara, beriak pelan saat diam).
- Batch 21 (armor & aksesori hero dari Blender): `build_hero_armor` membuat tiga kit kaku — `kit_a_pauldron` (menempel di joint lengan atas, dicerminkan untuk kanan, jadi ikut terangkat saat menyerang), `kit_a_chest` dan `kit_a_head`. Isinya: pauldron kerang berusuk + punggung mutiara, cup dada kerang, helm kerang bergerigi dengan crest & sirip bertulang (Fidelia); pauldron 3 lempeng bertumpuk bertepi gelap + circlet berujung V bersayap (Valeria); pauldron emas faceted dua lapis dengan trim navy & crest (Commander); tudung bintang ber-UV yang menjuntai jadi capelet + tepi emas, dan kalung emas dengan bros bintang (Mora); kalung usekh lebar dengan dua baris manik pirus + rumbai manik, dan mahkota emas dengan kobra uraeus (Eropatra). Primitif lama (bola, kotak, torus) diganti lewat `H.armor.pauldrons/chest/head`.
- Batch 22 (senjata hero dari Blender): `build_hero_weapons` membuat 12 kit senjata (`kit_w_*`) di ruang grup pemegangnya (gagang di origin, senjata ke +Y), dipasang lewat helper `weapon()`/`holderFor()` di heroes3d.js: pedang berpelindung mutiara + perisai kerang (Fidelia), greatsword bersayap dengan tepi es + tower shield bergaris (Valeria), sabit abyss berbentuk bulan sabit (Scylla), tongkat Anubis berkepala jakal (Eropatra), tongkat salib berinti rubi (Rumi), bilah kristal (Glytta), senapan void dengan teropong & strip cahaya (Gemora), palu perang (Micca), pedang celestial bersayap (Commander) dan katana melengkung dengan tsuba (Kali, termasuk halo pedangnya). Material tetap milik rig, jadi efek kilat/emissive tidak berubah.
- Batch 23 (penanda zona): `build_waystone` membuat tugu batas zona (`waystone.glb`: alas bertingkat berlumut, obelisk berukir rune, cakar batu memegang kristal melayang; mesh `ws_glow` diwarnai per area di game). `World._waystones()` memasang 8 tugu di Whispering Woods — 4 di lingkar Sunbeam Glade (satu per area luar) dan 4 di batas antar-area luar — di titik datar yang bebas pohon/landmark, dengan collider dan cahaya berdenyut sewarna area (Foxfire oranye, Eastern Cliffs biru, Mossy Meadow hijau, Hollow Grove ungu, Glade emas). Peta dunia (M) kini menggambar garis batas 5 area, nama tiap area, ikon tugu, dan menyorot area tempat pemain berdiri.
- Performa: GPU terintegrasi/software (Intel/Iris/SwiftShader…) otomatis mulai di preset LOW; `_autoGfx` kini memakai waktu frame mentah dan juga aktif di layar judul (3 frame >0,4 dtk → LOW). Ini memperbaiki tombol "Mulai dari awal" yang terasa tidak bisa diklik di Mac Intel + Retina.
