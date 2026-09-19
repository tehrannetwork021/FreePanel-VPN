import type { Destination } from '../core/types';
import { validateDestination } from './destination';

export type TcpSocketLike = {
  readable: ReadableStream<Uint8Array>;
  writable: WritableStream<Uint8Array>;
  close(): void;
  opened?: Promise<unknown>;
};

export type ConnectTcp = (destination: Destination, selfHost: string) => Promise<TcpSocketLike>;

export const openTcp: ConnectTcp = async (destination, selfHost) => {
  const validation = validateDestination(destination, selfHost);
  if (!validation.ok) throw new Error(`destination-blocked:${validation.reason}`);
  const { connect } = await import('cloudflare:sockets');
  const socket = connect(
    { hostname: destination.host, port: destination.port },
    { allowHalfOpen: true },
  ) as unknown as TcpSocketLike;
  if (socket.opened) await socket.opened;
  return socket;
};
