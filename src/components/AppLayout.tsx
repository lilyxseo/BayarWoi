import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../auth/AuthProvider';

const navLinkClassName = ({ isActive }: { isActive: boolean }) =>
  isActive ? 'nav-link active' : 'nav-link';

export function AppLayout() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
      toast.success('Anda sudah keluar.');
      navigate('/login', { replace: true });
    } catch (error) {
      console.error(error);
      toast.error('Gagal logout. Coba lagi.');
    }
  };

  return (
    <div className="app-shell">
      <header className="app-topbar">
        <div className="topbar-left">
          <Link to="/dashboard" className="brand">
            BayarWoi
          </Link>
          <nav className="topbar-nav">
            <NavLink to="/dashboard" className={navLinkClassName}>
              Dashboard
            </NavLink>
            <NavLink to="/accounts" className={navLinkClassName}>
              Akun
            </NavLink>
            <NavLink to="/transactions" className={navLinkClassName}>
              Transaksi
            </NavLink>
            <NavLink to="/transfer" className={navLinkClassName}>
              Transfer
            </NavLink>
          </nav>
        </div>
        <div className="topbar-right">
          <div className="user-info">
            <span className="user-email">{user?.email}</span>
          </div>
          <button type="button" className="btn btn-ghost" onClick={handleLogout}>
            Keluar
          </button>
        </div>
      </header>
      <main className="main-content">
        <div className="page-container">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
