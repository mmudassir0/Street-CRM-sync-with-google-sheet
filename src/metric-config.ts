/**
 * metric-config.ts
 * ---------------------------------------------------------------------------
 * Single source of truth for the field names, status strings and branch names
 * used to compute the weekly / YTD KPI report. These were confirmed against
 * live sample payloads from https://demo.street.co.uk/open-api/v1.
 *
 * If Street ever changes these values, this is the only file that needs
 * updating — metrics.ts and branch-sync.ts just read from here.
 */

// ---------------------------------------------------------------------------
// Branch (sales office) names — must match attributes.name on /branches
// exactly (case-insensitive match is used when resolving IDs).
// ---------------------------------------------------------------------------
export const SALES_BRANCH_NAMES = [
  'Bovey Tracey',
  'Teignmouth',
  'Newton Abbot',
  'Fine & Country',
] as const;

// If a branch literally called "Rentals" (or similar) exists in Street,
// we'll filter the Rentals tab to that branch. Otherwise we fall back to
// aggregating all lettings-flagged records across every branch.
export const RENTALS_BRANCH_NAME_CANDIDATES = ['Rentals', 'Lettings'];

// ---------------------------------------------------------------------------
// Valuations (/valuations)
// ---------------------------------------------------------------------------
export const VALUATION_TYPE = {
  SALES: 'sales',
  LETTINGS: 'lettings',
} as const;

export const VALUATION_STAGE = {
  INSTRUCTED: 'Instructed',
  WON: 'Won',
  CONFIRMED: 'Confirmed',
  UPCOMING: 'Upcoming',
} as const;

// ASSUMPTION: "Valuations attended" = the appointment has actually taken
// place, i.e. anything NOT still 'Upcoming'. "Valuations won" = stage/status
// === 'Won'. Please confirm this matches how the branches think about it —
// e.g. should a 'Confirmed' valuation in the future count as "attended"?
export const VALUATION_ATTENDED_STAGES: string[] = [
  VALUATION_STAGE.WON,
  VALUATION_STAGE.CONFIRMED,
  VALUATION_STAGE.INSTRUCTED,
];
export const VALUATION_WON_STAGE = VALUATION_STAGE.WON;
export const VALUATION_DATE_FIELD = 'appointment_at';

// ---------------------------------------------------------------------------
// Properties (/properties)
// ---------------------------------------------------------------------------
export const PROPERTY_STATUS = {
  INSTRUCTED: 'Instructed',
  FOR_SALE: 'For Sale',
  UNDER_OFFER: 'Under Offer',
  NOT_ON_MARKET: 'Not On The Market',
} as const;

export const PROPERTY_SALES_INSTRUCTED_DATE_FIELD = 'last_instructed_sales_at';
export const PROPERTY_LETTINGS_INSTRUCTED_DATE_FIELD = 'last_instructed_lettings_at';
export const PROPERTY_CREATED_AT_FIELD = 'created_at';

// ---------------------------------------------------------------------------
// Sales (/sales)
// ---------------------------------------------------------------------------
export const SALE_STATUS = {
  OFFER_ACCEPTED: 'Offer Accepted',
  EXCHANGED: 'Exchanged',
  COMPLETED: 'Completed',
  FALL_THROUGH: 'Fall Through',
} as const;

// ASSUMPTION: "Properties sold" = legally Completed (attributes.dates.completed_date
// falls in the period). Some agencies instead mean "sales agreed" (Offer Accepted).
// If you want the latter, swap SOLD_STATUS to OFFER_ACCEPTED and the date field
// to 'dates.offer_accepted_date'.
export const SOLD_STATUS = SALE_STATUS.COMPLETED;
export const SOLD_DATE_FIELD = 'dates.completed_date';

export const SALES_AGREED_STATUS = SALE_STATUS.OFFER_ACCEPTED;
export const SALES_AGREED_DATE_FIELD = 'dates.offer_accepted_date';

// ASSUMPTION: Street's sample payload has no dedicated "fall through date" —
// we use created_at as a proxy for when the fall-through record was logged.
// If Street adds attributes.dates.fall_through_date later, switch to that.
export const FALL_THROUGH_STATUS = SALE_STATUS.FALL_THROUGH;
export const FALL_THROUGH_DATE_FIELD = 'created_at';

// ---------------------------------------------------------------------------
// Tenancies (/tenancies)
// ---------------------------------------------------------------------------
export const TENANCY_STATUS = {
  ACTIVE: 'active',
  EXPIRING: 'expiring',
  ENDED: 'ended',
} as const;

export const SERVICE_LEVEL_FULLY_MANAGED = 'Fully Managed';

// "Properties let" = a new tenancy that started within the period.
export const TENANCY_LET_DATE_FIELD = 'start_date';

// ASSUMPTION: Street has no explicit "lost" status for a lettings instruction
// that fell through before a tenancy started. We proxy "Properties lost" as
// tenancies whose status became 'ended' within the period. This is almost
// certainly not quite right — please confirm with Street/the branches what
// "lost" should actually mean (e.g. a property instruction withdrawn before
// letting) so we can point at the correct field.
export const LOST_STATUS = TENANCY_STATUS.ENDED;
export const LOST_DATE_FIELD = 'end_date';

// ---------------------------------------------------------------------------
// Viewings (/viewings)
// ---------------------------------------------------------------------------
export const VIEWING_STATUS = {
  COMPLETED: 'completed',
  CONFIRMED: 'confirmed',
  UNCONFIRMED: 'unconfirmed',
  CANCELLED: 'cancelled',
} as const;

export const VIEWING_ATTENDED_STATUS = VIEWING_STATUS.COMPLETED;
export const VIEWING_DATE_FIELD = 'start';

// ---------------------------------------------------------------------------
// People / Applicants (/people)
// ---------------------------------------------------------------------------
// ASSUMPTION: There's no single documented "role" field confirmed for people
// records yet. We treat a record as an "applicant" if either:
//   (a) it carries a flattened relationship key that mentions "applicant"
//       (e.g. applicants_id / applicant_id / applicants_ids), or
//   (b) attributes.type / attributes.role contains "applicant" (case-insensitive)
// and then count by created_at falling in the period. Please sanity-check a
// real /people record against this — if applicants live on a different
// endpoint (e.g. /applicants) that would be cleaner and more reliable.
export const APPLICANT_CREATED_AT_FIELD = 'created_at';

// ---------------------------------------------------------------------------
// Pagination
// ---------------------------------------------------------------------------
// A single page (100 records) is nowhere near enough for a YTD aggregate.
// Override with STREET_MAX_PAGES in .env if a branch has very high volume.
export const DEFAULT_MAX_PAGES = Number(process.env.STREET_MAX_PAGES) || 50;
