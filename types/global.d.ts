import type { Server as SocketIOServer } from 'socket.io';

declare global {
  var __io: SocketIOServer | undefined;
}

export {};
