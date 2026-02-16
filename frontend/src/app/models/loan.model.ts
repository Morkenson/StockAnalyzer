export interface Loan {
  id: string;
  name: string;
  principal: number;
  interestRate: number; // Annual percentage rate
  loanTerm: number; // Months
  monthlyPayment: number;
  totalAmountPaid: number;
  totalInterest: number;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface LoanRow {
  id: string;
  user_id: string;
  name: string;
  principal: number;
  interest_rate: number;
  loan_term: number;
  monthly_payment: number;
  total_amount_paid: number;
  total_interest: number;
  notes?: string;
  created_at: string;
  updated_at: string;
}
