// ─── Prospect Hub Types ──────────────────────────────────────────────────────
export type CallingStatus = 'Positive' | 'Negative' | 'Neutral' | '';
// ListingType is now a comma-separated multi-select: '', 'Rent', 'Sale', or 'Rent,Sale'
export type ListingType   = string;
// "Condition" in the UI — the DB column is still `furnishing` for historical
// reasons. The widened CHECK constraint now allows the two rental types.
export type Furnishing    =
  | 'Fully Furnished'
  | 'Partly Furnished'
  | 'Bare Unit'
  | 'Room Rent'
  | 'Short Term Rent'
  | '';
export type Availability  = 'Available' | 'NOT Available' | '';
// Strict-enum toggle: '' (untouched) → 'O' (valid) → 'X' (invalid).
export type ValidStatus   = 'O' | 'X' | '';
// Free-form — backed by the workspace-wide unit_status_presets table.
export type UnitStatus    = string;

export interface Prospect {
  id: string;
  name: string;
  unitNo: string;
  type: string;
  size: string;
  phone: string;
  agent: string;       // nickname of the account that last updated the row
  lastUpdate: string;
  callingStatus: CallingStatus;
  valid: ValidStatus;
  listingType: ListingType;
  furnishing: Furnishing;     // labelled "Condition" in the UI
  availability: Availability;
  unitStatus: UnitStatus;
  askingRent: string;
  askingPrice: string;
  remark: string;
}

// ─── Seed data ────────────────────────────────────────────────────────────────
export const seedProspects: Prospect[] = [
  { id: '1',  name: 'Thai Kam Meng / Koo Choon May',             unitNo: 'C-08-05', type: 'B3',    size: '1403', phone: '012-2878545 / 012-3561223', agent: '', lastUpdate: '', callingStatus: 'Positive', listingType: 'Rent',       furnishing: 'Fully Furnished',  availability: 'Available',     unitStatus: '', valid: '', askingRent: '', askingPrice: '', remark: '' },
  { id: '2',  name: 'Chong Chia Ling',                           unitNo: 'C-08-06', type: 'A1',    size: '1219', phone: '012-6523394',               agent: '', lastUpdate: '', callingStatus: 'Negative', listingType: 'Sale',       furnishing: 'Partly Furnished', availability: 'NOT Available', unitStatus: '', valid: '', askingRent: '', askingPrice: '', remark: '' },
  { id: '3',  name: 'Joel Thean Siyang / Yeoh Wen Ling',         unitNo: 'C-08-07', type: 'A1-E',  size: '1219', phone: '016-2387987 / 017-8803939', agent: '', lastUpdate: '', callingStatus: 'Neutral',  listingType: 'Rent,Sale', furnishing: 'Fully Furnished',  availability: 'Available',     unitStatus: '', valid: '', askingRent: '', askingPrice: '', remark: '' },
  { id: '4',  name: 'Loh Chee Wei / Hoo Ai Ling',                unitNo: 'C-08-08', type: 'B2',    size: '1403', phone: '018-2288555 / 012-6714099', agent: '', lastUpdate: '', callingStatus: 'Positive', listingType: 'Rent',       furnishing: 'Bare Unit',        availability: 'Available',     unitStatus: '', valid: '', askingRent: '', askingPrice: '', remark: '' },
  { id: '5',  name: 'Law Kim Min',                               unitNo: 'C-08-09', type: 'B1-B',  size: '1403', phone: '012-7185582',               agent: '', lastUpdate: '', callingStatus: '',         listingType: '',            furnishing: '',                 availability: '',              unitStatus: '', valid: '', askingRent: '', askingPrice: '', remark: '' },
  { id: '6',  name: 'Wong Cheng Woon / Wong Yi Woon',            unitNo: 'C-08-10', type: 'A1-F',  size: '1219', phone: '016-2172166 / 016-9740513', agent: '', lastUpdate: '', callingStatus: 'Negative', listingType: 'Sale',       furnishing: 'Partly Furnished', availability: 'NOT Available', unitStatus: '', valid: '', askingRent: '', askingPrice: '', remark: '' },
  { id: '7',  name: 'Norsmalinda Binti Mohd Razali',             unitNo: 'C-09-01', type: 'A1-B',  size: '1219', phone: '012-2484704',               agent: '', lastUpdate: '', callingStatus: '',         listingType: '',            furnishing: '',                 availability: '',              unitStatus: '', valid: '', askingRent: '', askingPrice: '', remark: '' },
  { id: '8',  name: 'Tham Lai Ching',                            unitNo: 'C-09-03', type: 'B2',    size: '1403', phone: '012-3798560 / 012-2000462', agent: '', lastUpdate: '', callingStatus: 'Positive', listingType: 'Rent',       furnishing: 'Fully Furnished',  availability: 'Available',     unitStatus: '', valid: '', askingRent: '', askingPrice: '', remark: '' },
  { id: '9',  name: 'Chue Mei Ling',                             unitNo: 'C-09-05', type: 'B2-D',  size: '1403', phone: '016-2121136',               agent: '', lastUpdate: '', callingStatus: '',         listingType: '',            furnishing: '',                 availability: '',              unitStatus: '', valid: '', askingRent: '', askingPrice: '', remark: '' },
  { id: '10', name: 'Shah Rizal Bin Shaharudin',                 unitNo: 'C-09-06', type: 'B3',    size: '1403', phone: '019-2348200',               agent: '', lastUpdate: '', callingStatus: 'Neutral',  listingType: 'Rent',       furnishing: 'Partly Furnished', availability: 'Available',     unitStatus: '', valid: '', askingRent: '', askingPrice: '', remark: '' },
  { id: '11', name: 'Wong Jun Hau',                              unitNo: 'C-09-07', type: 'A1',    size: '1219', phone: '016-9091217',               agent: '', lastUpdate: '', callingStatus: '',         listingType: '',            furnishing: '',                 availability: '',              unitStatus: '', valid: '', askingRent: '', askingPrice: '', remark: '' },
  { id: '12', name: 'Fong Wan Kong / Lee Chee Huey',             unitNo: 'C-09-08', type: 'A1-E',  size: '1219', phone: '012-2356313 / 012-3371115', agent: '', lastUpdate: '', callingStatus: 'Positive', listingType: 'Sale',       furnishing: 'Fully Furnished',  availability: 'Available',     unitStatus: '', valid: '', askingRent: '', askingPrice: '', remark: '' },
  { id: '13', name: 'Ong Lilin / Ian Wong Shu Beng',             unitNo: 'C-09-09', type: 'B2',    size: '1403', phone: '018-8722884',               agent: '', lastUpdate: '', callingStatus: '',         listingType: '',            furnishing: '',                 availability: '',              unitStatus: '', valid: '', askingRent: '', askingPrice: '', remark: '' },
  { id: '14', name: 'Devanat A/L M.Naddan',                      unitNo: 'C-09-10', type: 'B1-B',  size: '1403', phone: '6596991079',                agent: '', lastUpdate: '', callingStatus: 'Negative', listingType: 'Rent',       furnishing: 'Bare Unit',        availability: 'NOT Available', unitStatus: '', valid: '', askingRent: '', askingPrice: '', remark: '' },
  { id: '15', name: 'Lock Kin Shien',                            unitNo: 'C-09-3A', type: 'B2-D',  size: '1403', phone: '012-6840927',               agent: '', lastUpdate: '', callingStatus: '',         listingType: '',            furnishing: '',                 availability: '',              unitStatus: '', valid: '', askingRent: '', askingPrice: '', remark: '' },
  { id: '16', name: 'Thiaku A/L Murugam',                        unitNo: 'C-10-01', type: 'A1-B',  size: '1219', phone: '010-2252741',               agent: '', lastUpdate: '', callingStatus: 'Neutral',  listingType: 'Sale',       furnishing: 'Partly Furnished', availability: 'Available',     unitStatus: '', valid: '', askingRent: '', askingPrice: '', remark: '' },
  { id: '17', name: 'Wan Farah Athirah Binti Wan Nasruddin',     unitNo: 'C-10-02', type: 'A1-F',  size: '1219', phone: '017-9316200',               agent: '', lastUpdate: '', callingStatus: '',         listingType: '',            furnishing: '',                 availability: '',              unitStatus: '', valid: '', askingRent: '', askingPrice: '', remark: '' },
  { id: '18', name: 'Liew Yoo Sen',                              unitNo: 'C-10-03', type: 'A1',    size: '1219', phone: '016-6097773 / 016-7687773', agent: '', lastUpdate: '', callingStatus: 'Positive', listingType: 'Rent',       furnishing: 'Fully Furnished',  availability: 'Available',     unitStatus: '', valid: '', askingRent: '', askingPrice: '', remark: '' },
];
