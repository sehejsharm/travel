import type { GeoPoint } from "../domain/types";

export interface City {
  name: string;
  countryCode: string;
  point: GeoPoint;
}

type Row = [name: string, country: string, lat: number, lng: number];

/** Cities people actually plan trips around, so a place name grounds anywhere. */
const ROWS: Row[] = [
  // South Asia
  ["Delhi", "IN", 28.6139, 77.209], ["Mumbai", "IN", 19.076, 72.8777],
  ["Bengaluru", "IN", 12.9716, 77.5946], ["Jaipur", "IN", 26.9124, 75.7873],
  ["Goa", "IN", 15.2993, 74.124], ["Kolkata", "IN", 22.5726, 88.3639],
  ["Chennai", "IN", 13.0827, 80.2707], ["Udaipur", "IN", 24.5854, 73.7125],
  ["Varanasi", "IN", 25.3176, 82.9739], ["Agra", "IN", 27.1767, 78.0081],
  ["Rishikesh", "IN", 30.0869, 78.2676], ["Leh", "IN", 34.1526, 77.5771],
  ["Colombo", "LK", 6.9271, 79.8612], ["Kandy", "LK", 7.2906, 80.6337],
  ["Kathmandu", "NP", 27.7172, 85.324], ["Pokhara", "NP", 28.2096, 83.9856],
  ["Malé", "MV", 4.1755, 73.5093], ["Thimphu", "BT", 27.4728, 89.639],
  ["Karachi", "PK", 24.8607, 67.0011], ["Lahore", "PK", 31.5204, 74.3587],
  ["Dhaka", "BD", 23.8103, 90.4125],

  // East Asia
  ["Tokyo", "JP", 35.6762, 139.6503], ["Kyoto", "JP", 35.0116, 135.7681],
  ["Osaka", "JP", 34.6937, 135.5023], ["Sapporo", "JP", 43.0618, 141.3545],
  ["Nara", "JP", 34.6851, 135.8048], ["Hiroshima", "JP", 34.3853, 132.4553],
  ["Fukuoka", "JP", 33.5902, 130.4017], ["Hakone", "JP", 35.2324, 139.1069],
  ["Kanazawa", "JP", 36.5613, 136.6562], ["Nagoya", "JP", 35.1815, 136.9066],
  ["Seoul", "KR", 37.5665, 126.978], ["Busan", "KR", 35.1796, 129.0756],
  ["Jeju", "KR", 33.4996, 126.5312], ["Beijing", "CN", 39.9042, 116.4074],
  ["Shanghai", "CN", 31.2304, 121.4737], ["Chengdu", "CN", 30.5728, 104.0668],
  ["Xi'an", "CN", 34.3416, 108.9398], ["Guilin", "CN", 25.2736, 110.2907],
  ["Hong Kong", "HK", 22.3193, 114.1694], ["Macau", "MO", 22.1987, 113.5439],
  ["Taipei", "TW", 25.033, 121.5654], ["Ulaanbaatar", "MN", 47.8864, 106.9057],

  // South East Asia
  ["Bangkok", "TH", 13.7563, 100.5018], ["Chiang Mai", "TH", 18.7883, 98.9853],
  ["Phuket", "TH", 7.8804, 98.3923], ["Krabi", "TH", 8.0863, 98.9063],
  ["Koh Samui", "TH", 9.512, 100.0136], ["Hanoi", "VN", 21.0278, 105.8342],
  ["Ho Chi Minh City", "VN", 10.8231, 106.6297], ["Hoi An", "VN", 15.8801, 108.338],
  ["Da Nang", "VN", 16.0544, 108.2022], ["Ha Long", "VN", 20.9101, 107.1839],
  ["Bali", "ID", -8.4095, 115.1889], ["Ubud", "ID", -8.5069, 115.2625],
  ["Jakarta", "ID", -6.2088, 106.8456], ["Yogyakarta", "ID", -7.7956, 110.3695],
  ["Lombok", "ID", -8.5833, 116.1167], ["Singapore", "SG", 1.3521, 103.8198],
  ["Kuala Lumpur", "MY", 3.139, 101.6869], ["Penang", "MY", 5.4141, 100.3288],
  ["Langkawi", "MY", 6.35, 99.8], ["Manila", "PH", 14.5995, 120.9842],
  ["Cebu", "PH", 10.3157, 123.8854], ["Palawan", "PH", 9.8349, 118.7384],
  ["Siem Reap", "KH", 13.3671, 103.8448], ["Phnom Penh", "KH", 11.5564, 104.9282],
  ["Luang Prabang", "LA", 19.8845, 102.1348], ["Vientiane", "LA", 17.9757, 102.6331],
  ["Yangon", "MM", 16.8661, 96.1951],

  // Middle East
  ["Dubai", "AE", 25.2048, 55.2708], ["Abu Dhabi", "AE", 24.4539, 54.3773],
  ["Doha", "QA", 25.2854, 51.531], ["Muscat", "OM", 23.588, 58.3829],
  ["Riyadh", "SA", 24.7136, 46.6753], ["Jeddah", "SA", 21.4858, 39.1925],
  ["Amman", "JO", 31.9454, 35.9284], ["Petra", "JO", 30.3285, 35.4444],
  ["Tel Aviv", "IL", 32.0853, 34.7818], ["Jerusalem", "IL", 31.7683, 35.2137],
  ["Istanbul", "TR", 41.0082, 28.9784], ["Cappadocia", "TR", 38.6431, 34.8289],
  ["Antalya", "TR", 36.8969, 30.7133], ["Tbilisi", "GE", 41.7151, 44.8271],
  ["Yerevan", "AM", 40.1792, 44.4991], ["Baku", "AZ", 40.4093, 49.8671],

  // Western Europe
  ["London", "GB", 51.5074, -0.1278], ["Edinburgh", "GB", 55.9533, -3.1883],
  ["Manchester", "GB", 53.4808, -2.2426], ["Dublin", "IE", 53.3498, -6.2603],
  ["Paris", "FR", 48.8566, 2.3522], ["Nice", "FR", 43.7102, 7.262],
  ["Lyon", "FR", 45.764, 4.8357], ["Marseille", "FR", 43.2965, 5.3698],
  ["Bordeaux", "FR", 44.8378, -0.5792], ["Berlin", "DE", 52.52, 13.405],
  ["Munich", "DE", 48.1351, 11.582], ["Hamburg", "DE", 53.5511, 9.9937],
  ["Cologne", "DE", 50.9375, 6.9603], ["Amsterdam", "NL", 52.3676, 4.9041],
  ["Rotterdam", "NL", 51.9244, 4.4777], ["Brussels", "BE", 50.8503, 4.3517],
  ["Bruges", "BE", 51.2093, 3.2247], ["Zurich", "CH", 47.3769, 8.5417],
  ["Geneva", "CH", 46.2044, 6.1432], ["Interlaken", "CH", 46.6863, 7.8632],
  ["Zermatt", "CH", 46.0207, 7.7491], ["Vienna", "AT", 48.2082, 16.3738],
  ["Salzburg", "AT", 47.8095, 13.055], ["Innsbruck", "AT", 47.2692, 11.4041],
  ["Rome", "IT", 41.9028, 12.4964], ["Florence", "IT", 43.7696, 11.2558],
  ["Venice", "IT", 45.4408, 12.3155], ["Milan", "IT", 45.4642, 9.19],
  ["Naples", "IT", 40.8518, 14.2681], ["Amalfi", "IT", 40.634, 14.6027],
  ["Barcelona", "ES", 41.3851, 2.1734], ["Madrid", "ES", 40.4168, -3.7038],
  ["Seville", "ES", 37.3891, -5.9845], ["Granada", "ES", 37.1773, -3.5986],
  ["Valencia", "ES", 39.4699, -0.3763], ["Ibiza", "ES", 38.9067, 1.4206],
  ["Lisbon", "PT", 38.7223, -9.1393], ["Porto", "PT", 41.1579, -8.6291],
  ["Madeira", "PT", 32.7607, -16.9595], ["Athens", "GR", 37.9838, 23.7275],
  ["Santorini", "GR", 36.3932, 25.4615], ["Mykonos", "GR", 37.4467, 25.3289],
  ["Crete", "GR", 35.2401, 24.8093], ["Valletta", "MT", 35.8989, 14.5146],
  ["Reykjavik", "IS", 64.1466, -21.9426],

  // Nordics and Baltics
  ["Stockholm", "SE", 59.3293, 18.0686], ["Gothenburg", "SE", 57.7089, 11.9746],
  ["Oslo", "NO", 59.9139, 10.7522], ["Bergen", "NO", 60.3913, 5.3221],
  ["Tromsø", "NO", 69.6492, 18.9553], ["Copenhagen", "DK", 55.6761, 12.5683],
  ["Helsinki", "FI", 60.1699, 24.9384], ["Rovaniemi", "FI", 66.5039, 25.7294],
  ["Tallinn", "EE", 59.437, 24.7536], ["Riga", "LV", 56.9496, 24.1052],
  ["Vilnius", "LT", 54.6872, 25.2797],

  // Central and Eastern Europe
  ["Prague", "CZ", 50.0755, 14.4378], ["Warsaw", "PL", 52.2297, 21.0122],
  ["Krakow", "PL", 50.0647, 19.945], ["Budapest", "HU", 47.4979, 19.0402],
  ["Bratislava", "SK", 48.1486, 17.1077], ["Bucharest", "RO", 44.4268, 26.1025],
  ["Sofia", "BG", 42.6977, 23.3219], ["Dubrovnik", "HR", 42.6507, 18.0944],
  ["Split", "HR", 43.5081, 16.4402], ["Zagreb", "HR", 45.815, 15.9819],
  ["Ljubljana", "SI", 46.0569, 14.5058], ["Belgrade", "RS", 44.7866, 20.4489],
  ["Sarajevo", "BA", 43.8563, 18.4131], ["Tirana", "AL", 41.3275, 19.8187],
  ["Kotor", "ME", 42.4247, 18.7712], ["Kyiv", "UA", 50.4501, 30.5234],

  // North America
  ["New York", "US", 40.7128, -74.006], ["Los Angeles", "US", 34.0522, -118.2437],
  ["San Francisco", "US", 37.7749, -122.4194], ["Chicago", "US", 41.8781, -87.6298],
  ["Miami", "US", 25.7617, -80.1918], ["Las Vegas", "US", 36.1699, -115.1398],
  ["Seattle", "US", 47.6062, -122.3321], ["Boston", "US", 42.3601, -71.0589],
  ["New Orleans", "US", 29.9511, -90.0715], ["Honolulu", "US", 21.3069, -157.8583],
  ["Austin", "US", 30.2672, -97.7431], ["Denver", "US", 39.7392, -104.9903],
  ["Toronto", "CA", 43.6532, -79.3832], ["Vancouver", "CA", 49.2827, -123.1207],
  ["Montreal", "CA", 45.5017, -73.5673], ["Banff", "CA", 51.1784, -115.5708],
  ["Mexico City", "MX", 19.4326, -99.1332], ["Cancún", "MX", 21.1619, -86.8515],
  ["Tulum", "MX", 20.2114, -87.4654], ["Oaxaca", "MX", 17.0732, -96.7266],
  ["San José", "CR", 9.9281, -84.0907], ["Panama City", "PA", 8.9824, -79.5199],
  ["Havana", "CU", 23.1136, -82.3666], ["Kingston", "JM", 17.9714, -76.7936],
  ["Nassau", "BS", 25.0443, -77.3504],

  // South America
  ["Rio de Janeiro", "BR", -22.9068, -43.1729], ["São Paulo", "BR", -23.5505, -46.6333],
  ["Buenos Aires", "AR", -34.6037, -58.3816], ["Mendoza", "AR", -32.8895, -68.8458],
  ["Santiago", "CL", -33.4489, -70.6693], ["Lima", "PE", -12.0464, -77.0428],
  ["Cusco", "PE", -13.5319, -71.9675], ["Machu Picchu", "PE", -13.1631, -72.545],
  ["Bogotá", "CO", 4.711, -74.0721], ["Cartagena", "CO", 10.391, -75.4794],
  ["Quito", "EC", -0.1807, -78.4678], ["Montevideo", "UY", -34.9011, -56.1645],
  ["La Paz", "BO", -16.4897, -68.1193],

  // Africa
  ["Cape Town", "ZA", -33.9249, 18.4241], ["Johannesburg", "ZA", -26.2041, 28.0473],
  ["Cairo", "EG", 30.0444, 31.2357], ["Luxor", "EG", 25.6872, 32.6396],
  ["Marrakesh", "MA", 31.6295, -7.9811], ["Casablanca", "MA", 33.5731, -7.5898],
  ["Fes", "MA", 34.0181, -5.0078], ["Chefchaouen", "MA", 35.1688, -5.2636],
  ["Nairobi", "KE", -1.2921, 36.8219], ["Zanzibar", "TZ", -6.1659, 39.2026],
  ["Arusha", "TZ", -3.3869, 36.683], ["Lagos", "NG", 6.5244, 3.3792],
  ["Accra", "GH", 5.6037, -0.187], ["Addis Ababa", "ET", 9.03, 38.7469],
  ["Tunis", "TN", 36.8065, 10.1815], ["Port Louis", "MU", -20.1609, 57.5012],
  ["Victoria", "SC", -4.6191, 55.4513], ["Windhoek", "NA", -22.5609, 17.0658],
  ["Kigali", "RW", -1.9441, 30.0619],

  // Oceania
  ["Sydney", "AU", -33.8688, 151.2093], ["Melbourne", "AU", -37.8136, 144.9631],
  ["Brisbane", "AU", -27.4698, 153.0251], ["Perth", "AU", -31.9505, 115.8605],
  ["Cairns", "AU", -16.9186, 145.7781], ["Auckland", "NZ", -36.8485, 174.7633],
  ["Queenstown", "NZ", -45.0312, 168.6626], ["Wellington", "NZ", -41.2866, 174.7756],
  ["Christchurch", "NZ", -43.5321, 172.6362], ["Nadi", "FJ", -17.7765, 177.4356],
];

export const CITIES: City[] = ROWS.map(([name, countryCode, lat, lng]) => ({
  name,
  countryCode,
  point: { lat, lng },
}));

/** Representative latitude per country, for climate estimates. */
export const COUNTRY_LATITUDE: Record<string, number> = (() => {
  const byCountry: Record<string, number[]> = {};
  for (const city of CITIES) {
    (byCountry[city.countryCode] ??= []).push(city.point.lat);
  }

  return Object.fromEntries(
    Object.entries(byCountry).map(([code, lats]) => [
      code,
      lats.reduce((sum, lat) => sum + lat, 0) / lats.length,
    ]),
  );
})();

export function citiesIn(countryCode: string): City[] {
  return CITIES.filter((city) => city.countryCode === countryCode.toUpperCase());
}
