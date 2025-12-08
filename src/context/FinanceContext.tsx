import React, { createContext, useContext, useState, useEffect } from 'react';
import { Account, Envelope, Transaction } from '../types';
import { generateId } from '../lib/utils';

interface FinanceContextType {
    accounts: Account[];
    envelopes: Envelope[];
    transactions: Transaction[];
    addAccount: (account: Omit<Account, 'id'>) => void;
    addEnvelope: (envelope: Omit<Envelope, 'id'>) => void;
    addTransaction: (transaction: Omit<Transaction, 'id'>) => void;
    getAccountBalance: (accountId: string) => number;
    getEnvelopeBalance: (envelopeId: string) => number;
}

const FinanceContext = createContext<FinanceContextType | undefined>(undefined);

export const useFinance = () => {
    const context = useContext(FinanceContext);
    if (!context) {
        throw new Error('useFinance must be used within a FinanceProvider');
    }
    return context;
};

export const FinanceProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [accounts, setAccounts] = useState<Account[]>(() => {
        const saved = localStorage.getItem('accounts');
        return saved ? JSON.parse(saved) : [];
    });

    const [envelopes, setEnvelopes] = useState<Envelope[]>(() => {
        const saved = localStorage.getItem('envelopes');
        return saved ? JSON.parse(saved) : [];
    });

    const [transactions, setTransactions] = useState<Transaction[]>(() => {
        const saved = localStorage.getItem('transactions');
        return saved ? JSON.parse(saved) : [];
    });

    useEffect(() => {
        localStorage.setItem('accounts', JSON.stringify(accounts));
    }, [accounts]);

    useEffect(() => {
        localStorage.setItem('envelopes', JSON.stringify(envelopes));
    }, [envelopes]);

    useEffect(() => {
        localStorage.setItem('transactions', JSON.stringify(transactions));
    }, [transactions]);

    const addAccount = (account: Omit<Account, 'id'>) => {
        setAccounts([...accounts, { ...account, id: generateId() }]);
    };

    const addEnvelope = (envelope: Omit<Envelope, 'id'>) => {
        setEnvelopes([...envelopes, { ...envelope, id: generateId() }]);
    };

    const addTransaction = (transactionData: Omit<Transaction, 'id'>) => {
        const newTransaction = { ...transactionData, id: generateId() };
        setTransactions([newTransaction, ...transactions]);

        // Update Balances Logic
        const { type, amount, accountId, destinationAccountId, envelopeId } = transactionData;

        if (type === 'INCOME') {
            setAccounts(prev => prev.map(acc =>
                acc.id === accountId ? { ...acc, balance: acc.balance + amount } : acc
            ));
        } else if (type === 'EXPENSE') {
            setAccounts(prev => prev.map(acc =>
                acc.id === accountId ? { ...acc, balance: acc.balance - amount } : acc
            ));
            if (envelopeId) {
                setEnvelopes(prev => prev.map(env =>
                    env.id === envelopeId ? { ...env, currentAmount: env.currentAmount - amount } : env
                ));
            }
        } else if (type === 'TRANSFER') {
            setAccounts(prev => prev.map(acc => {
                if (acc.id === accountId) return { ...acc, balance: acc.balance - amount };
                if (acc.id === destinationAccountId) return { ...acc, balance: acc.balance + amount };
                return acc;
            }));
        } else if (type === 'DEBT_PAYMENT') {
            // Paying a credit card. Source decreases, Destination (Card) increases (towards 0).
            setAccounts(prev => prev.map(acc => {
                if (acc.id === accountId) return { ...acc, balance: acc.balance - amount };
                if (acc.id === destinationAccountId) return { ...acc, balance: acc.balance + amount };
                return acc;
            }));
        }
    };

    const getAccountBalance = (accountId: string) => {
        return accounts.find(a => a.id === accountId)?.balance || 0;
    };

    const getEnvelopeBalance = (envelopeId: string) => {
        return envelopes.find(e => e.id === envelopeId)?.currentAmount || 0;
    };

    return (
        <FinanceContext.Provider value={{
            accounts,
            envelopes,
            transactions,
            addAccount,
            addEnvelope,
            addTransaction,
            getAccountBalance,
            getEnvelopeBalance
        }}>
            {children}
        </FinanceContext.Provider>
    );
};
