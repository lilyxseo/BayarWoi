import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../auth/AuthProvider';
import toast from 'react-hot-toast';

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
      <aside className="sidebar">
        <Link to="/dashboard" className="brand">
          BayarWoi
        </Link>
        <nav>
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
        <div className="sidebar-footer">
          <div className="user-info">
            <span className="user-email">{user?.email}</span>
          </div>
          <button type="button" className="btn btn-secondary" onClick={handleLogout}>
            Logout
          </button>
        </div>
      </aside>
      <main className="main-content">
        <Outlet />
      </main>
    </div>
  );
}