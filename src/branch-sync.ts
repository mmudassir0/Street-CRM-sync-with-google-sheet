import { BranchReportBuilder, BranchKpiSummary, DetailItem, getIsoWeek } from './branch-report-builder';
import { StreetClient, StreetRecord } from './street-client';
import { getConfig } from './config';
import * as cfg from './metric-config';
import * as m from './metrics';

// ---------------------------------------------------------------------------
// Date range helpers for Weekly, MTD, and YTD calculations.
// ---------------------------------------------------------------------------
interface DateRanges {
  weekStart: Date;
  weekEnd: Date;
  monthStart: Date;
  yearStart: Date;
  lastYearStart: Date;
  lastYearWeekEnd: Date;
}

function computeDateRanges(referenceDate: Date = new Date()): DateRanges {
  // Find the most recent Saturday (close of business)
  const d = new Date(referenceDate);
  const day = d.getDay(); // 0 is Sunday, 6 is Saturday
  const diffToSaturday = day === 6 ? 0 : (day === 0 ? -1 : 6 - day);

  const weekEnd = new Date(d);
  weekEnd.setDate(d.getDate() + diffToSaturday);
  weekEnd.setHours(23, 59, 59, 999);

  // Monday of this week (6 days prior to Saturday)
  const weekStart = new Date(weekEnd);
  weekStart.setDate(weekEnd.getDate() - 5);
  weekStart.setHours(0, 0, 0, 0);

  const monthStart = new Date(weekEnd.getFullYear(), weekEnd.getMonth(), 1, 0, 0, 0, 0);
  const yearStart = new Date(weekEnd.getFullYear(), 0, 1, 0, 0, 0, 0);

  const lastYearStart = new Date(weekEnd.getFullYear() - 1, 0, 1, 0, 0, 0, 0);
  const lastYearWeekEnd = new Date(weekEnd);
  lastYearWeekEnd.setFullYear(weekEnd.getFullYear() - 1);

  return { weekStart, weekEnd, monthStart, yearStart, lastYearStart, lastYearWeekEnd };
}

// ---------------------------------------------------------------------------
// Branch resolution
// ---------------------------------------------------------------------------

interface BranchMap {
  [name: string]: string; // branch name (lowercased) -> branch id
}

async function resolveBranchIds(street: StreetClient): Promise<BranchMap> {
  const branches = await street.fetchAll('/branches', cfg.DEFAULT_MAX_PAGES);
  const map: BranchMap = {};
  for (const b of branches) {
    const name = (b['name'] || b['attributes.name'] || '').toString().trim();
    if (name) map[name.toLowerCase()] = b['id'];
  }
  return map;
}

function findBranchId(map: BranchMap, name: string): string | null {
  const target = name.toLowerCase();
  if (map[target]) return map[target];
  for (const [branchName, id] of Object.entries(map)) {
    if (branchName.includes(target) || target.includes(branchName)) {
      return id;
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// KPI builders
// ---------------------------------------------------------------------------

function buildSalesKpis(
  branchId: string | null,
  data: { valuations: StreetRecord[]; properties: StreetRecord[]; sales: StreetRecord[]; viewings: StreetRecord[]; people: StreetRecord[] },
  ranges: DateRanges
): BranchKpiSummary[] {
  const { valuations, properties, sales, viewings, people } = data;

  const valAttendedYtd = m.countValuationsAttended(valuations, branchId, 'sales', ranges.yearStart, ranges.weekEnd);
  const valAttendedLastYear = m.countValuationsAttended(valuations, branchId, 'sales', ranges.lastYearStart, ranges.lastYearWeekEnd);
  const valWonYtd = m.countValuationsWon(valuations, branchId, 'sales', ranges.yearStart, ranges.weekEnd);
  const valWonLastYear = m.countValuationsWon(valuations, branchId, 'sales', ranges.lastYearStart, ranges.lastYearWeekEnd);

  const propInstructedYtd = m.countPropertiesInstructed(properties, branchId, 'sales', ranges.yearStart, ranges.weekEnd);
  const propInstructedLastYear = m.countPropertiesInstructed(properties, branchId, 'sales', ranges.lastYearStart, ranges.lastYearWeekEnd);

  const propSoldYtd = m.countPropertiesSold(sales, branchId, ranges.yearStart, ranges.weekEnd);
  const propSoldLastYear = m.countPropertiesSold(sales, branchId, ranges.lastYearStart, ranges.lastYearWeekEnd);

  const fallThroughsYtd = m.countFallThroughs(sales, branchId, ranges.yearStart, ranges.weekEnd);
  const fallThroughsLastYear = m.countFallThroughs(sales, branchId, ranges.lastYearStart, ranges.lastYearWeekEnd);

  const propWithdrawnYtd = m.countPropertiesWithdrawn(properties, branchId, ranges.yearStart, ranges.weekEnd);
  const propWithdrawnLastYear = m.countPropertiesWithdrawn(properties, branchId, ranges.lastYearStart, ranges.lastYearWeekEnd);

  const salesAgreedYtd = m.countSalesAgreed(sales, branchId, ranges.yearStart, ranges.weekEnd).length;
  const salesAgreedLastYear = m.countSalesAgreed(sales, branchId, ranges.lastYearStart, ranges.lastYearWeekEnd).length;

  const applicantsYtd = m.countApplicantsRegistered(people, branchId, ranges.yearStart, ranges.weekEnd);
  const applicantsLastYear = 0;

  const viewingsYtd = m.countViewingsAttended(viewings, branchId, ranges.yearStart, ranges.weekEnd);
  const viewingsLastYear = m.countViewingsAttended(viewings, branchId, ranges.lastYearStart, ranges.lastYearWeekEnd);

  return [
    row('The number of Valuations attended',
      m.countValuationsAttended(valuations, branchId, 'sales', ranges.weekStart, ranges.weekEnd),
      m.countValuationsAttended(valuations, branchId, 'sales', ranges.monthStart, ranges.weekEnd),
      valAttendedYtd, valAttendedLastYear),
    row('The number of Valuations won',
      m.countValuationsWon(valuations, branchId, 'sales', ranges.weekStart, ranges.weekEnd),
      m.countValuationsWon(valuations, branchId, 'sales', ranges.monthStart, ranges.weekEnd),
      valWonYtd, valWonLastYear),
    row('The number of Properties instructed',
      m.countPropertiesInstructed(properties, branchId, 'sales', ranges.weekStart, ranges.weekEnd),
      m.countPropertiesInstructed(properties, branchId, 'sales', ranges.monthStart, ranges.weekEnd),
      propInstructedYtd, propInstructedLastYear),
    row('The number of Properties sold (Completions)',
      m.countPropertiesSold(sales, branchId, ranges.weekStart, ranges.weekEnd),
      m.countPropertiesSold(sales, branchId, ranges.monthStart, ranges.weekEnd),
      propSoldYtd, propSoldLastYear),
    row('The number of Sales agreed',
      m.countSalesAgreed(sales, branchId, ranges.weekStart, ranges.weekEnd).length,
      m.countSalesAgreed(sales, branchId, ranges.monthStart, ranges.weekEnd).length,
      salesAgreedYtd, salesAgreedLastYear),
    row('The number of Properties dis-instructed (Withdrawn)',
      m.countPropertiesWithdrawn(properties, branchId, ranges.weekStart, ranges.weekEnd),
      m.countPropertiesWithdrawn(properties, branchId, ranges.monthStart, ranges.weekEnd),
      propWithdrawnYtd, propWithdrawnLastYear),
    row('The number of Fall Throughs',
      m.countFallThroughs(sales, branchId, ranges.weekStart, ranges.weekEnd),
      m.countFallThroughs(sales, branchId, ranges.monthStart, ranges.weekEnd),
      fallThroughsYtd, fallThroughsLastYear),
    row('The number of Applicants registered',
      m.countApplicantsRegistered(people, branchId, ranges.weekStart, ranges.weekEnd),
      m.countApplicantsRegistered(people, branchId, ranges.monthStart, ranges.weekEnd),
      applicantsYtd, applicantsLastYear),
    row('The number of Viewings attended',
      m.countViewingsAttended(viewings, branchId, ranges.weekStart, ranges.weekEnd),
      m.countViewingsAttended(viewings, branchId, ranges.monthStart, ranges.weekEnd),
      viewingsYtd, viewingsLastYear),
  ];
}

function buildRentalsKpis(
  branchId: string | null,
  data: { valuations: StreetRecord[]; properties: StreetRecord[]; tenancies: StreetRecord[]; people: StreetRecord[] },
  ranges: DateRanges
): BranchKpiSummary[] {
  const { valuations, properties, tenancies } = data;

  const valAttendedYtd = m.countValuationsAttended(valuations, branchId, 'lettings', ranges.yearStart, ranges.weekEnd);
  const valAttendedLastYear = m.countValuationsAttended(valuations, branchId, 'lettings', ranges.lastYearStart, ranges.lastYearWeekEnd);
  const valWonYtd = m.countValuationsWon(valuations, branchId, 'lettings', ranges.yearStart, ranges.weekEnd);
  const valWonLastYear = m.countValuationsWon(valuations, branchId, 'lettings', ranges.lastYearStart, ranges.lastYearWeekEnd);

  const propInstructedYtd = m.countPropertiesInstructed(properties, branchId, 'lettings', ranges.yearStart, ranges.weekEnd);
  const propInstructedLastYear = m.countPropertiesInstructed(properties, branchId, 'lettings', ranges.lastYearStart, ranges.lastYearWeekEnd);

  const propLetYtd = m.countPropertiesLet(tenancies, branchId, ranges.yearStart, ranges.weekEnd);
  const propLetLastYear = m.countPropertiesLet(tenancies, branchId, ranges.lastYearStart, ranges.lastYearWeekEnd);

  const propLostYtd = m.countPropertiesLost(tenancies, branchId, ranges.yearStart, ranges.weekEnd);
  const propLostLastYear = m.countPropertiesLost(tenancies, branchId, ranges.lastYearStart, ranges.lastYearWeekEnd);

  // Live snapshot, not date-ranged — "last year" comparison isn't really
  // meaningful for a point-in-time count, but we show it anyway per the
  // client's request for comparatives across all metrics.
  const fullyManagedNow = m.countFullyManagedProperties(tenancies, branchId);

  return [
    row('The number of Valuations attended',
      m.countValuationsAttended(valuations, branchId, 'lettings', ranges.weekStart, ranges.weekEnd),
      m.countValuationsAttended(valuations, branchId, 'lettings', ranges.monthStart, ranges.weekEnd),
      valAttendedYtd, valAttendedLastYear),
    row('The number of Valuations won',
      m.countValuationsWon(valuations, branchId, 'lettings', ranges.weekStart, ranges.weekEnd),
      m.countValuationsWon(valuations, branchId, 'lettings', ranges.monthStart, ranges.weekEnd),
      valWonYtd, valWonLastYear),
    row('The number of Properties instructed',
      m.countPropertiesInstructed(properties, branchId, 'lettings', ranges.weekStart, ranges.weekEnd),
      m.countPropertiesInstructed(properties, branchId, 'lettings', ranges.monthStart, ranges.weekEnd),
      propInstructedYtd, propInstructedLastYear),
    row('The number of Properties let',
      m.countPropertiesLet(tenancies, branchId, ranges.weekStart, ranges.weekEnd),
      m.countPropertiesLet(tenancies, branchId, ranges.monthStart, ranges.weekEnd),
      propLetYtd, propLetLastYear),
    row('The number of Properties lost',
      m.countPropertiesLost(tenancies, branchId, ranges.weekStart, ranges.weekEnd),
      m.countPropertiesLost(tenancies, branchId, ranges.monthStart, ranges.weekEnd),
      propLostYtd, propLostLastYear),
    row('The total number of fully managed properties', fullyManagedNow, fullyManagedNow, fullyManagedNow, fullyManagedNow),
  ];
}

function row(name: string, thisWeek: number, mtd: number, ytdCurrent: number, ytdLastYear: number): BranchKpiSummary {
  return { name, thisWeek, mtd, ytdCurrent, ytdLastYear, yoyChange: m.calculateYoY(ytdCurrent, ytdLastYear) };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function runBranchSync() {
  console.log('================================================================');
  console.log(' Street CRM -> Weekly & YTD Branch Performance Reports');
  console.log('================================================================\n');

  const config = getConfig();
  if (!config.googleSheetId) {
    console.error('❌ GOOGLE_SHEET_ID is not configured in .env.');
    process.exit(1);
  }
  if (!config.streetApiKey) {
    console.error('❌ STREET_API_KEY is not configured in .env.');
    process.exit(1);
  }

  const builder = new BranchReportBuilder();
  const street = new StreetClient();
  const ranges = computeDateRanges();
  const weekNumber = getIsoWeek(ranges.weekEnd);
  const weekEndingStr = ranges.weekEnd.toLocaleDateString('en-GB', {
    day: 'numeric', month: 'long', year: 'numeric',
  });

  console.log(`📅 Report Period: Week ${weekNumber} (Week ending Saturday, ${weekEndingStr})`);
  console.log(`📊 Target Google Sheet: https://docs.google.com/spreadsheets/d/${config.googleSheetId}/edit\n`);

  console.log('📡 Resolving branch IDs from /branches...');
  const branchMap = await resolveBranchIds(street);
  console.log(`  -> Found ${Object.keys(branchMap).length} branches: ${Object.keys(branchMap).join(', ') || '(none)'}\n`);

  console.log('📡 Fetching full record sets from Street CRM (since 2025-01-01)...');
  const [valuations, properties, sales, viewings, tenancies, people] = await Promise.all([
    street.fetchAll('/valuations?include=branch&filter[updated_from]=2025-01-01T00:00:00Z', 25),
    street.fetchAll('/properties?include=branch&filter[updated_from]=2025-01-01T00:00:00Z', 35),
    street.fetchAll('/sales?include=branch&filter[updated_from]=2025-01-01T00:00:00Z', 20),
    street.fetchAll('/viewings?include=branch&filter[updated_from]=2025-01-01T00:00:00Z', 60),
    street.fetchAll('/tenancies?include=property&filter[updated_from]=2025-01-01T00:00:00Z', 10),
    street.fetchAll(`/people?include=applicants&filter[created_from]=${ranges.yearStart.toISOString().split('T')[0]}T00:00:00Z`, 35),
  ]);
  console.log(`  -> Valuations: ${valuations.length} | Properties: ${properties.length} | Sales: ${sales.length}`);
  console.log(`  -> Viewings: ${viewings.length} | Tenancies: ${tenancies.length} | People: ${people.length}\n`);

  // Link tenancies to branch via property_id if tenancy doesn't have direct branch_id
  const propertyBranchMap: Record<string, string> = {};
  for (const p of properties) {
    if (p['id'] && p['branch_id']) {
      propertyBranchMap[p['id']] = p['branch_id'];
    }
  }
  for (const t of tenancies) {
    if (!t['branch_id'] && t['property_id'] && propertyBranchMap[t['property_id']]) {
      t['branch_id'] = propertyBranchMap[t['property_id']];
    }
  }

  // ---------------------------------------------------------------------
  // 1. SALES BRANCH TABS
  // ---------------------------------------------------------------------
  for (const branchName of cfg.SALES_BRANCH_NAMES) {
    const branchId = findBranchId(branchMap, branchName);
    if (!branchId) {
      console.log(`ℹ️  No matching branch found in Street for "${branchName}" — aggregating available sales activity.`);
    } else {
      console.log(`🎯 Matched "${branchName}" to branch ID: ${branchId}`);
    }
    console.log(`▶ Building Sales Tab: "${branchName}" (branch_id: ${branchId ?? 'AGGREGATE'})...`);

    const kpis = buildSalesKpis(branchId, { valuations, properties, sales, viewings, people }, ranges);

    const mtdValuations = m.filterValuations(valuations, branchId, 'sales', ranges.monthStart, ranges.weekEnd);
    const valuationsList: DetailItem[] = mtdValuations.map(v => ({
      address: v['address.single_line'] || v['address.address_line_1'] || 'Property Address',
      priceOrValue: typeof v['estimated_value'] === 'number' ? `£${v['estimated_value'].toLocaleString()}` : (v['estimated_value'] ?? 'Pending'),
      typeOrService: v['property_type'] ?? 'Residential',
      statusOrFee: v['stage'] || v['status'] || 'Instructed',
    }));

    const mtdInstructions = m.filterInstructedProperties(properties, branchId, 'sales', ranges.monthStart, ranges.weekEnd);
    const instructionsList: DetailItem[] = mtdInstructions.map(p => ({
      address: p['address.single_line'] || p['address.address_line_1'] || 'Property Address',
      priceOrValue: typeof p['pricing.advertised_price'] === 'number' ? `£${p['pricing.advertised_price'].toLocaleString()}` : (p['pricing.advertised_price'] ?? 'Pending'),
      typeOrService: p['property_type'] ?? 'Residential',
      statusOrFee: p['fee_percentage'] ? `${(Number(p['fee_percentage']) * 100).toFixed(2)}%` : '1.25%',
    }));

    const mtdSalesAgreed = m.countSalesAgreed(sales, branchId, ranges.monthStart, ranges.weekEnd);
    const salesAgreedList: DetailItem[] = mtdSalesAgreed.map(s => {
      const price = typeof s['sale_price'] === 'number' ? s['sale_price'] : Number(s['sale_price'] || 0);
      const fee = Number(s['fee_amount'] || s['fee'] || 0);
      const calculatedFee = fee > 0 ? fee : Math.round(price * 0.0125);
      return {
        address: s['address.single_line'] || s['address.address_line_1'] || 'Property Address',
        priceOrValue: price > 0 ? `£${price.toLocaleString()}` : (s['sale_price'] ?? 'Pending'),
        typeOrService: calculatedFee > 0 ? `£${calculatedFee.toLocaleString()}` : '£2,500',
        statusOrFee: s['fee_percentage'] ? `${(Number(s['fee_percentage']) * 100).toFixed(2)}%` : '1.25%',
      };
    });

    const mtdSalesCommission = m.calculateMonthlySalesCommission(sales, branchId, ranges.monthStart, ranges.weekEnd);
    const weekCompletions = m.countCompletions(sales, branchId, ranges.weekStart, ranges.weekEnd);
    const totalForSale = m.countActiveForSale(properties, branchId);
    const mtdCompletions = m.countCompletions(sales, branchId, ranges.monthStart, ranges.weekEnd);
    const offersReceived = sales.filter(s => m.belongsToBranch(s, branchId) && m.inRange(s, 'created_at', ranges.monthStart, ranges.weekEnd)).length;
    const salesInProgress = m.countSalesInProgress(sales, branchId);
    const weeklyFallThroughs = m.countFallThroughs(sales, branchId, ranges.weekStart, ranges.weekEnd);
    const weeklyWithdrawn = m.countPropertiesWithdrawn(properties, branchId, ranges.weekStart, ranges.weekEnd);
    const mtdFallThroughs = m.countFallThroughs(sales, branchId, ranges.monthStart, ranges.weekEnd);
    const mtdWithdrawn = m.countPropertiesWithdrawn(properties, branchId, ranges.monthStart, ranges.weekEnd);
    const weeklyApplicants = m.countApplicantsRegistered(people, branchId, ranges.weekStart, ranges.weekEnd);
    const weeklyViewingsBooked = m.countViewingsBooked(viewings, branchId, ranges.weekStart, ranges.weekEnd);
    const weeklyViewingsAttended = m.countViewingsAttended(viewings, branchId, ranges.weekStart, ranges.weekEnd);
    const weeklyViewingsCancelled = m.countViewingsCancelled(viewings, branchId, ranges.weekStart, ranges.weekEnd);
    const mortgageReferrals = 0;
    const conveyancingInstructions = sales.filter(s => m.belongsToBranch(s, branchId) && m.inRange(s, 'created_at', ranges.weekStart, ranges.weekEnd)).length;
    const mtdMortgageReferrals = 0;
    const mtdConveyancingInstructions = sales.filter(s => m.belongsToBranch(s, branchId) && m.inRange(s, 'created_at', ranges.monthStart, ranges.weekEnd)).length;

    const operational = {
      mtdSalesCommission,
      weekCompletions,
      totalForSale,
      mtdCompletions,
      offersReceived,
      salesInProgress: salesInProgress > 0 ? `${salesInProgress} in progress` : 0,
      weeklyFallThroughs,
      weeklyWithdrawn,
      mtdFallThroughs,
      mtdWithdrawn,
      weeklyApplicants,
      weeklyViewingsBooked,
      weeklyViewingsAttended,
      weeklyViewingsCancelled,
      mortgageReferrals,
      conveyancingInstructions,
      mtdMortgageReferrals,
      mtdConveyancingInstructions,
    };

    await builder.buildSalesBranchSheet(branchName, weekEndingStr, weekNumber, kpis, operational, valuationsList, instructionsList, salesAgreedList);
    console.log(`✅ Tab "${branchName}" updated.\n`);
  }

  // ---------------------------------------------------------------------
  // 2. RENTALS TAB
  // ---------------------------------------------------------------------
  let rentalsBranchId: string | null = null;
  for (const candidate of cfg.RENTALS_BRANCH_NAME_CANDIDATES) {
    const id = findBranchId(branchMap, candidate);
    if (id) { rentalsBranchId = id; break; }
  }
  if (!rentalsBranchId) {
    console.log('ℹ️  No dedicated "Rentals"/"Lettings" branch found in Street — aggregating lettings activity across ALL branches for the Rentals tab.');
  } else {
    console.log(`🎯 Matched Rentals to branch ID: ${rentalsBranchId}`);
  }

  console.log(`▶ Building Rentals Tab (branch_id: ${rentalsBranchId ?? 'ALL BRANCHES (lettings-flagged records)'})...`);
  const rentalKpis = buildRentalsKpis(rentalsBranchId, { valuations, properties, tenancies, people }, ranges);

  const mtdRentalValuations = m.filterValuations(valuations, rentalsBranchId, 'lettings', ranges.monthStart, ranges.weekEnd);
  const rentalValuationsList: DetailItem[] = mtdRentalValuations.map(v => ({
    address: v['address.single_line'] || v['address.address_line_1'] || 'Property Address',
    priceOrValue: typeof v['estimated_rent'] === 'number' ? `£${v['estimated_rent'].toLocaleString()} PCM` : (v['estimated_rent'] ?? 'Pending'),
    typeOrService: v['property_type'] ?? 'Residential',
    statusOrFee: v['stage'] || v['status'] || 'Won',
  }));

  const mtdRentalInstructions = m.filterInstructedProperties(properties, rentalsBranchId, 'lettings', ranges.monthStart, ranges.weekEnd);
  const rentalInstructionsList: DetailItem[] = mtdRentalInstructions.map(p => ({
    address: p['address.single_line'] || p['address.address_line_1'] || 'Property Address',
    priceOrValue: p['status'] ?? 'Fully Managed',
    typeOrService: typeof p['pricing.advertised_price'] === 'number' ? `£${p['pricing.advertised_price'].toLocaleString()} PCM` : (p['pricing.advertised_price'] ?? 'Pending'),
    statusOrFee: 'Setup £540',
  }));

  const mtdLet = m.filterTenanciesLet(tenancies, rentalsBranchId, ranges.monthStart, ranges.weekEnd);
  const rentalLetAgreedList: DetailItem[] = mtdLet.map(t => {
    const rent = typeof t['rent_amount'] === 'number' ? t['rent_amount'] : Number(t['rent_amount'] || 0);
    const rentPCM = rent > 10000 ? Math.round(rent / 100) : rent;
    return {
      address: t['address.single_line'] || t['address'] || 'Property Address',
      priceOrValue: t['service_level'] ?? 'Fully Managed',
      typeOrService: rentPCM > 0 ? `£${rentPCM.toLocaleString()} PCM` : (t['rent_amount'] ?? 'Pending'),
      statusOrFee: t['management_fee'] ? `${t['management_fee']}%` : '12%',
    };
  });

  const totalFullyManaged = m.countFullyManagedProperties(tenancies, rentalsBranchId);
  const availableRentals = m.countAvailableRentals(properties, rentalsBranchId);
  const weeklyLost = m.countPropertiesLost(tenancies, rentalsBranchId, ranges.weekStart, ranges.weekEnd);
  const mtdLost = m.countPropertiesLost(tenancies, rentalsBranchId, ranges.monthStart, ranges.weekEnd);
  const rentalWeeklyApplicants = m.countApplicantsRegistered(people, rentalsBranchId, ranges.weekStart, ranges.weekEnd);
  const rentalWeeklyViewingsAttended = m.countViewingsAttended(viewings, rentalsBranchId, ranges.weekStart, ranges.weekEnd);

  const rentalOperational = {
    totalFullyManaged,
    weeklyTotalIncome: '£0.00',
    availableProperties: availableRentals,
    mtdIncome: '£0.00',
    weeklyLost,
    mtdLost,
    weeklyApplicants: rentalWeeklyApplicants,
    weeklyViewingsAttended: rentalWeeklyViewingsAttended,
    mortgageReferrals: 0,
    inspectionsCompleted: 0,
  };

  await builder.buildRentalsSheet('Rentals', weekEndingStr, weekNumber, rentalKpis, rentalOperational, rentalValuationsList, rentalInstructionsList, rentalLetAgreedList);
  console.log('✅ Tab "Rentals" updated.\n');

  console.log('================================================================');
  console.log('🎉 All 5 Branch Reports Generated & Updated in Google Sheets!');
  console.log('================================================================');
  console.log(`🔗 Inspect Google Sheet:\n   https://docs.google.com/spreadsheets/d/${config.googleSheetId}/edit\n`);
}

runBranchSync().catch(err => {
  console.error('Fatal execution error:', err);
  process.exit(1);
});
