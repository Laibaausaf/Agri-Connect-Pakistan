import type { Server as SocketIOServer } from 'socket.io';

export function getIO(): SocketIOServer | undefined {
  return (globalThis as unknown as { __io?: SocketIOServer }).__io;
}
