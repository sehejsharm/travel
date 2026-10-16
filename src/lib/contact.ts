/**
 * The one address people reach us on: legal pages, data requests, and Help &
 * feedback alike. Both app stores check that it is answered.
 *
 * A plain module, so server pages and client screens import the same value.
 * NEXT_PUBLIC_ is inlined at build time, so changing it needs a rebuild.
 */
export const CONTACT_EMAIL = process.env.NEXT_PUBLIC_CONTACT_EMAIL || "support@manifest.trip";
