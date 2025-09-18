import { useMemo } from 'react';

export const useTenantId = () => {
  const tenantId = useMemo(() => {
    console.log('useTenantId: Computing tenantId');
    const result = 'YAZAMI';
    console.log('useTenantId: Computed result =', result);
    return result;
  }, []);
  
  console.log('useTenantId: Final tenantId =', tenantId);
  return tenantId;
};
