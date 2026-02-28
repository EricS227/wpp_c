import { create } from 'zustand';
import { Conversation } from '@/types/conversation';
import { Message } from '@/types/message';

interface TypingUser {
  userName: string;
}

interface ChatState {
  conversations: Conversation[];
  selectedConversationId: string | null;
  messages: Record<string, Message[]>;
  typingUsers: Record<string, Record<string, TypingUser>>; // convId -> { userId -> { userName } }

  setConversations: (conversations: Conversation[]) => void;
  selectConversation: (id: string | null) => void;
  setMessages: (conversationId: string, messages: Message[]) => void;
  addMessage: (conversationId: string, message: Message) => void;
  updateMessageStatus: (
    messageId: string,
    status: string,
  ) => void;
  updateConversation: (conversation: Partial<Conversation> & { id: string }) => void;
  incrementUnread: (conversationId: string) => void;
  resetUnread: (conversationId: string) => void;
  setTyping: (conversationId: string, userId: string, userName: string, isTyping: boolean) => void;
  clearTyping: (conversationId: string) => void;
}

export const useChatStore = create<ChatState>((set) => ({
  conversations: [],
  selectedConversationId: null,
  messages: {},
  typingUsers: {},

  setConversations: (conversations) => set({ conversations }),

  selectConversation: (id) => set({ selectedConversationId: id }),

  setMessages: (conversationId, messages) =>
    set((state) => ({
      messages: { ...state.messages, [conversationId]: messages },
    })),

  addMessage: (conversationId, message) =>
    set((state) => {
      const existing = state.messages[conversationId] || [];
      // Avoid duplicates
      if (existing.some((m) => m.id === message.id)) return state;
      return {
        messages: {
          ...state.messages,
          [conversationId]: [...existing, message],
        },
      };
    }),

  updateMessageStatus: (messageId, status) =>
    set((state) => {
      const newMessages = { ...state.messages };
      for (const convId of Object.keys(newMessages)) {
        newMessages[convId] = newMessages[convId].map((m) =>
          m.id === messageId ? { ...m, status: status as Message['status'] } : m,
        );
      }
      return { messages: newMessages };
    }),

  updateConversation: (conversation) =>
    set((state) => ({
      conversations: state.conversations.map((c) =>
        c.id === conversation.id ? { ...c, ...conversation } : c,
      ),
    })),

  incrementUnread: (conversationId) =>
    set((state) => ({
      conversations: state.conversations.map((c) =>
        c.id === conversationId
          ? { ...c, unreadCount: c.unreadCount + 1 }
          : c,
      ),
    })),

  resetUnread: (conversationId) =>
    set((state) => ({
      conversations: state.conversations.map((c) =>
        c.id === conversationId ? { ...c, unreadCount: 0 } : c,
      ),
    })),

  setTyping: (conversationId, userId, userName, isTyping) =>
    set((state) => {
      const convTyping = { ...(state.typingUsers[conversationId] || {}) };
      if (isTyping) {
        convTyping[userId] = { userName };
      } else {
        delete convTyping[userId];
      }
      return {
        typingUsers: { ...state.typingUsers, [conversationId]: convTyping },
      };
    }),

  clearTyping: (conversationId) =>
    set((state) => ({
      typingUsers: { ...state.typingUsers, [conversationId]: {} },
    })),
}));

