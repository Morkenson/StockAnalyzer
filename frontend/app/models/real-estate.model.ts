export interface RealEstateListing {
  id: string;
  address: string;
  city: string;
  country: string;
  propertyType: string;
  price: number;
  currency: string;
  bedrooms: number | null;
  bathrooms: number | null;
  areaSqm: number | null;
  estimatedMonthlyRent: number | null;
  propertyTaxRatePct: number | null;
  yearBuilt: number | null;
  source: 'sample' | 'rentcast';
}

export interface RentcastUsage {
  provider: string;
  configured: boolean;
  used: number;
  limit: number;
  remaining: number;
  periodStart: string;
  periodEnd: string;
}

export interface RealEstateSearchResult {
  listings: RealEstateListing[];
  source: 'sample' | 'rentcast';
  cached?: boolean;
  cachedAt?: string | null;
  usage?: RentcastUsage | null;
  quotaExhausted?: boolean;
}

export interface RealEstateSearchParams {
  location?: string;
  minPrice?: number;
  maxPrice?: number;
  propertyType?: string;
  minBedrooms?: number;
  refresh?: boolean;
}

export interface RealEstatePropertyInputs {
  name: string;
  address?: string;
  city?: string;
  country?: string;
  propertyType?: string;
  currency: string;
  purchasePrice: number;
  downPaymentPct: number;
  closingCosts: number;
  interestRate: number;
  loanTermYears: number;
  monthlyRent: number;
  vacancyRatePct: number;
  propertyTaxAnnual: number;
  insuranceAnnual: number;
  hoaMonthly: number;
  maintenancePct: number;
  managementPct: number;
  otherMonthlyCosts: number;
  appreciationPct: number;
  holdYears: number;
  notes?: string;
}

export interface RealEstateProperty extends RealEstatePropertyInputs {
  id: string;
  monthlyCashFlow: number;
  capRate: number;
  cashOnCashReturn: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface RealEstatePropertyRow extends RealEstatePropertyInputs {
  id: string;
  monthlyCashFlow: number;
  capRate: number;
  cashOnCashReturn: number;
  createdAt: string;
  updatedAt: string;
}

export type InvestmentVerdict = 'profitable' | 'marginal' | 'unprofitable';

export interface InvestmentAnalysis {
  loanAmount: number;
  downPayment: number;
  totalCashInvested: number;
  monthlyMortgage: number;
  effectiveMonthlyRent: number;
  monthlyOperatingExpenses: number;
  noiAnnual: number;
  monthlyCashFlow: number;
  annualCashFlow: number;
  capRate: number;
  cashOnCashReturn: number;
  grossRentMultiplier: number;
  onePercentRule: boolean;
  projectedValue: number;
  loanBalanceAtHold: number;
  equityAtHold: number;
  totalReturnAtHold: number;
  annualizedRoi: number;
  verdict: InvestmentVerdict;
}
