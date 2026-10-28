# ether-db

Database key-value sederhana dengan TypeScript dan Node.js. Data disimpan dalam file JSON dan dimuat kembali saat database dibuka. Proyek ini melanjutkan ether-http dalam Engineering Journey.

## Menjalankan

Gunakan Node.js 24 dan npm. Buka terminal di folder `ether-db`:

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

Tes menggunakan direktori sementara untuk memeriksa persistensi, overwrite, penghapusan, isolasi object, data tidak valid, file rusak, dan kegagalan penulisan. Integrasi API dengan ether-http dapat dibuat setelah fondasi penyimpanan ini dipahami.
