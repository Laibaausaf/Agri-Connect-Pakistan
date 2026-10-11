/**
 * Selected official AMIS tomato table from the supplied PDF.
 * Source report date: 2026-10-10.
 *
 * Important: the attached printout labels Min/Max/FQP but does not print
 * a rate unit beside those columns. The assistant uses the AMIS standard
 * Rs/100 kg convention for an indicative conversion only and warns users
 * to verify the unit before relying on the per-kg conversion.
 */
export const AMIS_TOMATO_REPORT_DATE = '10 October 2026';
export const AMIS_TOMATO_SOURCE = 'Agriculture Marketing Information Service (AMIS), Tomato price report dated 10/10/2026';
export const AMIS_TOMATO_REPORTED_UNIT = 'Rs/100 kg (assumed; unit is not printed in the supplied PDF)';
export const AMIS_TOMATO_PRICE_UNIT_CONFIDENCE = 'assumed';

export type AmisTomatoPrice = {
  city: string;
  min: number | null;
  max: number | null;
  fqp: number | null;
};

export const AMIS_TOMATO_PRICES: AmisTomatoPrice[] = [
  { city: "Lahore", min: 12000, max: 13000, fqp: 12500 },
  { city: "Faisalabad", min: 12000, max: 12500, fqp: 12250 },
  { city: "Gujranwala", min: 11400, max: 12700, fqp: 12050 },
  { city: "Okara", min: 10500, max: 11000, fqp: 10750 },
  { city: "Sargodha", min: null, max: null, fqp: null },
  { city: "Rawalpindi", min: 12700, max: 13600, fqp: 13150 },
  { city: "Multan", min: 11500, max: 12500, fqp: 12000 },
  { city: "RahimYarKhan", min: 10456, max: 11327, fqp: 10892 },
  { city: "Sahiwal", min: 10500, max: 11000, fqp: 10750 },
  { city: "Vehari", min: 9600, max: 12000, fqp: 10800 },
  { city: "Burewala", min: 9200, max: 12500, fqp: 10850 },
  { city: "Layyah", min: 8700, max: 9100, fqp: 8900 },
  { city: "Gujrat", min: 11700, max: 13000, fqp: 12350 },
  { city: "BahawalPur", min: 11200, max: 12000, fqp: 11600 },
  { city: "TTSingh", min: 12600, max: 14000, fqp: 13300 },
  { city: "KabirWala", min: 12500, max: 13500, fqp: 13000 },
  { city: "Patoki", min: null, max: null, fqp: null },
  { city: "ArifWala", min: 10000, max: 12000, fqp: 11000 },
  { city: "PakPattan", min: 11300, max: 19600, fqp: 15450 },
  { city: "Lodhran", min: 8200, max: 10800, fqp: 9500 },
  { city: "Chistian", min: 13900, max: 14500, fqp: 14200 },
  { city: "GujarKhan", min: 12800, max: 13500, fqp: 13150 },
  { city: "Mailsi", min: 9000, max: 12500, fqp: 10750 },
  { city: "Kahrorpacca", min: 10800, max: 10800, fqp: 10800 },
  { city: "Chichawatni", min: 11000, max: 12000, fqp: 11500 },
  { city: "DunyaPur", min: 10500, max: 11000, fqp: 10750 },
  { city: "DGKHAN", min: 11000, max: 11500, fqp: 11250 },
  { city: "Chunian", min: null, max: null, fqp: null },
  { city: "MandiBahaudin", min: null, max: null, fqp: null },
  { city: "Kamalia", min: 13000, max: 13400, fqp: 13200 },
  { city: "PirMahal", min: 12400, max: 12700, fqp: 12550 },
  { city: "Jahanian", min: 11500, max: 12500, fqp: 12000 },
  { city: "JamPur", min: 7000, max: 8000, fqp: 7500 },
  { city: "Sialkot", min: 11500, max: 12000, fqp: 11750 },
  { city: "Narowal", min: 11700, max: 13000, fqp: 12350 },
  { city: "Chakwal", min: 11500, max: 12000, fqp: 11750 },
  { city: "Jhelum", min: 11700, max: 12600, fqp: 12150 },
  { city: "Mianwali", min: 11700, max: 12200, fqp: 11950 },
  { city: "RajanPur", min: 7000, max: 7800, fqp: 7400 },
  { city: "Jhang", min: 12000, max: 13000, fqp: 12500 },
  { city: "SadiqAbad", min: 10200, max: 11050, fqp: 10625 },
  { city: "KotAdu", min: 8600, max: 8600, fqp: 8600 },
  { city: "Nankana", min: 11000, max: 11900, fqp: 11450 },
  { city: "ChackJhumra", min: 12000, max: 13000, fqp: 12500 },
  { city: "Summandri", min: 11700, max: 12150, fqp: 11925 },
  { city: "Tandlianwala", min: 11000, max: 13000, fqp: 12000 },
  { city: "Mamunkanjan", min: 11500, max: 12500, fqp: 12000 },
  { city: "Sheikhupura", min: 11500, max: 12500, fqp: 12000 },
  { city: "Chiniot", min: 10900, max: 11700, fqp: 11300 },
  { city: "Shorkot", min: 12800, max: 13200, fqp: 13000 },
  { city: "Kalurkot", min: null, max: null, fqp: null },
  { city: "TALAGANG", min: 12800, max: 13000, fqp: 12900 },
  { city: "Abdulhakim", min: 12000, max: 12200, fqp: 12100 },
  { city: "Sanglahill", min: 11000, max: 11900, fqp: 11450 },
  { city: "Hasanabdal", min: 12000, max: 12900, fqp: 12450 },
  { city: "Hafizabad", min: 12000, max: 12500, fqp: 12250 },
  { city: "Pindibhattian", min: 11600, max: 12000, fqp: 11800 },
  { city: "Kanganpur", min: 12000, max: 13000, fqp: 12500 },
  { city: "Khudian", min: 12000, max: 13000, fqp: 12500 },
  { city: "Sambrial", min: 13100, max: 14500, fqp: 13800 },
  { city: "Badomalhi", min: 11700, max: 13000, fqp: 12350 },
  { city: "Hazro", min: 12000, max: 12900, fqp: 12450 },
  { city: "Sraialamgir", min: 12700, max: 13100, fqp: 12900 },
  { city: "Jauharabad", min: 12700, max: 12700, fqp: 12700 },
  { city: "Qadirpurrawan", min: 11500, max: 12500, fqp: 12000 },
  { city: "Taunsasharif", min: 12000, max: 12500, fqp: 12250 },
  { city: "kotmoman", min: 13000, max: 14000, fqp: 13500 }
];

export const AMIS_DEFAULT_CITIES = ['Lahore', 'Faisalabad', 'Rawalpindi', 'Multan', 'Okara'];
