/**
 * Links out to Tripadvisor's own search. Nothing is fetched from Tripadvisor:
 * its API terms forbid storing its places on a trip, caching them, or passing
 * them through AI, so Discover sends you to the site instead, with only the
 * place in the address.
 */

const SEARCH = "https://www.tripadvisor.com/Search";

/** Tripadvisor's search for one place, where its reviews are. */
export function tripadvisorUrl(name: string, city?: string): string {
  const query = [name, city].filter(Boolean).join(", ");
  return `${SEARCH}?q=${encodeURIComponent(query)}`;
}

/** The Things to do tab of Tripadvisor's search, for a whole destination. */
export function tripadvisorThingsToDoUrl(where: string): string {
  return `${SEARCH}?q=${encodeURIComponent(where)}&ssrc=A`;
}
