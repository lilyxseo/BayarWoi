import { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { useAuth } from '../auth/AuthProvider';
import { listTransactions } from '../lib/db';
import type { Transaction } from '../lib/types';
import { supabase } from '../lib/supabaseClient';

export function useRealtimeTransactions(limit = 5) {
  const { user } = useAuth();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);

  const loadTransactions = useCallback(async () => {
    try {
      const result = await listTransactions({ limit });
      setTransactions(result);
    } catch (error) {
      console.error(error);
      toast.error('Gagal memuat transaksi');
    }
  }, [limit]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    loadTransactions()
      .catch(() => {
        /* error ditangani di loadTransactions */
      })
      .finally(() => {
        if (active) {
          setLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [loadTransactions]);

  useEffect(() => {
    if (!user?.id) {
      return;
    }

    const channel = supabase
      .channel(`transactions-stream-${user.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'transactions',
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          loadTransactions().catch(() => {
            /* error ditangani di loadTransactions */
          });
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, loadTransactions]);

  return { transactions, loading, refresh: loadTransactions };
}
