import { useMemo } from 'react';

export const useTenantId = () => {
  return useMemo(() => 'YAZAMI', []);
};
