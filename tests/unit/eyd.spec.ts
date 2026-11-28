import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { test } from '@japa/runner'
import app from '@adonisjs/core/services/app'

/**
 * Mechanical EYD V checks over resources/lang/id (D-471). The rules and
 * their sources are summed up in docs/drafts/eyd-rules.md; everything a
 * pattern cannot judge stays a manual review item listed there.
 */

const LANG_DIR = app.makePath('resources/lang/id')

type Messages = Record<string, string>

function flatten(value: unknown, prefix: string, into: Messages) {
  if (typeof value === 'string') {
    into[prefix] = value
  } else if (value && typeof value === 'object' && !Array.isArray(value)) {
    for (const [key, child] of Object.entries(value)) flatten(child, `${prefix}.${key}`, into)
  }
}

function loadLang() {
  const messages: Messages = {}
  for (const file of readdirSync(LANG_DIR).sort()) {
    if (!file.endsWith('.json')) continue
    const parsed: unknown = JSON.parse(readFileSync(join(LANG_DIR, file), 'utf8'))
    flatten(parsed, file.replace(/\.json$/, ''), messages)
  }
  return messages
}

/** Letters and digits on either side mean "inside a word". */
const B = '(?<![\\p{L}\\p{N}])'
const E = '(?![\\p{L}\\p{N}])'
const word = (body: string, flags = 'iu') => new RegExp(`${B}(?:${body})${E}`, flags)

/**
 * Non-standard spellings and their KBBI/EYD standard forms. Only forms
 * that are never right in SIGRAK copy belong here; words with a second
 * meaning ("rubah" is a fox) stay out.
 */
const MISSPELLINGS: Record<string, string> = {
  'praktek': 'praktik',
  'analisa': 'analisis',
  'menganalisa': 'menganalisis',
  'kwalitas': 'kualitas',
  'kwalifikasi': 'kualifikasi',
  'kwitansi': 'kuitansi',
  'kwartal': 'kuartal',
  'kwota': 'kuota',
  'nasehat': 'nasihat',
  'apotik': 'apotek',
  'sistim': 'sistem',
  'jadual': 'jadwal',
  'ijin': 'izin',
  'mengijinkan': 'mengizinkan',
  'perijinan': 'perizinan',
  'resiko': 'risiko',
  'standarisasi': 'standardisasi',
  'standart': 'standar',
  'ekstra kurikuler': 'ekstrakurikuler',
  'ekstra-kurikuler': 'ekstrakurikuler',
  'ekstrakulikuler': 'ekstrakurikuler',
  'ko kurikuler': 'kokurikuler',
  'ko-kurikuler': 'kokurikuler',
  'walikelas': 'wali kelas',
  'wali-kelas': 'wali kelas',
  'orangtua': 'orang tua',
  'orang-tua': 'orang tua',
  'silahkan': 'silakan',
  'terimakasih': 'terima kasih',
  'aktifitas': 'aktivitas',
  'efektifitas': 'efektivitas',
  'kreatifitas': 'kreativitas',
  'produktifitas': 'produktivitas',
  'obyek': 'objek',
  'obyektif': 'objektif',
  'subyek': 'subjek',
  'subyektif': 'subjektif',
  'propinsi': 'provinsi',
  'tehnik': 'teknik',
  'tekhnik': 'teknik',
  'tehnologi': 'teknologi',
  'merubah': 'mengubah',
  'dirubah': 'diubah',
  'perubah': 'pengubah',
  'ketrampilan': 'keterampilan',
  'trampil': 'terampil',
  'himbauan': 'imbauan',
  'menghimbau': 'mengimbau',
  'hapal': 'hafal',
  'menghapal': 'menghafal',
  'nomer': 'nomor',
  'fotocopy': 'fotokopi',
  'foto kopi': 'fotokopi',
  'antri': 'antre',
  'antrian': 'antrean',
  'sekedar': 'sekadar',
  'jaman': 'zaman',
  'ijasah': 'ijazah',
  'terlanjur': 'telanjur',
  'karir': 'karier',
  'kadaluarsa': 'kedaluwarsa',
  'kadaluwarsa': 'kedaluwarsa',
  'diagnosa': 'diagnosis',
  'hipotesa': 'hipotesis',
  'metoda': 'metode',
  'frekwensi': 'frekuensi',
  'konkrit': 'konkret',
  'kongkrit': 'konkret',
  'koordinir': 'koordinasi',
  'mengkoordinir': 'mengoordinasi',
  'kordinasi': 'koordinasi',
  'managemen': 'manajemen',
  'menejemen': 'manajemen',
  'pebruari': 'Februari',
  'nopember': 'November',
  "jum'at": 'Jumat',
  'sholat': 'salat',
  'shalat': 'salat',
  'ramadhan': 'Ramadan',
  'adzan': 'azan',
  "do'a": 'doa',
  'ustadz': 'ustaz',
  'wudhu': 'wudu',
  'rapot': 'rapor',
  'raport': 'rapor',
  'katagori': 'kategori',
  'tauladan': 'teladan',
  'ihlas': 'ikhlas',
  'faham': 'paham',
  'nafas': 'napas',
  'kuatir': 'khawatir',
  'mesjid': 'masjid',
  'mempengaruhi': 'memengaruhi',
  'mentaati': 'menaati',
  'mensukseskan': 'menyukseskan',
  'menterjemahkan': 'menerjemahkan',
  'mensosialisasikan': 'menyosialisasikan',
  'mengkonfirmasi': 'mengonfirmasi',
  'mengkoreksi': 'mengoreksi',
  'mengkomunikasikan': 'mengomunikasikan',
  'mengkonsumsi': 'mengonsumsi',
  'akte': 'akta',
  'atmosfir': 'atmosfer',
  'azas': 'asas',
  'jenasah': 'jenazah',
  'detil': 'detail',
  'hakekat': 'hakikat',
  'komplit': 'komplet',
  'nampak': 'tampak',
  'teoritis': 'teoretis',
  'seksama': 'saksama',
  'pondasi': 'fondasi',
  'rejeki': 'rezeki',
  'frase': 'frasa',
  'hirarki': 'hierarki',
  'ekstrim': 'ekstrem',
  'prosentase': 'persentase',
  'survey': 'survei',
  'eksport': 'ekspor',
  'tanda-tangan': 'tanda tangan',
  'tandatangan': 'tanda tangan',
  'utk': 'untuk',
  'yg': 'yang',
  'dgn': 'dengan',
  'tdk': 'tidak',
}

function misspellings(value: string) {
  const found: string[] = []
  for (const [wrong, right] of Object.entries(MISSPELLINGS)) {
    const pattern = wrong.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/ /g, '\\s+')
    if (word(pattern).test(value)) found.push(`"${wrong}" → "${right}"`)
  }
  return found
}

/**
 * Kata depan di/ke stay apart from the word after them (EYD "Kata
 * Depan"). Only place and direction words are listed, so passive verbs
 * such as "dimasukkan" or "disimpan" never match. "keluar" (to exit)
 * and "kemari" are one word in KBBI.
 */
const PLACE_WORDS = [
  'mana',
  'sini',
  'sana',
  'situ',
  'atas',
  'bawah',
  'dalam',
  'depan',
  'belakang',
  'samping',
  'sebelah',
  'antara',
  'tengah',
  'sekitar',
  'rumah',
  'sekolah',
  'kelas',
  'kantor',
  'bagian',
  'halaman',
  'menu',
  'akun',
]
// "kebagian" (to get a share) is a word of its own.
const JOINED_PREPOSITION = word(
  `di(?:${PLACE_WORDS.join('|')}|luar)|ke(?:${PLACE_WORDS.filter((w) => w !== 'bagian').join('|')})`
)

/** Passive di- written apart from a common verb ("di simpan"). */
const SPLIT_PASSIVE = word(
  'di\\s+(?:simpan|kirim|hapus|ubah|pakai|tambah(?:kan)?|undang|terima|tolak|batalkan|unduh|perbarui|periksa|pilih|ganti|tampilkan|gunakan|buat|setujui|nonaktifkan|aktifkan)'
)

function prepositions(value: string) {
  const found: string[] = []
  const joined = value.match(new RegExp(JOINED_PREPOSITION.source, 'giu'))
  for (const match of joined ?? [])
    found.push(`"${match}" → "${match.replace(/^(di|ke)/i, '$1 ')}"`)
  const split = value.match(new RegExp(SPLIT_PASSIVE.source, 'giu'))
  for (const match of split ?? []) found.push(`"${match}" → "${match.replace(/\s+/, '')}"`)
  return found
}

/**
 * Money: "Rp" with no space and no period, straight before the amount
 * (EYD "Singkatan", D-469). "{amount}" placeholders count as amounts.
 */
const MONEY = new RegExp(`${B}(?:Rp(?:\\.\\s*|\\s+)|RP\\.?\\s*|rp\\.?\\s*)(?=[\\d{])`, 'u')

function money(value: string) {
  return MONEY.test(value) ? ['write money as "Rp1.234.567" (no space, no period)'] : []
}

/** Times: "14.30" with a dot (house choice of D-469); "WIB" in capitals. */
function times(value: string) {
  const found: string[] = []
  if (/(?<![\p{L}\p{N}])\d{1,2}:\d{2}(?![\p{L}\p{N}]|[.,]\d)/u.test(value))
    found.push('write times as "14.30"')
  if (/(?<!\p{L})(?!WIB)[wW][iI][bB](?!\p{L})/u.test(value)) found.push('write "WIB" in capitals')
  return found
}

/** Reduplication is written in full with a hyphen, never with "2". */
const REDUPLICATION = new RegExp(`${B}\\p{L}\\p{Ll}+2${E}`, 'u')

function reduplication(value: string) {
  const match = value.match(REDUPLICATION)
  return match ? [`"${match[0]}": write the word twice with a hyphen`] : []
}

/** "Anda" always starts with a capital (EYD "Huruf Kapital", note a). */
function pronouns(value: string) {
  return new RegExp(`${B}anda${E}`, 'u').test(value) ? ['"anda" → "Anda"'] : []
}

/**
 * pun: apart after other words ("apa pun"), joined in the conjunctions
 * EYD lists ("walaupun"). "sekali pun" and "sekalipun" are both right.
 */
const PUN_CONJUNCTIONS = [
  'ada',
  'andai',
  'atau',
  'bagaimana',
  'biar',
  'jika',
  'kalau',
  'kendati',
  'mau',
  'meski',
  'sekali',
  'sementang',
  'sungguh',
  'walau',
]
/** Words that simply end in "pun". */
const PUN_ROOTS = ['ampun', 'rumpun', 'himpun', 'menghimpun', 'dihimpun', 'berhimpun', 'terhimpun']

function pun(value: string) {
  const found: string[] = []
  for (const match of value.matchAll(new RegExp(`${B}(\\p{L}+)pun${E}`, 'giu'))) {
    const whole = match[0].toLowerCase()
    const head = match[1].toLowerCase()
    if (!PUN_CONJUNCTIONS.includes(head) && !PUN_ROOTS.includes(whole)) {
      found.push(`"${match[0]}" → "${match[1]} pun"`)
    }
  }
  const split = PUN_CONJUNCTIONS.filter((head) => head !== 'sekali').join('|')
  for (const match of value.matchAll(new RegExp(`${B}(${split})\\s+pun${E}`, 'giu'))) {
    found.push(`"${match[0]}" → "${match[1]}pun"`)
  }
  return found
}

/**
 * Short labels and titles end without a period (EYD "Tanda Titik":
 * no period after titles and headings). Keys are snake_case English:
 * a label is a key whose last part names one, or any key inside a
 * group of labels such as `actions`, `fields` or `nav`.
 */
const LABEL_KEY = /(^|_)(title|label|heading|button|action|submit|caption|legend|placeholder)$/
const LABEL_GROUPS = new Set([
  'actions',
  'fields',
  'labels',
  'titles',
  'nav',
  'kinds',
  'levels',
  'modes',
  'outcomes',
  'roles',
  'scenarios',
  'semesters',
  'sources',
  'statuses',
  'status',
  'step_status',
  'steps',
  'summary',
  'views',
  'month_nav',
  'exam_types',
  'invitation_states',
  'paper_sizes',
])
/** A final abbreviation keeps its period (EYD "Singkatan"). */
const ABBREVIATIONS = new Set([
  'No.',
  'dll.',
  'dsb.',
  'dst.',
  'dkk.',
  'hlm.',
  'Yth.',
  'ybs.',
  'ttd.',
  'a.n.',
  's.d.',
  'Jl.',
  'Prof.',
  'Dr.',
  'dr.',
  'S.Pd.',
  'M.Pd.',
])

/** Keys that hold a sentence even inside a group of labels. */
const SENTENCE_KEY = /(^|_)(hint|intro|body|description|note|help)$/

/** Files whose every value is a label: the menus (nav.json). */
const LABEL_FILES = new Set(['nav'])

function isLabelKey(key: string) {
  const parts = key.split('.')
  const last = parts.at(-1) ?? ''
  if (SENTENCE_KEY.test(last)) return false
  return (
    LABEL_FILES.has(parts[0]) ||
    LABEL_KEY.test(last) ||
    parts.slice(1, -1).some((part) => LABEL_GROUPS.has(part))
  )
}

function labelPeriod(value: string, key: string) {
  if (!isLabelKey(key) || !value.endsWith('.')) return []
  const lastWord = value.split(/\s+/).at(-1) ?? ''
  return ABBREVIATIONS.has(lastWord) ? [] : ['label or title ends with a period']
}

/**
 * No space before . , ; : ? ! and a space after , ; : before a word
 * (EYD punctuation pages). Decimal commas ("1,5") and URLs stay out.
 */
function spacing(value: string) {
  const found: string[] = []
  const before = value.match(/\s[.,;:?!]/u)
  if (before) found.push(`space before "${before[0].trim()}"`)
  const after = value.match(/[,;](?=[\p{L}{])|:(?=[\p{L}{])/u)
  if (after) found.push(`no space after "${after[0]}"`)
  return found
}

/**
 * Document abbreviations take their period (EYD "Singkatan" 4a/4b):
 * dll., dsb., dst., dkk., hlm., yth., s.d., a.n.
 */
function abbreviations(value: string) {
  const found: string[] = []
  const bare = value.match(/(?<!\p{L})(dll|dsb|dst|dkk|hlm|yth)(?![\p{L}.])/iu)
  if (bare) found.push(`"${bare[0]}" → "${bare[0]}."`)
  if (/(?<!\p{L})(s\/d|sd\.)(?!\p{L})/iu.test(value)) found.push('write "s.d." or "sampai"')
  return found
}

/**
 * Names that keep their capitals inside a label (D-472): SIGRAK feature
 * names, products, subject names and the polite "Anda". Everything else
 * in a menu label, page title or button is capitalised on the first word
 * only ("Hari ini", "Pengaturan sekolah", "Simpan perubahan").
 */
const LABEL_PROPER_NAMES = [
  'Bank Soal',
  'Dokumen Saya',
  'Kunci AI',
  'Simulasi TKA',
  'Paket Soal TKA',
  'Quiz Battle',
  'Berkas Administrasi',
  'Tim SIGRAK',
  'Cerita Sekolah',
  'Kabar',
  'Seni dan Budaya',
  'Seni Musik',
  'Seni Rupa',
  'Seni Tari',
  'Seni Teater',
  'Pendidikan Pancasila',
  'Pendidikan Agama Kristen',
  'Pendidikan Agama Katolik',
  'Pendidikan Agama Hindu',
  'Pendidikan Agama Buddha',
  'Pendidikan Agama Khonghucu',
  'Anda',
  'Word',
  'Excel',
  'Google',
  'Gemini',
]

/**
 * D-472: a label with a capitalised word after the first, outside the
 * names above. A word right before a placeholder names a place or a
 * person ("Kesepakatan Kabupaten {name}") and keeps its capital; ALL
 * CAPS abbreviations (NPSN, PDF) and labels that hold whole sentences
 * are left out.
 */
function labelCapitals(value: string, key: string) {
  if (!isLabelKey(key) || /[.?!]\s/.test(value)) return []
  let text = value
  for (const name of LABEL_PROPER_NAMES) text = text.replaceAll(name, name.toLowerCase())
  const words = text.split(/\s+/)
  const found = words
    .slice(1)
    .filter((part, index) => /^[("“]?\p{Lu}\p{Ll}/u.test(part) && words[index + 2] !== '{}')
  return found.map((part) => `"${part}" → small letter (D-472)`)
}

type Check = {
  name: string
  run: (value: string, key: string) => string[]
  bad: string[]
  good: string[]
  /** Key used for the samples (only the label check reads it). */
  sampleKey?: string
}

const CHECKS: Check[] = [
  {
    name: 'standard spelling',
    run: misspellings,
    bad: [
      'Silahkan masuk.',
      'Jadwal praktek',
      'Analisa hasil',
      'Resiko tinggi',
      'Data orangtua murid',
      'Ijin tidak masuk',
      'Kegiatan ekstra kurikuler',
      'Nama walikelas',
      'Standarisasi nilai',
      'Sistim baru',
    ],
    good: [
      'Silakan masuk.',
      'Jadwal praktik dan analisis',
      'Risiko, kualitas, nasihat, apotek, sistem, izin',
      'Standardisasi, ekstrakurikuler, kokurikuler',
      'Wali kelas dan orang tua',
      'Perubahan wilayah',
    ],
  },
  {
    name: 'kata depan di/ke',
    run: prepositions,
    bad: [
      'Dimana file disimpan?',
      'Pergi kemana?',
      'Klik disini',
      'Ada disana',
      'Tinggal dirumah',
      'Lihat diatas',
      'Simpan diluar folder',
      'Data di simpan otomatis',
      'Undangan di kirim ulang',
    ],
    good: [
      'Di mana file disimpan?',
      'Data dimasukkan dan dikirim ke sana',
      'Ia keluar dari rumah, lalu kemari',
      'Ditambahkan di atas, di luar, di sini',
      'Kemarin dan dimanfaatkan',
    ],
  },
  {
    name: 'money',
    run: money,
    bad: ['Rp 1.234.567', 'Rp. 5.000', 'Rp.5.000', 'Sisa Rp {amount}', 'RP5.000'],
    good: ['Rp1.234.567', 'Sumbangan Rp{amount}', 'Rp1.234.567,00', 'Total -Rp5.000'],
  },
  {
    name: 'times',
    run: times,
    bad: ['Coba lagi pukul 14:30', 'Sampai {time} wib', 'Mulai 07.00 Wib'],
    good: ['Coba lagi pukul 14.30 WIB', 'Sampai {time} WIB', 'Skala 1:10.000'],
  },
  {
    name: 'reduplication',
    run: reduplication,
    bad: ['Data anak2', 'Hati2 di jalan', 'Kata2 sulit'],
    good: ['Data anak-anak', 'Kertas A4', 'Lulusan S1', 'Kelas 2'],
  },
  {
    name: 'Anda',
    run: pronouns,
    bad: ['Dokumen anda tersimpan.', 'Kunci AI milik anda'],
    good: ['Dokumen Anda tersimpan.', 'Ayahanda dan ibunda'],
  },
  {
    name: 'pun',
    run: pun,
    bad: [
      'Apapun pilihannya',
      'Siapapun boleh',
      'Tidak ada satupun',
      'Walau pun lelah',
      'Murid mau pun guru',
    ],
    good: [
      'Apa pun pilihannya',
      'Walaupun lelah, meskipun sibuk, adapun, maupun, bagaimanapun',
      'Sekalipun teman, belum sekali pun datang',
      'Rumpun ilmu',
      'Sekolah mana pun',
    ],
  },
  {
    name: 'label period',
    run: labelPeriod,
    sampleKey: 'sample.actions.save',
    bad: ['Simpan.', 'Unduh PDF.', 'Data diri.'],
    good: ['Simpan', 'No.', 'Keluar dari SIGRAK?', 'Memuat…', 'dll.'],
  },
  {
    name: 'label capitals',
    run: labelCapitals,
    sampleKey: 'sample.actions.save',
    bad: ['Hari Ini', 'Pengaturan Sekolah', 'Simpan Perubahan', 'Kembali ke Tahun Ajaran'],
    good: [
      'Hari ini',
      'Buka Dokumen Saya',
      'Unduh PDF',
      'Kunci AI Anda',
      'Kesepakatan Kabupaten {name}',
      'Simpan perubahan',
    ],
  },
  {
    name: 'punctuation spacing',
    run: spacing,
    bad: ['Keluar ?', 'Halo , {name}', 'Sesi :{title}', 'Selesai !', 'Halo,{name}'],
    good: ['Keluar?', 'Halo, {name}.', 'Sesi: {title}', 'Nilai 1,5', 'https://sekolah.sch.id'],
  },
  {
    name: 'abbreviations',
    run: abbreviations,
    bad: ['Buku, pensil, dll', 'Kelas 1 s/d 6', 'Lihat hlm 3'],
    good: ['Buku, pensil, dll.', 'Kelas 1 s.d. 6', 'Lihat hlm. 3', 'Kelas 1 sampai 6'],
  },
]

/** Placeholder names are code, not copy. */
const clean = (value: string) => value.replace(/\{\w+\}/g, '{}')

test.group('EYD: lang/id values', () => {
  test('every value follows the mechanical EYD checks', ({ assert }) => {
    const problems: string[] = []
    for (const [key, value] of Object.entries(loadLang())) {
      for (const check of CHECKS) {
        for (const problem of check.run(clean(value), key)) {
          problems.push(`${key}: ${check.name}: ${problem}`)
        }
      }
    }
    assert.deepEqual(problems, [])
  })

  for (const check of CHECKS) {
    test(`the ${check.name} check catches bad samples and passes good ones`, ({ assert }) => {
      const key = check.sampleKey ?? 'sample.text'
      for (const sample of check.bad) {
        assert.isNotEmpty(check.run(clean(sample), key), `should flag: ${sample}`)
      }
      for (const sample of check.good) {
        assert.isEmpty(check.run(clean(sample), key), `should pass: ${sample}`)
      }
    })
  }

  test('the label check reads key names', ({ assert }) => {
    assert.isTrue(isLabelKey('auth.titles.login'))
    assert.isTrue(isLabelKey('accounts.invitation.title'))
    assert.isTrue(isLabelKey('accounts.teachers.invite_title'))
    assert.isTrue(isLabelKey('common.actions.save'))
    assert.isTrue(isLabelKey('regions.directory.fields.name'))
    assert.isTrue(isLabelKey('nav.school_settings'))
    assert.isTrue(isLabelKey('nav.console.calendar'))
    assert.isFalse(isLabelKey('accounts.invitation.intro'))
    assert.isFalse(isLabelKey('common.toasts.saved'))
    assert.isFalse(isLabelKey('errors.general'))
    assert.isFalse(isLabelKey('auth.fields.password_hint'))
    assert.isNotEmpty(labelCapitals('Ganti Peran', 'common.actions.switch'))
    assert.isEmpty(labelCapitals('Ganti Peran', 'common.toasts.switched'))
  })
})
