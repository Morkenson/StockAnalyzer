export type FilingStatus = 'single' | 'married_joint' | 'head_of_household';

export interface TaxProfileInputs {
  taxYear: number;
  filingStatus: FilingStatus;
  grossIncome: number;
  preTaxContributions: number;
  useItemized: boolean;
  itemizedDeduction: number;
  withholdingsPaid: number;
}

export interface TaxProfile extends TaxProfileInputs {
  id: string;
  createdAt: string;
  updatedAt: string;
}

export interface TaxCalculationResult {
  taxYear: number;
  filingStatus: FilingStatus;
  grossIncome: number;
  preTaxContributions: number;
  agi: number;
  deduction: number;
  taxableIncome: number;
  federalTax: number;
  ficaTax: number;
  socialSecurityTax: number;
  medicareTax: number;
  additionalMedicareTax: number;
  stateTax: number;
  totalTax: number;
  withholdingsPaid: number;
  balanceDue: number;
  effectiveRate: number;
}
