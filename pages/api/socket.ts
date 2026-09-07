import type { NextApiRequest, NextApiResponse } from 'next';
import { Server as SocketIOServer } from 'socket.io';

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    res.status(405).end();
    return;
  }

  const socket = res.socket as typeof res.socket & { server?: { io?: SocketIOServer } };
  const httpServer = socket.server;
  if (!httpServer) {
    res.status(500).end('Missing underlying server');
    return;
  }

  if (!httpServer.io) {
    const io = new SocketIOServer(httpServer as any, {
      path: '/api/socket',
      addTrailingSlash: false,
      transports: ['websocket', 'polling'],
    });

    io.on('connection', (socket) => {
      socket.on('join-auction', (auctionId: string) => {
        if (typeof auctionId === 'string') {
          socket.join(`auction:${auctionId}`);
        }
      });

      socket.on('leave-auction', (auctionId: string) => {
        if (typeof auctionId === 'string') {
          socket.leave(`auction:${auctionId}`);
        }
      });
    });

    httpServer.io = io;
    (globalThis as unknown as { __io?: SocketIOServer }).__io = io;
  }

  res.end();
}
