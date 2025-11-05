import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { listAccounts, listTransactions } from '../lib/db';
import type { Account, Transaction } from '../lib/types';
import { Spinner } from '../components/Spinner';

function formatCurrency(amount: number, currency = 'IDR') {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
  }).format(amount);
}

export function DashboardPage() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setLoading(true);
    Promise.all([
      listAccounts({ includeArchived: false }),
      listTransactions({ limit: 5 }),
    ])
      .then(([accountsResponse, transactionsResponse]) => {
        if (!active) return;
        setAccounts(accountsResponse);
        setTransactions(transactionsResponse);
      })
      .catch((error) => {
        console.error(error);
        toast.error('Gagal memuat dashboard.');
      })
      .finally(() => {
        if (active) {
          setLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, []);

  const totalBalance = useMemo(
    () => accounts.reduce((sum, account) => sum + Number(account.balance ?? 0), 0),
    [accounts],
  );

  const totalsThisMonth = useMemo(() => {
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

  if (loading) {
    return (
      <div className="page-padding">
        <Spinner label="Memuat dashboard..." />
      </div>
    );
  }

  return (
    <div className="page-padding dashboard">
      <div className="cards-grid">
        <div className="card">
          <p className="card-title">Total Saldo</p>
          <p className="card-value">{formatCurrency(totalBalance)}</p>
        </div>
        <div className="card">
          <p className="card-title">Income Bulan Ini</p>
          <p className="card-value success">{formatCurrency(totalsThisMonth.income)}</p>
        </div>
        <div className="card">
          <p className="card-title">Pengeluaran Bulan Ini</p>
          <p className="card-value danger">{formatCurrency(totalsThisMonth.expense)}</p>
        </div>
      </div>

      <div className="actions-row">
        <Link to="/transactions" className="btn btn-primary">
          Tambah Transaksi
        </Link>
        <Link to="/transfer" className="btn btn-secondary">
          Transfer Saldo
        </Link>
      </div>

      <section className="section">
        <h2 className="section-title">Transaksi Terbaru</h2>
        {transactions.length === 0 ? (
          <p className="empty-state">Belum ada transaksi.</p>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Tanggal</th>
                <th>Akun</th>
                <th>Tipe</th>
                <th>Judul</th>
                <th>Nominal</th>
              </tr>
            </thead>
            <tbody>
              {transactions.map((transaction) => (
                <tr key={transaction.id}>
                  <td>{new Date(transaction.date).toLocaleDateString('id-ID')}</td>
                  <td>{transaction.account?.name ?? '-'}</td>
                  <td className={`tag ${transaction.type}`}>{transaction.type}</td>
                  <td>{transaction.title}</td>
                  <td>{formatCurrency(Number(transaction.amount))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}