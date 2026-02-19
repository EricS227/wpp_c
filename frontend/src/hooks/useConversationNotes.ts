'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from '@/lib/api-client';
import { ConversationNote } from '@/types/conversationNote';

export function useConversationNotes(conversationId: string | null) {
  const queryClient = useQueryClient();

  const query = useQuery<ConversationNote[]>({
    queryKey: ['notes', conversationId],
    queryFn: async () => {
      if (!conversationId) return [];
      const res = await apiClient.get(`/conversations/${conversationId}/notes`);
      return res.data;
    },
    enabled: !!conversationId,
  });

  const createNote = useMutation({
    mutationFn: async (data: { conversationId: string; content: string }) => {
      const res = await apiClient.post(`/conversations/${data.conversationId}/notes`, {
        content: data.content,
      });
      return res.data as ConversationNote;
    },
    onSuccess: (newNote) => {
      queryClient.setQueryData(
        ['notes', newNote.conversationId],
        (old: ConversationNote[] = []) => [...old, newNote],
      );
    },
  });

  const updateNote = useMutation({
    mutationFn: async (data: { conversationId: string; noteId: string; content: string }) => {
      const res = await apiClient.patch(
        `/conversations/${data.conversationId}/notes/${data.noteId}`,
        { content: data.content },
      );
      return res.data as ConversationNote;
    },
    onSuccess: (updated) => {
      queryClient.setQueryData(
        ['notes', updated.conversationId],
        (old: ConversationNote[] = []) =>
          old.map((n) => (n.id === updated.id ? updated : n)),
      );
    },
  });

  const deleteNote = useMutation({
    mutationFn: async (data: { conversationId: string; noteId: string }) => {
      await apiClient.delete(`/conversations/${data.conversationId}/notes/${data.noteId}`);
      return data;
    },
    onSuccess: (_result, variables) => {
      queryClient.setQueryData(
        ['notes', variables.conversationId],
        (old: ConversationNote[] = []) => old.filter((n) => n.id !== variables.noteId),
      );
    },
  });

  return {
    notes: query.data ?? [],
    isLoading: query.isLoading,
    createNote,
    updateNote,
    deleteNote,
  };
}
