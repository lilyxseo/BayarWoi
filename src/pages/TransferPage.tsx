import { useEffect, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import toast from 'react-hot-toast';
import { createTransfer } from '../lib/db';
import { Spinner } from '../components/Spinner';
import { useRealtimeAccounts } from '../hooks/useRealtimeAccounts';

const initialState = {
  date: new Date().toISOString().split('T')[0],
  from_account_id: '',
  to_account_id: '',
  amount: '',
  title: 'Transfer Saldo',
  notes: '',
};

type TransferFormState = typeof initialState;

function formatCurrency(amount: number, currency = 'IDR') {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
  }).format(amount ?? 0);
}

export function TransferPage() {
  const { accounts, loading } = useRealtimeAccounts();
  const [form, setForm] = useState<TransferFormState>(initialState);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (accounts.length === 0) {
      setForm((prev) => ({ ...prev, from_account_id: '', to_account_id: '' }));
      return;
    }

    setForm((prev) => {
      const currentFrom = accounts.find((account) => account.id === prev.from_account_id);
      const fromAccountId = currentFrom?.id ?? accounts[0].id;
      const currentTo = accounts.find((account) => account.id === prev.to_account_id && account.id !== fromAccountId);
      const fallback = accounts.find((account) => account.id !== fromAccountId);
      return {
        ...prev,
        from_account_id: fromAccountId,
        to_account_id: currentTo?.id ?? fallback?.id ?? '',
      };
    });
  }, [accounts]);

  const availableDestinations = useMemo(
    () => accounts.filter((account) => account.id !== form.from_account_id),
    [accounts, form.from_account_id],
  );

  const fromAccount = accounts.find((account) => account.id === form.from_account_id) ?? null;
  const toAccount = accounts.find((account) => account.id === form.to_account_id) ?? null;

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

    const amountValue = Number(form.amount);
    if (!Number.isFinite(amountValue) || amountValue <= 0) {
      toast.error('Nominal transfer harus lebih dari 0');
      return;
    }

    if (fromAccount && Number(fromAccount.balance ?? 0) < amountValue) {
      toast.error('Saldo akun sumber tidak mencukupi');
      return;
    }

    setSubmitting(true);
    try {
      await createTransfer({
        date: form.date,
        from_account_id: form.from_account_id,
        to_account_id: form.to_account_id,
        amount: amountValue,
        title: form.title || `Transfer ke ${toAccount?.name ?? 'Akun'}`,
        notes: form.notes,
      });
      toast.success('Transfer berhasil');
      setForm((prev) => ({
        ...initialState,
        from_account_id: prev.from_account_id,
        to_account_id: prev.to_account_id,
      }));
    } catch (error) {
      console.error(error);
      toast.error(error instanceof Error ? error.message : 'Transfer gagal');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading && accounts.length === 0) {
    return (
      <div className="page-padding">
        <Spinner label="Menyiapkan transfer..." />
      </div>
    );
  }

  return (
    <div className="page-padding transfer-page">
      <div className="page-header">
        <div>
          <h1>Transfer Saldo</h1>
          <p className="section-sub">Kirim saldo antar akun BayarWoi secara realtime</p>
        </div>
      </div>

      <div className="transfer-layout">
        <div className="surface-card transfer-card">
          <form className="transfer-form" onSubmit={handleSubmit}>
            <div className="form-grid">
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
                Dari akun
                <select
                  className="form-input"
                  value={form.from_account_id}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, from_account_id: event.target.value }))
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
                  value={form.to_account_id}
                  disabled={accounts.length < 2}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, to_account_id: event.target.value }))
                  }
                >
                  <option value="" disabled>
                    Pilih tujuan transfer
                  </option>
                  {availableDestinations.map((account) => (
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
                  value={form.amount}
                  onChange={(event) => setForm((prev) => ({ ...prev, amount: event.target.value }))}
                  placeholder="0"
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
                  placeholder="Berikan pesan untuk penerima"
                />
              </label>
            </div>
            <div className="form-actions">
              <div className="transfer-balance">
                <span>Saldo tersedia</span>
                <strong>
                  {formatCurrency(Number(fromAccount?.balance ?? 0), fromAccount?.currency ?? 'IDR')}
                </strong>
              </div>
              <button
                type="submit"
                className="btn btn-primary"
                disabled={submitting || accounts.length < 2}
              >
                {submitting ? 'Memproses...' : 'Transfer sekarang'}
              </button>
            </div>
          </form>
        </div>

        <aside className="surface-card transfer-sidebar">
          <h2 className="sidebar-title">Ringkasan realtime</h2>
          <ul className="sidebar-list">
            <li>
              <span>Akun sumber</span>
              <strong>{fromAccount?.name ?? 'Belum dipilih'}</strong>
            </li>
            <li>
              <span>Akun tujuan</span>
              <strong>{toAccount?.name ?? 'Belum dipilih'}</strong>
            </li>
            <li>
              <span>Nominal</span>
              <strong>{form.amount ? formatCurrency(Number(form.amount)) : '-'}</strong>
            </li>
          </ul>
          <div className="sidebar-tips">
            <h3>Tips</h3>
            <p>Saldo akan berkurang dan bertambah secara otomatis di kedua akun ketika transfer berhasil.</p>
            <p>Undang teman Anda ke BayarWoi dan nikmati transfer bebas biaya.</p>
          </div>
        </aside>
      </div>
    </div>
  );
}
