import type { RegionSeed } from '../region_list.js'

/**
 * Jawa Tengah, first part of the region list (D-466): the province and
 * the three regencies of the school directory (Kudus, Jepara, Pati,
 * D-169, D-170) with their kecamatan.
 *
 * Status: draft until Tim Validasi checks it (D-113).
 * - Kemendagri codes and kecamatan names follow the Kemendagri region
 *   code list (Kepmendagri on kode dan data wilayah administrasi
 *   pemerintahan); they were written from that list and must be checked
 *   against the current decree before production.
 * - Dapodik (Kemendikdasmen reference site) codes of the province and
 *   the regencies come from the source URLs of docs/data/schools/*.json
 *   and docs/drafts/regional-layers.md §2.2. Kecamatan Dapodik codes are
 *   not in the repository yet, so they stay empty; the directory import
 *   matches kecamatan by name within the regency, ignoring case and
 *   spaces (the site writes "Gunung Wungkal").
 */
export const jawaTengah: RegionSeed = {
  kemendagriCode: '33',
  dapodikCode: '030000',
  name: 'Jawa Tengah',
  children: [
    {
      kemendagriCode: '33.18',
      dapodikCode: '031800',
      name: 'Pati',
      regencyKind: 'kabupaten',
      children: [
        { kemendagriCode: '33.18.01', name: 'Sukolilo' },
        { kemendagriCode: '33.18.02', name: 'Kayen' },
        { kemendagriCode: '33.18.03', name: 'Tambakromo' },
        { kemendagriCode: '33.18.04', name: 'Winong' },
        { kemendagriCode: '33.18.05', name: 'Pucakwangi' },
        { kemendagriCode: '33.18.06', name: 'Jaken' },
        { kemendagriCode: '33.18.07', name: 'Batangan' },
        { kemendagriCode: '33.18.08', name: 'Juwana' },
        { kemendagriCode: '33.18.09', name: 'Jakenan' },
        { kemendagriCode: '33.18.10', name: 'Pati' },
        { kemendagriCode: '33.18.11', name: 'Gabus' },
        { kemendagriCode: '33.18.12', name: 'Margorejo' },
        { kemendagriCode: '33.18.13', name: 'Gembong' },
        { kemendagriCode: '33.18.14', name: 'Tlogowungu' },
        { kemendagriCode: '33.18.15', name: 'Wedarijaksa' },
        { kemendagriCode: '33.18.16', name: 'Margoyoso' },
        { kemendagriCode: '33.18.17', name: 'Gunungwungkal' },
        { kemendagriCode: '33.18.18', name: 'Cluwak' },
        { kemendagriCode: '33.18.19', name: 'Tayu' },
        { kemendagriCode: '33.18.20', name: 'Dukuhseti' },
        { kemendagriCode: '33.18.21', name: 'Trangkil' },
      ],
    },
    {
      kemendagriCode: '33.19',
      dapodikCode: '031900',
      name: 'Kudus',
      regencyKind: 'kabupaten',
      children: [
        { kemendagriCode: '33.19.01', name: 'Kaliwungu' },
        { kemendagriCode: '33.19.02', name: 'Kota Kudus' },
        { kemendagriCode: '33.19.03', name: 'Jati' },
        { kemendagriCode: '33.19.04', name: 'Undaan' },
        { kemendagriCode: '33.19.05', name: 'Mejobo' },
        { kemendagriCode: '33.19.06', name: 'Jekulo' },
        { kemendagriCode: '33.19.07', name: 'Bae' },
        { kemendagriCode: '33.19.08', name: 'Gebog' },
        { kemendagriCode: '33.19.09', name: 'Dawe' },
      ],
    },
    {
      kemendagriCode: '33.20',
      dapodikCode: '032000',
      name: 'Jepara',
      regencyKind: 'kabupaten',
      children: [
        { kemendagriCode: '33.20.01', name: 'Kedung' },
        { kemendagriCode: '33.20.02', name: 'Pecangaan' },
        { kemendagriCode: '33.20.03', name: 'Welahan' },
        { kemendagriCode: '33.20.04', name: 'Mayong' },
        { kemendagriCode: '33.20.05', name: 'Batealit' },
        { kemendagriCode: '33.20.06', name: 'Jepara' },
        { kemendagriCode: '33.20.07', name: 'Mlonggo' },
        { kemendagriCode: '33.20.08', name: 'Bangsri' },
        { kemendagriCode: '33.20.09', name: 'Keling' },
        { kemendagriCode: '33.20.10', name: 'Karimunjawa' },
        { kemendagriCode: '33.20.11', name: 'Tahunan' },
        { kemendagriCode: '33.20.12', name: 'Nalumsari' },
        { kemendagriCode: '33.20.13', name: 'Kalinyamatan' },
        { kemendagriCode: '33.20.14', name: 'Kembang' },
        { kemendagriCode: '33.20.15', name: 'Pakis Aji' },
        { kemendagriCode: '33.20.16', name: 'Donorojo' },
      ],
    },
  ],
}
