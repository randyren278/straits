/**
 * Offline port gazetteer for AIS destination strings.
 *
 * The AIS destination field is free text typed by crews: mostly UN/LOCODEs
 * ("EGPSD", "TR MER"), port names in several spellings ("PORT SAID",
 * "PORTSAID", "P0RT SAID"), routing chains ("LBBEY>TRMER" — the last leg is
 * the destination), and instructions that are not places at all ("FOR
 * ORDERS", "AT SEA"). The route-deviation detector only needs a bearing to
 * the destination, so a port's approximate centre is plenty.
 *
 * Pure and instant. This replaced per-run Nominatim lookups, which were
 * against that service's usage policy and had been rate-limited to nothing.
 */

export interface PortCoords { lat: number; lon: number }

type Entry = [locode: string, name: string, lat: number, lon: number, ...aliases: string[]];

/** LOCODE, canonical name, lat, lon, then spellings seen in the wild. */
const PORTS: Entry[] = [
  // Egypt
  ['EGPSD', 'PORT SAID', 31.26, 32.30, 'PORTSAID', 'P0RT SAID', 'PORDSAID', 'PORT-SAID', 'PORT SAID EAST', 'EGPSE', 'EGPSW', 'EGPS', 'EG SAID', 'PSE'],
  ['EGDAM', 'DAMIETTA', 31.47, 31.75, 'DUMYAT', 'DAMITA', 'DAMEITTA', 'EGDM', 'EGDAMM', 'EGYDMT'],
  ['EGSUZ', 'SUEZ', 29.95, 32.55, 'SUZE', 'SEUZ', 'SUZEG', 'PORT SUEZ', 'SUEZ STS', 'SUEZ STS AREA', 'SUEZ ANCH', 'EGSZC'],
  ['EGSCN', 'SUEZ CANAL', 30.59, 32.27, 'SUEZCANAL', 'SUEZ CANAI', 'SUEZCNAL', 'EGSUC', 'EGSCT', 'ISMAILIA', 'SUEZ CANAL AUTHORITY', 'SUEZCANALAUTHORITY', 'SUEZ CANALISMAILIA', 'EGSUCN', 'EGSUC N'],
  ['EGALY', 'ALEXANDRIA', 31.19, 29.87, 'EGALX', 'ALEXANADARA', 'EG ALE', 'EG ALI'],
  ['EGEDK', 'EL DEKHEILA', 31.13, 29.80, 'ELDEKHILA'],
  ['EGAIS', 'AIN SUKHNA', 29.60, 32.35, 'AIN SOKHNA', 'EGSOK', 'SOKHNA'],
  ['EGADA', 'ADABIYA', 29.87, 32.47],
  ['EGSKT', 'SIDI KERIR', 31.10, 29.62],
  ['EGAAR', 'EL ARISH', 31.13, 33.80, 'AL ARISH', 'ALARISH', 'ELARISH', 'EIARISH'],
  ['EGAKI', 'ABU KIR', 31.32, 30.07, 'ABU QIR'],
  ['EGGRB', 'RAS GHARIB', 28.36, 33.08, 'RASGHARIB'],
  // Turkey
  ['TRMER', 'MERSIN', 36.79, 34.63, 'MERSIN TUR', 'TR MERSIN', 'OPL MERSIN'],
  ['TRISK', 'ISKENDERUN', 36.59, 36.17, 'ISKENDERON', 'ISKEDRUN', 'TKISK', 'TISK'],
  ['TRIST', 'ISTANBUL', 41.02, 28.97],
  ['TRAMB', 'AMBARLI', 40.97, 28.68],
  ['TRALI', 'ALIAGA', 38.80, 26.97],
  ['TRNEM', 'NEMRUT BAY', 38.77, 26.92],
  ['TRGEM', 'GEMLIK', 40.43, 29.15],
  ['TRCEY', 'CEYHAN', 36.87, 35.90, 'TRBOT', 'TRCYH', 'CEYHAN BOTAS', 'YUMURTALIK', 'TRYUM', 'TR YUM', 'TOROS'],
  ['TRTUZ', 'TUZLA', 40.82, 29.30],
  ['TRCKZ', 'CANAKKALE', 40.15, 26.40, 'TRCAN', 'AKCANSA', 'DARDANELLES'],
  ['TRYAL', 'YALOVA', 40.66, 29.28],
  ['TRERE', 'EREGLI', 41.28, 31.42],
  ['TRTUT', 'TUTUNCIFTLIK', 40.75, 29.80, 'TRKOR', 'KORFEZ'],
  ['TRIZT', 'IZMIT', 40.77, 29.92, 'KOCAELI', 'GEBZE', 'TRDIL', 'TRDYL', 'DILISKELESI', 'TRDOR'],
  ['TRIZM', 'IZMIR', 38.44, 27.14],
  ['TRGUL', 'GULLUK', 37.24, 27.60],
  ['TRAYT', 'ANTALYA', 36.84, 30.61],
  ['TRTAS', 'TASUCU', 36.31, 33.88],
  ['TRSSX', 'SAMSUN', 41.29, 36.33],
  ['TRMRA', 'MARMARA EREGLISI', 40.97, 27.95, 'TRMAR'],
  ['TRTGT', 'TEKIRDAG', 40.97, 27.51],
  // Israel
  ['ILHFA', 'HAIFA', 32.82, 35.00, 'ISHFA', 'IL HFA'],
  ['ILASH', 'ASHDOD', 31.82, 34.64, 'ILASHD', 'ASHDDOT'],
  ['ILHAD', 'HADERA', 32.47, 34.88],
  ['ILAKL', 'ASHKELON', 31.67, 34.55, 'ASHQELON', 'ASHKELCN'],
  // Cyprus
  ['CYLMS', 'LIMASSOL', 34.65, 33.02, 'LIMMASOL', 'CYLIM', 'CYLM', 'CVLMS', 'LMS'],
  ['CYVAS', 'VASILIKO', 34.72, 33.32, 'VASSILIKO', 'VASSILIKOS', 'VASILIKOS', 'CYZYY', 'ZYGI'],
  ['CYLCA', 'LARNACA', 34.92, 33.64, 'LARNAKA'],
  ['CYFMG', 'FAMAGUSTA', 35.12, 33.94],
  ['CYAKT', 'AKROTIRI', 34.59, 32.98],
  ['CYDHK', 'DHEKELIA', 34.98, 33.74],
  // Syria
  ['SYTTS', 'TARTOUS', 34.89, 35.87, 'TARTUS'],
  ['SYLTK', 'LATTAKIA', 35.52, 35.78, 'LATAKIA', 'LATTKIA', 'LAT'],
  ['SYBAN', 'BANIYAS', 35.18, 35.94, 'BANYAS', 'BANIYS'],
  // Lebanon
  ['LBBEY', 'BEIRUT', 33.90, 35.52, 'PEIRUT'],
  ['LBKYE', 'TRIPOLI', 34.45, 35.82, 'TRIPOLILEBANON'],
  ['LBSDN', 'SIDON', 33.56, 35.37, 'SAIDA', 'LBSAY'],
  ['LBSEL', 'SELAATA', 34.28, 35.66],
  ['LBJIE', 'JIEH', 33.65, 35.42],
  ['LBDBA', 'DBAYEH', 33.94, 35.59, 'ZOUK'],
  // Greece
  ['GRPIR', 'PIRAEUS', 37.94, 23.64, 'GRPIE'],
  ['GRLAV', 'LAVRIO', 37.71, 24.06],
  ['GRVOL', 'VOLOS', 39.36, 22.95],
  ['GRSKG', 'THESSALONIKI', 40.63, 22.93],
  ['GRRHO', 'RHODES', 36.44, 28.23],
  ['GREEU', 'ELEUSIS', 38.04, 23.54],
  ['GRJKH', 'CHIOS', 38.37, 26.14],
  ['GRAGT', 'AGIOI THEODOROI', 37.93, 23.13],
  ['GRTHV', 'THISVI', 38.28, 22.95, 'GRTHISVI'],
  ['GRKAL', 'KALI LIMENES', 34.93, 24.80],
  ['GRGYT', 'GYTHEIO', 36.76, 22.57],
  ['GRSYS', 'SYROS', 37.44, 24.94],
  // Malta, Italy, Spain, Gibraltar, France, Portugal
  ['MTMLA', 'VALLETTA', 35.90, 14.51, 'MALTA'],
  ['MTMAR', 'MARSAXLOKK', 35.83, 14.54],
  ['ITAUG', 'AUGUSTA', 37.21, 15.22, 'SANTA PANAGIA'],
  ['ITPFX', 'SARROCH', 39.07, 9.03],
  ['ITTAR', 'TARANTO', 40.47, 17.23],
  ['ITNAP', 'NAPLES', 40.84, 14.25],
  ['ITGOA', 'GENOA', 44.40, 8.93],
  ['ITTRS', 'TRIESTE', 45.65, 13.76],
  ['ITRAN', 'RAVENNA', 44.49, 12.28],
  ['ITVCE', 'VENICE', 45.43, 12.33, 'MARGHERA', 'PORTO MARGHERA'],
  ['ITSAL', 'SALERNO', 40.68, 14.75],
  ['ITMLZ', 'MILAZZO', 38.22, 15.24],
  ['ESALG', 'ALGECIRAS', 36.13, -5.45, 'ESALR'],
  ['ESCAR', 'CARTAGENA', 37.60, -0.98],
  ['ESLPA', 'LAS PALMAS', 28.13, -15.42, 'ESLPG'],
  ['ESBCN', 'BARCELONA', 41.35, 2.17, 'SPBCN'],
  ['ESVLC', 'VALENCIA', 39.44, -0.32],
  ['ESTAR', 'TARRAGONA', 41.10, 1.23],
  ['ESCAS', 'CASTELLON', 39.96, 0.02],
  ['ESHUV', 'HUELVA', 37.20, -6.93],
  ['ESBIO', 'BILBAO', 43.35, -3.03],
  ['ESCEU', 'CEUTA', 35.89, -5.31],
  ['ESSAG', 'SAGUNTO', 39.65, -0.22],
  ['GIGIB', 'GIBRALTAR', 36.14, -5.36, 'GIBRALTOR', 'GBGIB'],
  ['FRFOS', 'FOS', 43.42, 4.90],
  ['FRLAV', 'LAVERA', 43.38, 5.00],
  ['FRLEH', 'LE HAVRE', 49.49, 0.11],
  ['FRSET', 'SETE', 43.40, 3.70],
  ['PTSIE', 'SINES', 37.95, -8.87],
  // North Sea / Baltic / Black Sea
  ['NLRTM', 'ROTTERDAM', 51.92, 4.48],
  ['NLAMS', 'AMSTERDAM', 52.40, 4.85],
  ['BEANR', 'ANTWERP', 51.27, 4.40],
  ['GBLGP', 'LONDON GATEWAY', 51.50, 0.47, 'GBTIL'],
  ['DEBRV', 'BREMERHAVEN', 53.55, 8.58],
  ['PLGDN', 'GDANSK', 54.40, 18.67],
  ['RULED', 'ST PETERSBURG', 59.90, 30.25, 'SAINT PETERSBURG'],
  ['RUULU', 'UST LUGA', 59.68, 28.40],
  ['RUNVS', 'NOVOROSSIYSK', 44.72, 37.80],
  ['ROCND', 'CONSTANTA', 44.17, 28.65],
  ['ROGAL', 'GALATI', 45.42, 28.05],
  ['ROMID', 'MIDIA', 44.33, 28.68],
  ['ROSUL', 'SULINA', 45.15, 29.65],
  ['BGVAR', 'VARNA', 43.20, 27.92],
  ['GEPTI', 'POTI', 42.15, 41.65],
  ['GEBUS', 'BATUMI', 41.65, 41.65],
  ['GEKUL', 'KULEVI', 42.27, 41.65],
  ['HRRJK', 'RIJEKA', 45.33, 14.44],
  ['SIKOP', 'KOPER', 45.55, 13.73],
  ['ALDRZ', 'DURRES', 41.32, 19.45],
  // North Africa
  ['DZALG', 'ALGIERS', 36.77, 3.07],
  ['DZSKI', 'SKIKDA', 36.88, 6.90],
  ['DZORN', 'ORAN', 35.71, -0.64],
  ['DZAZW', 'ARZEW', 35.86, -0.30],
  ['DZAAE', 'ANNABA', 36.90, 7.77],
  ['DZDJE', 'DJENDJEN', 36.83, 5.88],
  ['MAPTM', 'TANGER MED', 35.89, -5.50, 'TANGIER MED', 'MAPTM02', 'MAPTM1'],
  ['MATNG', 'TANGIER', 35.79, -5.81],
  ['TNSFA', 'SFAX', 34.73, 10.77],
  ['TNLSK', 'LA SKHIRA', 34.30, 10.13],
  ['TNGAE', 'GABES', 33.89, 10.12],
  ['TNZAR', 'ZARZIS', 33.50, 11.12],
  ['LYBEN', 'BENGHAZI', 32.12, 20.06],
  ['LYTIP', 'TRIPOLI LIBYA', 32.90, 13.18],
  ['LYMRA', 'MISRATA', 32.37, 15.21],
  ['LYRLA', 'RAS LANUF', 30.50, 18.57],
  ['LYMBR', 'MARSA EL BREGA', 30.42, 19.58],
  ['LYTOB', 'TOBRUK', 32.08, 23.97],
  // Red Sea, Gulf, Indian Ocean
  ['JOAQB', 'AQABA', 29.52, 35.00],
  ['SAJED', 'JEDDAH', 21.48, 39.17],
  ['SAYNB', 'YANBU', 24.09, 38.06],
  ['SARAB', 'RABIGH', 22.75, 39.00],
  ['SARTA', 'RAS TANURA', 26.64, 50.16],
  ['SDPZU', 'PORT SUDAN', 19.62, 37.22],
  ['ERMSW', 'MASSAWA', 15.61, 39.47],
  ['DJJIB', 'DJIBOUTI', 11.60, 43.15, 'DJPOD'],
  ['YEADE', 'ADEN', 12.78, 45.03],
  ['IRKHK', 'KHARG ISLAND', 29.23, 50.32],
  ['KWMEA', 'MINA AL AHMADI', 29.07, 48.13],
  ['IQBOT', 'BASRAH OIL TERMINAL', 29.68, 48.80],
  ['QAMES', 'MESAIEED', 24.99, 51.55],
  ['AEFJR', 'FUJAIRAH', 25.13, 56.35],
  ['AEJEA', 'JEBEL ALI', 25.01, 55.06],
  ['AEKLF', 'KHALIFA', 24.80, 54.65, 'AEKHL'],
  ['OMSLV', 'SALALAH', 16.94, 54.00],
  ['OMDQM', 'DUQM', 19.67, 57.70],
  ['OMSOH', 'SOHAR', 24.50, 56.62],
  ['TZDAR', 'DAR ES SALAAM', -6.82, 39.29],
  ['INJAM', 'JAMNAGAR', 22.47, 70.07],
  ['INSIK', 'SIKKA', 22.43, 69.83],
  ['INVAD', 'VADINAR', 22.42, 69.70],
  ['INMUN', 'MUNDRA', 22.74, 69.72],
  ['INHZA', 'HAZIRA', 21.10, 72.62],
  ['INNSA', 'NHAVA SHEVA', 18.95, 72.95, 'MUMBAI'],
  ['INVTZ', 'VISAKHAPATNAM', 17.69, 83.29, 'VIZAG'],
  ['INIXY', 'KANDLA', 23.03, 70.22],
  ['INPRT', 'PARADIP', 20.27, 86.67],
  ['LKCMB', 'COLOMBO', 6.95, 79.85],
  ['LKGAL', 'GALLE', 6.03, 80.22],
  ['BDCGP', 'CHITTAGONG', 22.32, 91.80],
  // East Asia
  ['SGSIN', 'SINGAPORE', 1.26, 103.83],
  ['MYPKG', 'PORT KLANG', 3.00, 101.39, 'PKG'],
  ['CNDLC', 'DALIAN', 38.93, 121.63],
  ['CNTAO', 'QINGDAO', 36.07, 120.32, 'QING DAO'],
  ['CNNBG', 'NINGBO', 29.87, 121.55],
  ['CNRZH', 'RIZHAO', 35.38, 119.53],
  ['CNNSA', 'NANSHA', 22.75, 113.60],
  ['TWKHH', 'KAOHSIUNG', 22.61, 120.28],
  ['TWMLI', 'MAILIAO', 23.79, 120.18],
  ['KRYOS', 'YEOSU', 34.74, 127.74],
  ['KRONS', 'ONSAN', 35.43, 129.36],
  ['KRPTK', 'PYEONGTAEK', 36.97, 126.83],
  ['KRINC', 'INCHEON', 37.45, 126.60],
  ['HKHKG', 'HONG KONG', 22.29, 114.17, 'HONGKONG'],
  ['PHMNL', 'MANILA', 14.58, 120.97],
  // Americas
  ['USNYC', 'NEW YORK', 40.67, -74.05],
  ['USCHS', 'CHARLESTON', 32.78, -79.93],
  ['USSAV', 'SAVANNAH', 32.08, -81.09],
  ['USJAX', 'JACKSONVILLE', 30.40, -81.55],
  ['BRSSZ', 'SANTOS', -23.96, -46.30],
];

const NON_PLACE = /^(FOR[\s.-]*ORDERS?|FORORDERS?|TO ORDER|ORDERS?|FOR ORDR|WAITING|WAITING FOR ORDERS|TBA|TBN|TBC|UNKNOWN|NIL|NULL|N\/A|NONE|NO DATA|OFFSHORE|AT SEA|TO SEA|OPEN SEA|SEA|MED|MED SEA|MEDITERRANEAN|ATLANTIC OCEAN|BALTIC SEA|OPL|ANCH|ANCHORAGE|STS|STS AREA|STS ANCHORAGE|C ANC)$/;
/** Trailing words that qualify a place rather than name it. */
const QUALIFIERS = new Set(['FOR', 'ORDER', 'ORDERS', 'ORDR', 'OPL', 'ANCH', 'ANCHOR', 'ANCHORAGE', 'PORT', 'EGYPT', 'EG', 'EGY', 'EGP', 'TURKEY', 'TURKIYE', 'TUR', 'TKY', 'LEBANON', 'LEB', 'LBN', 'LB', 'SYRIA', 'SYR', 'SY', 'CYPRUS', 'CY', 'ISRAEL', 'IL', 'ITALY', 'GEORGIA', 'TUNISIA', 'LIBYA', 'GREECE', 'GR', 'TR', 'IN', 'IND', 'CN', 'MY', 'BG', 'RO', 'EAST', 'WEST', 'NORTH', 'SOUTH', 'N', 'S', 'E', 'W', 'STS', 'SEA', 'MARINA', 'TERMINAL', 'PORTO', 'VIA', 'SUEZ']);

const byKey = new Map<string, PortCoords>();
for (const [locode, name, lat, lon, ...aliases] of PORTS) {
  const coords = { lat, lon };
  for (const k of [locode, name, ...aliases]) byKey.set(k.replace(/\s+/g, ' ').trim(), coords);
}

function lookup(token: string): PortCoords | null {
  if (!token) return null;
  const direct = byKey.get(token);
  if (direct) return direct;
  // "EG PSD", "EG_PSD", "TR/ISK" → LOCODE
  const m = token.match(/^([A-Z]{2})[ _/.-]?([A-Z0-9]{3})$/);
  if (m) return byKey.get(m[1] + m[2]) ?? null;
  // "PORT SAID EGYPT" → "PORT SAID"; "OPL PORT SAID" → "PORT SAID"
  const words = token.split(' ');
  if (words.length > 1) {
    if (QUALIFIERS.has(words[words.length - 1])) return lookup(words.slice(0, -1).join(' '));
    if (QUALIFIERS.has(words[0])) return lookup(words.slice(1).join(' '));
    const joined = words.join('');
    if (byKey.has(joined)) return byKey.get(joined)!;
  }
  return null;
}

/**
 * Resolve a raw AIS destination string to coordinates, or null when it is
 * not a place we know. Routing chains resolve to their last leg.
 */
export function resolveDestination(raw: string): PortCoords | null {
  let s = raw.toUpperCase().replace(/[^A-Z0-9>]+/g, ' ').replace(/\s+/g, ' ').trim();
  if (!s) return null;
  if (s.includes('>')) {
    const legs = s.split('>').map((l) => l.trim()).filter(Boolean);
    s = legs[legs.length - 1] ?? '';
  }
  if (!s || NON_PLACE.test(s)) return null;
  const hit = lookup(s);
  if (hit) return hit;
  // "SUEZ FOR ORDERS", "V ANCH PORT SAID": the place is the longest
  // prefix or suffix we know; try prefixes first (the place usually leads).
  const words = s.split(' ');
  for (let n = words.length - 1; n >= 1; n--) {
    const h = lookup(words.slice(0, n).join(' '));
    if (h) return h;
  }
  for (let i = 1; i < words.length; i++) {
    const h = lookup(words.slice(i).join(' '));
    if (h) return h;
  }
  return null;
}

/** Number of distinct places in the gazetteer — for tests and the docs. */
export const PORT_COUNT = PORTS.length;
