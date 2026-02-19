import { create } from 'zustand';

export interface Notification {
  id: string;
  type: 'new_conversation' | 'conversation_transferred' | 'info' | 'warning' | 'error';
  title: string;
  message: string;
  conversationId?: string;
  customerName?: string;
  customerPhone?: string;
  departmentName?: string;
  transferredBy?: string;
  timestamp: Date;
  autoDissmiss?: boolean;
}

interface NotificationStore {
  notifications: Notification[];
  addNotification: (notification: Omit<Notification, 'id' | 'timestamp'>) => void;
  removeNotification: (id: string) => void;
  clearAll: () => void;
  notificationCount: number;
}

export const useNotificationStore = create<NotificationStore>((set, get) => ({
  notifications: [],
  notificationCount: 0,

  addNotification: (notification) => {
    const id = `${notification.type}-${Date.now()}-${Math.random()}`;
    const newNotification: Notification = {
      ...notification,
      id,
      timestamp: new Date(),
    };

    set((state) => ({
      notifications: [newNotification, ...state.notifications],
      notificationCount: state.notifications.length + 1,
    }));

    // Auto-dismiss após 8 segundos se configurado
    if (notification.autoDissmiss !== false) {
      setTimeout(() => {
        get().removeNotification(id);
      }, 8000);
    }
  },

  removeNotification: (id: string) => {
    set((state) => ({
      notifications: state.notifications.filter((n) => n.id !== id),
      notificationCount: Math.max(0, state.notificationCount - 1),
    }));
  },

  clearAll: () => {
    set({
      notifications: [],
      notificationCount: 0,
    });
  },
}));
