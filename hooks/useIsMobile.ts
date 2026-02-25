import { useState, useEffect } from 'react';

export function useIsMobile(): boolean {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const check = () => setIsMobile(window.matchMedia('(max-width: 768px)').matches);
    check();
    const mql = window.matchMedia('(max-width: 768px)');
    mql.addEventListener('change', check);
    return () => mql.removeEventListener('change', check);
  }, []);

  return isMobile;
}
