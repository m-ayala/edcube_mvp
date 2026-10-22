// frontend/src/components/admin/AdminPage.jsx
// Admin page for the person running EdCube: accounts and plans, the paid/enterprise waitlist,
// and AI cost reporting. Only reachable with the admin claim (isAdmin); everyone else is
// redirected. Every write goes through /api/admin/*, which re-checks the claim.
import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import AccountsTab from './AccountsTab';
import WaitlistTab from './WaitlistTab';
import CostsTab from './CostsTab';

const TABS = [
  { id: 'accounts', label: 'Accounts' },
  { id: 'waitlist', label: 'Waitlist' },
  { id: 'costs', label: 'Costs' },
];

const AdminPage = () => {
  const { isAdmin } = useAuth();
  const [tab, setTab] = useState('accounts');
  if (!isAdmin) return <Navigate to="/my-courses" replace />;
  return (
    <div style={{ padding: '32px 40px', fontFamily: "'DM Sans', sans-serif", color: '#1C1917', maxWidth: 1200 }}>
      <h1 style={{ fontFamily: "'Fraunces', serif", fontSize: 28, margin: '0 0 4px', color: '#2C5F3A' }}>Admin</h1>
      <p style={{ margin: '0 0 20px', color: '#78716C', fontSize: 14 }}>Plans, credits, the waitlist and AI costs. Changes here are logged.</p>
      <div role="tablist" style={{ display: 'flex', gap: 6, borderBottom: '1px solid #E7E5E4', marginBottom: 20 }}>
        {TABS.map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => setTab(t.id)}
            style={{
              padding: '10px 18px', border: 'none', background: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 14,
              fontWeight: tab === t.id ? 700 : 500, color: tab === t.id ? '#2C5F3A' : '#78716C',
              borderBottom: tab === t.id ? '2px solid #E8761A' : '2px solid transparent', marginBottom: -1,
            }}
          >
            {t.label}
          </button>
        ))}
      </div>
      {tab === 'accounts' && <AccountsTab />}
      {tab === 'waitlist' && <WaitlistTab />}
      {tab === 'costs' && <CostsTab />}
    </div>
  );
};

export default AdminPage;
