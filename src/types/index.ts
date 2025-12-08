export type Currency = 'CRC' | 'USD';

export type AccountType = 'BANK' | 'CASH' | 'CREDIT_CARD' | 'INVESTMENT';

export interface Account {
    id: string;
    name: string;
    type: AccountType;
    currency: Currency;
    balance: number;
}

export type EnvelopeCategory = 'FIXED' | 'VARIABLE' | 'SAVINGS' | 'GOALS' | 'DEBT';

export interface Envelope {
    id: string;
    name: string;
    category: EnvelopeCategory;
    budgetLimit: number;
    currentAmount: number;
}

export type TransactionType = 'INCOME' | 'EXPENSE' | 'TRANSFER' | 'DEBT_PAYMENT';

export interface Transaction {
    id: string;
    date: string; // ISO string
    amount: number;
    currency: Currency;
    type: TransactionType;
    accountId: string; // Source for expense/transfer, Destination for income
    destinationAccountId?: string; // For transfers
    envelopeId?: string; // For expenses
    notes?: string;
}
