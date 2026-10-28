# ether-db

Database key-value sederhana dengan TypeScript dan Node.js. Data disimpan dalam file JSON dan dimuat kembali saat database dibuka. Proyek ini melanjutkan ether-http dalam Engineering Journey.

## Menjalankan

Gunakan Node.js 24 dan npm. Proyek ini memakai ether-http sebagai dependency lokal. Clone kedua repository berdampingan (lewati `git clone` jika folder sudah ada):

```sh
git clone https://github.com/Etherlyvan/ether-http.git
git clone https://github.com/Etherlyvan/ether-db.git
cd ether-http
npm ci
npm run build
cd ../ether-db
```

Dari folder `ether-db`:

```sh
npm ci
npm run dev
```

Demo menyimpan user di `data/demo.json`, mencoba penghapusan, lalu membuka ulang database untuk memverifikasi persistensi. Jalankan lagi untuk melihat nilai user sebelumnya. File demo diabaikan oleh Git.

```sh
npm run check
npm test
npm run build
npm start
```

## Penggunaan

```ts
import { Database } from './database.js';

const db = new Database('data/store.json');
db.set('user', { name: 'etherlyvan' });
console.log(db.get('user')); // { name: 'etherlyvan' }
console.log(db.has('user')); // true
console.log(db.keys());     // ['user']
console.log(db.size);       // 1
db.delete('user');          // true; false jika key tidak ditemukan
```

Contoh import di atas berlaku untuk file di dalam `src/`. API bersifat synchronous. Setiap `set` dan penghapusan key yang ada langsung disimpan; tidak perlu `close()` atau `flush()`. `get()` mengembalikan `undefined` untuk key yang tidak ditemukan. Key harus string yang tidak kosong. Nilai mendukung null, boolean, angka finite, string, array, dan object JSON biasa. Undefined, BigInt, Date, array berlubang, dan referensi melingkar ditolak. Input dan hasil `get` disalin sehingga perubahan object dari pemanggil tidak mengubah database secara diam-diam.

## Cara penyimpanan bekerja

`Map → snapshot JSON → file sementara → rename ke file database → perbarui Map`

File memiliki format berversi:

```json
{
  "version": 1,
  "entries": [["user", {"name": "etherlyvan"}]]
}
```

File sementara dibuat di direktori yang sama untuk mengganti snapshot melalui rename. Jika penulisan atau penggantian gagal, nilai di memori tetap seperti sebelumnya dan error diteruskan. File yang tidak ada dibuka sebagai database kosong; file baru dibuat pada penulisan pertama. File rusak atau format yang tidak didukung menyebabkan error dan tidak ditimpa otomatis.

## Batasan

Proyek belajar untuk data kecil, dengan satu instance pemilik per file. Tidak ada locking antarproses/instance; membuka beberapa instance untuk menulis file yang sama dapat menyebabkan perubahan saling menimpa. Semua data ada di memori, setiap perubahan menulis ulang seluruh snapshot, dan operasi file synchronous memblokir event loop. Belum ada transaksi multioperasi, indeks, query, enkripsi, atau write-ahead log. Rename bukan jaminan data bertahan dari listrik mati: belum ada fsync atau pemulihan otomatis file sementara setelah proses berhenti mendadak.

Tes menggunakan direktori sementara untuk memeriksa persistensi, overwrite, penghapusan, isolasi object, data tidak valid, file rusak, dan kegagalan penulisan. Tes API juga menutup dan membuka ulang server untuk memeriksa persistensi melalui HTTP.

## API HTTP dengan ether-http

```sh
npm run serve
```

Server memakai ether-http (TCP), berjalan di `http://127.0.0.1:3001`, dan menyimpan data di `data/api.json`. Variabel lingkungan `PORT` dan `DB_PATH` dapat mengubah port dan lokasi file. Untuk menjalankan hasil build: `npm run build`, lalu `npm run serve:built`. Server ether-http pada port 3000 tidak perlu dijalankan terpisah.

| Method | Endpoint | Fungsi |
|---|---|---|
| GET | `/health` | Status server |
| GET | `/keys` | Semua key dan jumlahnya |
| PUT | `/kv?key=user` | Simpan atau timpa nilai JSON |
| GET | `/kv?key=user` | Baca nilai; 404 jika tidak ditemukan |
| DELETE | `/kv?key=user` | Hapus nilai; 404 jika tidak ditemukan |

`key` harus ada tepat satu kali dan tidak kosong. Encode karakter khusus pada key sebagai URL query parameter. PUT wajib memakai `Content-Type: application/json` (415 jika tidak sesuai); JSON tidak valid menghasilkan 400. Nilai `null` disimpan sebagai nilai, bukan sebagai penghapusan. GET juga mendukung HEAD tanpa body. Error penyimpanan menghasilkan 500 tanpa detail internal.

Contoh di PowerShell, gunakan string JSON sederhana agar konsisten pada Windows PowerShell dan PowerShell baru:

```powershell
curl.exe -i -X PUT 'http://127.0.0.1:3001/kv?key=score' -H 'Content-Type: application/json' --data-binary '42'
curl.exe -i 'http://127.0.0.1:3001/kv?key=score'
curl.exe -i 'http://127.0.0.1:3001/keys'
curl.exe -i -X DELETE 'http://127.0.0.1:3001/kv?key=score'
```

Untuk mencoba object JSON di PowerShell:

```powershell
Invoke-RestMethod -Method Put -Uri 'http://127.0.0.1:3001/kv?key=user' -ContentType 'application/json' -Body '{"name":"etherlyvan"}'
```

API ini untuk pembelajaran lokal: server mengikat alamat loopback dan belum memiliki autentikasi. Batas ukuran request dan batasan protokol mengikuti ether-http. Jangan membuka instance database kedua untuk menulis file yang sedang dipakai API.
