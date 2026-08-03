export interface ChecklistItem {
  id: string;
  labelId: string;
  labelEn: string;
  isIndent?: boolean;
  expectedAnswer?: 'YES' | 'NO'; // Default is 'YES' if omitted. Set to 'NO' for questions where NO means normal (e.g. "Apakah Ada Kebocoran?")
}

export interface ChecklistSection {
  titleId: string;
  titleEn: string;
  items: ChecklistItem[];
}

export interface EquipmentChecklist {
  type: string;
  docNo: string;
  effectiveDate: string;
  revNo: string;
  title: string;
  sections: ChecklistSection[];
}

export const CHECKLIST_DEFINITIONS: Record<string, EquipmentChecklist> = {
  'Fire Extinguisher': {
    type: 'Fire Extinguisher',
    docNo: 'YJ2-F.HSE.0011',
    effectiveDate: '01 Mei 2017',
    revNo: '02',
    title: 'APAR INSPECTION CHECKLIST',
    sections: [
      {
        titleId: '1. TABUNG APAR / APAB',
        titleEn: 'APAR / APAB TUBE',
        items: [
          { id: 'fe_1_1', labelId: 'Nomor Sesuai', labelEn: 'Corresponding Number' },
          { id: 'fe_1_2', labelId: 'Penempatannya Benar', labelEn: 'Correct Placement' },
          { id: 'fe_1_3', labelId: 'Peralatan Layak dan Mudah dicapai, dan tidak Terhalangi', labelEn: 'The equipment is suitable and easily accessible, and is not obstructed' },
          { id: 'fe_1_4', labelId: 'Peralatan Bersih, Tidak Rusak, Tidak Berkarat, Tidak Bocor', labelEn: 'Clean, Undamaged, Rust-Free, and Leak-Free Equipment' },
          { id: 'fe_1_5', labelId: 'Kondisi Ban, Roda, Selang, Kereta, Nozzle (Unit Beroda)', labelEn: 'Condition of Tires, Wheels, Hoses, Trolleys, Nozzles (Wheeled Units)' },
        ],
      },
      {
        titleId: '2. IDENTIFIKASI APAR / APAB',
        titleEn: 'IDENTIFICATION OF APAR / APAB',
        items: [
          { id: 'fe_2_1', labelId: 'Data Kelas Kebakaran', labelEn: 'Fire Class Data' },
          { id: 'fe_2_2', labelId: 'Data Media Pemadam', labelEn: 'Firefighting Media Data' },
          { id: 'fe_2_3', labelId: 'Petunjuk Instruksi Penggunaan', labelEn: 'Instructions for Use' },
          { id: 'fe_2_4', labelId: 'Nomor Peralatan', labelEn: 'Equipment Number' },
          { id: 'fe_2_5', labelId: 'Tanggal Lebel Pemeriksaan sudah diisi', labelEn: 'Inspection Label Date has been filled in' },
        ],
      },
      {
        titleId: '3. BERAT ISI (PERLU DITIMBANG) / DIANGKAT',
        titleEn: 'WEIGHT OF CONTENTS (NEEDS TO BE WEIGHED) / LIFTED',
        items: [
          { id: 'fe_3_1', labelId: 'Cukup ( tidak kurang dari 10 % dari berat diharuskan)', labelEn: 'Sufficient (not less than 10% of the required weight)' },
        ],
      },
      {
        titleId: '4. INDIKATOR TEKANAN',
        titleEn: 'PRESSURE INDICATOR',
        items: [
          { id: 'fe_4_1', labelId: 'Tali Seal Pengaman', labelEn: 'Safety Seal Strap' },
          { id: 'fe_4_2', labelId: 'Pin Pengaman', labelEn: 'Safety Pin' },
          { id: 'fe_4_3', labelId: 'Jarum menunjuk tekanan normal', labelEn: 'The needle points to normal pressure' },
          { id: 'fe_4_4', labelId: 'Kondisi fisik indikator', labelEn: 'The physical condition of the indicator is not damaged' },
        ],
      },
      {
        titleId: '5. CORONG PENYEMPROT',
        titleEn: 'SPRAYER FUNNEL',
        items: [
          { id: 'fe_5_1', labelId: 'Bersih tidak ada gangguan, tidak tersumbat', labelEn: 'Clean, no obstructions, not clogged' },
        ],
      },
    ],
  },

  'Emergency Lamp': {
    type: 'Emergency Lamp',
    docNo: 'YJ-F.HRD.0008',
    effectiveDate: '11 Mei 2019',
    revNo: '02',
    title: 'EMERGENCY LIGHT & EXIT SIGN INSPECTION CHECKLIST',
    sections: [
      {
        titleId: 'PEMERIKSAAN KELAYAKAN LAMPU DARURAT',
        titleEn: 'EMERGENCY & EXIT LAMP CHECKLIST',
        items: [
          { id: 'el_1', labelId: 'LAMPU EMERGENCY HIDUP', labelEn: 'EMERGENCY LIGHTS ON' },
          { id: 'el_2', labelId: 'LAMPU EXIT HIDUP', labelEn: 'EXIT LAMP ON' },
          { id: 'el_3', labelId: 'SUPLAY LISTRIK', labelEn: 'ELECTRICAL SUPPLY' },
          { id: 'el_4', labelId: 'PENGISI DAYA BATERAI MIN. 90 MENIT', labelEn: 'BATTERY CHARGER MIN. 90 MINUTES' },
          { id: 'el_5', labelId: 'BATTERY TERISI', labelEn: 'BATTERY CHARGED' },
          { id: 'el_6', labelId: 'SWITCH LAMPU', labelEn: 'SWITCH LAMP' },
        ],
      },
    ],
  },

  'Emergency Exit Lamp': {
    type: 'Emergency Exit Lamp',
    docNo: 'YJ-F.HRD.0008',
    effectiveDate: '11 Mei 2019',
    revNo: '02',
    title: 'EMERGENCY LIGHT & EXIT SIGN INSPECTION CHECKLIST',
    sections: [
      {
        titleId: 'PEMERIKSAAN KELAYAKAN LAMPU DARURAT',
        titleEn: 'EMERGENCY & EXIT LAMP CHECKLIST',
        items: [
          { id: 'el_1', labelId: 'LAMPU EMERGENCY HIDUP', labelEn: 'EMERGENCY LIGHTS ON' },
          { id: 'el_2', labelId: 'LAMPU EXIT HIDUP', labelEn: 'EXIT LAMP ON' },
          { id: 'el_3', labelId: 'SUPLAY LISTRIK', labelEn: 'ELECTRICAL SUPPLY' },
          { id: 'el_4', labelId: 'PENGISI DAYA BATERAI MIN. 90 MENIT', labelEn: 'BATTERY CHARGER MIN. 90 MINUTES' },
          { id: 'el_5', labelId: 'BATTERY TERISI', labelEn: 'BATTERY CHARGED' },
          { id: 'el_6', labelId: 'SWITCH LAMPU', labelEn: 'SWITCH LAMP' },
        ],
      },
    ],
  },

  'Fire Alarm': {
    type: 'Fire Alarm',
    docNo: 'YJ-F.HSE.0037',
    effectiveDate: '14 Februari 2018',
    revNo: '02',
    title: 'VISUAL CHECK FIRE ALARM PANEL',
    sections: [
      {
        titleId: 'I. PEMERIKSAAN PANEL UTAMA / CENTRAL',
        titleEn: 'MAIN PANEL ALARM CHECK',
        items: [
          { id: 'fa_1_1', labelId: 'TERDAPAT TANDA PENUNJUKAN LOKASI ALARM', labelEn: 'SIGNS INDICATING ALARM LOCATION' },
          { id: 'fa_1_2', labelId: 'PANEL ALARM DITANDAI DENGAN JELAS', labelEn: 'DEVICES PROPERLY INDICATED AND MARKED' },
          { id: 'fa_1_3', labelId: 'INDIKATOR DAYA (LISTRIK) DITANDAI DAN MENYALA', labelEn: 'POWER INDICATOR IS MARKED AND ON' },
          { id: 'fa_1_4', labelId: 'PANEL TIDAK TERHALANGI DAN TIDAK TERGANGGU APAPUN', labelEn: 'PANEL FREE FROM ANY BLOCKING AND WITHOUT INTERRUPTION' },
          { id: 'fa_1_5', labelId: 'TERDAPAT LAMPU TEST DAN BERFUNGSI DENGAN BAIK (SAAT TEST ALARM)', labelEn: 'THERE IS A TEST LIGHT AND IT FUNCTIONS WELL (DURING TEST ALARM)' },
        ],
      },
      {
        titleId: 'II. PANEL ALARM DILOKASI PEMASANGAN',
        titleEn: 'ANNUNCIATOR PANEL ALARM',
        items: [
          { id: 'fa_2_1', labelId: 'PENEMPATAN PANEL DI LOKASI YANG BENAR', labelEn: 'PLACEMENT OF PANEL IN CORRECT LOCATION' },
          { id: 'fa_2_2', labelId: 'INDIKATOR DAYA (LISTRIK) DITANDAI DAN MENYALA', labelEn: 'POWER INDICATOR IS MARKED AND ON' },
          { id: 'fa_2_3', labelId: 'TERDAPAT HEAT DETECTOR, SMOKE DETECTOR, DAN PENEMPATAN SESUAI', labelEn: 'HEAT DETECTORS AND / OR SMOKE DETECTORS LOCATION ACCEPTABLE' },
          { id: 'fa_2_4', labelId: 'LAMPU TEST BERFUNGSI DENGAN BAIK (SAAT TEST ALARM)', labelEn: 'TEST LIGHT WORKS WELL (DURING TEST ALARM)' },
          { id: 'fa_2_5', labelId: 'PANEL TERDETEKSI DI MAIN PANEL (SAAT TEST ALARM)', labelEn: 'PANEL DETECTED IN MAIN PANEL(DURING TEST ALARM)' },
        ],
      },
    ],
  },

  'Fire Hydrant': {
    type: 'Fire Hydrant',
    docNo: 'YJ2-HSE-COMP-014F',
    effectiveDate: '04 January 2021',
    revNo: '03',
    title: 'FIRE HYDRANT INSPECTION CHECKLIST',
    sections: [
      {
        titleId: 'PEMERIKSAAN KELAYAKAN HYDRANT',
        titleEn: 'HYDRANT INSPECTION CHECKLIST',
        items: [
          { id: 'fh_1', labelId: 'Apakah Pada Penempatan Bok Ditempat Yang Sesuai ?', labelEn: 'Is It In An Appropriate Stock Placement?' },
          { id: 'fh_2', labelId: 'Apakah Hydrant Bebas Dari Halangan ?', labelEn: 'Are Hydrant Free From Barriers ?' },
          { id: 'fh_3', labelId: 'Apakah Hydrant Dalam Kondisi Baik ?', labelEn: 'Is The Hydrant in Good Condition ?' },
          { id: 'fh_4', labelId: 'Apakah Peralatan Di Kabinet Lengkap ?', labelEn: 'What Is The Equipment In The Cabinet Is Complete ?' },
          { id: 'fh_4_a', labelId: 'Selang ( 2 Roll )', labelEn: 'Fire Hose (2 Roll)', isIndent: true },
          { id: 'fh_4_b', labelId: 'Selang Corong', labelEn: 'Hose Nozzle', isIndent: true },
          { id: 'fh_4_c', labelId: 'Katup Hydrant', labelEn: 'Hydrant Valve', isIndent: true },
          { id: 'fh_4_d', labelId: 'Rak Selang', labelEn: 'Hose Rack', isIndent: true },
          { id: 'fh_4_e', labelId: 'Kunci Keran', labelEn: 'Valve Key', isIndent: true },
          { id: 'fh_4_f', labelId: 'Kopel', labelEn: 'Coupling', isIndent: true },
          { id: 'fh_4_g', labelId: 'Tekanan', labelEn: 'Pressure', isIndent: true },
          { id: 'fh_5', labelId: 'Apakah Peralatan Dalam Kondisi Baik ?', labelEn: 'Is The Equipment In Good Condition ?' },
          { id: 'fh_6', labelId: 'Lakukan Penyiraman Penuh Tahunan Dalam Sistem Hydrant, Apakah Air Keluar Dengan Stabil?', labelEn: 'Do This Annual Fully Watering In A Hydrant System, Is The Water Out Stable ?' },
          { id: 'fh_7', labelId: 'Apakah Ada Kebocoran ?', labelEn: 'Is There A Leak ?', expectedAnswer: 'NO' },
        ],
      },
    ],
  },
};

export function getChecklistForType(type: string): EquipmentChecklist {
  return CHECKLIST_DEFINITIONS[type] || CHECKLIST_DEFINITIONS['Fire Extinguisher'];
}
