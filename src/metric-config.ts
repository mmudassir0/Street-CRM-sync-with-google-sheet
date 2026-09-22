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
  BOOKED: 'Booked',
  CONFIRMED: 'Confirmed',
  UPCOMING: 'Upcoming',
} as const;

export const VALUATION_DATE_FIELD = 'start';
export const VALUATION_DATE_FIELDS = ['start', 'appointment_at', 'created_at'];

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
export const PROPERTY_SALES_INSTRUCTED_DATE_FIELDS = [
  'last_instructed_sales_at',
  'last_made_available_for_sale_at',
  'status_updated_at',
  'created_at',
];

export const PROPERTY_LETTINGS_INSTRUCTED_DATE_FIELD = 'last_instructed_lettings_at';
export const PROPERTY_LETTINGS_INSTRUCTED_DATE_FIELDS = [
  'last_instructed_lettings_at',
  'last_made_available_to_let_at',
  'status_updated_at',
  'created_at',
];

export const PROPERTY_CREATED_AT_FIELD = 'created_at';

// ---------------------------------------------------------------------------
// Sales (/sales)
// ---------------------------------------------------------------------------
export const SALE_STATUS = {
  OFFER_ACCEPTED: 'Offer Accepted',
  EXCHANGED: 'Exchanged',
  COMPLETED: 'Completed',
  FALL_THROUGH: 'Fall Through',
  FALLEN_THROUGH: 'Fallen Through',
} as const;

export const SOLD_STATUS = SALE_STATUS.COMPLETED;
export const SOLD_DATE_FIELD = 'dates.completed_date';
export const SOLD_DATE_FIELDS = ['dates.completed_date', 'status_updated_at', 'updated_at', 'created_at'];

export const SALES_AGREED_STATUS = SALE_STATUS.OFFER_ACCEPTED;
export const SALES_AGREED_DATE_FIELD = 'dates.offer_accepted_date';
export const SALES_AGREED_DATE_FIELDS = ['dates.offer_accepted_date', 'created_at', 'status_updated_at'];

export const FALL_THROUGH_STATUS = SALE_STATUS.FALLEN_THROUGH;
export const FALL_THROUGH_DATE_FIELD = 'created_at';
export const FALL_THROUGH_DATE_FIELDS = ['status_updated_at', 'updated_at', 'created_at'];

// ---------------------------------------------------------------------------
// Tenancies (/tenancies)
// ---------------------------------------------------------------------------
export const TENANCY_STATUS = {
  ACTIVE: 'active',
  EXPIRING: 'expiring',
  ENDED: 'ended',
} as const;

export const SERVICE_LEVEL_FULLY_MANAGED = 'Fully Managed';

export const TENANCY_LET_DATE_FIELD = 'start_date';
export const TENANCY_LET_DATE_FIELDS = ['start_date', 'created_at'];

export const LOST_STATUS = TENANCY_STATUS.ENDED;
export const LOST_DATE_FIELD = 'end_date';
export const LOST_DATE_FIELDS = ['end_date', 'status_updated_at', 'updated_at', 'created_at'];

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
export const VIEWING_DATE_FIELDS = ['start', 'start_at', 'created_at'];

// ---------------------------------------------------------------------------
// People / Applicants (/people)
// ---------------------------------------------------------------------------
export const APPLICANT_CREATED_AT_FIELD = 'created_at';

// ---------------------------------------------------------------------------
// Pagination
// ---------------------------------------------------------------------------
export const DEFAULT_MAX_PAGES = Number(process.env.STREET_MAX_PAGES) || 60;

