import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import toast from 'react-hot-toast';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../auth/AuthProvider';
import { Spinner } from '../components/Spinner';

type LocationState = {
  from?: { pathname: string };
};

export function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { session, loading } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!loading && session) {
      const target = (location.state as LocationState | null)?.from?.pathname ?? '/dashboard';
      navigate(target, { replace: true });
    }
  }, [loading, session, navigate, location.state]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        throw error;
      }
      toast.success('Login berhasil.');
      navigate('/dashboard', { replace: true });
    } catch (error) {
      console.error(error);
      const message =
        error instanceof Error ? error.message : 'Tidak bisa login. Periksa email dan password Anda.';
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleGoogleLogin = async () => {
    setSubmitting(true);
    try {
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: window.location.origin + '/dashboard',
        },
      });
      if (error) {
        throw error;
      }
      if (data.url) {
        window.location.href = data.url;
      }
    } catch (error) {
      console.error(error);
      toast.error('Gagal memulai login Google.');
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="page-center">
        <Spinner label="Memuat sesi..." />
      </div>
    );
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <h1 className="auth-title">Masuk ke BayarWoi</h1>
        <form className="auth-form" onSubmit={handleSubmit}>
          <label className="form-label">
            Email
            <input
              type="email"
              className="form-input"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
              autoComplete="email"
            />
          </label>
          <label className="form-label">
            Password
            <input
              type="password"
              className="form-input"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
              autoComplete="current-password"
            />
          </label>
          <button type="submit" className="btn btn-primary" disabled={submitting}>
            {submitting ? 'Memproses...' : 'Masuk'}
          </button>
        </form>
        <div className="separator">atau</div>
        <button type="button" className="btn btn-outline" disabled={submitting} onClick={handleGoogleLogin}>
          Masuk dengan Google
        </button>
      </div>
    </div>
  );
}