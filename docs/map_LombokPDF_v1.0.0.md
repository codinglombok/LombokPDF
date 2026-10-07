# Map LombokPDF v1.0.0

Peta dependensi LombokPDF terhadap Lombok Ecosystem: library yang sudah ada, celah yang harus ditutup di library tersebut, library baru yang perlu dibuat, dan urutan pengerjaannya. Posisi cluster, tingkat (L0 sampai L4), dan aturan dependensi mengikuti dokumen induk ekosistem v3.6 (MASTERPLAN_UTAMA dan PRINSIP_UNIVERSAL, tidak di-commit, ADR-024). Bagian 9 berisi usulan perubahan untuk revisi dokumen induk berikutnya.

Bagian ini satu-satunya tempat nama aplikasi atau framework boleh muncul (ADR-019). Setiap library yang disebut di sini mandiri dan dapat dipakai siapa pun untuk keperluan apa pun; LombokPDF hanya salah satu pemakai. Arah dependensi selalu dari pemakai ke library.

## 1. Posisi LombokPDF

```
Tingkat L3 (produk) · pemakai banyak library L0-L2

L3  LombokPDF
     dependensi wajib (target v2) : hanya library Lombok Ecosystem (bagian 4 dan 5)
     dependensi pihak ketiga      : 0 di runtime (target v2); saat ini 19 (bagian 2)
     pemakai                      : LombokDocFlow (adapter PDF), LombokDocFlowNode/PHP/Phyton,
                                    LombokClarion (rencana, ekspor laporan), LombokMiner (rencana,
                                    lewat LombokPDFCore/LombokPDFText, bukan lewat LombokPDF)
```

LombokPDF adalah lapisan orkestrasi: ia merangkai parser masukan (HTML, Markdown, DOCX, CSV), mesin gaya, tata letak, penulisan PDF, dan operasi pasca-proses menjadi satu API fluent (`from().locale().theme().pipe().export()`), CLI, adapter framework, dan 12 templat. Logika berat (parsing, shaping, layout, kripto, codec) tidak boleh tinggal di LombokPDF; tempatnya di library yang bisa dipakai ulang.

## 2. Diagnosis kondisi v1.0.0

Diperiksa terhadap kode di `main` (af8a726) dan `scripts/lombok-doctor.sh` (v3.6).

| Aspek | Kondisi | Konsekuensi |
|---|---|---|
| Dependensi runtime | 19 paket npm pihak ketiga (`pdfkit`, `pdf-lib`, `sharp`, `parse5`, `marked`, `mammoth`, `handlebars`, `bidi-js`, `hyphen`, `qrcode`, `jsbarcode`, `gray-matter`, `yaml`, `commander`, `chalk`, `ora`, ...) ditambah 6 impor dinamis tidak terdaftar (`bwip-js`, `node-forge`, `tesseract.js`, `pdf2pic`, `canvas`, `xmldom`) | Melanggar prinsip tanpa dependensi luar (ADR-004); `sharp` dan `canvas` adalah modul native |
| Mesin layout (LLE) | "Stage 1" = HTML diteruskan ke PDFKit; loader WASM merujuk `assets/lombokpdf.wasm` yang tidak ada | Klaim README "Full CSS Paged Media + Flexbox + Grid", "HarfBuzz shaping", "50+ language" belum didukung kode |
| Skill | 17 dari 45 berkas skill berisi penanda `Stage 2` (placeholder atau no-op): footnote, crossRef, redaksi pola, ekspor SVG/PNG, PDF/A, PDF/UA, tanda tangan PKCS#7 (hanya metadata), split per bab | Fitur tampak ada di API tetapi no-op atau peringatan |
| Port | Python, PHP, Go, Java, Ruby, .NET, Rust adalah pembungkus tipis yang menunggu inti WASM | Tidak ada perilaku yang dapat dibuktikan lintas bahasa |
| Kontrak normatif | Tidak ada SPEC, tidak ada `vectors/` | Gagal GP-11 dan ADR-015 |
| Dokumen publik | 0/10 (`changelog`, `map`, `structure_repo`, `full_summary_project`, `guide_how_to_use`, `how_to_dist`, `development_ide`, `API`, `Lang`, `SPEC`) | Gagal `lombok doctor docs` |
| Gaya dan ignore | Emoji di `CONTRIBUTING.md`; `.gitignore` tanpa 3 baris ADR-024; README tanpa "Mengapa library ini?" | Gagal `style`, `ignore`, `meta` |

Kesimpulan: v1.0.0 adalah prototipe API (desain fluent, skill tree-shakeable, templat, adapter) yang baik, tetapi mesinnya pinjaman. Rencana di bawah mempertahankan API tersebut dan mengganti seluruh mesin di bawahnya dengan library Lombok. Versi hasilnya diusulkan menjadi v2.0.0.

## 3. Aturan pemetaan

1. **Hanya dependensi Lombok.** Library dan LombokPDF boleh bergantung pada library Lombok lain, dengan arah tingkat yang lebih tinggi ke tingkat yang lebih rendah (L2 ke L1 ke L0), tanpa siklus.
2. **Salin boleh, dengan jejak.** Kode dari library Lombok boleh disalin (vendoring) agar library tetap dapat dipasang sendiri, seperti LombokDocx yang membawa ZIP, inflate, dan XML sendiri. Syarat: berkas salinan diberi kepala `Salinan dari <Library> v<versi> (<commit>), <berkas asal>; jangan diubah di sini`, dan CI penyalin menjalankan subset vector milik library asal agar penyimpangan terdeteksi. Perbaikan dilakukan di library asal lalu disalin ulang.
3. **Kapan salin, kapan bergantung.** Salin bila potongannya kecil (di bawah sekitar 1500 baris), stabil, dan dibutuhkan di jalur panas tanpa API publik (contoh: inflate, CRC-32, Adler-32, escape HTML). Bergantung bila besar, masih berkembang, atau membawa data (contoh: shaping, tabel Unicode, font, kripto).
4. **Primitif kripto hanya di LombokEncryptDecrypt** (ADR-016). Library lain boleh memakai, tidak boleh mengimplementasi ulang SHA, AES, RSA, atau ECDSA.
5. **Satu kontrak, banyak bahasa** (ADR-015, GP-11). Setiap library baru: SPEC normatif, berkas vector (minimal 100 kasus, SHA-256 tercatat di SPEC), runner vector di setiap port. Urutan port: Rust (rujukan, `no_std` + `alloc` bila memungkinkan), TypeScript, Python, lalu Go dan PHP.
6. **Pesan lewat katalog** (ADR-009). Library L1 ke atas hanya menyimpan ID pesan dan teks `en`; terjemahan lewat LombokLocale.
7. **Batas input selalu ada.** Setiap parser memiliki batas kedalaman, ukuran, dan jumlah objek yang terdokumentasi di SPEC, dan diuji dengan LombokFuzzer.

## 4. Library yang sudah ada

Status: **siap** = dapat dipakai sekarang; **celah** = dapat dipakai setelah celah ditutup di library tersebut; **perombakan** = perlu ditulis ulang sesuai standar v3.6 sebelum dipakai.

| Library | Versi | Tingkat | Peran untuk LombokPDF | Menggantikan | Status | Celah yang harus ditutup di library tersebut |
|---|---|---|---|---|---|---|
| LombokHTML | 0.2.0 | L0 | Tokenizer WHATWG, tree builder, sanitizer, selector subset untuk masukan HTML dan templat | `parse5` | celah | Tree construction penuh (insertion modes, adoption agency, foster parenting) agar pohon sama dengan browser; selector Level 4 lengkap (`:nth-child(An+B of S)`, `:is`, `:where`, `:has`) atau serahkan pencocokan ke LombokCSSOM |
| LombokMarkDown | 2.0.0 | L0 | Markdown ke HTML, AST, heading id, TOC | `marked`, `marked-gfm-heading-id`, `gray-matter` | celah | Front matter (pemisahan blok `---`/`+++`, isi diserahkan ke LombokSerde), footnote GFM, blok matematika sebagai node AST (render opsional) |
| LombokDocx | 1.1.0 | L0 | Impor `.docx` ke HTML aman | `mammoth` | siap | Opsional: gaya paragraf dan penomoran daftar ke kelas CSS; header/footer dokumen |
| LombokCSV | 1.1.0 | L0 | Impor CSV ke tabel HTML aman, deteksi tipe kolom | kode lokal `importCSV.ts` | siap | - |
| LombokLocale | 0.2.0 | L0 | BCP 47, negosiasi, format angka/mata uang/tanggal, plural, MessageFormat, katalog pesan CLI | kode lokal `locale.ts`, sebagian `Intl` | celah | Arah teks per locale (`characterOrder`), sistem angka lokal (Arab-Indic, Devanagari, Thai), data layout CLDR (`quotationStart/End`, nama bulan untuk templat); tambah locale sesuai daftar target |
| LombokCompress | 0.1.1 | L0 | FlateDecode encode/decode untuk stream PDF | `pdfkit`/`pdf-lib` internal zlib | celah | Dekoder Brotli (RFC 7932) untuk WOFF2; antarmuka streaming inkremental; level kompresi deterministik lintas port |
| LombokEncryptDecrypt | 0.1.0 | L0 | AES-128/256-CBC (enkripsi PDF R4/R6), SHA-256/384/512 (Algoritma 2.B ISO 32000-2), RSA PKCS#1 v1.5 dan PSS, ECDSA P-256/P-384, MD5 dan RC4 hanya untuk membaca PDF lama | `node-forge`, `pdf-lib` crypto | perombakan | Sebagian besar ekspor di `src/index.ts` masih dikomentari: SHA-512, HMAC, ECDSA, RSA, X.509, PEM belum tersedia. Perlu: mode CBC dengan padding PKCS#7, SHA-384/512, RSA (verifikasi wajib, tanda tangan dengan kunci privat), ECDSA P-256/P-384, MD5 dan RC4 di balik flag `legacy` read-only, SPEC dan vector (NIST CAVP, Wycheproof) |
| LombokXML | 0.1.0 | L0 | Paket XMP (wajib PDF/A), parsing SVG, XFDF, XML faktur elektronik | `xmldom` | celah | Namespace lengkap dan serializer kanonik untuk XMP; batas entitas; README masih menyebut kepemilikan oleh aplikasi lain (melanggar ADR-019) |
| LombokSerde | 0.1.0 | L0 | Data templat (JSON/TOML), front matter | `yaml` | celah | YAML 1.2 core schema subset aman (tanpa tag kustom, tanpa anchor tak terbatas); README menyebut kepemilikan (ADR-019) |
| LombokJSON | 0.1.0 | L0 | Opsi dan data templat, keluaran laporan audit | `JSON` bawaan (hanya untuk port non-JS) | siap | README menyebut kepemilikan (ADR-019) |
| LombokQRCode | 0.2.1 | L1 | QR dan Code128 sebagai vektor | `qrcode`, `jsbarcode` (Code128) | celah | Keluaran sebagai daftar persegi/path netral (bukan hanya string SVG) agar dapat digambar langsung ke content stream; port selain TS; SPEC dan vector |
| LombokECC | 0.2.0 | L0 | Reed-Solomon untuk simbol 2D | `bwip-js` (internal) | celah | Saat ini hanya RS(255,239) di GF(256) polinom 0x11D. Perlu: polinom dan panjang parity sembarang (QR 0x11D, DataMatrix 0x12D, Aztec GF(16)/GF(64)/GF(1024)/GF(4096)), serta medan prima GF(929) untuk PDF417 |
| LombokJpegExif | 0.1.0 | L0 | Orientasi EXIF dan metadata saat menyisipkan JPEG | bagian dari `sharp` | celah | Pembacaan penanda SOF (lebar, tinggi, komponen, bit depth, progresif) dan segmen APP2 ICC agar JPEG dapat diteruskan apa adanya sebagai DCTDecode |
| LombokUnram | 0.3.0 | L1 | Crop, rotasi, filter gambar, pemisahan gambar (`splitimg`) | bagian dari `sharp` | celah | Bergantung pada LombokImage (baru) untuk codec; resize berkualitas (Lanczos3, ruang linear) |
| LombokCSS | 0.1.12 | L0 | Sumber token desain dan `print.css` untuk tema templat | `src/integrations/lombokcss` | siap | Ekspor token sebagai data (JSON) selain CSS agar tema dapat dipakai tanpa mesin CSS penuh; varian `@page` untuk tiap tema |
| LombokCharts | 0.1.10 | L1 | Grafik sebagai SVG untuk disematkan sebagai vektor | `src/integrations/lombokcharts` | siap | Mode render tanpa DOM (string SVG murni di Node/Deno); font metrics yang dapat disuntik agar teks grafik cocok dengan font PDF |
| LombokIcons | 0.2.0 | L0 | Ikon SVG untuk templat | - | siap | - |
| LombokTableSheet | 1.0.1 | L1 | Model tabel (sel gabung, format angka) sebagai masukan tabel PDF | - | siap | Ekspor model ke HTML tabel semantik |
| LombokCLIParse | 0.2.0 | L0 | Parser argumen CLI `lombokpdf` | `commander` | siap | Warna ANSI dan spinner tidak perlu library: cukup helper 40 baris di `src/cli/` (pengganti `chalk`, `ora`) |
| LombokAsync | 0.2.0 | L0 | Batas konkurensi untuk batch render, timeout | - | siap | - |
| LombokLog | 0.1.0 | L0 | Log terstruktur dengan redaksi rahasia (mengganti `console.warn`) | - | siap | - |
| LombokStorage | 0.1.0 | L0 | Jalur keluaran aman, deteksi MIME berkas masukan dari magic bytes | `node:path` manual | siap | Tanda tangan magic bytes PDF, font (OTF/TTF/WOFF/WOFF2), DOCX |
| LombokValidator | 0.1.0 | L1 | Validasi opsi publik (`LombokPDFOptions`, `PageConfig`) dan data templat | - | siap | - |
| LombokSecurity | 0.1.0 | L0 | Escape HTML di templat, CSP untuk adapter server | - | siap | - |
| LombokPrivacy | 0.1.0 | L0 | Pola masking (email, IP) untuk redaksi berbasis pola | - | siap | Pola NIK, NPWP, nomor telepon, IBAN, nomor kartu (Luhn) |
| LombokCache | 0.1.0 | L0 | Cache font yang sudah di-parse dan gambar yang sudah di-decode | - | siap | - |
| LombokResilience, LombokRateLimit, LombokAuth | 0.1.0 | L0 | Hanya untuk mode server/adapter (`deploy/`) | - | siap | - |
| LombokFuzzer | 0.3.0 | alat | Fuzzing parser PDF, font, gambar, CSS (dev-dependency) | - | siap | Target harness untuk format biner berstruktur (PDF, OpenType) |
| LombokPDFA | 0.1.0 | L2 | Validator dan konverter PDF/A-1b/2b/3b | `pdfa-converter.ts` lokal | perombakan | 653 baris TS, analisis berbasis regex atas byte. Tulis ulang di atas LombokPDFCore: validasi objek (bukan teks), aturan ISO 19005-1/2/3/4 per klausul, laporan setara veraPDF, SPEC dan vector |
| LombokPDFUA | 0.1.0 | L2 | Validator dan penanda PDF/UA-1/UA-2 | `pdfua-converter.ts` lokal | perombakan | Sama dengan LombokPDFA; aturan Matterhorn Protocol 1.1 dan ISO 14289-2; pembangunan struktur tag dipindah ke LombokPDFCore (struktur) dan LombokLayout (pemberi tag) |
| LombokAlgoritma | 0.2.0 | L0 | Struktur data umum (heap, interval tree) bila dibutuhkan layout | - | siap | Tidak wajib; LombokLayout boleh menyalin potongan kecil |

Tidak dibutuhkan LombokPDF: LombokVector, LombokSimHash, LombokMiner, LombokDNS, LombokDNSProxy, LombokSQL, LombokConfig (kecuali mode server), LombokAnimate, LombokUI. LombokDocFlow dan turunannya adalah pemakai LombokPDF, bukan dependensi.

## 5. Library baru yang perlu dibuat

Setiap library di bawah ini dirancang umum: nama, README, dan SPEC tidak menyebut LombokPDF (ADR-019). Kolom "Pemakai lain" menunjukkan mengapa library tersebut layak berdiri sendiri.

### 5.1 Ringkasan

| No | Library | Tingkat | Cluster | Cakupan | Menggantikan | Pemakai lain | Prioritas |
|---|---|---|---|---|---|---|---|
| N1 | LombokPDFCore | L1 | 03 Format | Objek PDF ISO 32000-2: lexer, parser toleran, xref dan xref stream, object stream, pembaruan inkremental, perbaikan berkas rusak, writer deterministik, filter, pohon halaman, outline, anotasi, AcroForm, metadata, enkripsi standard security handler R2-R6 | `pdf-lib`, `pdfkit` (lapis objek) | LombokDocFlow, LombokMiner, LombokPDFA, LombokPDFUA, alat CLI pihak mana pun | P0 |
| N2 | LombokUnicode | L0 | 03 Format | UCD 16.0+: UAX #9 BiDi, #14 line break, #29 segmentasi, #24 script, #11 east asian width, #15 normalisasi, #50 vertikal, properti emoji, case mapping | `bidi-js`, `src/core/bidi` | LombokHTML, LombokMarkDown, LombokValidator (panjang grapheme), terminal UI, mesin pencari | P0 |
| N3 | LombokFont | L1 | 03 Format | OpenType 1.9: TrueType, CFF/CFF2, cmap, metrik, kerning lama, outline glyph, subsetting (glyf dan CFF), WOFF dan WOFF2, instansiasi variable font, koleksi TTC | font bawaan PDFKit, `fontkit` | LombokCharts (ukur teks), LombokUnram (render teks), pembuat ikon font | P0 |
| N4 | LombokShape | L2 | 03 Format | Text shaping setara HarfBuzz: GSUB/GPOS, mark positioning, Arab (joining), Ibrani, Indic, USE (Khmer, Myanmar, Jawa, Bali), Thai, Hangul, CJK vertikal, fitur OpenType | HarfBuzz yang diklaim | Editor teks, renderer SVG/teks apa pun | P1 |
| N5 | LombokHyphen | L0 | 03 Format | Algoritma Liang dengan pola TeX (hanya pola berlisensi kompatibel, lihat bagian 8), pengecualian per bahasa | `hyphen` | LombokMarkDown (soft hyphen opsional), tata letak web | P2 |
| N6 | LombokCSSOM | L1 | 03 Format | CSS Syntax 3 tokenizer/parser, Selectors 4, cascade dan specificity, nilai terhitung, `@page`, `@font-face`, `@media print`, counters, GCPM (running elements, `string-set`, `target-counter`, `float: footnote`), CSS Color 4 | `src/core/cssom` | LombokCSS (lint dan build), LombokHTML (selector), linter, pengoptimal email HTML | P0 |
| N7 | LombokLayout | L2 | 06 Dokumen | Mesin tata letak: box tree, block dan inline formatting, line breaking (Knuth-Plass dan greedy), float, tabel (auto/fixed, sel gabung, header berulang), flexbox, grid, multi-kolom, fragmentasi halaman (widows, orphans, `break-*`), margin box halaman, footnote, pemberi tag struktur. Keluaran: display list netral | PDFKit, LLE "Stage 2" | Renderer PNG/SVG, e-book, laporan terminal, pratinjau di browser | P0 |
| N8 | LombokSVG | L1 | 01 Visual | Parser SVG 1.1/2 subset statis lewat LombokXML, normalisasi (setara usvg): path absolut, transform, gradien, clip, mask, teks ke run; keluaran display list | `exportSVG` lokal | LombokCharts, LombokIcons (validasi), LombokRaster | P1 |
| N9 | LombokImage | L0 | 03 Format | Codec: PNG (decode/encode, Adam7, 16-bit, palet), JPEG (baseline dan progresif decode, baseline encode), GIF, WebP lossless dan lossy; parsing ICC; konversi ruang warna; resize | `sharp`, `canvas` | LombokUnram, LombokStorage (verifikasi isi), layanan thumbnail | P1 |
| N10 | LombokColor | L0 | 01 Visual | CSS Color 4 (sRGB, Display P3, Lab, OKLCH), CMYK naif dan berbasis ICC, profil ICC v2/v4 baca dan tulis minimal, profil sRGB bebas lisensi untuk OutputIntent PDF/A | - | LombokCSS, LombokCharts, LombokImage, LombokUI | P1 |
| N11 | LombokRaster | L1 | 01 Visual | Rasterizer 2D anti-alias (setara tiny-skia): path, stroke, dash, gradien, pola, clip, blend mode PDF, glyph dari LombokFont | `pdf2pic`, `canvas`, rasterizer placeholder | LombokCharts (PNG di server), LombokSVG ke PNG, thumbnail | P2 |
| N12 | LombokPDFText | L2 | 03 Format | Interpreter content stream: ekstraksi teks dengan urutan baca, posisi glyph, ToUnicode, pencarian, pembuatan teks dari region (dasar redaksi berbasis pola) | redaksi "Stage 2" | LombokMiner, LombokDocFlow (impor PDF), pencarian dokumen | P1 |
| N13 | LombokPDFRender | L3 | 03 Format | Render halaman PDF ke bitmap (setara pdf.js/hayro) di atas LombokPDFCore, LombokFont, LombokRaster, LombokImage | `pdf2pic`, `exportPNG` placeholder | Pratinjau dokumen, thumbnail, OCR | P3 |
| N14 | LombokPKI | L1 | 04 Keamanan | ASN.1 DER/BER, X.509 parse dan verifikasi rantai, CMS SignedData (RFC 5652), PKCS#12 baca, RFC 3161 timestamp, OCSP (RFC 6960), CRL, PAdES B-B/B-T/B-LT/B-LTA (ETSI EN 319 142) | `node-forge` | LombokAuth (mTLS, JWT x5c), penandatangan dokumen umum | P1 |
| N15 | LombokTemplate | L0 | 03 Format | Templat logic-less kompatibel Mustache/Handlebars subset: escape otomatis per konteks, partial, helper terdaftar (bukan kode), layout, tanpa `eval` | `handlebars` | LombokClarion (view), email transaksional, generator kode | P0 |
| N16 | LombokBarcode | L1 | 01 Visual | 1D: EAN-8/13, UPC-A/E, Code39, Code93, ITF-14, Codabar, GS1-128; 2D: DataMatrix ECC200, PDF417, Aztec; GS1 Application Identifier; keluaran daftar modul | `jsbarcode`, `bwip-js` | Label logistik, tiket, POS | P2 |
| N17 | LombokEInvoice | L2 | 06 Dokumen | Faktur elektronik: model UBL 2.1 dan UN/CEFACT CII, profil EN 16931, Factur-X/ZUGFeRD (CII dalam PDF/A-3), validasi aturan bisnis | - | Sistem akuntansi, ERP, LombokDocFlow | P3 |
| N18 | LombokOCR | L3 | 07 Data/ML | Antarmuka OCR dan mesin ringan (deteksi baris, pengenalan berbasis model kecil) di atas LombokUnram dan LombokImage | `tesseract.js` | Arsip pindaian, LombokMiner | P4 |
| N19 | LombokMathType | L2 | 06 Dokumen | Typesetting matematika (subset LaTeX dan MathML Core ke kotak tata letak), font matematika OpenType MATH | - | LombokMarkDown (render matematika), e-learning | P4 |
| D1 | LombokFontsData | data | - | Paket data font terbuka (Noto Sans/Serif subset per script, OFL-1.1) dengan manifest dan hash; dipisah dari kode agar lisensi kode tetap Apache-2.0 | font standar 14 PDFKit | Semua pemakai LombokFont | P1 |

Prioritas: P0 dibutuhkan untuk render HTML ke PDF yang benar secara minimal; P1 untuk fitur yang sudah diklaim README (i18n, gambar, tanda tangan, PDF/A); P2 melengkapi skill; P3 dan P4 perluasan.

### 5.2 Detail per library

**N1 LombokPDFCore** (L1, depend: LombokCompress, LombokEncryptDecrypt; salin opsional: inflate dari LombokCompress)
- Rujukan: ISO 32000-1:2008, ISO 32000-2:2020 (PDF 2.0); SOTA: qpdf (perbaikan dan linearisasi), pdf-writer/krilla (writer deterministik), PDFBox (COS model), lopdf.
- Penulisan deterministik: urutan objek, ID dokumen dari hash isi, tanggal opsional, sehingga byte keluaran identik lintas port untuk masukan yang sama (dasar vector).
- Modul: `syntax` (lexer/parser/writer), `filters` (Flate, LZW, ASCIIHex, ASCII85, RunLength, predictor PNG/TIFF; DCT dan JPX diteruskan), `document` (pohon halaman, merge, split, rotate, outline, named destinations, page labels), `annot` (link, watermark sebagai XObject), `forms` (AcroForm isi, ekstrak, buat, ratakan; tanpa XFA), `crypt` (RC4/AES-128/AES-256 R2-R6, baca dan tulis), `struct` (StructTreeRoot, MarkInfo, role map; untuk PDF/UA), `incremental` (append update untuk tanda tangan).
- Batas: kedalaman objek, panjang stream terdekompresi (anti bom), jumlah objek, siklus referensi.
- Port: Rust, TS, Python, Go, PHP. Vector: berkas PDF kecil buatan tangan plus korpus publik yang lisensinya diperiksa per berkas (misalnya sebagian korpus uji pdf.js) untuk uji toleransi berkas rusak.

**N2 LombokUnicode** (L0, tanpa dependensi)
- Data dibangkitkan dari UCD versi terkunci (16.0, naik ke 17.0) oleh skrip generator di repo; tabel trie dua tingkat yang sama di semua port.
- Lulus berkas uji resmi Unicode: `BidiTest.txt`, `BidiCharacterTest.txt`, `LineBreakTest.txt`, `GraphemeBreakTest.txt`, `WordBreakTest.txt`, `SentenceBreakTest.txt`, `NormalizationTest.txt`. Berkas ini menjadi vector (jauh di atas 100 kasus).
- `no_std` di Rust; ukuran data dapat dipangkas per fitur.

**N3 LombokFont** (L1, depend: LombokCompress untuk WOFF/WOFF2)
- Rujukan: OpenType 1.9, WOFF 1.0, WOFF2 (W3C); SOTA: ttf-parser, skrifa/read-fonts, fontTools subsetter, hb-subset.
- Subsetting menghasilkan font tersemat minimal dan CIDToGIDMap/ToUnicode untuk PDF (pembangkitan objek PDF ada di LombokLayout/LombokPDF, bukan di sini).
- Batas: tabel di luar berkas, offset melingkar, glyph komposit berulang (fuzzing wajib).

**N4 LombokShape** (L2, depend: LombokFont, LombokUnicode)
- Rujukan: spesifikasi OpenType shaping Microsoft per script, Unicode Arabic joining; SOTA: HarfBuzz, rustybuzz. Vector: subset uji `harfbuzz/test/shape` (MIT) dengan font bebas.
- Fase: (a) Latin, Kiril, Yunani, kerning dan ligatur; (b) Arab, Ibrani; (c) Indic dan USE; (d) Thai, Lao, Khmer, Myanmar dengan pemecahan kata kamus (dari LombokUnicode + kamus terpisah).

**N5 LombokHyphen** (L0)
- Algoritma Liang, format pola `hyph-utf8`; hanya membawa pola yang lisensinya kompatibel Apache-2.0 (MIT/BSD/public domain). Pola berlisensi lain dimuat oleh pengguna saat runtime.
- Pola bahasa Indonesia dan Melayu disertakan sejak awal.

**N6 LombokCSSOM** (L1, depend: LombokColor; salin: subset selector dari LombokHTML)
- Rujukan: CSS Syntax 3, Selectors 4, Cascade 5 (layer), Values 4, Paged Media 3, GCPM 3, Fragmentation 3, Lists 3 (counters), Fonts 4; SOTA: lightningcss, cssparser (Servo), WeasyPrint `css/`.
- Keluaran: computed style per elemen sebagai struktur data netral, dipakai LombokLayout.
- Batas: kedalaman nesting, jumlah aturan, panjang selector.

**N7 LombokLayout** (L2, depend: LombokCSSOM, LombokUnicode, LombokFont, LombokShape, LombokHyphen, LombokHTML; opsional: LombokSVG, LombokImage)
- Rujukan: CSS 2.1 visual formatting, CSS Text 3, Flexbox 1, Grid 1/2, Multi-column 1, Fragmentation 3; SOTA: WeasyPrint (paged media), Taffy (flex/grid), Typst (Knuth-Plass, footnote), Prince (GCPM).
- Keluaran display list netral: `GlyphRun`, `Path`, `Image`, `Link`, `StructTag`, `Destination`. Penulisan ke PDF (atau SVG/PNG) adalah backend terpisah, sehingga library ini tidak bergantung pada PDF.
- Pemberian tag struktur (H1-H6, P, Table, Figure dengan Alt, L/LI, Lbl) dihasilkan saat layout sehingga keluaran PDF/UA tidak perlu pasca-proses.
- Vector: pasangan HTML+CSS dan display list yang diharapkan (posisi dibulatkan ke 1/64 pt agar deterministik), ditambah subset WPT `css-page`, `css-break`, `css-flexbox`, `css-grid`.

**N8 LombokSVG** (L1, depend: LombokXML, LombokColor; opsional: LombokFont untuk teks)
- Rujukan: SVG 1.1 Second Edition, SVG 2 subset statis; SOTA: resvg/usvg dan suite uji resvg.

**N9 LombokImage** (L0; salin: inflate/deflate dari LombokCompress)
- Rujukan: PNG (ISO/IEC 15948, PNG 3rd Edition), JPEG (ITU T.81, JFIF), GIF89a, WebP (RFC 9649); SOTA: image-rs, zune-image, libjpeg-turbo sebagai referensi keluaran.
- Batas: dimensi maksimum dan anggaran memori sebelum decode (anti bom dekompresi).
- LombokJpegExif tetap fokus metadata; LombokUnram memakai LombokImage untuk I/O.

**N10 LombokColor** (L0)
- Rujukan: CSS Color 4, ICC.1:2022 (v4.4), IEC 61966-2-1 (sRGB). Profil sRGB dibangkitkan sendiri dari parameter standar sehingga tidak ada masalah lisensi untuk OutputIntent.

**N11 LombokRaster** (L1, depend: LombokColor; opsional: LombokFont)
- SOTA: tiny-skia, Blend2D, vello (konsep). Keluaran deterministik integer (tanpa SIMD yang mengubah hasil, sejalan dengan prinsip LombokVector).

**N12 LombokPDFText** (L2, depend: LombokPDFCore, LombokFont, LombokUnicode)
- Urutan baca berbasis struktur tag bila ada, heuristik geometri bila tidak (SOTA: pdf.js text layer, pdfminer layout analysis).

**N13 LombokPDFRender** (L3, depend: LombokPDFCore, LombokFont, LombokRaster, LombokImage, LombokColor)
- Vector: render halaman uji dibandingkan dengan toleransi piksel; korpus pdf.js.

**N14 LombokPKI** (L1, depend: LombokEncryptDecrypt)
- Primitif (RSA, ECDSA, SHA-2) tetap di LombokEncryptDecrypt (ADR-016); LombokPKI hanya format dan aturan validasi.
- Vector: Wycheproof (Apache-2.0) untuk verifikasi tanda tangan, x509-limbo untuk validasi rantai, sampel CMS/TSP RFC.
- Tanda tangan PDF: LombokPKI membuat CMS detached; LombokPDFCore menyediakan placeholder `/Contents`, `/ByteRange`, dan pembaruan inkremental; LombokPDF merangkai keduanya.

**N15 LombokTemplate** (L0; depend opsional: LombokLocale untuk helper format)
- Spesifikasi resmi Mustache spec (MIT) sebagai sebagian vector; subset Handlebars: `{{#each}}`, `{{#if}}`, `{{#with}}`, `{{> partial}}`, `{{{raw}}}` dengan peringatan, helper terdaftar.
- Escape sadar konteks (teks, atribut, URL) agar templat faktur tidak menjadi jalur injeksi.

**N16 LombokBarcode** (L1, depend: LombokECC yang sudah digeneralisasi)
- Rujukan: ISO/IEC 15420 (EAN/UPC), 16388 (Code39), 15417 (Code128), 16390 (ITF), 16022 (DataMatrix), 15438 (PDF417), 24778 (Aztec), GS1 General Specifications.
- Code128 dipindah dari LombokQRCode ke sini; LombokQRCode tetap khusus QR (dan Micro QR, rMQR sebagai perluasan).

**N17 LombokEInvoice** (L2, depend: LombokXML, LombokLocale, LombokValidator)
- Menghasilkan XML dan validasi aturan EN 16931; penyematan ke PDF/A-3 dilakukan oleh LombokPDF memakai LombokPDFCore dan LombokPDFA.

**D1 LombokFontsData** (paket data)
- Bukan library kode; dipublikasikan terpisah dengan lisensi OFL-1.1 dan manifest SHA-256 per berkas. LombokPDF memuatnya bila tersedia dan menyediakan fallback ke font yang diberikan pengguna.

## 6. Graf dependensi target

```
L0  LombokUnicode   LombokCompress   LombokEncryptDecrypt   LombokColor   LombokImage
    LombokHyphen    LombokTemplate   LombokLocale   LombokHTML   LombokMarkDown   LombokDocx
    LombokCSV       LombokXML        LombokSerde    LombokJSON   LombokECC        LombokCLIParse
    LombokLog       LombokStorage    LombokCache    LombokAsync  LombokSecurity   LombokPrivacy
    LombokCSS       LombokIcons      LombokJpegExif
         |
L1  LombokFont ------------- (LombokCompress)
    LombokCSSOM ------------ (LombokColor)
    LombokSVG -------------- (LombokXML, LombokColor)
    LombokPDFCore ---------- (LombokCompress, LombokEncryptDecrypt)
    LombokPKI -------------- (LombokEncryptDecrypt)
    LombokRaster ----------- (LombokColor)
    LombokBarcode, LombokQRCode -- (LombokECC)
    LombokValidator -------- (LombokLocale)
    LombokCharts, LombokTableSheet, LombokUnram (LombokImage)
         |
L2  LombokShape ------------ (LombokFont, LombokUnicode)
    LombokLayout ----------- (LombokCSSOM, LombokShape, LombokFont, LombokUnicode, LombokHyphen, LombokHTML)
    LombokPDFText ---------- (LombokPDFCore, LombokFont, LombokUnicode)
    LombokPDFA, LombokPDFUA  (LombokPDFCore, LombokXML)
    LombokEInvoice --------- (LombokXML, LombokLocale, LombokValidator)
         |
L3  LombokPDFRender -------- (LombokPDFCore, LombokFont, LombokRaster, LombokImage)
    LombokPDF -------------- (semua di atas sesuai fitur; skill memuat secara malas)
```

## 7. Peta fitur LombokPDF ke library

| Fitur / modul LombokPDF | Berkas saat ini | Library target |
|---|---|---|
| `from({ html })` | `skills/io/importHTML.ts`, `parse5` | LombokHTML, LombokCSSOM, LombokLayout |
| `from({ markdown })` | `skills/io/importMarkdown.ts`, `marked`, `gray-matter` | LombokMarkDown, LombokSerde (front matter) |
| `from({ docx })` | `skills/io/importDocx.ts`, `mammoth` | LombokDocx |
| `from({ csv })` | `skills/io/importCSV.ts` | LombokCSV, LombokTableSheet (opsional) |
| `from({ template, data })` | `templates/engine.ts`, `handlebars` | LombokTemplate, LombokLocale (helper), LombokValidator (skema data) |
| `.locale()` | `core/locale.ts` | LombokLocale |
| BiDi dan RTL | `core/bidi/resolver.ts`, `bidi-js` | LombokUnicode |
| `.theme()` | `integrations/lombokcss` | LombokCSS (token), LombokCSSOM |
| Mesin render (LLE) | `core/lle/*`, `pdfkit` | LombokLayout ke backend PDF di LombokPDF memakai LombokPDFCore, LombokFont (subset), LombokShape |
| Grafik | `integrations/lombokcharts` | LombokCharts ke LombokSVG ke display list |
| `merge`, `split`, `rotate`, `watermark`, `compress` | `skills/ops/*`, `pdf-lib` | LombokPDFCore, LombokCompress, LombokImage (resample gambar) |
| `formFill`, `formExtract`, `formCreate`, `formFlatten` | `skills/forms/*`, `pdf-lib` | LombokPDFCore (forms), LombokFont (appearance stream) |
| `encryptAES` | `skills/security/aes-encryptor.ts` | LombokPDFCore (crypt), LombokEncryptDecrypt |
| `signPKCS7`, `verify` | `skills/security/pkcs7.ts`, `verifier.ts`, `node-forge` | LombokPKI, LombokPDFCore (incremental), LombokEncryptDecrypt |
| `redact` | `skills/security/redactor.ts` | LombokPDFText, LombokPDFCore, LombokPrivacy (pola) |
| `qrcode` | `skills/marks/qrcode-generator.ts`, `qrcode` | LombokQRCode |
| `barcode`, `datamatrix`, `pdf417` | `skills/marks/*`, `jsbarcode`, `bwip-js` | LombokBarcode, LombokECC |
| `toc`, `bookmarks`, `footnotes`, `crossRef`, running header | `skills/structure/*` | LombokLayout (GCPM), LombokPDFCore (outline) |
| `exportPDFA` | `skills/io/pdfa-converter.ts` | LombokPDFA, LombokColor (OutputIntent), LombokXML (XMP), LombokFont (semua font tersemat) |
| `exportPDFUA` | `skills/io/pdfua-converter.ts` | LombokLayout (tag), LombokPDFCore (struct), LombokPDFUA (validasi) |
| `exportPNG`, `rasterize` | `skills/io/exportPNG.ts`, `sharp`, `pdf2pic` | LombokRaster (langsung dari display list), LombokPDFRender (dari PDF yang ada), LombokImage (encode PNG) |
| `exportSVG` | `skills/io/svg-exporter.ts` | Backend SVG dari display list LombokLayout |
| `crop`, `splitimg` | `skills/image/*`, `sharp` | LombokImage, LombokUnram |
| `ocr` | `skills/image/ocr-processor.ts`, `tesseract.js` | Antarmuka plugin sekarang; LombokOCR nanti |
| Faktur elektronik (baru) | - | LombokEInvoice, LombokPDFA (PDF/A-3) |
| CLI | `cli/index.ts`, `commander`, `chalk`, `ora` | LombokCLIParse, LombokLog, helper ANSI lokal |
| Adapter server (`deploy/`, `adapters/`) | - | LombokRateLimit, LombokResilience, LombokSecurity (CSP), LombokStorage |

## 8. Keputusan yang perlu diambil pemilik

1. **Lisensi font.** Font Noto berlisensi OFL-1.1, bukan Apache-2.0. Usulan: pisahkan sebagai paket data (D1) dan nyatakan di ADR bahwa aturan "Apache-2.0 saja" berlaku untuk kode, bukan aset font.
2. **Pola hyphenation.** Banyak pola TeX berlisensi LPPL. Usulan: hanya bawa pola MIT/BSD/public domain; sisanya dimuat pengguna.
3. **Mesin OCR.** Sampai LombokOCR ada, `ocr()` menjadi antarmuka plugin; mesin luar (misalnya tesseract) dipasang pengguna di luar paket inti agar aturan dependensi Lombok-saja tetap terpenuhi.
4. **Strategi port.** Usulan: Rust sebagai rujukan untuk library berat (N1, N3, N4, N7, N11, N13) dan dikompilasi ke WASM untuk dipakai port TS; Python, Go, PHP tetap port native yang lulus vector yang sama. Java, Ruby, .NET di LombokPDF menjadi binding tipis ke pustaka C-ABI dari Rust (tingkat dukungan 2), bukan port penuh.
5. **Nomor katalog dan cluster** untuk N1-N19 ditetapkan di dokumen induk; tabel bagian 5.1 hanya usulan.

## 9. Usulan perubahan untuk revisi dokumen induk (v3.7)

1. **Kebijakan salin antar library** (bagian 3 butir 2 dan 3) dibakukan sebagai ADR, termasuk kepala berkas salinan dan pemeriksaan vector asal di CI penyalin. LombokDocx (ZIP, inflate, XML) menjadi contoh rujukan.
2. **Tingkat L3 untuk produk** seperti LombokPDF dinyatakan eksplisit: boleh bergantung pada banyak library, tetap wajib SPEC dan vector untuk API publiknya sendiri (keluaran PDF deterministik).
3. **Cluster 06 Dokumen dan Tipografi** dibentuk untuk LombokLayout, LombokShape (atau di 03), LombokMathType, LombokEInvoice, sehingga Cluster 03 tetap untuk format dan parser.
4. **Pemeriksaan klaim README** ditambahkan ke `lombok doctor`: setiap fitur di README harus ditautkan ke bagian SPEC atau ditandai "rencana". Saat ini klaim berlebih ada di LombokPDF, LombokEncryptDecrypt (ekspor dikomentari), dan LombokPDFA/LombokPDFUA ("validation against ISO 19005" berbasis regex).
5. **Perbaikan ADR-019 di library lama**: LombokXML, LombokSerde, LombokJSON, LombokSimHash masih menyebut diri bagian dari framework/aplikasi tertentu di README.
6. **Generalisasi LombokECC** (polinom dan medan sembarang) agar dapat dipakai LombokQRCode, LombokBarcode, dan penyimpanan data (RS untuk arsip).
7. **Brotli di LombokCompress** (dibutuhkan WOFF2 dan HTTP), dan antarmuka streaming.
8. **Fuzzing wajib untuk parser biner** (PDF, OpenType, PNG, JPEG, WebP, ASN.1) memakai LombokFuzzer, dengan korpus disimpan di repo dan dijalankan terjadwal di CI.

## 10. Urutan pengerjaan

| Fase | Isi | Kriteria selesai |
|---|---|---|
| F0 Kepatuhan | LombokPDF: 10 dokumen publik, `.gitignore` ADR-024, hapus emoji, README "Mengapa library ini?" dengan klaim jujur, `lombok doctor` lulus kecuali SPEC/vector | `scripts/lombok-doctor.sh LombokPDF` hanya gagal pada SPEC/vector |
| F1 Pengganti cepat (selesai, lihat bagian 12) | Ganti `parse5`, `marked`, `gray-matter`, `mammoth`, `commander`, `chalk`, `ora`, `qrcode` dengan LombokHTML, LombokMarkDown, LombokDocx, LombokCLIParse, LombokQRCode; tutup celah front matter (LombokMarkDown) dan YAML (LombokSerde) | 8 dependensi pihak ketiga hilang, tes lama tetap lulus |
| F2 Fondasi teks dan objek | N2 LombokUnicode, N15 LombokTemplate, N1 LombokPDFCore, perombakan LombokEncryptDecrypt (CBC, SHA-2 lengkap) | `pdf-lib`, `handlebars`, `bidi-js` hilang; merge/split/rotate/forms/encrypt berjalan di LombokPDFCore |
| F3 Font dan gaya | N3 LombokFont, D1 LombokFontsData, N10 LombokColor, N6 LombokCSSOM | Font tersemat ter-subset; CSS terhitung untuk semua templat |
| F4 Mesin layout | N7 LombokLayout (block, inline, tabel, paginasi, GCPM), backend PDF di LombokPDF; N4 LombokShape fase a dan b | `pdfkit` hilang; 12 templat ter-render oleh mesin sendiri; Arab dan Ibrani benar |
| F5 Kepatuhan PDF | Perombakan LombokPDFA dan LombokPDFUA di atas LombokPDFCore; N14 LombokPKI; N8 LombokSVG; N9 LombokImage | `node-forge`, `sharp`, `xmldom` hilang; keluaran lulus veraPDF untuk PDF/A-2b dan PDF/UA-1; tanda tangan PAdES B-B dan B-T diverifikasi pembaca PDF umum |
| F6 Lengkap | N16 LombokBarcode, N5 LombokHyphen, N11 LombokRaster, N12 LombokPDFText, N4 fase c dan d | 0 dependensi runtime pihak ketiga; SPEC LombokPDF v2.0.0 dengan minimal 100 vector; rilis v2.0.0 |
| F7 Perluasan | N13 LombokPDFRender, N17 LombokEInvoice, N18 LombokOCR, N19 LombokMathType | Sesuai kebutuhan pemakai |

## 11. Jalur kontrak normatif (target)

`docs/SPEC_LombokPDF_v2.0.0.md` -> `vectors/lombokpdf-vectors-v1.json` (sha256 di SPEC; masukan HTML/CSS/data dan SHA-256 byte PDF keluaran deterministik) -> runner `tests/vectors.test.ts` dan runner per port.

## 12. Status F1

Selesai: 10 dependensi runtime pihak ketiga dihapus (`parse5`, `marked`, `marked-gfm-heading-id`, `gray-matter`, `yaml`, `mammoth`, `commander`, `chalk`, `ora`, `qrcode`). Sisa runtime pihak ketiga: `pdfkit`, `pdf-lib`, `sharp`, `handlebars`, `bidi-js`, `hyphen`, `@types/hyphen`, `jsbarcode` (F2-F6).

| Pengganti | Cara pakai | Bukti |
|---|---|---|
| LombokHTML 0.2.0 (ad2bc25) | salinan `src/vendor/lombokhtml` | 228 vector asal |
| LombokMarkDown 2.0.0 (4fceb72) | salinan `src/vendor/lombokmarkdown` | 114 vector asal |
| LombokDocx 1.1.0 (16e37bd) | salinan `src/vendor/lombokdocx` | 163 vector asal |
| LombokCLIParse 0.2.0 (86110d2) | salinan `src/vendor/lombokcliparse` | 134 vector asal |
| LombokQRCode 0.2.1 | dependensi npm `lombokqrcode` (sudah terbit) | decode ulang PDF oleh decoder independen |
| YAML subset + front matter | modul sementara `src/templates/front-matter.ts` | sama dengan `gray-matter` untuk 12 templat bawaan |

Library yang belum terbit di npm dipakai lewat salinan (bagian 3), dan diganti menjadi dependensi npm setelah terbit. Total 639 kasus vector asal lulus terhadap salinan (`tests/vendor/vendor-vectors.test.ts`); `npm run audit:vendor` memastikan salinan tidak disunting lokal.

Celah yang ditemukan selama F1, untuk ditutup di library asal:

- LombokCLIParse: belum ada argumen posisional variadik (`merge <files...>`) dan alias `-v` untuk versi; sementara ditangani `normalizeArgv()` di `src/cli/index.ts`.
- LombokSerde: belum ada YAML; `src/templates/front-matter.ts` ditulis tanpa impor LombokPDF agar dapat dipindah utuh beserta tesnya.
- LombokMarkDown: belum ada pemisahan front matter.
- Salinan TypeScript tidak lolos opsi `exactOptionalPropertyTypes` dan `noUncheckedIndexedAccess` milik LombokPDF, sehingga diberi `// @ts-nocheck`. Usulan: library asal mengaktifkan kedua opsi tersebut agar salinan dapat diperiksa tipe di repo pemakai.
- Port Python LombokPDF masih memakai `python-mammoth`; penggantinya port Python LombokDocx (sudah ada di `LombokDocx/ports/python`).

Kondisi lama yang belum berubah (bukan regresi F1): 24 galat `tsc`, 20 tes lama gagal (mock vitest 5 dan templat `invoice` yang tidak dapat di-parse Handlebars, F2), `tsup` gagal karena impor `node-forge`/`xmldom` yang tidak terdaftar, dan `npm ci` gagal karena tidak ada lockfile serta konflik peer TypeScript 7 dengan `@typescript-eslint`.

*Lisensi dokumen: Apache-2.0 · © codinglombok*
