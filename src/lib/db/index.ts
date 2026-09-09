import Database from "better-sqlite3";
import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import type { Money, PlaceRef, Trip, TripItem } from "../domain/types";
import type { ItemDraft } from "../extract/types";
import { SEED_TRIP, seedItems } from "./seed";

const DB_PATH = process.env.MANIFEST_DB_PATH ?? join(process.cwd(), ".data", "manifest.db");

const SCHEMA = `
CREATE TABLE IF NOT EXISTS trips (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  home_country TEXT NOT NULL,
  start_date TEXT NOT NULL,
  end_date TEXT NOT NULL,
  budget_amount REAL,
  budget_currency TEXT,
  travelers TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS items (
  id TEXT PRIMARY KEY,
  trip_id TEXT NOT NULL REFERENCES trips(id),
  title TEXT NOT NULL,
  category TEXT NOT NULL,
  booking_kind TEXT,
  source TEXT NOT NULL,
  source_ref TEXT,
  notes TEXT,
  place TEXT,
  arrival_place TEXT,
  starts_at TEXT,
  ends_at TEXT,
  cost TEXT,
  cost_status TEXT,
  confirmation_code TEXT,
  traveler_name TEXT,
  refundable_until TEXT,
  confidence REAL NOT NULL,
  extraction_method TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS items_trip_idx ON items(trip_id);
`;

type Db = ReturnType<typeof Database>;

// Next.js reloads modules in dev; without this each reload opens a new handle.
const globalForDb = globalThis as unknown as { manifestDb?: Db };

function connect(): Db {
  mkdirSync(dirname(DB_PATH), { recursive: true });
  const db = new Database(DB_PATH);
  db.pragma("journal_mode = WAL");
  db.exec(SCHEMA);

  const hasTrip = db.prepare("SELECT COUNT(*) AS count FROM trips").get() as { count: number };
  if (hasTrip.count === 0) seed(db);

  return db;
}

export function getDb(): Db {
  if (!globalForDb.manifestDb) globalForDb.manifestDb = connect();
  return globalForDb.manifestDb;
}

function seed(db: Db): void {
  db.prepare(
    `INSERT INTO trips (id, name, home_country, start_date, end_date, budget_amount, budget_currency, travelers)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    SEED_TRIP.id,
    SEED_TRIP.name,
    SEED_TRIP.homeCountry,
    SEED_TRIP.startDate,
    SEED_TRIP.endDate,
    SEED_TRIP.budgetTarget?.amount ?? null,
    SEED_TRIP.budgetTarget?.currency ?? null,
    JSON.stringify(SEED_TRIP.travelers),
  );

  const insert = itemInsert(db);
  const insertAll = db.transaction((items: TripItem[]) => {
    for (const item of items) insert(item);
  });
  insertAll(seedItems(SEED_TRIP.id));
}

function itemInsert(db: Db) {
  const statement = db.prepare(
    `INSERT INTO items (
      id, trip_id, title, category, booking_kind, source, source_ref, notes,
      place, arrival_place, starts_at, ends_at, cost, cost_status,
      confirmation_code, traveler_name, refundable_until, confidence,
      extraction_method, created_at
    ) VALUES (
      @id, @tripId, @title, @category, @bookingKind, @source, @sourceRef, @notes,
      @place, @arrivalPlace, @startsAt, @endsAt, @cost, @costStatus,
      @confirmationCode, @travelerName, @refundableUntil, @confidence,
      @extractionMethod, @createdAt
    )`,
  );

  return (item: TripItem) =>
    statement.run({
      id: item.id,
      tripId: item.tripId,
      title: item.title,
      category: item.category,
      bookingKind: item.bookingKind ?? null,
      source: item.source,
      sourceRef: item.sourceRef ?? null,
      notes: item.notes ?? null,
      place: item.place ? JSON.stringify(item.place) : null,
      arrivalPlace: item.arrivalPlace ? JSON.stringify(item.arrivalPlace) : null,
      startsAt: item.startsAt ?? null,
      endsAt: item.endsAt ?? null,
      cost: item.cost ? JSON.stringify(item.cost) : null,
      costStatus: item.costStatus ?? null,
      confirmationCode: item.confirmationCode ?? null,
      travelerName: item.travelerName ?? null,
      refundableUntil: item.refundableUntil ?? null,
      confidence: item.confidence,
      extractionMethod: item.extractionMethod,
      createdAt: item.createdAt,
    });
}

interface TripRow {
  id: string;
  name: string;
  home_country: string;
  start_date: string;
  end_date: string;
  budget_amount: number | null;
  budget_currency: string | null;
  travelers: string;
}

interface ItemRow {
  id: string;
  trip_id: string;
  title: string;
  category: string;
  booking_kind: string | null;
  source: string;
  source_ref: string | null;
  notes: string | null;
  place: string | null;
  arrival_place: string | null;
  starts_at: string | null;
  ends_at: string | null;
  cost: string | null;
  cost_status: string | null;
  confirmation_code: string | null;
  traveler_name: string | null;
  refundable_until: string | null;
  confidence: number;
  extraction_method: string;
  created_at: string;
}

function toTrip(row: TripRow): Trip {
  return {
    id: row.id,
    name: row.name,
    homeCountry: row.home_country,
    startDate: row.start_date,
    endDate: row.end_date,
    budgetTarget:
      row.budget_amount !== null && row.budget_currency
        ? { amount: row.budget_amount, currency: row.budget_currency }
        : undefined,
    travelers: JSON.parse(row.travelers),
  };
}

function toItem(row: ItemRow): TripItem {
  return {
    id: row.id,
    tripId: row.trip_id,
    title: row.title,
    category: row.category as TripItem["category"],
    bookingKind: (row.booking_kind as TripItem["bookingKind"]) ?? undefined,
    source: row.source as TripItem["source"],
    sourceRef: row.source_ref ?? undefined,
    notes: row.notes ?? undefined,
    place: row.place ? (JSON.parse(row.place) as PlaceRef) : undefined,
    arrivalPlace: row.arrival_place ? (JSON.parse(row.arrival_place) as PlaceRef) : undefined,
    startsAt: row.starts_at ?? undefined,
    endsAt: row.ends_at ?? undefined,
    cost: row.cost ? (JSON.parse(row.cost) as Money) : undefined,
    costStatus: (row.cost_status as TripItem["costStatus"]) ?? undefined,
    confirmationCode: row.confirmation_code ?? undefined,
    travelerName: row.traveler_name ?? undefined,
    refundableUntil: row.refundable_until ?? undefined,
    confidence: row.confidence,
    extractionMethod: row.extraction_method as TripItem["extractionMethod"],
    createdAt: row.created_at,
  };
}

export function getTrip(): Trip {
  const row = getDb().prepare("SELECT * FROM trips LIMIT 1").get() as TripRow;
  return toTrip(row);
}

export function listItems(tripId: string): TripItem[] {
  const rows = getDb()
    .prepare("SELECT * FROM items WHERE trip_id = ? ORDER BY created_at")
    .all(tripId) as ItemRow[];
  return rows.map(toItem);
}

export function addItem(tripId: string, draft: ItemDraft, meta: {
  confidence: number;
  extractionMethod: TripItem["extractionMethod"];
}): TripItem {
  const item: TripItem = {
    ...draft,
    id: `item-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
    tripId,
    createdAt: new Date().toISOString(),
    confidence: meta.confidence,
    extractionMethod: meta.extractionMethod,
  };

  itemInsert(getDb())(item);
  return item;
}

export function deleteItem(id: string): void {
  getDb().prepare("DELETE FROM items WHERE id = ?").run(id);
}
