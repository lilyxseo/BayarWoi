export type CurrencyCode = 'IDR' | 'USD' | 'EUR' | 'SGD';

export type Account = {
  id: string;
  user_id: string;
  name: string;
  balance: number;
  currency: CurrencyCode;
  is_archived: boolean;
  created_at: string;
  updated_at: string;
};

export type TransactionType = 'income' | 'expense' | 'transfer';

export type Transaction = {
  id: string;
  user_id: string;
  date: string;
  type: TransactionType;
  amount: number;
  account_id: string;
  to_account_id: string | null;
  title: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
  account?: Pick<Account, 'id' | 'name'>;
  to_account?: Pick<Account, 'id' | 'name'>;
};

export type CreateAccountPayload = {
  name: string;
  currency?: CurrencyCode;
};

export type UpdateAccountPayload = Partial<CreateAccountPayload> & {
  balance?: number;
  is_archived?: boolean;
};

export type CreateTransactionPayload = {
  date: string;
  type: 'income' | 'expense';
  amount: number;
  account_id: string;
  title: string;
  notes?: string;
};

export type UpdateTransactionPayload = Partial<CreateTransactionPayload>;

export type CreateTransferPayload = {
  date: string;
  from_account_id: string;
  to_account_id: string;
  amount: number;
  title: string;
  notes?: string;
};