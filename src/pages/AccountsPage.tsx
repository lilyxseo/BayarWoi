import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import toast from 'react-hot-toast';
import { archiveAccount, createAccount, listAccounts, updateAccount } from '../lib/db';
import type { Account, CurrencyCode } from '../lib/types';
import { Spinner } from '../components/Spinner';

const currencies = ['IDR', 'USD', 'EUR', 'SGD'] as const;

type FormState = {
  id?: string;
  name: string;
  currency: CurrencyCode;
};

const initialState: FormState = {
  name: '',
  currency: 'IDR',
};

export function AccountsPage() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<FormState>(initialState);
  const [submitting, setSubmitting] = useState(false);

  const isEditing = Boolean(form.id);

  const loadAccounts = () => {
    setLoading(true);
    listAccounts({ includeArchived: true })
      .then(setAccounts)
      .catch((error) => {
        console.error(error);
        toast.error('Tidak dapat memuat akun');
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadAccounts();
  }, []);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!form.name.trim()) {
      toast.error('Nama akun wajib diisi');
      return;
    }

    const nameExists = accounts.some((account) => account.name.toLowerCase() === form.name.toLowerCase() && account.id !== form.id);
    if (nameExists) {
      toast.error('Nama akun harus unik');
      return;
    }

    setSubmitting(true);

    try {
      if (isEditing && form.id) {
        await updateAccount(form.id, {
          name: form.name,
          currency: form.currency,
        });
        toast.success('Akun diperbarui');
      } else {
        await createAccount({ name: form.name, currency: form.currency });
        toast.success('Akun dibuat');
      }
      loadAccounts();
      setForm(initialState);
    } catch (error) {
      console.error(error);
      const message = error instanceof Error ? error.message : 'Gagal menyimpan akun';
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = (account: Account) => {
    setForm({ id: account.id, name: account.name, currency: account.currency });
  };

  const handleArchive = async (account: Account) => {
    try {
      await archiveAccount(account.id);
      loadAccounts();
      toast.success('Akun diarsipkan');
    } catch (error) {
      console.error(error);
      toast.error('Tidak dapat mengarsipkan akun');
    }
  };

  return (
    <div className="page-padding">
      <div className="page-header">
        <h1>Kelola Akun</h1>
      </div>

      <div className="form-card">
        <h2 className="section-title">{isEditing ? 'Edit Akun' : 'Tambah Akun'}</h2>
        <form className="form-grid" onSubmit={handleSubmit}>
          <label className="form-label">
            Nama Akun
            <input
              type="text"
              className="form-input"
              value={form.name}
              onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
              required
              placeholder="Contoh: Dompet"
            />
          </label>
          <label className="form-label">
            Mata Uang
            <select
              className="form-input"
              value={form.currency}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, currency: event.target.value as CurrencyCode }))
              }
            >
              {currencies.map((currency) => (
                <option key={currency} value={currency}>
                  {currency}
                </option>
              ))}
            </select>
          </label>
          <div className="form-actions">
            {isEditing ? (
              <button type="button" className="btn btn-light" onClick={() => setForm(initialState)} disabled={submitting}>
                Batal
              </button>
            ) : null}
            <button type="submit" className="btn btn-primary" disabled={submitting}>
              {submitting ? 'Menyimpan...' : isEditing ? 'Simpan Perubahan' : 'Tambah Akun'}
            </button>
          </div>
        </form>
      </div>

      <section className="section">
        <h2 className="section-title">Daftar Akun</h2>
        {loading ? (
          <Spinner label="Memuat akun..." />
        ) : accounts.length === 0 ? (
          <p className="empty-state">Belum ada akun.</p>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Nama</th>
                <th>Saldo</th>
                <th>Mata Uang</th>
                <th>Status</th>
                <th>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {accounts.map((account) => (
                <tr key={account.id}>
                  <td>{account.name}</td>
                  <td>{Number(account.balance).toLocaleString('id-ID')}</td>
                  <td>{account.currency}</td>
                  <td>{account.is_archived ? 'Diarsipkan' : 'Aktif'}</td>
                  <td className="table-actions">
                    <button type="button" className="btn btn-link" onClick={() => handleEdit(account)}>
                      Edit
                    </button>
                    {!account.is_archived ? (
                      <button type="button" className="btn btn-link" onClick={() => handleArchive(account)}>
                        Arsipkan
                      </button>
                    ) : null}
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