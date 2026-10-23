'use client';

import { useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';

export function useSocket() {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let instance: Socket | null = null;

    const onConnect = () => setConnected(true);
    const onDisconnect = () => setConnected(false);

    // The Socket.IO server is attached by the /api/socket route the first time
    // it is requested over plain HTTP; a WebSocket handshake alone never
    // reaches that route. Ask for it before connecting so the first visitor
    // after a server start gets live updates too.
    fetch('/api/socket')
      .catch(() => undefined)
      .finally(() => {
        if (cancelled) return;
        instance = io({
          path: '/api/socket',
          transports: ['websocket', 'polling'],
        });
        instance.on('connect', onConnect);
        instance.on('disconnect', onDisconnect);
        if (instance.connected) setConnected(true);
        setSocket(instance);
      });

    return () => {
      cancelled = true;
      if (instance) {
        instance.off('connect', onConnect);
        instance.off('disconnect', onDisconnect);
        instance.disconnect();
      }
      setSocket(null);
      setConnected(false);
    };
  }, []);

  return { socket, connected };
}
