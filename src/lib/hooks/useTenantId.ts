import { useMemo } from 'react';

export const useTenantId = () => {
  const tenantId = useMemo(() => {
    // Reduced logging to prevent console spam
    const result = 'YAZAMI';
    return result;
  }, []);
  
  return tenantId;
};
