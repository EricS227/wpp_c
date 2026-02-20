'use client';

import { useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { connectSocket, disconnectSocket, getSocket } from '@/lib/socket';
import { useAuthStore } from '@/stores/authStore';
import { useChatStore } from '@/stores/chatStore';
import { useNotificationStore } from '@/stores/notificationStore';
import apiClient from '@/lib/api-client';

type SocketInstance = ReturnType<typeof connectSocket>;

export function useSocket() {
  const token = useAuthStore((s) => s.token);
  const addMessage = useChatStore((s) => s.addMessage);
  const updateMessageStatus = useChatStore((s) => s.updateMessageStatus);
  const incrementUnread = useChatStore((s) => s.incrementUnread);
  const selectedConversationId = useChatStore((s) => s.selectedConversationId);
  const addNotification = useNotificationStore((s) => s.addNotification);
  const socketRef = useRef<SocketInstance | null>(null);
  const [socketInstance, setSocketInstance] = useState<SocketInstance | null>(null);
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!token) return;

    const socket = connectSocket(token);
    socketRef.current = socket;
    setSocketInstance(socket);

    socket.on('connect', () => {
      socket.emit('agent-online');
      // Also call REST API to guarantee DB update (socket event alone can be missed)
      apiClient.patch('/users/me/status', { status: 'ONLINE' }).catch(() => { });
    });

    socket.on('message-received', (data: { message: any; conversationId: string }) => {
      addMessage(data.conversationId, data.message);
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
      if (data.conversationId !== selectedConversationId) {
        incrementUnread(data.conversationId);
      }
      if (typeof document !== 'undefined' && document.hidden && 'Notification' in window) {
        if (Notification.permission === 'granted') {
          new Notification('Nova mensagem', {
            body: data.message.content?.slice(0, 100) || 'Nova mensagem recebida',
            icon: '/favicon.ico',
          });
        } else if (Notification.permission !== 'denied') {
          Notification.requestPermission();
        }
      }
    });

    socket.on('message-sent', (message: any) => {
      addMessage(message.conversationId, message);
    });

    socket.on('message-status-updated', (data: { messageId: string; status: string }) => {
      updateMessageStatus(data.messageId, data.status);
    });

    socket.on('conversation-assigned', () => {
      toast.info('Nova conversa atribuída a você!');
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
    });

    socket.on('conversation-queued', () => {
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
    });

    socket.on('conversation-transferred', () => {
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
    });

    socket.on('agent-status-changed', () => {
      queryClient.invalidateQueries({ queryKey: ['department-agents'] });
    });

    // 🔔 Novo evento de conversa recebida no setor
    socket.on('new_conversation', (data: {
      conversationId: string;
      customerName: string;
      customerPhone: string;
      departmentName: string;
      timestamp: string;
    }) => {
      addNotification({
        type: 'new_conversation',
        title: '📞 Nova Conversa',
        message: `Conversa do cliente ${data.customerName} chegou no seu setor`,
        conversationId: data.conversationId,
        customerName: data.customerName,
        customerPhone: data.customerPhone,
        departmentName: data.departmentName,
        autoDissmiss: true,
      });
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
    });

    // 🔄 Novo evento de conversa transferida para o setor
    socket.on('conversation_transferred', (data: {
      conversationId: string;
      customerName: string;
      customerPhone: string;
      transferredBy: string;
      fromDepartmentName: string;
      toDepartmentName: string;
      timestamp: string;
    }) => {
      addNotification({
        type: 'conversation_transferred',
        title: '🔄 Conversa Transferida',
        message: `Conversa de ${data.customerName} foi transferida por ${data.transferredBy} do setor ${data.fromDepartmentName}`,
        conversationId: data.conversationId,
        customerName: data.customerName,
        customerPhone: data.customerPhone,
        transferredBy: data.transferredBy,
        autoDissmiss: true,
      });
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
    });

    const heartbeatInterval = setInterval(() => {
      getSocket()?.emit('heartbeat');
    }, 30000); // 30s — must be < 120s timeout

    const handleBeforeUnload = () => {
      getSocket()?.emit('agent-offline');
    };
    if (typeof window !== 'undefined') {
      window.addEventListener('beforeunload', handleBeforeUnload);
    }

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      clearInterval(heartbeatInterval);
      socket.emit('agent-offline');
      socket.off('connect');
      socket.off('message-received');
      socket.off('message-sent');
      socket.off('message-status-updated');
      socket.off('conversation-assigned');
      socket.off('conversation-queued');
      socket.off('conversation-transferred');
      socket.off('agent-status-changed');
      socket.off('new_conversation');
      socket.off('conversation_transferred');
      disconnectSocket();
    };
  }, [token]);

  const joinConversation = (conversationId: string) => {
    getSocket()?.emit('join-conversation', conversationId);
  };

  const leaveConversation = (conversationId: string) => {
    getSocket()?.emit('leave-conversation', conversationId);
  };

  const emitTypingStart = (conversationId: string) => {
    getSocket()?.emit('typing-start', conversationId);
  };

  const emitTypingStop = (conversationId: string) => {
    getSocket()?.emit('typing-stop', conversationId);
  };

  return {
    socket: socketInstance,
    joinConversation,
    leaveConversation,
    emitTypingStart,
    emitTypingStop,
  };
}
