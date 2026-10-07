# CLAUDE.md

Catatan kerja untuk asisten AI di repo ini (dan di seluruh Lombok Ecosystem).

## Alur kerja repo library baru

Library baru yang dihasilkan (misalnya daftar N1-N19 di `docs/map_LombokPDF_v1.0.0.md` bagian 5)
dikemas sebagai ZIP berisi struktur repo lengkap sesuai standar v3.6. Pemilik mengunggah ZIP
tersebut sendiri lewat GitHub Desktop; setelah repo ada di GitHub, perbaikan dilakukan bersama
di repo itu. Asisten tidak membuat repo GitHub baru lewat API.

## Salinan library Lombok (`src/vendor/`)

- Berkas di `src/vendor/` adalah salinan dari library Lombok; jangan diubah di sini. Perbaiki di
  repo asal, salin ulang, lalu jalankan `node scripts/check-vendor.mjs --update`.
- `node scripts/check-vendor.mjs` memastikan salinan sama dengan MANIFEST;
  `tests/vendor/vendor-vectors.test.ts` menjalankan vector library asal terhadap salinan.
