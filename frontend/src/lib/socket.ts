import { io, Socket } from 'socket.io-client';

let socket: Socket | null = null;

/**
 * Socket.IO client espera a URL HTTP(S) do servidor, não ws:// ou wss://.
 * Converte para o formato correto.
 */
function getSocketServerUrl(): string {
  const url = process.env.NEXT_PUBLIC_WS_URL || 'http://192.168.10.156:4000';
  const trimmed = url.trim();
  if (trimmed.startsWith('ws://')) return 'http://' + trimmed.slice(5);
  if (trimmed.startsWith('wss://')) return 'https://' + trimmed.slice(6);
  return trimmed;
}

export function getSocket(): Socket | null {
  return socket;
}

export function connectSocket(token: string): Socket {
  if (socket?.connected) return socket;

  const serverUrl = getSocketServerUrl();

  socket = io(serverUrl, {
    auth: { token },
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionAttempts: 20,
    reconnectionDelay: 500,
    reconnectionDelayMax: 5000,
    timeout: 10000,
    pingInterval: 25000,
    pingTimeout: 60000,
    forceNew: false,
    autoConnect: true,
  });

  socket.on('connect', () => {
    console.log('[Socket.IO] ✓ Conectado ao servidor WebSocket');
  });

  socket.on('disconnect', (reason) => {
    console.log(`[Socket.IO] ✗ Desconectado: ${reason}`);
  });

  socket.on('connect_error', (error) => {
    console.error(`[Socket.IO] ✗ Erro de conexão: ${error.message}`);
  });

  socket.on('reconnect_attempt', () => {
    console.log('[Socket.IO] → Tentando reconectar...');
  });

  socket.on('reconnect', () => {
    console.log('[Socket.IO] ✓ Reconectado com sucesso');
  });

  return socket;
}

export function disconnectSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}
