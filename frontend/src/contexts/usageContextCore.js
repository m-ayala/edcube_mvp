// frontend/src/contexts/usageContextCore.js
// Context object + hook for UsageProvider (kept apart so UsageContext.jsx only
// exports a component, which Vite fast refresh requires).
import { createContext, useContext } from 'react';

export const UsageContext = createContext(null);

export const useUsage = () => {
  const context = useContext(UsageContext);
  if (!context) {
    throw new Error('useUsage must be used within a UsageProvider');
  }
  return context;
};
