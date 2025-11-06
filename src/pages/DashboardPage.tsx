import { useEffect, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Spinner } from '../components/Spinner';
import { createTransfer } from '../lib/db';
import { useRealtimeAccounts } from '../hooks/useRealtimeAccounts';
import { useRealtimeTransactions } from '../hooks/useRealtimeTransactions';

function formatCurrency(amount: number, currency = 'IDR') {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
  }).format(amount ?? 0);
}

function getInitials(name: string) {
  const words = name.trim().split(/\s+/);
  if (words.length === 1) {
    return words[0].slice(0, 2).toUpperCase();
  }
  return (words[0][0] + words[1][0]).toUpperCase();
}

type TransferState = {
  fromAccountId: string;
  toAccountId: string;
  amount: string;
};

const paymentShortcuts = [
  { id: 'pln', label: 'PLN', description: 'Token Listrik', icon: '⚡' },
  { id: 'pulsa', label: 'Pulsa', description: 'Paket data', icon: '📱' },
  { id: 'bpjs', label: 'BPJS', description: 'Kesehatan', icon: '🏥' },
  { id: 'emoney', label: 'E-money', description: 'Isi saldo', icon: '💳' },
  { id: 'cicilan', label: 'Cicilan', description: 'Tagihan kredit', icon: '📄' },
  { id: 'pdam', label: 'PDAM', description: 'Tagihan air', icon: '🚰' },
];

const serviceShortcuts = [
  { id: 'transfer', label: 'Transfer gratis', icon: '⇄' },
  { id: 'request', label: 'Minta', icon: '🧾' },
  { id: 'split', label: 'Split bill', icon: '🍽️' },
  { id: 'gift', label: 'Hadiah', icon: '🎁' },
];

export function DashboardPage() {
  const navigate = useNavigate();
  const { accounts, loading: accountsLoading } = useRealtimeAccounts();
  const { transactions, loading: transactionsLoading } = useRealtimeTransactions(6);
  const [transferState, setTransferState] = useState<TransferState>({
    fromAccountId: '',
    toAccountId: '',
    amount: '',
  });
  const [transferring, setTransferring] = useState(false);

  const loading = accountsLoading || transactionsLoading;
  const initialLoading = loading && accounts.length === 0 && transactions.length === 0;

  useEffect(() => {
    if (accounts.length === 0) {
      setTransferState((prev) => ({ ...prev, fromAccountId: '', toAccountId: '' }));
      return;
    }

    setTransferState((prev) => {
      const currentFrom = accounts.find((account) => account.id === prev.fromAccountId);
      const fromAccountId = currentFrom?.id ?? accounts[0].id;
      const currentTo = accounts.find((account) => account.id === prev.toAccountId && account.id !== fromAccountId);
      const fallbackRecipient = accounts.find((account) => account.id !== fromAccountId);
      return {
        ...prev,
        fromAccountId,
        toAccountId: currentTo?.id ?? fallbackRecipient?.id ?? '',
      };
    });
  }, [accounts]);

  const sortedAccounts = useMemo(
    () => [...accounts].sort((a, b) => Number(b.balance ?? 0) - Number(a.balance ?? 0)),
    [accounts],
  );

  const primaryAccount = sortedAccounts[0];

  const totalBalance = useMemo(
    () => accounts.reduce((sum, account) => sum + Number(account.balance ?? 0), 0),
    [accounts],
  );

  const monthlyTotals = useMemo(() => {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    return transactions.reduce(
      (acc, transaction) => {
        const date = new Date(transaction.date);
        if (date.getMonth() !== currentMonth || date.getFullYear() !== currentYear) {
          return acc;
        }

        if (transaction.type === 'income') {
          acc.income += Number(transaction.amount);
        }
        if (transaction.type === 'expense') {
          acc.expense += Number(transaction.amount);
        }
        return acc;
      },
      { income: 0, expense: 0 },
    );
  }, [transactions]);

  const savingsTotal = useMemo(
    () =>
      accounts
        .filter((account) => /tabung|saving/i.test(account.name))
        .reduce((sum, account) => sum + Number(account.balance ?? 0), 0),
    [accounts],
  );

  const loanTotal = useMemo(
    () =>
      accounts
        .filter((account) => /pinjam|loan|utang/i.test(account.name))
        .reduce((sum, account) => sum + Number(account.balance ?? 0), 0),
    [accounts],
  );

  const coins = useMemo(() => Math.max(0, Math.round(totalBalance / 100_000)), [totalBalance]);
  const monthName = useMemo(
    () => new Intl.DateTimeFormat('id-ID', { month: 'long' }).format(new Date()),
    [],
  );

  const fromAccount = accounts.find((account) => account.id === transferState.fromAccountId) ?? null;
  const toAccount = accounts.find((account) => account.id === transferState.toAccountId) ?? null;

  const availableRecipients = useMemo(
    () => sortedAccounts.filter((account) => account.id !== transferState.fromAccountId),
    [sortedAccounts, transferState.fromAccountId],
  );

  const handleSelectRecipient = (accountId: string) => {
    setTransferState((prev) => ({ ...prev, toAccountId: accountId }));
  };

  const handleTransferSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!transferState.fromAccountId || !transferState.toAccountId) {
      toast.error('Pilih akun sumber dan tujuan');
      return;
    }

    if (transferState.fromAccountId === transferState.toAccountId) {
      toast.error('Akun sumber dan tujuan harus berbeda');
      return;
    }

    const amountNumber = Number(transferState.amount);
    if (!Number.isFinite(amountNumber) || amountNumber <= 0) {
      toast.error('Nominal transfer harus lebih dari 0');
      return;
    }

    if (fromAccount && Number(fromAccount.balance ?? 0) < amountNumber) {
      toast.error('Saldo akun sumber tidak mencukupi');
      return;
    }

    setTransferring(true);
    try {
      await createTransfer({
        date: new Date().toISOString().split('T')[0],
        from_account_id: transferState.fromAccountId,
        to_account_id: transferState.toAccountId,
        amount: amountNumber,
        title: `Transfer ke ${toAccount?.name ?? 'Akun'}`,
        notes: 'Transfer cepat dari dashboard',
      });
      toast.success('Transfer berhasil dikirim');
      setTransferState((prev) => ({ ...prev, amount: '' }));
    } catch (error) {
      console.error(error);
      toast.error(error instanceof Error ? error.message : 'Transfer gagal diproses');
    } finally {
      setTransferring(false);
    }
  };

  const handleServiceShortcut = (serviceId: string) => {
    if (serviceId === 'transfer') {
      navigate('/transfer');
      return;
    }
    if (serviceId === 'request') {
      toast('Gunakan catatan pada transfer untuk memberi tahu teman Anda.');
      return;
    }
    navigate('/transactions');
  };

  if (initialLoading) {
    return (
      <div className="page-padding">
        <Spinner label="Menyiapkan dashboard..." />
      </div>
    );
  }

  return (
    <div className="dashboard-page">
      <section className="dashboard-hero">
        <div className="wallet-card surface-card">
          <div className="wallet-card-header">
            <div>
              <span className="wallet-label">Saldo utama</span>
              <h1 className="wallet-amount">{formatCurrency(primaryAccount?.balance ?? totalBalance)}</h1>
            </div>
            <div className="wallet-coins" aria-label={`Koin ${coins}`}>
              <span>Coins</span>
              <strong>{coins}</strong>
            </div>
          </div>
          <div className="wallet-meta">
            <div className="wallet-meta-item">
              <span>Pinjam</span>
              <strong>{formatCurrency(loanTotal)}</strong>
            </div>
            <div className="wallet-meta-item">
              <span>Tabungan</span>
              <strong>{formatCurrency(savingsTotal)}</strong>
            </div>
          </div>
          <div className="wallet-actions">
            <button type="button" className="pill-action" onClick={() => navigate('/transactions')}>
              Top up
            </button>
            <button type="button" className="pill-action" onClick={() => navigate('/transactions')}>
              Tarik tunai
            </button>
            <button type="button" className="pill-action" onClick={() => navigate('/transfer')}>
              QR bayar
            </button>
          </div>
        </div>
        <aside className="wallet-summary surface-card">
          <div>
            <p className="summary-text">
              {formatCurrency(monthlyTotals.expense)} sudah terpakai di {monthName}.
            </p>
            <p className="summary-sub">Pantau pengeluaran dan raih promo spesial.</p>
          </div>
          <button type="button" className="btn btn-outline" onClick={() => navigate('/transactions')}>
            Promo
          </button>
        </aside>
      </section>

      <section className="surface-card">
        <header className="section-header">
          <div>
            <h2>Kirim &amp; terima</h2>
            <p className="section-sub">Transfer instan antar akun BayarWoi</p>
          </div>
          <Link to="/accounts" className="link-muted">
            Kelola akun
          </Link>
        </header>

        {availableRecipients.length > 0 ? (
          <div className="recipient-grid">
            {availableRecipients.map((account) => (
              <button
                type="button"
                key={account.id}
                className={`recipient-card ${transferState.toAccountId === account.id ? 'active' : ''}`}
                onClick={() => handleSelectRecipient(account.id)}
                aria-pressed={transferState.toAccountId === account.id}
              >
                <div className="recipient-icon">{getInitials(account.name)}</div>
                <div className="recipient-info">
                  <strong>{account.name}</strong>
                  <span>{formatCurrency(Number(account.balance ?? 0), account.currency)}</span>
                </div>
              </button>
            ))}
          </div>
        ) : (
          <p className="empty-state">Tambahkan akun lain untuk mulai transfer.</p>
        )}

        <form className="quick-transfer" onSubmit={handleTransferSubmit}>
          <div className="quick-transfer-fields">
            <label className="form-label">
              Dari akun
              <select
                className="form-input"
                value={transferState.fromAccountId}
                onChange={(event) =>
                  setTransferState((prev) => ({ ...prev, fromAccountId: event.target.value }))
                }
              >
                {accounts.map((account) => (
                  <option key={account.id} value={account.id}>
                    {account.name} — {formatCurrency(Number(account.balance ?? 0), account.currency)}
                  </option>
                ))}
              </select>
            </label>
            <label className="form-label">
              Ke akun
              <select
                className="form-input"
                value={transferState.toAccountId}
                disabled={accounts.length < 2}
                onChange={(event) =>
                  setTransferState((prev) => ({ ...prev, toAccountId: event.target.value }))
                }
              >
                <option value="" disabled>
                  Pilih tujuan transfer
                </option>
                {accounts
                  .filter((account) => account.id !== transferState.fromAccountId)
                  .map((account) => (
                    <option key={account.id} value={account.id}>
                      {account.name}
                    </option>
                  ))}
              </select>
            </label>
            <label className="form-label">
              Nominal
              <input
                type="number"
                min={0}
                step="1000"
                className="form-input"
                value={transferState.amount}
                onChange={(event) => setTransferState((prev) => ({ ...prev, amount: event.target.value }))}
                placeholder="0"
              />
            </label>
          </div>
          <div className="quick-transfer-footer">
            <div className="quick-transfer-balance">
              <span>Saldo tersedia</span>
              <strong>{formatCurrency(Number(fromAccount?.balance ?? 0), fromAccount?.currency ?? 'IDR')}</strong>
            </div>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={transferring || accounts.length < 2}
            >
              {transferring ? 'Memproses...' : 'Transfer sekarang'}
            </button>
          </div>
        </form>

        <div className="service-shortcuts">
          {serviceShortcuts.map((service) => (
            <button
              type="button"
              key={service.id}
              className="service-button"
              onClick={() => handleServiceShortcut(service.id)}
            >
              <span className="service-icon" aria-hidden="true">
                {service.icon}
              </span>
              <span className="service-label">{service.label}</span>
            </button>
          ))}
        </div>
      </section>

      <section className="surface-card">
        <header className="section-header">
          <h2>Pembayaran</h2>
          <Link to="/transactions" className="link-muted">
            Lihat semua
          </Link>
        </header>
        <div className="payment-grid">
          {paymentShortcuts.map((item) => (
            <button
              type="button"
              key={item.id}
              className="payment-tile"
              onClick={() => navigate('/transactions')}
            >
              <span className="payment-icon" aria-hidden="true">
                {item.icon}
              </span>
              <span className="payment-label">
                <strong>{item.label}</strong>
                <small>{item.description}</small>
              </span>
            </button>
          ))}
        </div>
      </section>

      <section className="surface-card">
        <header className="section-header">
          <h2>Aktivitas terbaru</h2>
          <Link to="/transactions" className="link-muted">
            Detail
          </Link>
        </header>
        {transactions.length === 0 ? (
          <p className="empty-state">Belum ada transaksi yang tercatat.</p>
        ) : (
          <ul className="activity-list">
            {transactions.map((transaction) => {
              const isExpense = transaction.type === 'expense';
              const amountPrefix =
                transaction.type === 'transfer' ? '' : isExpense ? '-' : '+';
              const formattedAmount = formatCurrency(Number(transaction.amount));
              const targetName = transaction.type === 'transfer' ? transaction.to_account?.name ?? 'Transfer' : transaction.account?.name ?? '-';
              return (
                <li key={transaction.id} className="activity-item">
                  <div className={`activity-icon ${transaction.type}`} aria-hidden="true">
                    {transaction.type === 'income' ? '⬇️' : transaction.type === 'expense' ? '⬆️' : '⇄'}
                  </div>
                  <div className="activity-meta">
                    <strong>{transaction.title}</strong>
                    <span>
                      {new Date(transaction.date).toLocaleDateString('id-ID', {
                        day: '2-digit',
                        month: 'short',
                      })}{' '}
                      · {targetName}
                    </span>
                  </div>
                  <span className={`activity-amount ${transaction.type}`}>
                    {transaction.type === 'transfer'
                      ? formattedAmount
                      : `${amountPrefix}${formattedAmount}`}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
