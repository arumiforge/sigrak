// Arabic test sheet: shaping, harakat, bidi and fonts (spike).
// The Qur'anic text here is typed for a rendering test only; any use in
// content needs a check by Tim Validasi SIGRAK (D-113).
#import "lib.typ": *

#show: sigrak-doc.with(
  title: "Uji Tulisan Arab",
  school: "Spike R0-07",
  paper: sys.inputs.at("paper", default: "a4"),
)

#align(center, text(size: 14pt, weight: "bold")[Uji Tulisan Arab untuk MI])
#align(center, text(fill: colors.muted)[Bentuk huruf, harakat, arah kanan ke kiri, dan dua fon: Noto Naskh Arabic dan Amiri.])

#let both(body, size: 18pt) = table(
  columns: (18%, 1fr),
  align: (left + horizon, right + horizon),
  fill: none,
  [Noto Naskh Arabic], ar-block(body, size: size, font: "Noto Naskh Arabic"),
  [Amiri], ar-block(body, size: size, font: "Amiri"),
)

#section[1. Surah Al-Ikhlas (harakat lengkap, tanda waqaf, nomor ayat)]
#both[بِسْمِ اللّٰهِ الرَّحْمٰنِ الرَّحِيْمِ \ قُلْ هُوَ اللّٰهُ اَحَدٌۚ ۝١ اَللّٰهُ الصَّمَدُۚ ۝٢ لَمْ يَلِدْ وَلَمْ يُوْلَدْۙ ۝٣ وَلَمْ يَكُنْ لَّهٗ كُفُوًا اَحَدٌ ۝٤]

#section[2. Harakat yang sulit]
#table(
  columns: (1fr, 30%, 18%, 18%),
  align: (left + horizon, left + horizon, center + horizon, center + horizon),
  th([Ciri], [Contoh], [Noto Naskh], [Amiri]),
  ..(
    ("Syadah + fathah, kasrah, dammah", "رَبِّ · السَّمَاءِ · يُحِبُّ"),
    ("Tanwin fathah, kasrah, dammah", "عِلْمًا · بَيْتٍ · مَدْرَسَةٌ"),
    ("Sukun dan mad", "اسْمُكَ · نُوْرٌ · آمَنَ"),
    ("Alif kecil di atas (alif khanjariyah)", "هٰذَا · ذٰلِكَ · الرَّحْمٰنِ"),
    ("Hamzah", "أَنَا · إِلَى · سُؤَالٌ · شَاطِئِ · سَمَاءٌ"),
    ("Lam alif dan lafaz Allah", "لَا · السَّلَامُ · اللّٰهُ"),
    ("Alif wasal dan tatwil", "ٱلْحَمْدُ · كـتـاب"),
  )
    .map(r => (r.at(0), r.at(1), ar(r.at(1), size: 1.6em), ar(r.at(1), size: 1.6em, font: "Amiri")))
    .flatten(),
)

#section[3. Pola kalimat dari CP Bahasa Arab Fase A (SK Dirjen Pendis 9941/2025)]
#ar-block[مَا اسْمُكَ؟، مَا اسْمُكِ؟، اِسْمِيْ...، مَنْ هُوَ؟، مَنْ هِيَ؟، هُوَ أَبِيْ، هِيَ أُمِّيْ، هٰذَا بَيْتٌ، هٰذِهِ مَدْرَسَةٌ]
#ar-block[كَمْ السَّاعَةُ الْآن؟; أَنَا أَذْهَبُ إِلَى الْمَدْرَسَةِ فِي السَّاعَةِ السَّادِسَةِ وَالرُّبُعِ صَبَاحًا; هَلْ أَنْتَ تُحِبُّ اللُّغَةَ الْعَرَبِيَّةَ؟ نَعَمْ، أُحِبُّهَا; هُوَ يَتَعَلَّمُ اللُّغَةَ الْعَرَبِيَّةَ فِي الْمَدْرَسَةِ; كَيْفَ قَضَيْتِ الْعُطْلَةَ يَا أُخْتِي؟ قَضَيْتُ الْعُطْلَةَ بِزِيَارَةِ بَيْتِ جَدِّيْ]

#section[4. Campuran Indonesia dan Arab (dua arah)]
Pola #ar[مَا اسْمُكَ؟] dipakai untuk bertanya kepada laki-laki, sedangkan #ar[مَا اسْمُكِ؟] untuk perempuan. Jawabannya #ar[اِسْمِيْ أَحْمَدُ] (namaku Ahmad). Murid mengulang pola ini 3 kali, lalu berpasangan selama 10 menit.

#ar-block[أَنَا فِي الْفَصْلِ 4 (kelas empat)، وَعُمْرِي ١٠ سَنَوَاتٍ.]

#section[5. Paragraf panjang rata kanan-kiri]
#block[
  #set par(justify: true, leading: 0.75em)
  #set text(dir: rtl)
  #ar(size: 1.45em)[هٰذَا أُذُنٌ، أَنَا أَسْمَعُ بِالْأُذُنِ; تِلْكَ فَرَاشَةٌ جَمِيْلَةٌ; مَاذَا فِي غُرْفَةِ الْاِسْتِقْبَالِ؟; الْجَدْوَلُ الدِّرَاسِيُّ فِي غُرْفَةِ الْمُذَاكَرَةِ; فِي الْمَدْرَسَةِ مَكْتَبَةٌ كَبِيْرَةٌ وَنَظِيْفَةٌ; هَلْ أَنْتَ جَوْعَانُ؟ نَعَمْ، أَنَا جَوْعَانُ. مِنْ أَيْنَ أَنْتِ؟ أَنَا مِنْ إِنْدُوْنِيْسِيَا; مَا عُنْوَانُكَ؟ عُنْوَانِيْ فِي الشَّارِعِ الْكَبِيْرِ; هَلْ أَنْتَ مُدَرِّسٌ؟ لَا، أَنَا مُوَظَّفٌ; ذٰلِكَ بَيْتِيْ، هُوَ جَمِيْلٌ وَنَظِيْفٌ.]
]
