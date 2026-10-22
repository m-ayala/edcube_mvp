// frontend/src/utils/planLabel.js
// Display name for a plan id. 'trial' -> "Free trial", 'teacher' -> "Teacher",
// 'org' -> the organization's name. Unknown ids are shown as-is, never as a
// retired free/pro label.
export const planLabel = (plan, orgName) => {
  switch (plan) {
    case 'trial': return 'Free trial';
    case 'teacher': return 'Teacher';
    case 'org': return orgName || 'Organization';
    default: return plan ? String(plan) : '';
  }
};

// True for plans that are not the trial (nothing to upgrade to from here).
export const isPaidPlan = (plan) => plan === 'teacher' || plan === 'org';
