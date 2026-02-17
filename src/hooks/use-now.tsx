import { useEffect, useState } from 'react';

// Hook that returns a Date object that updates on an interval to force re-renders
// Useful to keep displayed relative timestamps fresh without refetching data.
export default function useNow(intervalMs = 30000) {
  const [now, setNow] = useState<Date>(() => new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);

  return now;
}
