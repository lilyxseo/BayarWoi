import type {
  Account,
  CreateAccountPayload,
  CreateTransactionPayload,
  CreateTransferPayload,
  Transaction,
  UpdateAccountPayload,
  UpdateTransactionPayload,
} from './types';
import { supabase } from './supabaseClient';

type ServiceError = { message: string };

function mapError(error: unknown, fallback: string): ServiceError {
  if (error && typeof error === 'object' && 'message' in error) {
    return { message: String(error.message) };
  }
  return { message: fallback };
}

export async function listAccounts(options: { includeArchived?: boolean } = {}): Promise<Account[]> {
  const { includeArchived = false } = options;
  const query = supabase
    .from('accounts')
    .select('*')
    .order('name', { ascending: true });

  if (!includeArchived) {
    query.eq('is_archived', false);
  }

  const { data, error } = await query;
  if (error) {
    throw mapError(error, 'Gagal memuat akun');
  }
  return (data ?? []) as Account[];
}

export async function createAccount(payload: CreateAccountPayload): Promise<Account> {
  const { data, error } = await supabase
    .from('accounts')
    .insert({ name: payload.name, currency: payload.currency ?? 'IDR' })
    .select()
    .single();

  if (error) {
    throw mapError(error, 'Gagal membuat akun');
  }

  return data as Account;
}

export async function updateAccount(accountId: string, payload: UpdateAccountPayload): Promise<Account> {
  const { data, error } = await supabase
    .from('accounts')
    .update(payload)
    .eq('id', accountId)
    .select()
    .single();

  if (error) {
    throw mapError(error, 'Gagal memperbarui akun');
  }

  return data as Account;
}

export async function archiveAccount(accountId: string): Promise<Account> {
  return updateAccount(accountId, { is_archived: true });
}

export async function listTransactions(options: {
  type?: 'income' | 'expense' | 'transfer';
  accountId?: string;
  limit?: number;
} = {}): Promise<Transaction[]> {
  const { type, accountId, limit } = options;

  const query = supabase
    .from('transactions')
    .select(
      `*,
      account:accounts!transactions_account_id_fkey(id,name),
      to_account:accounts!transactions_to_account_id_fkey(id,name)`
    )
    .order('date', { ascending: false })
    .order('created_at', { ascending: false });

  if (type) {
    query.eq('type', type);
  }

  if (accountId) {
    query.or(`account_id.eq.${accountId},to_account_id.eq.${accountId}`);
  }

  if (limit) {
    query.limit(limit);
  }

  const { data, error } = await query;
  if (error) {
    throw mapError(error, 'Gagal memuat transaksi');
  }

  return (data ?? []) as Transaction[];
}

export async function createTransaction(payload: CreateTransactionPayload): Promise<Transaction> {
  const { data, error } = await supabase
    .from('transactions')
    .insert({
      date: payload.date,
      type: payload.type,
      amount: payload.amount,
      account_id: payload.account_id,
      title: payload.title,
      notes: payload.notes ?? null,
    })
    .select()
    .single();

  if (error) {
    throw mapError(error, 'Gagal menyimpan transaksi');
  }

  const delta = payload.type === 'income' ? payload.amount : -payload.amount;
  const { data: account, error: adjustError } = await supabase.rpc('apply_account_balance_change', {
    account_id: payload.account_id,
    amount_delta: delta,
  });

  if (adjustError) {
    // Rollback created transaction if adjustment fails
    await supabase.from('transactions').delete().eq('id', (data as Transaction).id);
    throw mapError(adjustError, 'Gagal memperbarui saldo akun');
  }

  return { ...(data as Transaction), account } as Transaction;
}

export async function updateTransaction(
  transactionId: string,
  payload: UpdateTransactionPayload,
): Promise<Transaction> {
  const { data: existing, error: existingError } = await supabase
    .from('transactions')
    .select('*')
    .eq('id', transactionId)
    .single();

  if (existingError || !existing) {
    throw mapError(existingError, 'Transaksi tidak ditemukan');
  }

  if (existing.type === 'transfer') {
    throw { message: 'Gunakan halaman transfer untuk mengubah transaksi ini.' };
  }

  const updatedFields = {
    date: payload.date ?? existing.date,
    type: payload.type ?? existing.type,
    amount: payload.amount ?? existing.amount,
    account_id: payload.account_id ?? existing.account_id,
    title: payload.title ?? existing.title,
    notes: payload.notes ?? existing.notes,
  };

  const { data, error } = await supabase
    .from('transactions')
    .update(updatedFields)
    .eq('id', transactionId)
    .select()
    .single();

  if (error) {
    throw mapError(error, 'Gagal memperbarui transaksi');
  }

  const oldDelta = existing.type === 'income' ? existing.amount : -existing.amount;
  const newDelta = updatedFields.type === 'income' ? updatedFields.amount : -updatedFields.amount;

  if (existing.account_id === updatedFields.account_id) {
    const difference = newDelta - oldDelta;
    if (difference !== 0) {
      const { error: adjustError } = await supabase.rpc('apply_account_balance_change', {
        account_id: updatedFields.account_id,
        amount_delta: difference,
      });
      if (adjustError) {
        throw mapError(adjustError, 'Gagal mengatur ulang saldo akun');
      }
    }
  } else {
    const { error: revertError } = await supabase.rpc('apply_account_balance_change', {
      account_id: existing.account_id,
      amount_delta: -oldDelta,
    });
    if (revertError) {
      throw mapError(revertError, 'Gagal mengembalikan saldo akun asal');
    }

    const { error: applyError } = await supabase.rpc('apply_account_balance_change', {
      account_id: updatedFields.account_id,
      amount_delta: newDelta,
    });
    if (applyError) {
      throw mapError(applyError, 'Gagal menerapkan saldo akun baru');
    }
  }

  return data as Transaction;
}

export async function deleteTransaction(transactionId: string): Promise<void> {
  const { data: existing, error: existingError } = await supabase
    .from('transactions')
    .select('*')
    .eq('id', transactionId)
    .single();

  if (existingError || !existing) {
    throw mapError(existingError, 'Transaksi tidak ditemukan');
  }

  const { error } = await supabase.from('transactions').delete().eq('id', transactionId);
  if (error) {
    throw mapError(error, 'Gagal menghapus transaksi');
  }

  if (existing.type !== 'transfer') {
    const delta = existing.type === 'income' ? -existing.amount : existing.amount;
    const { error: adjustError } = await supabase.rpc('apply_account_balance_change', {
      account_id: existing.account_id,
      amount_delta: delta,
    });
    if (adjustError) {
      throw mapError(adjustError, 'Gagal mengembalikan saldo akun');
    }
  } else {
    // Transfer deletion should be handled via dedicated flow in future
    throw { message: 'Penghapusan transfer belum didukung.' };
  }
}

export async function createTransfer(payload: CreateTransferPayload): Promise<Transaction> {
  const { data, error } = await supabase.rpc('apply_transfer', {
    from_account_id: payload.from_account_id,
    to_account_id: payload.to_account_id,
    amount: payload.amount,
    transfer_date: payload.date,
    transfer_title: payload.title,
    transfer_notes: payload.notes ?? null,
  });

  if (error) {
    throw mapError(error, 'Gagal memproses transfer');
  }

  return data as Transaction;
}