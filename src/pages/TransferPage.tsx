import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import toast from 'react-hot-toast';
import { createTransfer, listAccounts } from '../lib/db';
import type { Account } from '../lib/types';
import { Spinner } from '../components/Spinner';

const initialForm = {
  date: new Date().toISOString().split('T')[0],
  from_account_id: '',
  to_account_id: '',
  amount: 0,
  title: '',
  notes: '',
};

export function TransferPage() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [form, setForm] = useState(initialForm);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    listAccounts({ includeArchived: false })
      .then((result) => {
        setAccounts(result);
        setForm((prev) => ({
          ...prev,
          from_account_id: result[0]?.id ?? '',
          to_account_id: result[1]?.id ?? '',
        }));
      })
      .catch((error) => {
        console.error(error);
        toast.error('Tidak dapat memuat akun');
      })
      .finally(() => setLoading(false));
  }, []);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!form.from_account_id || !form.to_account_id) {
      toast.error('Pilih akun sumber dan tujuan');
      return;
    }
    if (form.from_account_id === form.to_account_id) {
      toast.error('Akun sumber dan tujuan tidak boleh sama');
      return;
    }
    if (form.amount <= 0) {
      toast.error('Nominal transfer harus lebih dari 0');
      return;
    }

    const sourceAccount = accounts.find((account) => account.id === form.from_account_id);
    if (sourceAccount && Number(sourceAccount.balance) < form.amount) {
      toast.error('Saldo akun sumber tidak mencukupi');
      return;
    }

    setSubmitting(true);
    try {
      await createTransfer({
        date: form.date,
        from_account_id: form.from_account_id,
        to_account_id: form.to_account_id,
        amount: form.amount,
        title: form.title || 'Transfer Saldo',
        notes: form.notes,
      });
      toast.success('Transfer berhasil');
      const refreshedAccounts = await listAccounts({ includeArchived: false });
      setAccounts(refreshedAccounts);
      setForm((prev) => ({
        ...initialForm,
        from_account_id: refreshedAccounts[0]?.id ?? prev.from_account_id,
        to_account_id: refreshedAccounts[1]?.id ?? prev.to_account_id,
      }));
    } catch (error) {
      console.error(error);
      toast.error(error instanceof Error ? error.message : 'Transfer gagal');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="page-padding">
        <Spinner label="Menyiapkan transfer..." />
      </div>
    );
  }

  return (
    <div className="page-padding">
      <div className="page-header">
        <h1>Transfer Saldo</h1>
      </div>

      <div className="form-card">
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
            Dari Akun
            <select
              className="form-input"
              value={form.from_account_id}
              onChange={(event) => setForm((prev) => ({ ...prev, from_account_id: event.target.value }))}
              required
            >
              <option value="" disabled>
                Pilih akun sumber
              </option>
              {accounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.name} (Saldo: {Number(account.balance).toLocaleString('id-ID')})
                </option>
              ))}
            </select>
          </label>
          <label className="form-label">
            Ke Akun
            <select
              className="form-input"
              value={form.to_account_id}
              onChange={(event) => setForm((prev) => ({ ...prev, to_account_id: event.target.value }))}
              required
            >
              <option value="" disabled>
                Pilih akun tujuan
              </option>
              {accounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.name} (Saldo: {Number(account.balance).toLocaleString('id-ID')})
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
              placeholder="Transfer Saldo"
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
            <button type="submit" className="btn btn-primary" disabled={submitting}>
              {submitting ? 'Memproses...' : 'Transfer Sekarang'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}