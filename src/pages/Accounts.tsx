import { useState } from 'react';
import { useFinance } from '../context/FinanceContext';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Plus, Wallet, CreditCard, Banknote, PiggyBank } from 'lucide-react';
import { formatCurrency } from '../lib/utils';
import { AccountType, Currency, EnvelopeCategory } from '../types';

export default function Accounts() {
    const { accounts, envelopes, addAccount, addEnvelope } = useFinance();
    const [showAddAccount, setShowAddAccount] = useState(false);
    const [showAddEnvelope, setShowAddEnvelope] = useState(false);

    // Form States
    const [newAccountName, setNewAccountName] = useState('');
    const [newAccountType, setNewAccountType] = useState<AccountType>('BANK');
    const [newAccountCurrency, setNewAccountCurrency] = useState<Currency>('CRC');
    const [newAccountBalance, setNewAccountBalance] = useState('');

    const [newEnvelopeName, setNewEnvelopeName] = useState('');
    const [newEnvelopeCategory, setNewEnvelopeCategory] = useState<EnvelopeCategory>('VARIABLE');
    const [newEnvelopeLimit, setNewEnvelopeLimit] = useState('');

    const handleAddAccount = (e: React.FormEvent) => {
        e.preventDefault();
        addAccount({
            name: newAccountName,
            type: newAccountType,
            currency: newAccountCurrency,
            balance: Number(newAccountBalance),
        });
        setShowAddAccount(false);
        setNewAccountName('');
        setNewAccountBalance('');
    };

    const handleAddEnvelope = (e: React.FormEvent) => {
        e.preventDefault();
        addEnvelope({
            name: newEnvelopeName,
            category: newEnvelopeCategory,
            budgetLimit: Number(newEnvelopeLimit),
            currentAmount: 0, // Starts at 0, filled by income allocation
        });
        setShowAddEnvelope(false);
        setNewEnvelopeName('');
        setNewEnvelopeLimit('');
    };

    const getIcon = (type: AccountType) => {
        switch (type) {
            case 'BANK': return <Wallet className="text-blue-500" />;
            case 'CREDIT_CARD': return <CreditCard className="text-purple-500" />;
            case 'CASH': return <Banknote className="text-green-500" />;
            case 'INVESTMENT': return <PiggyBank className="text-orange-500" />;
        }
    };

    return (
        <div className="space-y-8">
            {/* Accounts Section */}
            <section className="space-y-4">
                <div className="flex items-center justify-between">
                    <h2 className="text-2xl font-bold text-slate-800">Cuentas Reales</h2>
                    <Button onClick={() => setShowAddAccount(!showAddAccount)}>
                        <Plus className="mr-2 h-4 w-4" /> Nueva Cuenta
                    </Button>
                </div>

                {showAddAccount && (
                    <Card className="bg-slate-50 border-dashed">
                        <CardContent className="pt-6">
                            <form onSubmit={handleAddAccount} className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 items-end">
                                <Input
                                    label="Nombre"
                                    value={newAccountName}
                                    onChange={e => setNewAccountName(e.target.value)}
                                    required
                                />
                                <div className="space-y-1">
                                    <label className="text-sm font-medium text-slate-700">Tipo</label>
                                    <select
                                        className="flex h-10 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
                                        value={newAccountType}
                                        onChange={e => setNewAccountType(e.target.value as AccountType)}
                                    >
                                        <option value="BANK">Bancaria</option>
                                        <option value="CASH">Efectivo</option>
                                        <option value="CREDIT_CARD">Tarjeta de Crédito</option>
                                        <option value="INVESTMENT">Inversión / Ahorro</option>
                                    </select>
                                </div>
                                <div className="space-y-1">
                                    <label className="text-sm font-medium text-slate-700">Moneda</label>
                                    <select
                                        className="flex h-10 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
                                        value={newAccountCurrency}
                                        onChange={e => setNewAccountCurrency(e.target.value as Currency)}
                                    >
                                        <option value="CRC">Colones (CRC)</option>
                                        <option value="USD">Dólares (USD)</option>
                                    </select>
                                </div>
                                <Input
                                    label="Saldo Inicial"
                                    type="number"
                                    step="0.01"
                                    value={newAccountBalance}
                                    onChange={e => setNewAccountBalance(e.target.value)}
                                    required
                                />
                                <Button type="submit">Guardar</Button>
                            </form>
                        </CardContent>
                    </Card>
                )}

                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {accounts.map(account => (
                        <Card key={account.id}>
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-sm font-medium">
                                    {account.name}
                                </CardTitle>
                                {getIcon(account.type)}
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold">
                                    {formatCurrency(account.balance, account.currency)}
                                </div>
                                <p className="text-xs text-slate-500 capitalize">
                                    {account.type.replace('_', ' ').toLowerCase()}
                                </p>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            </section>

            {/* Envelopes Section */}
            <section className="space-y-4">
                <div className="flex items-center justify-between">
                    <h2 className="text-2xl font-bold text-slate-800">Sobres (Presupuesto)</h2>
                    <Button onClick={() => setShowAddEnvelope(!showAddEnvelope)} variant="outline">
                        <Plus className="mr-2 h-4 w-4" /> Nuevo Sobre
                    </Button>
                </div>

                {showAddEnvelope && (
                    <Card className="bg-slate-50 border-dashed">
                        <CardContent className="pt-6">
                            <form onSubmit={handleAddEnvelope} className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 items-end">
                                <Input
                                    label="Nombre"
                                    value={newEnvelopeName}
                                    onChange={e => setNewEnvelopeName(e.target.value)}
                                    required
                                />
                                <div className="space-y-1">
                                    <label className="text-sm font-medium text-slate-700">Categoría</label>
                                    <select
                                        className="flex h-10 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
                                        value={newEnvelopeCategory}
                                        onChange={e => setNewEnvelopeCategory(e.target.value as EnvelopeCategory)}
                                    >
                                        <option value="FIXED">Gastos Fijos</option>
                                        <option value="VARIABLE">Gastos Variables</option>
                                        <option value="SAVINGS">Ahorro</option>
                                        <option value="GOALS">Metas</option>
                                        <option value="DEBT">Deudas</option>
                                    </select>
                                </div>
                                <Input
                                    label="Presupuesto Mensual"
                                    type="number"
                                    step="0.01"
                                    value={newEnvelopeLimit}
                                    onChange={e => setNewEnvelopeLimit(e.target.value)}
                                    required
                                />
                                <Button type="submit">Guardar</Button>
                            </form>
                        </CardContent>
                    </Card>
                )}

                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {envelopes.map(envelope => (
                        <Card key={envelope.id}>
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-sm font-medium">
                                    {envelope.name}
                                </CardTitle>
                                <span className="text-xs font-semibold px-2 py-1 rounded-full bg-slate-100 text-slate-600">
                                    {envelope.category}
                                </span>
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold">
                                    {formatCurrency(envelope.currentAmount, 'CRC')}
                                </div>
                                <p className="text-xs text-slate-500">
                                    de {formatCurrency(envelope.budgetLimit, 'CRC')} presupuestado
                                </p>
                                {/* Progress Bar */}
                                <div className="mt-3 h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                                    <div
                                        className="h-full bg-brand-500 rounded-full"
                                        style={{ width: `${Math.min((envelope.currentAmount / envelope.budgetLimit) * 100, 100)}%` }}
                                    />
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            </section>
        </div>
    );
}
