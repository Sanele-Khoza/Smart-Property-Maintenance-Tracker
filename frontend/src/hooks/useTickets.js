import { useEffect, useState, useCallback } from 'react';
import { getTickets } from '../data/ticketStore';

export default function useTickets() {
  const [tickets, setTickets] = useState(() => getTickets());
  const refresh = useCallback(() => setTickets(getTickets()), []);

  useEffect(() => {
    const onUpdate = () => setTickets(getTickets());
    window.addEventListener('spmt:tickets-updated', onUpdate);
    return () => window.removeEventListener('spmt:tickets-updated', onUpdate);
  }, []);

  return [tickets, refresh];
}
