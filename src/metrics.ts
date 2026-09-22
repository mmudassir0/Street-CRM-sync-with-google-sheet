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

/** Parses a date field (or checks multiple fallback field names) on a record; returns null if missing/invalid. */
export function parseDateField(record: StreetRecord, field: string | string[]): Date | null {
  const fields = Array.isArray(field) ? field : [field];
  for (const f of fields) {
    const raw = getField(record, f);
    if (raw) {
      const d = new Date(raw);
      if (!isNaN(d.getTime())) return d;
    }
  }
  return null;
}

/** True if a record's branch_id matches the given branch id. */
export function belongsToBranch(record: StreetRecord, branchId: string | null): boolean {
  if (!branchId) return true; // no branch filter requested (e.g. aggregate view)
  if (!record['branch_id']) return true; // Record has no branch assignment, include in agency count
  return record['branch_id'] === branchId;
}

/** True if a date field (or fallback field) on the record falls within [start, end] inclusive. */
export function inRange(record: StreetRecord, dateField: string | string[], start: Date, end: Date): boolean {
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
  return valuations.filter(v => {
    if (!belongsToBranch(v, branchId)) return false;
    const vType = (getField(v, 'valuation_type') || '').toString().toLowerCase();
    const typeMatches = vType === type || vType.includes(type);
    if (!typeMatches) return false;
    return inRange(v, cfg.VALUATION_DATE_FIELDS, start, end);
  });
}

export function countValuationsAttended(
  valuations: StreetRecord[],
  branchId: string | null,
  type: 'sales' | 'lettings',
  start: Date,
  end: Date
): number {
  return filterValuations(valuations, branchId, type, start, end).filter(v => {
    const status = (getField(v, 'status') || getField(v, 'stage') || '').toString().toLowerCase();
    return !status.includes('cancel') && !status.includes('not attended');
  }).length;
}

export function countValuationsWon(
  valuations: StreetRecord[],
  branchId: string | null,
  type: 'sales' | 'lettings',
  start: Date,
  end: Date
): number {
  return filterValuations(valuations, branchId, type, start, end).filter(v => {
    const status = (getField(v, 'status') || getField(v, 'stage') || '').toString().toLowerCase();
    return status.includes('instruct') || status.includes('won');
  }).length;
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
  return filterInstructedProperties(properties, branchId, channel, start, end).length;
}

export function filterInstructedProperties(
  properties: StreetRecord[],
  branchId: string | null,
  channel: 'sales' | 'lettings',
  start: Date,
  end: Date
): StreetRecord[] {
  const dateFields = channel === 'sales'
    ? cfg.PROPERTY_SALES_INSTRUCTED_DATE_FIELDS
    : cfg.PROPERTY_LETTINGS_INSTRUCTED_DATE_FIELDS;
  const flagField = channel === 'sales' ? 'is_sales' : 'is_lettings';

  return properties.filter(p => {
    if (!belongsToBranch(p, branchId)) return false;
    const status = (getField(p, 'status') || '').toString().toLowerCase();
    const isChannel = truthy(p, flagField) || (channel === 'sales' ? status.includes('sale') : status.includes('let'));
    if (!isChannel) return false;
    if (status.includes('valuation cancelled')) return false;
    return inRange(p, dateFields, start, end);
  });
}

// ---------------------------------------------------------------------------
// Sales
// ---------------------------------------------------------------------------

export function countPropertiesSold(sales: StreetRecord[], branchId: string | null, start: Date, end: Date): number {
  return sales.filter(s => {
    if (!belongsToBranch(s, branchId)) return false;
    const status = (getField(s, 'status') || '').toString().toLowerCase();
    if (!status.includes('completed')) return false;
    return inRange(s, cfg.SOLD_DATE_FIELDS, start, end);
  }).length;
}

export function countSalesAgreed(sales: StreetRecord[], branchId: string | null, start: Date, end: Date): StreetRecord[] {
  return sales.filter(s => {
    if (!belongsToBranch(s, branchId)) return false;
    const status = (getField(s, 'status') || '').toString().toLowerCase();
    const isAgreed = status.includes('offer accepted') || status.includes('exchanged') || status.includes('completed');
    if (!isAgreed) return false;
    return inRange(s, cfg.SALES_AGREED_DATE_FIELDS, start, end);
  });
}

export function countFallThroughs(sales: StreetRecord[], branchId: string | null, start: Date, end: Date): number {
  return sales.filter(s => {
    if (!belongsToBranch(s, branchId)) return false;
    const status = (getField(s, 'status') || '').toString().toLowerCase();
    if (!status.includes('fall')) return false;
    return inRange(s, cfg.FALL_THROUGH_DATE_FIELDS, start, end);
  }).length;
}

// ---------------------------------------------------------------------------
// Tenancies (lettings)
// ---------------------------------------------------------------------------

export function filterTenanciesLet(tenancies: StreetRecord[], branchId: string | null, start: Date, end: Date): StreetRecord[] {
  return tenancies.filter(t =>
    belongsToBranch(t, branchId) &&
    inRange(t, cfg.TENANCY_LET_DATE_FIELDS, start, end)
  );
}

export function countPropertiesLet(tenancies: StreetRecord[], branchId: string | null, start: Date, end: Date): number {
  return filterTenanciesLet(tenancies, branchId, start, end).length;
}

export function countPropertiesLost(tenancies: StreetRecord[], branchId: string | null, start: Date, end: Date): number {
  return tenancies.filter(t => {
    if (!belongsToBranch(t, branchId)) return false;
    const status = (getField(t, 'status') || '').toString().toLowerCase();
    const isLost = status.includes('ended') || status.includes('lost');
    if (!isLost) return false;
    return inRange(t, cfg.LOST_DATE_FIELDS, start, end);
  }).length;
}

/** Live snapshot — not date-ranged, since it's a point-in-time count. */
export function countFullyManagedProperties(tenancies: StreetRecord[], branchId: string | null): number {
  return tenancies.filter(t => {
    if (!belongsToBranch(t, branchId)) return false;
    if (!truthy(t, 'active')) return false;
    const level = (getField(t, 'service_level') || '').toString().toLowerCase();
    return level.includes('manage');
  }).length;
}

// ---------------------------------------------------------------------------
// Viewings
// ---------------------------------------------------------------------------

export function countViewingsAttended(viewings: StreetRecord[], branchId: string | null, start: Date, end: Date): number {
  return viewings.filter(v => {
    if (!belongsToBranch(v, branchId)) return false;
    const status = (getField(v, 'status') || '').toString().toLowerCase();
    if (status.includes('cancelled')) return false;
    return inRange(v, cfg.VIEWING_DATE_FIELDS, start, end);
  }).length;
}

// ---------------------------------------------------------------------------
// Applicants
// ---------------------------------------------------------------------------

function looksLikeApplicant(record: StreetRecord): boolean {
  if (record['applicants_ids'] || record['applicants_id']) return true;
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
// Additional Operational & Pipeline Metrics (matching client report layout)
// ---------------------------------------------------------------------------

/** Properties dis-instructed / withdrawn in date range */
export function countPropertiesWithdrawn(
  properties: StreetRecord[],
  branchId: string | null,
  start: Date,
  end: Date
): number {
  return properties.filter(p => {
    if (!belongsToBranch(p, branchId)) return false;
    const status = (getField(p, 'status') || '').toString().toLowerCase();
    const isWithdrawn = status.includes('withdrawn') || status.includes('dis-instructed') || status.includes('cancelled');
    if (!isWithdrawn || status.includes('valuation cancelled')) return false;
    const date = parseDateField(p, ['status_updated_at', 'updated_at', 'created_at']);
    return date ? date >= start && date <= end : false;
  }).length;
}

/** Active sales properties currently on market (For Sale snapshot) */
export function countActiveForSale(properties: StreetRecord[], branchId: string | null): number {
  return properties.filter(p => {
    if (!belongsToBranch(p, branchId)) return false;
    const isSales = truthy(p, 'is_sales') || (getField(p, 'status') || '').toString().toLowerCase().includes('sale');
    if (!isSales) return false;
    const status = (getField(p, 'status') || '').toString().toLowerCase();
    return (
      status.includes('for sale') ||
      status.includes('instructed') ||
      status.includes('under offer') ||
      status.includes('sold stc') ||
      status === 'available'
    );
  }).length;
}

/** Active sales currently in pipeline (agreed, under offer, or exchanged) */
export function countSalesInProgress(sales: StreetRecord[], branchId: string | null): number {
  return sales.filter(s => {
    if (!belongsToBranch(s, branchId)) return false;
    const status = (getField(s, 'status') || '').toString().toLowerCase();
    return status.includes('offer accepted') || status.includes('under offer') || status.includes('exchanged') || status.includes('in progress');
  }).length;
}

/** Total sales commission (£) for sales agreed or completed in period */
export function calculateMonthlySalesCommission(
  sales: StreetRecord[],
  branchId: string | null,
  start: Date,
  end: Date
): number {
  let total = 0;
  for (const s of sales) {
    if (!belongsToBranch(s, branchId)) continue;
    const date = parseDateField(s, ['dates.offer_accepted_date', 'created_at', 'status_updated_at']);
    if (date && date >= start && date <= end) {
      const fee = Number(getField(s, 'fee_amount') || getField(s, 'fee') || 0);
      if (fee > 0) {
        total += fee;
      } else {
        const price = Number(getField(s, 'sale_price') || 0);
        const feePct = Number(getField(s, 'fee_percentage') || 0.0125);
        if (price > 0) total += Math.round(price * feePct);
      }
    }
  }
  return total;
}

/** Completions in date range */
export function countCompletions(sales: StreetRecord[], branchId: string | null, start: Date, end: Date): number {
  return sales.filter(s => {
    if (!belongsToBranch(s, branchId)) return false;
    const status = (getField(s, 'status') || '').toString().toLowerCase();
    if (!status.includes('completed')) return false;
    const date = parseDateField(s, ['dates.completed_date', 'status_updated_at', 'updated_at']);
    return date ? date >= start && date <= end : false;
  }).length;
}

/** Total viewings booked in date range */
export function countViewingsBooked(viewings: StreetRecord[], branchId: string | null, start: Date, end: Date): number {
  return viewings.filter(v =>
    belongsToBranch(v, branchId) &&
    inRange(v, cfg.VIEWING_DATE_FIELDS, start, end)
  ).length;
}

/** Viewings cancelled in date range */
export function countViewingsCancelled(viewings: StreetRecord[], branchId: string | null, start: Date, end: Date): number {
  return viewings.filter(v => {
    if (!belongsToBranch(v, branchId)) return false;
    const status = (getField(v, 'status') || '').toString().toLowerCase();
    return status.includes('cancelled') && inRange(v, cfg.VIEWING_DATE_FIELDS, start, end);
  }).length;
}

/** Available lettings properties */
export function countAvailableRentals(properties: StreetRecord[], branchId: string | null): number {
  return properties.filter(p => {
    if (!belongsToBranch(p, branchId)) return false;
    const isLet = truthy(p, 'is_lettings') || (getField(p, 'status') || '').toString().toLowerCase().includes('to let');
    if (!isLet) return false;
    const status = (getField(p, 'status') || '').toString().toLowerCase();
    return status.includes('to let') || status.includes('instructed') || status === 'available';
  }).length;
}

// ---------------------------------------------------------------------------
// YoY helper (re-exported here so metrics.ts is self-contained for testing)
// ---------------------------------------------------------------------------

export function calculateYoY(current: number, previous: number): string {
  if (previous === 0) {
    return current > 0 ? "'+100%" : '0%';
  }
  const diff = ((current - previous) / previous) * 100;
  const prefix = diff > 0 ? '+' : '';
  return `'${prefix}${diff.toFixed(1)}%`;
}

