import { useEffect, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import toast from 'react-hot-toast';
import {
  createTransaction,
  deleteTransaction,
  listAccounts,
  listTransactions,
  updateTransaction,
} from '../lib/db';
import type { Account, Transaction } from '../lib/types';
import { Spinner } from '../components/Spinner';

const transactionTypes = [
  { value: 'income', label: 'Income' },
  { value: 'expense', label: 'Pengeluaran' },
] as const;

type FormState = {
  id?: string;
  date: string;
  type: 'income' | 'expense';
  account_id: string;
  amount: number;
  title: string;
  notes: string;
};

const newTransactionState = (accounts: Account[]): FormState => ({
  date: new Date().toISOString().split('T')[0],
  type: 'income',
  account_id: accounts[0]?.id ?? '',
  amount: 0,
  title: '',
  notes: '',
});

export function TransactionsPage() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [filters, setFilters] = useState<{ type: string; account: string }>({ type: 'all', account: 'all' });
  const [form, setForm] = useState<FormState>(newTransactionState([]));
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const isEditing = Boolean(form.id);

  const loadData = async () => {
    setLoading(true);
    try {
      const [accountsResult, transactionsResult] = await Promise.all([
        listAccounts({ includeArchived: false }),
        listTransactions(),
      ]);
      setAccounts(accountsResult);
      setTransactions(transactionsResult);
      setForm((prev) => ({ ...newTransactionState(accountsResult), id: prev.id ? prev.id : undefined }));
    } catch (error) {
      console.error(error);
      toast.error('Gagal memuat transaksi');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const filteredTransactions = useMemo(() => {
    return transactions.filter((transaction) => {
      if (filters.type !== 'all' && transaction.type !== filters.type) {
        return false;
      }
      if (
        filters.account !== 'all' &&
        transaction.account_id !== filters.account &&
        transaction.to_account_id !== filters.account
      ) {
        return false;
      }
      return transaction.type !== 'transfer';
    });
  }, [transactions, filters]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!form.account_id) {
      toast.error('Pilih akun terlebih dahulu');
      return;
    }
    if (!form.title.trim()) {
      toast.error('Judul wajib diisi');
      return;
    }
    if (form.amount <= 0) {
      toast.error('Nominal harus lebih dari 0');
      return;
    }

    setSubmitting(true);
    try {
      if (isEditing && form.id) {
        await updateTransaction(form.id, {
          date: form.date,
          type: form.type,
          amount: form.amount,
          account_id: form.account_id,
          title: form.title,
          notes: form.notes,
        });
        toast.success('Transaksi diperbarui');
      } else {
        await createTransaction({
          date: form.date,
          type: form.type,
          amount: form.amount,
          account_id: form.account_id,
          title: form.title,
          notes: form.notes,
        });
        toast.success('Transaksi tercatat');
      }
      const refreshed = await listTransactions();
      setTransactions(refreshed);
      setForm(newTransactionState(accounts));
    } catch (error) {
      console.error(error);
      toast.error(error instanceof Error ? error.message : 'Gagal menyimpan transaksi');
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = (transaction: Transaction) => {
    if (transaction.type === 'transfer') {
      toast.error('Gunakan halaman transfer untuk transaksi ini');
      return;
    }
    setForm({
      id: transaction.id,
      date: transaction.date.split('T')[0],
      type: transaction.type as 'income' | 'expense',
      account_id: transaction.account_id,
      amount: Number(transaction.amount),
      title: transaction.title,
      notes: transaction.notes ?? '',
    });
  };

  const handleDelete = async (transaction: Transaction) => {
    if (!window.confirm('Hapus transaksi ini?')) return;
    try {
      await deleteTransaction(transaction.id);
      setTransactions((prev) => prev.filter((item) => item.id !== transaction.id));
      toast.success('Transaksi dihapus');
    } catch (error) {
      console.error(error);
      toast.error(error instanceof Error ? error.message : 'Gagal menghapus transaksi');
    }
  };

  return (
    <div className="page-padding">
      <div className="page-header">
        <h1>Transaksi</h1>
      </div>

      <div className="form-card">
        <h2 className="section-title">{isEditing ? 'Edit Transaksi' : 'Tambah Transaksi'}</h2>
        <form className="form-grid" onSubmit={handleSubmit}>
          <label className="form-label">
            Tanggal
            <input
              type="date"
              className="form-input"
              value={form.date}
              onChange={(event) => setForm((prev) => ({ ...prev, date: event.target.value }))}
              required
            />
          </label>
          <label className="form-label">
            Tipe
            <select
              className="form-input"
              value={form.type}
              onChange={(event) => setForm((prev) => ({ ...prev, type: event.target.value as 'income' | 'expense' }))}
            >
              {transactionTypes.map((type) => (
                <option key={type.value} value={type.value}>
                  {type.label}
                </option>
              ))}
            </select>
          </label>
          <label className="form-label">
            Akun
            <select
              className="form-input"
              value={form.account_id}
              onChange={(event) => setForm((prev) => ({ ...prev, account_id: event.target.value }))}
              required
            >
              <option value="" disabled>
                Pilih akun
              </option>
              {accounts.map((account) => (
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
              step="0.01"
              className="form-input"
              value={form.amount}
              onChange={(event) => setForm((prev) => ({ ...prev, amount: Number(event.target.value) }))}
              required
            />
          </label>
          <label className="form-label">
            Judul
            <input
              type="text"
              className="form-input"
              value={form.title}
              onChange={(event) => setForm((prev) => ({ ...prev, title: event.target.value }))}
              required
            />
          </label>
          <label className="form-label">
            Catatan
            <textarea
              className="form-input"
              value={form.notes}
              onChange={(event) => setForm((prev) => ({ ...prev, notes: event.target.value }))}
              rows={3}
            />
          </label>
          <div className="form-actions">
            {isEditing ? (
              <button type="button" className="btn btn-light" onClick={() => setForm(newTransactionState(accounts))}>
                Batal
              </button>
            ) : null}
            <button type="submit" className="btn btn-primary" disabled={submitting}>
              {submitting ? 'Menyimpan...' : isEditing ? 'Simpan Perubahan' : 'Tambah Transaksi'}
            </button>
          </div>
        </form>
      </div>

      <section className="section">
        <div className="filters">
          <label>
            Tipe
            <select
              value={filters.type}
              onChange={(event) => setFilters((prev) => ({ ...prev, type: event.target.value }))}
            >
              <option value="all">Semua</option>
              {transactionTypes.map((type) => (
                <option key={type.value} value={type.value}>
                  {type.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            Akun
            <select
              value={filters.account}
              onChange={(event) => setFilters((prev) => ({ ...prev, account: event.target.value }))}
            >
              <option value="all">Semua</option>
              {accounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.name}
                </option>
              ))}
            </select>
          </label>
        </div>

        {loading ? (
          <Spinner label="Memuat transaksi..." />
        ) : filteredTransactions.length === 0 ? (
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
                <th>Catatan</th>
                <th>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {filteredTransactions.map((transaction) => (
                <tr key={transaction.id}>
                  <td>{new Date(transaction.date).toLocaleDateString('id-ID')}</td>
                  <td>{transaction.account?.name ?? '-'}</td>
                  <td className={`tag ${transaction.type}`}>{transaction.type}</td>
                  <td>{transaction.title}</td>
                  <td>{Number(transaction.amount).toLocaleString('id-ID')}</td>
                  <td>{transaction.notes ?? '-'}</td>
                  <td className="table-actions">
                    <button type="button" className="btn btn-link" onClick={() => handleEdit(transaction)}>
                      Edit
                    </button>
                    <button type="button" className="btn btn-link" onClick={() => handleDelete(transaction)}>
                      Hapus
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}