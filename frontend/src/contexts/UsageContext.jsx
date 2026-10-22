// frontend/src/contexts/UsageContext.jsx
// Credit counters for the workspace the teacher is acting in: fetches GET /api/account/usage
// (personal plan, or the organization's pool), keeps it fresh after AI actions and when the
// workspace is switched, and owns the "limit reached" and "Join the waitlist" modals.
// It also answers one question for every AI button: gate(kind) -> is this feature paused, and why.
// Manual editing, saving and viewing are never gated.
import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useAuth } from './AuthContext';
import { authFetch, QUOTA_EVENT, USAGE_CHANGED_EVENT, isQuotaDetail } from '../services/authFetch';
import { UsageContext } from './usageContextCore';
import { trialEnded as isTrialEnded, pausedMessage, TRIAL_ENDED_MESSAGE } from '../utils/usageFormat';
import QuotaExceededModal from '../components/modals/QuotaExceededModal';
import JoinWaitlistModal from '../components/modals/JoinWaitlistModal';

const OPEN = { blocked: false, reason: null, message: '' };

export const UsageProvider = ({ children }) => {
  const { currentUser, activeWorkspace } = useAuth();
  // Keyed by uid + workspace so one user's (or one workspace's) numbers are never shown for another.
  const [stored, setStored] = useState(null);
  const [quotaDetail, setQuotaDetail] = useState(null);
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  // Kinds the server has just refused (402 quota_exceeded), until the next usage refresh.
  const [blockedKinds, setBlockedKinds] = useState([]);
  // Set by a 402 plan_inactive (trial ended), until the next usage refresh.
  const [planInactive, setPlanInactive] = useState(false);
  const timers = useRef([]);
  const active = !!currentUser && !!activeWorkspace;
  const uid = currentUser?.uid;
  const key = `${uid}|${activeWorkspace}`;
  const data = active && stored?.key === key ? stored.data : null;

  const refreshUsage = useCallback(async () => {
    if (!active) return;
    try {
      const res = await authFetch(`${import.meta.env.VITE_API_BASE_URL}/api/account/usage`);
      if (!res.ok) return;
      setStored({ key, data: await res.json() });
      setBlockedKinds([]);
      setPlanInactive(false);
    } catch {
      /* usage display is best-effort */
    }
  }, [active, key]);

  const showQuotaModal = useCallback((detail) => {
    setQuotaDetail(detail || {});
    if (detail?.code === 'plan_inactive') setPlanInactive(true);
    else if (detail?.code === 'quota_exceeded' && detail.kind) {
      setBlockedKinds((prev) => (prev.includes(detail.kind) ? prev : [...prev, detail.kind]));
    }
  }, []);

  // Initial load, and again on sign-in / sign-out / workspace switch.
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
    const credits = data?.credits || null;
    const ended = isTrialEnded(data) || planInactive;
    const isPool = data?.pool === true;
    const gate = (kind) => {
      if (!data && !planInactive && !blockedKinds.includes(kind)) return OPEN;
      if (ended) return { blocked: true, reason: 'trial_ended', message: TRIAL_ENDED_MESSAGE };
      const c = credits?.[kind];
      const out = blockedKinds.includes(kind) || (c && c.limit != null && c.remaining === 0);
      if (!out) return OPEN;
      return {
        blocked: true,
        reason: 'quota',
        message: pausedMessage(kind, { isTrial: !!data?.is_trial, resetsAt: c?.resets_at ?? data?.resets_at, trialEndsAt: data?.trial_ends_at }),
      };
    };
    // Meter: always for the personal workspace; for an org pool only when it has a limit.
    const anyLimit = credits ? Object.values(credits).some((c) => c && c.limit != null) : false;
    const meterVisible = !!data && (!isPool || anyLimit);
    return {
      credits,
      plan: data?.plan ?? null,
      isTrial: !!data?.is_trial,
      isPool,
      trialDaysLeft: data?.trial_days_left ?? null,
      trialEndsAt: data?.trial_ends_at ?? null,
      resetsAt: data?.resets_at ?? null,
      trialEnded: ended,
      loaded: !!data,
      meterVisible,
      gate,
      isExhausted: (kind) => gate(kind).blocked,
      refreshUsage,
      showQuotaModal,
      openUpgrade: () => setUpgradeOpen(true),
    };
  }, [data, blockedKinds, planInactive, refreshUsage, showQuotaModal]);

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
      {upgradeOpen && <JoinWaitlistModal onClose={() => setUpgradeOpen(false)} />}
    </UsageContext.Provider>
  );
};
