/**
 * metrics.ts
 * ---------------------------------------------------------------------------
 * Pure aggregation functions over flattened Street records (as produced by
 * StreetClient.fetchAll). No API calls happen here — this file just filters
 * and counts arrays that have already been fetched, so it's easy to unit
 * test independently of the network.
 */

import { StreetRecord } from './street-client';
import * as cfg from './metric-config';

// ---------------------------------------------------------------------------
// Generic helpers
// ---------------------------------------------------------------------------

/** Reads a (possibly dot-notation-flattened) field off a record. */
export function getField(record: StreetRecord, field: string): any {
  return record[field];
}

/** Parses a date field on a record; returns null if missing/invalid. */
export function parseDateField(record: StreetRecord, field: string): Date | null {
  const raw = getField(record, field);
  if (!raw) return null;
  const d = new Date(raw);
  return isNaN(d.getTime()) ? null : d;
}

/** True if a record's branch_id matches the given branch id. */
export function belongsToBranch(record: StreetRecord, branchId: string | null): boolean {
  if (!branchId) return true; // no branch filter requested (e.g. aggregate view)
  return record['branch_id'] === branchId;
}

/** True if a date field on the record falls within [start, end] inclusive. */
export function inRange(record: StreetRecord, dateField: string, start: Date, end: Date): boolean {
  const d = parseDateField(record, dateField);
  if (!d) return false;
  return d >= start && d <= end;
}

/** Case-insensitive exact match on a status/stage field. */
export function statusIs(record: StreetRecord, field: string, value: string): boolean {
  const v = getField(record, field);
  return typeof v === 'string' && v.toLowerCase() === value.toLowerCase();
}

/** Case-insensitive match against one of several allowed values. */
export function statusIn(record: StreetRecord, field: string, values: string[]): boolean {
  const v = getField(record, field);
  if (typeof v !== 'string') return false;
  return values.some(candidate => candidate.toLowerCase() === v.toLowerCase());
}

function truthy(record: StreetRecord, field: string): boolean {
  const v = getField(record, field);
  return v === true || v === 'true' || v === 1 || v === '1';
}

// ---------------------------------------------------------------------------
// Valuations
// ---------------------------------------------------------------------------

export function filterValuations(
  valuations: StreetRecord[],
  branchId: string | null,
  type: 'sales' | 'lettings',
  start: Date,
  end: Date
): StreetRecord[] {
  return valuations.filter(v =>
    belongsToBranch(v, branchId) &&
    statusIs(v, 'valuation_type', type) &&
    inRange(v, cfg.VALUATION_DATE_FIELD, start, end)
  );
}

export function countValuationsAttended(
  valuations: StreetRecord[],
  branchId: string | null,
  type: 'sales' | 'lettings',
  start: Date,
  end: Date
): number {
  return filterValuations(valuations, branchId, type, start, end).filter(v =>
    statusIn(v, 'stage', cfg.VALUATION_ATTENDED_STAGES) || statusIn(v, 'status', cfg.VALUATION_ATTENDED_STAGES)
  ).length;
}

export function countValuationsWon(
  valuations: StreetRecord[],
  branchId: string | null,
  type: 'sales' | 'lettings',
  start: Date,
  end: Date
): number {
  return filterValuations(valuations, branchId, type, start, end).filter(v =>
    statusIs(v, 'stage', cfg.VALUATION_WON_STAGE) || statusIs(v, 'status', cfg.VALUATION_WON_STAGE)
  ).length;
}

// ---------------------------------------------------------------------------
// Properties
// ---------------------------------------------------------------------------

export function countPropertiesInstructed(
  properties: StreetRecord[],
  branchId: string | null,
  channel: 'sales' | 'lettings',
  start: Date,
  end: Date
): number {
  const dateField = channel === 'sales'
    ? cfg.PROPERTY_SALES_INSTRUCTED_DATE_FIELD
    : cfg.PROPERTY_LETTINGS_INSTRUCTED_DATE_FIELD;
  const flagField = channel === 'sales' ? 'is_sales' : 'is_lettings';

  return properties.filter(p =>
    belongsToBranch(p, branchId) &&
    truthy(p, flagField) &&
    inRange(p, dateField, start, end)
  ).length;
}

export function filterInstructedProperties(
  properties: StreetRecord[],
  branchId: string | null,
  channel: 'sales' | 'lettings',
  start: Date,
  end: Date
): StreetRecord[] {
  const dateField = channel === 'sales'
    ? cfg.PROPERTY_SALES_INSTRUCTED_DATE_FIELD
    : cfg.PROPERTY_LETTINGS_INSTRUCTED_DATE_FIELD;
  const flagField = channel === 'sales' ? 'is_sales' : 'is_lettings';

  return properties.filter(p =>
    belongsToBranch(p, branchId) &&
    truthy(p, flagField) &&
    inRange(p, dateField, start, end)
  );
}

// ---------------------------------------------------------------------------
// Sales
// ---------------------------------------------------------------------------

export function filterSalesByStatus(
  sales: StreetRecord[],
  branchId: string | null,
  status: string,
  dateField: string,
  start: Date,
  end: Date
): StreetRecord[] {
  return sales.filter(s =>
    belongsToBranch(s, branchId) &&
    statusIs(s, 'status', status) &&
    inRange(s, dateField, start, end)
  );
}

export function countPropertiesSold(sales: StreetRecord[], branchId: string | null, start: Date, end: Date): number {
  return filterSalesByStatus(sales, branchId, cfg.SOLD_STATUS, cfg.SOLD_DATE_FIELD, start, end).length;
}

export function countSalesAgreed(sales: StreetRecord[], branchId: string | null, start: Date, end: Date): StreetRecord[] {
  return filterSalesByStatus(sales, branchId, cfg.SALES_AGREED_STATUS, cfg.SALES_AGREED_DATE_FIELD, start, end);
}

export function countFallThroughs(sales: StreetRecord[], branchId: string | null, start: Date, end: Date): number {
  return filterSalesByStatus(sales, branchId, cfg.FALL_THROUGH_STATUS, cfg.FALL_THROUGH_DATE_FIELD, start, end).length;
}

// ---------------------------------------------------------------------------
// Tenancies (lettings)
// ---------------------------------------------------------------------------

export function filterTenanciesLet(tenancies: StreetRecord[], branchId: string | null, start: Date, end: Date): StreetRecord[] {
  return tenancies.filter(t =>
    belongsToBranch(t, branchId) &&
    inRange(t, cfg.TENANCY_LET_DATE_FIELD, start, end)
  );
}

export function countPropertiesLet(tenancies: StreetRecord[], branchId: string | null, start: Date, end: Date): number {
  return filterTenanciesLet(tenancies, branchId, start, end).length;
}

export function countPropertiesLost(tenancies: StreetRecord[], branchId: string | null, start: Date, end: Date): number {
  return tenancies.filter(t =>
    belongsToBranch(t, branchId) &&
    statusIs(t, 'status', cfg.LOST_STATUS) &&
    inRange(t, cfg.LOST_DATE_FIELD, start, end)
  ).length;
}

/** Live snapshot — not date-ranged, since it's a point-in-time count. */
export function countFullyManagedProperties(tenancies: StreetRecord[], branchId: string | null): number {
  return tenancies.filter(t =>
    belongsToBranch(t, branchId) &&
    truthy(t, 'active') &&
    statusIs(t, 'service_level', cfg.SERVICE_LEVEL_FULLY_MANAGED)
  ).length;
}

// ---------------------------------------------------------------------------
// Viewings
// ---------------------------------------------------------------------------

export function countViewingsAttended(viewings: StreetRecord[], branchId: string | null, start: Date, end: Date): number {
  return viewings.filter(v =>
    belongsToBranch(v, branchId) &&
    statusIs(v, 'status', cfg.VIEWING_ATTENDED_STATUS) &&
    inRange(v, cfg.VIEWING_DATE_FIELD, start, end)
  ).length;
}

// ---------------------------------------------------------------------------
// Applicants
// ---------------------------------------------------------------------------

function looksLikeApplicant(record: StreetRecord): boolean {
  const keys = Object.keys(record);
  if (keys.some(k => k.toLowerCase().includes('applicant'))) return true;
  const roleOrType = (record['role'] || record['type'] || '').toString().toLowerCase();
  return roleOrType.includes('applicant');
}

export function countApplicantsRegistered(people: StreetRecord[], branchId: string | null, start: Date, end: Date): number {
  return people.filter(p =>
    belongsToBranch(p, branchId) &&
    looksLikeApplicant(p) &&
    inRange(p, cfg.APPLICANT_CREATED_AT_FIELD, start, end)
  ).length;
}

// ---------------------------------------------------------------------------
// YoY helper (re-exported here so metrics.ts is self-contained for testing)
// ---------------------------------------------------------------------------

export function calculateYoY(current: number, previous: number): string {
  if (previous === 0) {
    return current > 0 ? '+100%' : '0%';
  }
  const diff = ((current - previous) / previous) * 100;
  const prefix = diff > 0 ? '+' : '';
  return `${prefix}${diff.toFixed(1)}%`;
}
