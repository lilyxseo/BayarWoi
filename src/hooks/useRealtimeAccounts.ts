import { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { useAuth } from '../auth/AuthProvider';
import { listAccounts } from '../lib/db';
import type { Account } from '../lib/types';
import { supabase } from '../lib/supabaseClient';

export function useRealtimeAccounts() {
  const { user } = useAuth();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);

  const loadAccounts = useCallback(async () => {
    try {
      const result = await listAccounts({ includeArchived: false });
      setAccounts(result);
    } catch (error) {
      console.error(error);
      toast.error('Gagal memuat akun');
    }
  }, []);

  useEffect(() => {
    let active = true;
    setLoading(true);
    loadAccounts()
      .catch(() => {
        /* error ditangani di loadAccounts */
      })
      .finally(() => {
        if (active) {
          setLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [loadAccounts]);

  useEffect(() => {
    if (!user?.id) {
      return;
    }

    const channel = supabase
      .channel(`accounts-stream-${user.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'accounts',
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          loadAccounts().catch(() => {
            /* error ditangani di loadAccounts */
          });
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, loadAccounts]);

  return { accounts, loading, refresh: loadAccounts };
}
