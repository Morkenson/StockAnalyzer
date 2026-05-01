export interface Loan {
  id: string;
  name: string;
  principal: number;
  interestRate: number;
  loanTerm: number;
  monthlyPayment: number;
  totalAmountPaid: number;
  totalInterest: number;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface LoanRow {
  id: string;
  name: string;
  principal: number;
  interestRate: number;
  loanTerm: number;
  monthlyPayment: number;
  totalAmountPaid: number;
  totalInterest: number;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}
