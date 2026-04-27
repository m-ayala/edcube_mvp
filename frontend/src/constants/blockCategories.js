// Block educational category taxonomy
// Used for labelling blocks and guiding Edo generation

export const BLOCK_CATEGORIES = [
  {
    id: 'thinking_self_awareness',
    label: 'Thinking and Self-Awareness',
    color: { bg: '#F3EFFF', text: '#7C3AED', border: '#DDD6FE' },
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
    color: { bg: '#FFF1F2', text: '#E11D48', border: '#FECDD3' },
    allowedTypes: ['content', 'worksheet', 'activity'],
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
  {
    id: 'knowledge_theory',
    label: 'Knowledge and Theory',
    color: { bg: '#EFF6FF', text: '#2563EB', border: '#BFDBFE' },
    allowedTypes: ['content', 'worksheet', 'activity'],
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
  {
    id: 'ethics_perspectives',
    label: 'Ethics and Global Perspectives',
    color: { bg: '#F0FDF4', text: '#16A34A', border: '#BBF7D0' },
    allowedTypes: ['content', 'worksheet', 'activity'],
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
  {
    id: 'application_impact',
    label: 'Application and Impact',
    color: { bg: '#FFFBEB', text: '#D97706', border: '#FDE68A' },
    allowedTypes: ['activity'],
    subcategories: [
      'Hands-on Building',
      'Art Creation',
      'Experimentation',
      'Modelling',
      'Presentations',
      'Problem Solving',
      'Role Play & Simulation',
      'Research & Investigation',
    ],
  },
];

// Flat list of all subcategories for a given block type
export function getSubcategoriesForType(blockType) {
  const result = [];
  for (const cat of BLOCK_CATEGORIES) {
    if (!cat.allowedTypes.includes(blockType)) continue;
    const subs = cat.clusters
      ? cat.clusters.flatMap(c => c.subcategories)
      : cat.subcategories;
    result.push({ categoryId: cat.id, categoryLabel: cat.label, subcategories: subs });
  }
  return result;
}

// Find category + color for a given category label
export function getCategoryColor(categoryLabel) {
  const cat = BLOCK_CATEGORIES.find(c => c.label === categoryLabel);
  return cat?.color || null;
}
