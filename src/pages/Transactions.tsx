import { useState } from 'react';
import { useFinance } from '../context/FinanceContext';
import { Card, CardContent } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { formatCurrency } from '../lib/utils';
import { TransactionType, Currency } from '../types';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

export default function Transactions() {
    const { accounts, envelopes, transactions, addTransaction } = useFinance();
    const [showForm, setShowForm] = useState(false);

    // Form State
    const [type, setType] = useState<TransactionType>('EXPENSE');
    const [amount, setAmount] = useState('');
    const [currency, setCurrency] = useState<Currency>('CRC');
    const [date, setDate] = useState(new Date().toLocaleDateString('en-CA'));
    const [accountId, setAccountId] = useState(''); // Source
    const [destinationAccountId, setDestinationAccountId] = useState(''); // Destination
    const [envelopeId, setEnvelopeId] = useState(''); // Category
    const [notes, setNotes] = useState('');

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        addTransaction({
            date,
            amount: Number(amount),
            currency,
            type,
            accountId,
            destinationAccountId: (type === 'TRANSFER' || type === 'DEBT_PAYMENT' || type === 'INCOME') ? destinationAccountId : undefined,
            envelopeId: type === 'EXPENSE' ? envelopeId : undefined,
            notes,
        });
        setShowForm(false);
        setAmount('');
        setNotes('');
    };

    return (
        <div className="space-y-8">
            <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold text-slate-800">Movimientos</h2>
                <Button onClick={() => setShowForm(!showForm)}>
                    {showForm ? 'Cancelar' : 'Nuevo Movimiento'}
                </Button>
            </div>

            {showForm && (
                <Card className="bg-slate-50">
                    <CardContent className="pt-6">
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                                <div className="space-y-1">
                                    <label className="text-sm font-medium text-slate-700">Tipo</label>
                                    <select
                                        className="flex h-10 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
                                        value={type}
                                        onChange={e => setType(e.target.value as TransactionType)}
                                    >
                                        <option value="EXPENSE">Gasto</option>
                                        <option value="INCOME">Ingreso</option>
                                        <option value="TRANSFER">Transferencia</option>
                                        <option value="DEBT_PAYMENT">Pago Deuda</option>
                                    </select>
                                </div>

                                <Input
                                    label="Fecha"
                                    type="date"
                                    value={date}
                                    onChange={e => setDate(e.target.value)}
                                    required
                                />

                                <Input
                                    label="Monto"
                                    type="number"
                                    step="0.01"
                                    value={amount}
                                    onChange={e => setAmount(e.target.value)}
                                    required
                                />

                                <div className="space-y-1">
                                    <label className="text-sm font-medium text-slate-700">Moneda</label>
                                    <select
                                        className="flex h-10 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
                                        value={currency}
                                        onChange={e => setCurrency(e.target.value as Currency)}
                                    >
                                        <option value="CRC">Colones (CRC)</option>
                                        <option value="USD">Dólares (USD)</option>
                                    </select>
                                </div>
                            </div>

                            <div className="grid gap-4 md:grid-cols-2">
                                {/* Logic for Source Account */}
                                <div className="space-y-1">
                                    <label className="text-sm font-medium text-slate-700">
                                        {type === 'INCOME' ? 'Cuenta Destino (Ingreso)' : 'Cuenta Origen'}
                                    </label>
                                    <select
                                        className="flex h-10 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
                                        value={accountId}
                                        onChange={e => setAccountId(e.target.value)}
                                        required
                                    >
                                        <option value="">Seleccionar...</option>
                                        {accounts.map(acc => (
                                            <option key={acc.id} value={acc.id}>{acc.name} ({formatCurrency(acc.balance, acc.currency)})</option>
                                        ))}
                                    </select>
                                </div>

                                {/* Logic for Destination / Envelope */}
                                {type === 'EXPENSE' && (
                                    <div className="space-y-1">
                                        <label className="text-sm font-medium text-slate-700">Sobre / Categoría</label>
                                        <select
                                            className="flex h-10 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
                                            value={envelopeId}
                                            onChange={e => setEnvelopeId(e.target.value)}
                                            required
                                        >
                                            <option value="">Seleccionar...</option>
                                            {envelopes.map(env => (
                                                <option key={env.id} value={env.id}>{env.name} (Disp: {formatCurrency(env.currentAmount, 'CRC')})</option>
                                            ))}
                                        </select>
                                    </div>
                                )}

                                {(type === 'TRANSFER' || type === 'DEBT_PAYMENT') && (
                                    <div className="space-y-1">
                                        <label className="text-sm font-medium text-slate-700">Cuenta Destino</label>
                                        <select
                                            className="flex h-10 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
                                            value={destinationAccountId}
                                            onChange={e => setDestinationAccountId(e.target.value)}
                                            required
                                        >
                                            <option value="">Seleccionar...</option>
                                            {accounts.filter(a => a.id !== accountId).map(acc => (
                                                <option key={acc.id} value={acc.id}>{acc.name}</option>
                                            ))}
                                        </select>
                                    </div>
                                )}
                            </div>

                            <Input
                                label="Notas"
                                value={notes}
                                onChange={e => setNotes(e.target.value)}
                            />

                            <div className="flex justify-end">
                                <Button type="submit">Registrar Movimiento</Button>
                            </div>
                        </form>
                    </CardContent>
                </Card>
            )}

            {/* Transactions List */}
            <Card>
                <CardContent className="p-0">
                    <div className="relative w-full overflow-auto">
                        <table className="w-full caption-bottom text-sm">
                            <thead className="[&_tr]:border-b">
                                <tr className="border-b transition-colors hover:bg-slate-100/50 data-[state=selected]:bg-slate-100">
                                    <th className="h-12 px-4 text-left align-middle font-medium text-slate-500">Fecha</th>
                                    <th className="h-12 px-4 text-left align-middle font-medium text-slate-500">Tipo</th>
                                    <th className="h-12 px-4 text-left align-middle font-medium text-slate-500">Detalle</th>
                                    <th className="h-12 px-4 text-right align-middle font-medium text-slate-500">Monto</th>
                                </tr>
                            </thead>
                            <tbody className="[&_tr:last-child]:border-0">
                                {transactions.map(tx => {
                                    const accountName = accounts.find(a => a.id === tx.accountId)?.name || 'Cuenta Desconocida';
                                    const envelopeName = envelopes.find(e => e.id === tx.envelopeId)?.name;
                                    const destAccountName = accounts.find(a => a.id === tx.destinationAccountId)?.name;

                                    return (
                                        <tr key={tx.id} className="border-b transition-colors hover:bg-slate-100/50">
                                            <td className="p-4 align-middle">
                                                {format(new Date(tx.date), 'dd MMM yyyy', { locale: es })}
                                            </td>
                                            <td className="p-4 align-middle">
                                                <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium
                          ${tx.type === 'INCOME' ? 'bg-green-100 text-green-800' :
                                                        tx.type === 'EXPENSE' ? 'bg-red-100 text-red-800' : 'bg-blue-100 text-blue-800'}`}>
                                                    {tx.type === 'DEBT_PAYMENT' ? 'PAGO DEUDA' :
                                                        tx.type === 'INCOME' ? 'INGRESO' :
                                                            tx.type === 'EXPENSE' ? 'GASTO' : 'TRANSFERENCIA'}
                                                </span>
                                            </td>
                                            <td className="p-4 align-middle">
                                                <div className="flex flex-col">
                                                    <span className="font-medium">{tx.notes || '-'}</span>
                                                    <span className="text-xs text-slate-500">
                                                        {tx.type === 'EXPENSE' ? `${accountName} -> ${envelopeName}` :
                                                            tx.type === 'TRANSFER' ? `${accountName} -> ${destAccountName}` :
                                                                tx.type === 'INCOME' ? `-> ${accountName}` :
                                                                    `${accountName} -> ${destAccountName}`}
                                                    </span>
                                                </div>
                                            </td>
                                            <td className={`p-4 align-middle text-right font-bold ${tx.type === 'INCOME' ? 'text-green-600' :
                                                tx.type === 'EXPENSE' ? 'text-red-600' : 'text-slate-900'
                                                }`}>
                                                {tx.type === 'EXPENSE' ? '-' : tx.type === 'INCOME' ? '+' : ''}
                                                {formatCurrency(tx.amount, tx.currency)}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
