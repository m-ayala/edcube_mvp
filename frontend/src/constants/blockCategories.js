// Block educational category taxonomy
// Used for labelling blocks and guiding Edo generation
// Sourced from Firestore (kb_objectives), cached in memory since this data
// changes rarely. Colors are presentation-only and stay local to the frontend.

import { collection, getDocs } from 'firebase/firestore';
import { db } from '../firebase/config';

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

async function loadObjectivesFromFirestore() {
  try {
    const snap = await getDocs(collection(db, 'kb_objectives'));
    if (snap.empty) return;
    categories = snap.docs.map(d => {
      const data = d.data();
      return {
        id: d.id,
        label: data.label,
        color: CATEGORY_COLORS[d.id] || null,
        allowedTypes: data.allowed_types || [],
        clusters: data.clusters || [],
      };
    });
  } catch (err) {
    console.error('Failed to load kb_objectives from Firestore, using fallback taxonomy', err);
  }
}

// Kicked off lazily (on first real use) rather than at module load, since
// this module gets bundled into the app's initial chunk and would otherwise
// race the user's auth state — kb_objectives requires an authenticated read.
let hasStartedFetch = false;
function ensureObjectivesLoading() {
  if (hasStartedFetch) return;
  hasStartedFetch = true;
  loadObjectivesFromFirestore();
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
