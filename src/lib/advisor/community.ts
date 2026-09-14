import type { Candidate } from "./types";

/**
 * Tier two: what other people put in trips they published. Until there is a
 * backend of published trips to read, this ships as a seeded corpus — real
 * places, entered once, so the tier is genuinely free and genuinely offline.
 * The shape is what a published-trips query would return, so swapping the
 * source later changes this file and nothing above it.
 */
type Row = [city: string, interest: string, name: string, detail: string];

const ROWS: Row[] = [
  // Tokyo
  ["Tokyo", "food", "Tsukiji Outer Market", "Breakfast sushi and tamagoyaki, best before 9am"],
  ["Tokyo", "food", "Omoide Yokocho", "Alley of tiny yakitori counters under the tracks"],
  ["Tokyo", "coffee", "Koffee Mameya", "Bean counter where they talk you through the roast"],
  ["Tokyo", "nightlife", "Golden Gai", "Six alleys of bars that seat six people each"],
  ["Tokyo", "art", "teamLab Borderless", "Room-scale digital art, timed entry"],
  ["Tokyo", "architecture", "Senso-ji", "The city's oldest temple, lit after dark"],
  ["Tokyo", "nature", "Shinjuku Gyoen", "Three gardens in one, best in cherry season"],
  ["Tokyo", "shopping", "Takeshita Street", "Harajuku's teenage high street"],
  ["Tokyo", "wellness", "Thermae-yu", "Onsen water piped into Shinjuku, open late"],
  ["Tokyo", "history", "Meiji Jingu", "Shrine in a forest planted by donation"],
  ["Tokyo", "family", "Ghibli Museum", "Tickets released a month out and gone in minutes"],

  // Kyoto
  ["Kyoto", "architecture", "Fushimi Inari Taisha", "Ten thousand torii up the mountain; go at dawn"],
  ["Kyoto", "nature", "Arashiyama Bamboo Grove", "Twenty minutes of bamboo, packed by 10am"],
  ["Kyoto", "history", "Kiyomizu-dera", "Wooden stage over the hillside, no nails"],
  ["Kyoto", "food", "Nishiki Market", "Five blocks of pickles, tofu and skewers"],
  ["Kyoto", "wellness", "Funaoka Onsen", "Century-old neighbourhood bathhouse"],

  // Osaka
  ["Osaka", "food", "Dotonbori", "Takoyaki, kushikatsu and the Glico sign"],
  ["Osaka", "nightlife", "Ura-Namba", "Where Osaka drinks after the tourists leave"],

  // Bangkok
  ["Bangkok", "food", "Or Tor Kor Market", "The produce market chefs shop at"],
  ["Bangkok", "food", "Chinatown Yaowarat", "Street food from sundown, best on foot"],
  ["Bangkok", "architecture", "Wat Arun", "Porcelain-studded spire, best from the river"],
  ["Bangkok", "shopping", "Chatuchak Weekend Market", "Fifteen thousand stalls; go early"],
  ["Bangkok", "nightlife", "Soi Nana", "Bars in old shophouses, nothing like the other Nana"],
  ["Bangkok", "wellness", "Wat Pho", "Thai massage school attached to the temple"],

  // Singapore
  ["Singapore", "food", "Maxwell Food Centre", "Hawker stalls, several with long-standing queues"],
  ["Singapore", "nature", "Gardens by the Bay", "Supertrees and two cooled conservatories"],
  ["Singapore", "art", "National Gallery Singapore", "South East Asian art in two colonial buildings"],

  // Bali
  ["Bali", "nature", "Campuhan Ridge Walk", "Easy ridge above Ubud, go at sunrise"],
  ["Bali", "beach", "Bingin Beach", "Cliff steps down to a surf break and warungs"],
  ["Bali", "wellness", "Tirta Empul", "Spring-water purification, bring a sarong"],

  // Hong Kong
  ["Hong Kong", "food", "Tim Ho Wan", "Dim sum, famously cheap for the accolades"],
  ["Hong Kong", "nature", "Dragon's Back", "Ridge hike ending at a beach"],

  // Seoul
  ["Seoul", "food", "Gwangjang Market", "Bindaetteok and mayak gimbap, cash only"],
  ["Seoul", "shopping", "Seongsu-dong", "Warehouses turned into cafés and flagships"],
  ["Seoul", "history", "Gyeongbokgung", "Free entry if you turn up in hanbok"],

  // London
  ["London", "food", "Borough Market", "Produce and lunch stalls under the railway"],
  ["London", "art", "Tate Modern", "Free collection, paid exhibitions, river views"],
  ["London", "nature", "Hampstead Heath", "Swimming ponds and the best skyline view"],
  ["London", "nightlife", "Soho", "Old pubs, small theatres and late Chinese food"],
  ["London", "history", "Sir John Soane's Museum", "An architect's house left exactly as it was"],

  // Paris
  ["Paris", "art", "Musée d'Orsay", "Impressionists in a converted railway station"],
  ["Paris", "food", "Rue Mouffetard", "Market street, cheese and a good crêpe"],
  ["Paris", "coffee", "Café de Flore", "Expensive, and still worth one sitting"],
  ["Paris", "architecture", "Sainte-Chapelle", "Fifteen windows of thirteenth-century glass"],
  ["Paris", "shopping", "Marché aux Puces", "Saint-Ouen flea market, Saturday to Monday"],

  // Rome
  ["Rome", "history", "Pantheon", "Still the largest unreinforced concrete dome"],
  ["Rome", "food", "Testaccio Market", "Where Roman cooking is still cheap"],
  ["Rome", "art", "Galleria Borghese", "Bernini marbles, two-hour timed slots only"],

  // Barcelona
  ["Barcelona", "architecture", "Sagrada Família", "Book the tower slot separately"],
  ["Barcelona", "food", "Mercat de Sant Antoni", "Local market, Sunday book stalls outside"],
  ["Barcelona", "beach", "Bogatell", "Calmer than Barceloneta, same water"],

  // Lisbon
  ["Lisbon", "food", "Time Out Market", "One hall, a lot of the city's best kitchens"],
  ["Lisbon", "architecture", "Jerónimos Monastery", "Manueline stonework; queue early"],
  ["Lisbon", "nightlife", "Cais do Sodré", "Pink street and the bars off it"],

  // Amsterdam
  ["Amsterdam", "art", "Rijksmuseum", "Dutch Golden Age, and a bicycle tunnel through it"],
  ["Amsterdam", "nature", "Vondelpark", "The city's back garden"],

  // New York
  ["New York", "food", "Katz's Delicatessen", "Pastrami, ticket system, cash tip the carver"],
  ["New York", "art", "The Met", "Pay-what-you-wish for New York State residents"],
  ["New York", "nature", "The High Line", "Old freight line, now a mile-and-a-half walk"],
  ["New York", "nightlife", "Lower East Side", "Small venues within stumbling distance"],

  // Mexico City
  ["Mexico City", "food", "Mercado de Medellín", "South American groceries and good ceviche"],
  ["Mexico City", "art", "Museo Frida Kahlo", "Casa Azul, tickets online days ahead"],
  ["Mexico City", "history", "Teotihuacán", "Pyramids an hour out; first bus beats the heat"],

  // Istanbul
  ["Istanbul", "architecture", "Hagia Sophia", "Church, mosque, museum, mosque again"],
  ["Istanbul", "food", "Kadıköy Market", "The Asian side's eating quarter"],
  ["Istanbul", "wellness", "Çemberlitaş Hamamı", "A Sinan bathhouse, working since 1584"],

  // Dubai
  ["Dubai", "architecture", "Burj Khalifa", "Book the 124th floor at sunset, weeks ahead"],
  ["Dubai", "shopping", "Gold Souk", "Deira, haggling expected, price by weight"],

  // Delhi
  ["Delhi", "history", "Humayun's Tomb", "The rehearsal for the Taj Mahal"],
  ["Delhi", "food", "Chandni Chowk", "Paranthe Wali Gali and the shops around it"],
  ["Delhi", "shopping", "Dilli Haat", "Crafts from every state, small entry fee"],

  // Sydney
  ["Sydney", "nature", "Bondi to Coogee", "Six kilometres of coast path and sea pools"],
  ["Sydney", "architecture", "Sydney Opera House", "The building tour beats the exterior photo"],

  // Reykjavik
  ["Reykjavik", "nature", "Þingvellir", "Two tectonic plates and a parliament site"],
  ["Reykjavik", "wellness", "Sky Lagoon", "Cheaper and closer than the Blue Lagoon"],
];

export function communityPicks(city: string, interests: string[]): Candidate[] {
  const wanted = new Set(interests);

  return ROWS.filter(
    ([rowCity, interest]) =>
      rowCity.toLowerCase() === city.toLowerCase() && wanted.has(interest),
  ).map(([rowCity, interest, name, detail]) => ({
    name,
    interestId: interest,
    detail,
    city: rowCity,
    tier: "community" as const,
    attribution: "Published trips",
  }));
}

/** Which of our seeded cities this destination matches, if any. */
export function communityCities(): string[] {
  return [...new Set(ROWS.map(([city]) => city))];
}
