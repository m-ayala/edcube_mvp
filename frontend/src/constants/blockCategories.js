// Block educational category taxonomy
// Used for labelling blocks and guiding Edo generation
// Sourced from the backend (GET /api/knowledge-base/objectives, which reads
// the knowledge base via knowledge_base_service.py), cached in memory since
// this data changes rarely. The frontend never reads the knowledge base from
// Firestore directly. Colors are presentation-only and stay local.
//
// The hardcoded array below is only a fallback: it is what callers see until
// the fetch resolves, and permanently if the fetch fails.

import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '../firebase/config';

const API_BASE_URL = `${import.meta.env.VITE_API_BASE_URL}/api`;

const CATEGORY_COLORS = {
  thinking_self_awareness: { bg: '#F3EFFF', text: '#7C3AED', border: '#DDD6FE' },
  soft_skills: { bg: '#FFF1F2', text: '#E11D48', border: '#FECDD3' },
  knowledge_theory: { bg: '#EFF6FF', text: '#2563EB', border: '#BFDBFE' },
  ethics_perspectives: { bg: '#F0FDF4', text: '#16A34A', border: '#BBF7D0' },
  application_impact: { bg: '#FFFBEB', text: '#D97706', border: '#FDE68A' },
};

// Snapshot of kb_objectives, used until the Firestore fetch below resolves
// so callers never see an empty taxonomy.
let categories = [
  {
    id: 'thinking_self_awareness',
    label: 'Thinking and Self-Awareness',
    allowedTypes: ['content', 'worksheet', 'activity'],
    clusters: [
      {
        label: 'Self-Awareness',
        subcategories: [
          'Emotional Intelligence',
          'Self-Regulation',
          'Growth Mindset',
          'Metacognition',
          'Identity & Values',
          'Resilience',
        ],
      },
      {
        label: 'Critical Thinking',
        subcategories: [
          'Critical Thinking',
          'Compare & Contrast',
          'Pattern Recognition',
          'Examine Evidence',
          'Synthesize',
          'Critique & Debate',
          'Evaluate & Judge',
          'Make Connections',
        ],
      },
    ],
  },
  {
    id: 'soft_skills',
    label: 'Soft Skills',
    allowedTypes: ['content', 'worksheet', 'activity'],
    clusters: [
      {
        label: 'Soft Skills',
        subcategories: [
          'Communication',
          'Teamwork',
          'Leadership',
          'Collaboration',
          'Conflict Resolution',
          'Time Management',
          'Public Speaking',
        ],
      },
    ],
  },
  {
    id: 'knowledge_theory',
    label: 'Knowledge and Theory',
    allowedTypes: ['content', 'worksheet', 'activity'],
    clusters: [
      {
        label: 'Knowledge and Theory',
        subcategories: [
          'Definitions',
          'Concepts',
          'Theories',
          'Types of',
          'Parts of',
          'Process',
          'Methodologies',
          'Techniques',
          'Principles',
          'Frameworks',
          'Systems',
          'Rules & Formulas',
        ],
      },
    ],
  },
  {
    id: 'ethics_perspectives',
    label: 'Ethics and Global Perspectives',
    allowedTypes: ['content', 'worksheet', 'activity'],
    clusters: [
      {
        label: 'Ethics and Global Perspectives',
        subcategories: [
          'History',
          'Evolution',
          'Culture',
          'Perspectives',
          'Ethical Issues',
          'Ethical Practices',
          'Impact & Consequences',
          'Sustainability',
        ],
      },
    ],
  },
  {
    id: 'application_impact',
    label: 'Application and Impact',
    allowedTypes: ['content', 'worksheet', 'activity'],
    clusters: [],
  },
].map(cat => ({ ...cat, color: CATEGORY_COLORS[cat.id] || null }));

async function loadObjectivesFromBackend(user) {
  try {
    const idToken = await user.getIdToken();
    const response = await fetch(`${API_BASE_URL}/knowledge-base/objectives`, {
      headers: { Authorization: `Bearer ${idToken}` },
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    const objectives = data?.objectives;
    if (!Array.isArray(objectives) || objectives.length === 0) {
      throw new Error('empty objectives list');
    }
    categories = objectives.map(o => ({
      id: o.id,
      label: o.label,
      color: CATEGORY_COLORS[o.id] || null,
      allowedTypes: o.allowed_types || [],
      clusters: o.clusters || [],
    }));
  } catch (err) {
    // Logged once (hasStartedFetch is never reset after this point); the
    // fallback taxonomy stays in place.
    console.error('Failed to load taxonomy from /api/knowledge-base/objectives, using fallback taxonomy', err);
  }
}

// Kicked off lazily (on first real use) rather than at module load, since
// this module gets bundled into the app's initial chunk and would otherwise
// race the user's auth state -- the endpoint requires a Firebase ID token.
// If no user is signed in yet, nothing is marked as started; instead a
// one-shot auth listener runs the fetch as soon as a user appears, so a
// too-early first call does not leave the fallback in place for the session.
let hasStartedFetch = false;
let isWaitingForAuth = false;
function ensureObjectivesLoading() {
  if (hasStartedFetch) return;
  const user = auth.currentUser;
  if (user) {
    hasStartedFetch = true;
    loadObjectivesFromBackend(user);
    return;
  }
  if (isWaitingForAuth) return;
  isWaitingForAuth = true;
  const unsubscribe = onAuthStateChanged(auth, u => {
    if (!u) return;
    unsubscribe();
    isWaitingForAuth = false;
    if (hasStartedFetch) return;
    hasStartedFetch = true;
    loadObjectivesFromBackend(u);
  });
}

// Flat list of all subcategories for a given block type
export function getSubcategoriesForType(blockType) {
  ensureObjectivesLoading();
  const result = [];
  for (const cat of categories) {
    if (!cat.allowedTypes.includes(blockType)) continue;
    const subs = cat.clusters.flatMap(c => c.subcategories);
    result.push({ categoryId: cat.id, categoryLabel: cat.label, subcategories: subs });
  }
  return result;
}

// Find category + color for a given category label
export function getCategoryColor(categoryLabel) {
  ensureObjectivesLoading();
  const cat = categories.find(c => c.label === categoryLabel);
  return cat?.color || null;
}
