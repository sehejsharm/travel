import type { GeoPoint } from "../domain/types";

export interface Airport {
  iata: string;
  name: string;
  city: string;
  countryCode: string;
  point: GeoPoint;
  /** Published minimum connection times, in minutes. */
  minConnect: { domestic: number; international: number };
}

type Row = [iata: string, name: string, city: string, country: string, lat: number, lng: number];

/** One hour domestic, ninety minutes international, unless published otherwise. */
const DEFAULT_CONNECT = { domestic: 60, international: 90 };

const CONNECT: Record<string, { domestic: number; international: number }> = {
  HND: { domestic: 45, international: 75 },
  KIX: { domestic: 50, international: 80 },
  SIN: { domestic: 60, international: 60 },
  BKK: { domestic: 70, international: 90 },
  DXB: { domestic: 60, international: 75 },
  IST: { domestic: 60, international: 75 },
  DOH: { domestic: 60, international: 60 },
  AMS: { domestic: 50, international: 50 },
  CDG: { domestic: 60, international: 90 },
  FRA: { domestic: 45, international: 60 },
  ATL: { domestic: 45, international: 90 },
  JFK: { domestic: 60, international: 90 },
  ORD: { domestic: 50, international: 90 },
};

/**
 * Flights are the most-filed item, and a flight names airports rather than
 * cities. Without these, half a trip's pins never land on the map.
 */
const ROWS: Row[] = [
  // South and Central Asia
  ["DEL", "Indira Gandhi International", "Delhi", "IN", 28.5562, 77.1],
  ["BOM", "Chhatrapati Shivaji Maharaj International", "Mumbai", "IN", 19.0896, 72.8656],
  ["BLR", "Kempegowda International", "Bengaluru", "IN", 13.1986, 77.7066],
  ["MAA", "Chennai International", "Chennai", "IN", 12.9941, 80.1709],
  ["HYD", "Rajiv Gandhi International", "Hyderabad", "IN", 17.2403, 78.4294],
  ["CCU", "Netaji Subhas Chandra Bose International", "Kolkata", "IN", 22.6547, 88.4467],
  ["GOI", "Goa International", "Goa", "IN", 15.3808, 73.8314],
  ["JAI", "Jaipur International", "Jaipur", "IN", 26.8242, 75.8122],
  ["CMB", "Bandaranaike International", "Colombo", "LK", 7.1808, 79.8841],
  ["KTM", "Tribhuvan International", "Kathmandu", "NP", 27.6966, 85.3591],
  ["MLE", "Velana International", "Malé", "MV", 4.1918, 73.5291],
  ["KHI", "Jinnah International", "Karachi", "PK", 24.9065, 67.1608],
  ["DAC", "Hazrat Shahjalal International", "Dhaka", "BD", 23.8433, 90.3978],
  ["TAS", "Tashkent International", "Tashkent", "UZ", 41.2579, 69.2812],

  // East Asia
  ["HND", "Tokyo Haneda", "Tokyo", "JP", 35.5494, 139.7798],
  ["NRT", "Tokyo Narita", "Tokyo", "JP", 35.7719, 140.3929],
  ["KIX", "Kansai International", "Osaka", "JP", 34.4342, 135.2328],
  ["ITM", "Osaka Itami", "Osaka", "JP", 34.7855, 135.4382],
  ["CTS", "New Chitose", "Sapporo", "JP", 42.7752, 141.6923],
  ["FUK", "Fukuoka", "Fukuoka", "JP", 33.5859, 130.4506],
  ["OKA", "Naha", "Okinawa", "JP", 26.1958, 127.646],
  ["ICN", "Incheon International", "Seoul", "KR", 37.4602, 126.4407],
  ["GMP", "Gimpo International", "Seoul", "KR", 37.5583, 126.7906],
  ["PUS", "Gimhae International", "Busan", "KR", 35.1795, 128.9382],
  ["PEK", "Beijing Capital International", "Beijing", "CN", 40.0799, 116.6031],
  ["PKX", "Beijing Daxing International", "Beijing", "CN", 39.5098, 116.4105],
  ["PVG", "Shanghai Pudong International", "Shanghai", "CN", 31.1443, 121.8083],
  ["CAN", "Guangzhou Baiyun International", "Guangzhou", "CN", 23.3924, 113.2988],
  ["CTU", "Chengdu Tianfu International", "Chengdu", "CN", 30.3125, 104.4413],
  ["HKG", "Hong Kong International", "Hong Kong", "HK", 22.308, 113.9185],
  ["TPE", "Taoyuan International", "Taipei", "TW", 25.0777, 121.2328],

  // South East Asia
  ["BKK", "Suvarnabhumi", "Bangkok", "TH", 13.69, 100.7501],
  ["DMK", "Don Mueang International", "Bangkok", "TH", 13.9126, 100.6068],
  ["CNX", "Chiang Mai International", "Chiang Mai", "TH", 18.7669, 98.9626],
  ["HKT", "Phuket International", "Phuket", "TH", 8.1132, 98.3169],
  ["SIN", "Singapore Changi", "Singapore", "SG", 1.3644, 103.9915],
  ["KUL", "Kuala Lumpur International", "Kuala Lumpur", "MY", 2.7456, 101.7099],
  ["CGK", "Soekarno-Hatta International", "Jakarta", "ID", -6.1256, 106.6559],
  ["DPS", "Ngurah Rai International", "Bali", "ID", -8.7482, 115.1672],
  ["MNL", "Ninoy Aquino International", "Manila", "PH", 14.5086, 121.0194],
  ["CEB", "Mactan-Cebu International", "Cebu", "PH", 10.3075, 123.9794],
  ["SGN", "Tan Son Nhat International", "Ho Chi Minh City", "VN", 10.8188, 106.6519],
  ["HAN", "Noi Bai International", "Hanoi", "VN", 21.2212, 105.8072],
  ["DAD", "Da Nang International", "Da Nang", "VN", 16.0439, 108.1994],
  ["REP", "Siem Reap Angkor International", "Siem Reap", "KH", 13.4109, 103.813],
  ["RGN", "Yangon International", "Yangon", "MM", 16.9073, 96.1332],
  ["VTE", "Wattay International", "Vientiane", "LA", 17.9883, 102.5633],

  // Middle East and Africa
  ["DXB", "Dubai International", "Dubai", "AE", 25.2532, 55.3657],
  ["AUH", "Zayed International", "Abu Dhabi", "AE", 24.433, 54.6511],
  ["DOH", "Hamad International", "Doha", "QA", 25.2731, 51.6081],
  ["RUH", "King Khalid International", "Riyadh", "SA", 24.9576, 46.6988],
  ["JED", "King Abdulaziz International", "Jeddah", "SA", 21.6796, 39.1565],
  ["MCT", "Muscat International", "Muscat", "OM", 23.5933, 58.2844],
  ["IST", "Istanbul", "Istanbul", "TR", 41.2753, 28.7519],
  ["SAW", "Sabiha Gökçen International", "Istanbul", "TR", 40.8986, 29.3092],
  ["TLV", "Ben Gurion", "Tel Aviv", "IL", 32.0114, 34.8867],
  ["AMM", "Queen Alia International", "Amman", "JO", 31.7226, 35.9932],
  ["CAI", "Cairo International", "Cairo", "EG", 30.1219, 31.4056],
  ["CMN", "Mohammed V International", "Casablanca", "MA", 33.3675, -7.5899],
  ["RAK", "Marrakesh Menara", "Marrakesh", "MA", 31.6069, -8.0363],
  ["NBO", "Jomo Kenyatta International", "Nairobi", "KE", -1.3192, 36.9278],
  ["JRO", "Kilimanjaro International", "Kilimanjaro", "TZ", -3.4294, 37.0745],
  ["ZNZ", "Abeid Amani Karume International", "Zanzibar", "TZ", -6.222, 39.2249],
  ["CPT", "Cape Town International", "Cape Town", "ZA", -33.9715, 18.6021],
  ["JNB", "O. R. Tambo International", "Johannesburg", "ZA", -26.1392, 28.246],
  ["ADD", "Bole International", "Addis Ababa", "ET", 8.9779, 38.7993],
  ["LOS", "Murtala Muhammed International", "Lagos", "NG", 6.5774, 3.3212],
  ["MRU", "Sir Seewoosagur Ramgoolam International", "Mauritius", "MU", -20.4302, 57.6836],

  // Europe
  ["LHR", "London Heathrow", "London", "GB", 51.47, -0.4543],
  ["LGW", "London Gatwick", "London", "GB", 51.1537, -0.1821],
  ["STN", "London Stansted", "London", "GB", 51.885, 0.235],
  ["MAN", "Manchester", "Manchester", "GB", 53.3537, -2.275],
  ["EDI", "Edinburgh", "Edinburgh", "GB", 55.95, -3.3725],
  ["DUB", "Dublin", "Dublin", "IE", 53.4213, -6.2701],
  ["CDG", "Paris Charles de Gaulle", "Paris", "FR", 49.0097, 2.5479],
  ["ORY", "Paris Orly", "Paris", "FR", 48.7233, 2.3794],
  ["NCE", "Côte d'Azur", "Nice", "FR", 43.6584, 7.2159],
  ["AMS", "Amsterdam Schiphol", "Amsterdam", "NL", 52.3105, 4.7683],
  ["BRU", "Brussels", "Brussels", "BE", 50.9014, 4.4844],
  ["FRA", "Frankfurt", "Frankfurt", "DE", 50.0379, 8.5622],
  ["MUC", "Munich", "Munich", "DE", 48.3538, 11.7861],
  ["BER", "Berlin Brandenburg", "Berlin", "DE", 52.3667, 13.5033],
  ["ZRH", "Zurich", "Zurich", "CH", 47.4647, 8.5492],
  ["GVA", "Geneva", "Geneva", "CH", 46.2381, 6.1089],
  ["VIE", "Vienna International", "Vienna", "AT", 48.1103, 16.5697],
  ["PRG", "Václav Havel", "Prague", "CZ", 50.1008, 14.26],
  ["BUD", "Budapest Ferenc Liszt International", "Budapest", "HU", 47.4298, 19.2611],
  ["WAW", "Warsaw Chopin", "Warsaw", "PL", 52.1657, 20.9671],
  ["KRK", "Kraków John Paul II International", "Kraków", "PL", 50.0777, 19.7848],
  ["FCO", "Rome Fiumicino", "Rome", "IT", 41.8003, 12.2389],
  ["MXP", "Milan Malpensa", "Milan", "IT", 45.6301, 8.7255],
  ["VCE", "Venice Marco Polo", "Venice", "IT", 45.5053, 12.3519],
  ["NAP", "Naples International", "Naples", "IT", 40.886, 14.2908],
  ["BCN", "Barcelona El Prat", "Barcelona", "ES", 41.2974, 2.0833],
  ["MAD", "Adolfo Suárez Madrid-Barajas", "Madrid", "ES", 40.4719, -3.5626],
  ["AGP", "Málaga-Costa del Sol", "Málaga", "ES", 36.6749, -4.4991],
  ["PMI", "Palma de Mallorca", "Mallorca", "ES", 39.5517, 2.7388],
  ["LIS", "Humberto Delgado", "Lisbon", "PT", 38.7756, -9.1354],
  ["OPO", "Francisco Sá Carneiro", "Porto", "PT", 41.2481, -8.6814],
  ["ATH", "Athens International", "Athens", "GR", 37.9364, 23.9445],
  ["JTR", "Santorini", "Santorini", "GR", 36.3992, 25.4793],
  ["CPH", "Copenhagen", "Copenhagen", "DK", 55.6181, 12.656],
  ["ARN", "Stockholm Arlanda", "Stockholm", "SE", 59.6519, 17.9186],
  ["OSL", "Oslo Gardermoen", "Oslo", "NO", 60.1939, 11.1004],
  ["HEL", "Helsinki-Vantaa", "Helsinki", "FI", 60.3172, 24.9633],
  ["KEF", "Keflavík International", "Reykjavik", "IS", 63.985, -22.6056],
  ["OTP", "Henri Coandă International", "Bucharest", "RO", 44.5711, 26.085],
  ["ZAG", "Franjo Tuđman", "Zagreb", "HR", 45.7429, 16.0688],
  ["SPU", "Split", "Split", "HR", 43.5389, 16.298],

  // North America
  ["JFK", "John F. Kennedy International", "New York", "US", 40.6413, -73.7781],
  ["EWR", "Newark Liberty International", "New York", "US", 40.6895, -74.1745],
  ["LGA", "LaGuardia", "New York", "US", 40.7769, -73.874],
  ["LAX", "Los Angeles International", "Los Angeles", "US", 33.9416, -118.4085],
  ["SFO", "San Francisco International", "San Francisco", "US", 37.6213, -122.379],
  ["ORD", "O'Hare International", "Chicago", "US", 41.9742, -87.9073],
  ["MIA", "Miami International", "Miami", "US", 25.7959, -80.287],
  ["BOS", "Logan International", "Boston", "US", 42.3656, -71.0096],
  ["SEA", "Seattle-Tacoma International", "Seattle", "US", 47.4502, -122.3088],
  ["DEN", "Denver International", "Denver", "US", 39.8561, -104.6737],
  ["ATL", "Hartsfield-Jackson Atlanta International", "Atlanta", "US", 33.6407, -84.4277],
  ["DFW", "Dallas/Fort Worth International", "Dallas", "US", 32.8998, -97.0403],
  ["LAS", "Harry Reid International", "Las Vegas", "US", 36.084, -115.1537],
  ["HNL", "Daniel K. Inouye International", "Honolulu", "US", 21.3187, -157.9225],
  ["YYZ", "Toronto Pearson International", "Toronto", "CA", 43.6777, -79.6248],
  ["YVR", "Vancouver International", "Vancouver", "CA", 49.1967, -123.1815],
  ["YUL", "Montréal-Trudeau International", "Montreal", "CA", 45.4706, -73.7408],
  ["MEX", "Benito Juárez International", "Mexico City", "MX", 19.4361, -99.0719],
  ["CUN", "Cancún International", "Cancún", "MX", 21.0365, -86.8771],

  // South America and Oceania
  ["GRU", "São Paulo-Guarulhos International", "São Paulo", "BR", -23.4356, -46.4731],
  ["GIG", "Rio de Janeiro-Galeão International", "Rio de Janeiro", "BR", -22.8089, -43.2436],
  ["EZE", "Ministro Pistarini International", "Buenos Aires", "AR", -34.8222, -58.5358],
  ["SCL", "Arturo Merino Benítez International", "Santiago", "CL", -33.393, -70.7858],
  ["LIM", "Jorge Chávez International", "Lima", "PE", -12.0219, -77.1143],
  ["CUZ", "Alejandro Velasco Astete International", "Cusco", "PE", -13.5357, -71.9388],
  ["BOG", "El Dorado International", "Bogotá", "CO", 4.7016, -74.1469],
  ["SYD", "Kingsford Smith", "Sydney", "AU", -33.9399, 151.1753],
  ["MEL", "Melbourne", "Melbourne", "AU", -37.669, 144.841],
  ["BNE", "Brisbane", "Brisbane", "AU", -27.3842, 153.1175],
  ["PER", "Perth", "Perth", "AU", -31.9385, 115.9672],
  ["AKL", "Auckland", "Auckland", "NZ", -37.0082, 174.7917],
  ["ZQN", "Queenstown", "Queenstown", "NZ", -45.0211, 168.7392],
  ["NAN", "Nadi International", "Nadi", "FJ", -17.7554, 177.4434],
];

export const AIRPORT_LIST: Airport[] = ROWS.map(
  ([iata, name, city, countryCode, lat, lng]) => ({
    iata,
    name,
    city,
    countryCode,
    point: { lat, lng },
    minConnect: CONNECT[iata] ?? DEFAULT_CONNECT,
  }),
);

export const AIRPORTS: Record<string, Airport> = Object.fromEntries(
  AIRPORT_LIST.map((airport) => [airport.iata, airport]),
);

export function getAirport(code?: string): Airport | undefined {
  if (!code) return undefined;
  return AIRPORTS[code.trim().toUpperCase()];
}
