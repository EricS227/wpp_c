'use client';

import { useEffect } from 'react';
import { useNotificationStore, Notification } from '@/stores/notificationStore';
import { X, MessageCircle, ArrowRightCircle, AlertCircle, CheckCircle, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';

function NotificationToast({ notification, onDismiss }: { notification: Notification; onDismiss: () => void }) {
  const router = useRouter();

  const getIcon = () => {
    switch (notification.type) {
      case 'new_conversation':
        return <MessageCircle className="h-5 w-5 text-blue-500" />;
      case 'conversation_transferred':
        return <ArrowRightCircle className="h-5 w-5 text-purple-500" />;
      case 'error':
        return <AlertCircle className="h-5 w-5 text-red-500" />;
      case 'warning':
        return <AlertTriangle className="h-5 w-5 text-yellow-500" />;
      case 'info':
      default:
        return <CheckCircle className="h-5 w-5 text-green-500" />;
    }
  };

  const getBackgroundColor = () => {
    switch (notification.type) {
      case 'new_conversation':
        return 'bg-blue-50 border-blue-200';
      case 'conversation_transferred':
        return 'bg-purple-50 border-purple-200';
      case 'error':
        return 'bg-red-50 border-red-200';
      case 'warning':
        return 'bg-yellow-50 border-yellow-200';
      case 'info':
      default:
        return 'bg-green-50 border-green-200';
    }
  };

  const handleViewConversation = () => {
    if (notification.conversationId) {
      router.push(`/dashboard/chat?id=${notification.conversationId}`);
      onDismiss();
    }
  };

  return (
    <div
      className={cn(
        'flex items-start gap-3 min-w-[350px] max-w-[450px] p-4 rounded-lg border shadow-lg bg-white animate-in slide-in-from-right-5 duration-300',
        getBackgroundColor(),
      )}
    >
      {getIcon()}
      <div className="flex-1 min-w-0">
        <h3 className="font-semibold text-sm">{notification.title}</h3>
        <p className="text-sm text-gray-600 mt-1">{notification.message}</p>
        {notification.customerName && (
          <p className="text-xs text-gray-500 mt-2">
            👤 <span className="font-medium">{notification.customerName}</span>
            {notification.departmentName && (
              <>
                {' '} ({notification.departmentName})
              </>
            )}
          </p>
        )}
        {notification.conversationId && (
          <Button
            size="sm"
            className="mt-3 h-7 text-xs"
            onClick={handleViewConversation}
          >
            Ver conversa
          </Button>
        )}
      </div>
      <button
        onClick={onDismiss}
        className="text-gray-400 hover:text-gray-600 transition-colors flex-shrink-0"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

export function NotificationContainer() {
  const notifications = useNotificationStore((state) => state.notifications);
  const removeNotification = useNotificationStore((state) => state.removeNotification);

  return (
    <div className="fixed top-4 right-4 z-50 pointer-events-none space-y-2">
      {notifications.map((notification) => (
        <div key={notification.id} className="pointer-events-auto">
          <NotificationToast
            notification={notification}
            onDismiss={() => removeNotification(notification.id)}
          />
        </div>
      ))}
    </div>
  );
}
