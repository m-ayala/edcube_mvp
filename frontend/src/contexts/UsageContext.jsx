// frontend/src/contexts/UsageContext.jsx
// Plan usage for public-space users: fetches GET /api/account/usage, keeps it fresh
// after AI actions, and owns the "limit reached" + "Upgrade to Pro" modals.
// Org users never fetch usage and never see any of this UI.
import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useAuth } from './AuthContext';
import { authFetch, QUOTA_EVENT, USAGE_CHANGED_EVENT, isQuotaDetail } from '../services/authFetch';
import { UsageContext } from './usageContextCore';
import QuotaExceededModal from '../components/modals/QuotaExceededModal';
import UpgradeToProModal from '../components/modals/UpgradeToProModal';

export const UsageProvider = ({ children }) => {
  const { currentUser, isPublicUser } = useAuth();
  // Keyed by uid so one user's numbers are never shown to the next sign-in.
  const [stored, setStored] = useState(null);
  const [quotaDetail, setQuotaDetail] = useState(null);
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  // Kinds the server has just refused (402), until the next usage refresh.
  const [blockedKinds, setBlockedKinds] = useState([]);
  const timers = useRef([]);
  const active = !!currentUser && isPublicUser;
  const uid = currentUser?.uid;
  const data = active && stored?.uid === uid ? stored.data : null;

  const refreshUsage = useCallback(async () => {
    if (!active) return;
    try {
      const res = await authFetch(`${import.meta.env.VITE_API_BASE_URL}/api/account/usage`);
      if (!res.ok) return;
      setStored({ uid, data: await res.json() });
      setBlockedKinds([]);
    } catch {
      /* usage display is best-effort */
    }
  }, [active, uid]);

  const showQuotaModal = useCallback((detail) => {
    setQuotaDetail(detail || {});
    if (detail?.kind) setBlockedKinds((prev) => (prev.includes(detail.kind) ? prev : [...prev, detail.kind]));
  }, []);

  // Initial load / reset on sign-in and sign-out.
  useEffect(() => {
    const t = setTimeout(refreshUsage, 0);
    return () => clearTimeout(t);
  }, [refreshUsage]);

  // Central 402 and "an AI call succeeded" events, dispatched by authFetch.
  useEffect(() => {
    const onQuota = (e) => { if (isQuotaDetail(e.detail)) showQuotaModal(e.detail); };
    const onChanged = () => {
      if (!active) return;
      // Debounced; a second pass catches streaming routes that finish later.
      timers.current.forEach(clearTimeout);
      timers.current = [setTimeout(refreshUsage, 1500), setTimeout(refreshUsage, 10000)];
    };
    window.addEventListener(QUOTA_EVENT, onQuota);
    window.addEventListener(USAGE_CHANGED_EVENT, onChanged);
    return () => {
      window.removeEventListener(QUOTA_EVENT, onQuota);
      window.removeEventListener(USAGE_CHANGED_EVENT, onChanged);
      timers.current.forEach(clearTimeout);
    };
  }, [active, refreshUsage, showQuotaModal]);

  const value = useMemo(() => {
    const limits = data?.limits || null;
    const usage = data?.usage || null;
    const exhausted = (kind) => {
      if (blockedKinds.includes(kind)) return true;
      const limit = limits?.[kind];
      return limit != null && (usage?.[kind] ?? 0) >= limit;
    };
    return {
      usage,
      limits,
      plan: data?.plan ?? null,
      resetsAt: data?.resets_at ?? null,
      loaded: !!data,
      isExhausted: exhausted,
      refreshUsage,
      showQuotaModal,
      openUpgrade: () => setUpgradeOpen(true),
    };
  }, [data, blockedKinds, refreshUsage, showQuotaModal]);

  return (
    <UsageContext.Provider value={value}>
      {children}
      {quotaDetail && (
        <QuotaExceededModal
          detail={quotaDetail}
          onClose={() => setQuotaDetail(null)}
          onUpgrade={() => { setQuotaDetail(null); setUpgradeOpen(true); }}
        />
      )}
      {upgradeOpen && <UpgradeToProModal onClose={() => setUpgradeOpen(false)} />}
    </UsageContext.Provider>
  );
};
