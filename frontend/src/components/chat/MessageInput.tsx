'use client';

import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Send } from 'lucide-react';
import { useSendMessage } from '@/hooks/useMessages';
import { useSocket } from '@/hooks/useSocket';
import { QuickRepliesPanel } from './QuickRepliesPanel';

interface MessageInputProps {
  conversationId: string;
}

export function MessageInput({ conversationId }: MessageInputProps) {
  const [content, setContent] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const sendMessage = useSendMessage();
  const { emitTypingStart, emitTypingStop } = useSocket();
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    textareaRef.current?.focus();
  }, [conversationId]);

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    const trimmed = content.trim();
    if (!trimmed || sendMessage.isPending) return;

    setContent('');
    emitTypingStop(conversationId);

    sendMessage.mutate({
      conversationId,
      content: trimmed,
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setContent(e.target.value);

    emitTypingStart(conversationId);

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    typingTimeoutRef.current = setTimeout(() => {
      emitTypingStop(conversationId);
    }, 2000);
  };

  const handleQuickReply = (replyContent: string) => {
    setContent(replyContent);
    textareaRef.current?.focus();
  };

  // Auto-resize textarea
  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = `${Math.min(textarea.scrollHeight, 120)}px`;
    }
  }, [content]);

  return (
    <form
      onSubmit={handleSubmit}
      className="flex items-end gap-2 border-t bg-white p-4"
    >
      {/* Quick Replies Panel — always visible */}
      <QuickRepliesPanel onSelect={handleQuickReply} />

      <textarea
        ref={textareaRef}
        value={content}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        placeholder="Digite uma mensagem..."
        className="flex-1 resize-none rounded-lg border bg-gray-50 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
        rows={1}
      />
      <Button
        type="submit"
        size="icon"
        className="h-10 w-10 shrink-0 bg-green-600 hover:bg-green-700"
        disabled={!content.trim() || sendMessage.isPending}
      >
        <Send className="h-4 w-4" />
      </Button>
    </form>
  );
}
