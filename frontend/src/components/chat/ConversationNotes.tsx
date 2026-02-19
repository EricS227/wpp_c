'use client';

import { useState, useRef, useEffect } from 'react';
import { useConversationNotes } from '@/hooks/useConversationNotes';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { FileText, Pencil, Trash2, Plus, X } from 'lucide-react';
import { toast } from 'sonner';
import { ConversationNote } from '@/types/conversationNote';

interface ConversationNotesProps {
  conversationId: string;
}

export function ConversationNotes({ conversationId }: ConversationNotesProps) {
  const { user } = useAuth();
  const { notes, isLoading, createNote, updateNote, deleteNote } =
    useConversationNotes(conversationId);

  const [isCreating, setIsCreating] = useState(false);
  const [newContent, setNewContent] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');
  const createRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (isCreating) createRef.current?.focus();
  }, [isCreating]);

  const handleCreate = () => {
    if (!newContent.trim()) return;
    createNote.mutate(
      { conversationId, content: newContent.trim() },
      {
        onSuccess: () => {
          setNewContent('');
          setIsCreating(false);
          toast.success('Nota adicionada');
        },
        onError: () => toast.error('Erro ao adicionar nota'),
      },
    );
  };

  const handleUpdate = (note: ConversationNote) => {
    if (!editContent.trim()) return;
    updateNote.mutate(
      { conversationId, noteId: note.id, content: editContent.trim() },
      {
        onSuccess: () => { setEditingId(null); toast.success('Nota atualizada'); },
        onError: () => toast.error('Erro ao atualizar nota'),
      },
    );
  };

  const handleDelete = (noteId: string) => {
    if (!confirm('Deletar esta nota?')) return;
    deleteNote.mutate(
      { conversationId, noteId },
      {
        onSuccess: () => toast.success('Nota removida'),
        onError: () => toast.error('Erro ao remover nota'),
      },
    );
  };

  const canEditOrDelete = (note: ConversationNote) =>
    user?.id === note.authorId || user?.role === 'ADMIN';

  if (isLoading) {
    return <p className="px-4 py-2 text-xs text-muted-foreground">Carregando notas...</p>;
  }

  return (
    <div className="p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <FileText className="h-3.5 w-3.5 text-blue-500" />
          <h4 className="text-xs font-semibold text-muted-foreground uppercase">
            Notas Internas {notes.length > 0 && `(${notes.length})`}
          </h4>
        </div>
        {!isCreating && (
          <button
            type="button"
            onClick={() => setIsCreating(true)}
            className="rounded p-0.5 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            title="Adicionar nota"
          >
            <Plus className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {/* Create form */}
      {isCreating && (
        <div className="rounded-md border bg-blue-50 p-2 space-y-2">
          <textarea
            ref={createRef}
            value={newContent}
            onChange={(e) => setNewContent(e.target.value)}
            placeholder="Escreva uma nota interna..."
            className="w-full resize-none rounded border bg-white px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-400"
            rows={3}
            maxLength={2000}
          />
          <div className="flex justify-end gap-1">
            <button
              type="button"
              onClick={() => { setIsCreating(false); setNewContent(''); }}
              className="rounded p-1 hover:bg-blue-100 transition-colors"
            >
              <X className="h-3.5 w-3.5 text-muted-foreground" />
            </button>
            <Button
              size="sm"
              className="h-6 text-xs px-2 bg-blue-600 hover:bg-blue-700"
              onClick={handleCreate}
              disabled={!newContent.trim() || createNote.isPending}
            >
              Salvar
            </Button>
          </div>
        </div>
      )}

      {/* Notes list */}
      <div className="space-y-2 max-h-60 overflow-y-auto">
        {notes.length === 0 && !isCreating && (
          <p className="text-xs text-muted-foreground text-center py-2">
            Nenhuma nota interna
          </p>
        )}
        {notes.map((note) => (
          <div key={note.id} className="rounded-md border bg-yellow-50 p-2.5 text-xs">
            {editingId === note.id ? (
              <div className="space-y-2">
                <textarea
                  value={editContent}
                  onChange={(e) => setEditContent(e.target.value)}
                  className="w-full resize-none rounded border bg-white px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-400"
                  rows={3}
                  maxLength={2000}
                  autoFocus
                />
                <div className="flex justify-end gap-1">
                  <button
                    type="button"
                    onClick={() => setEditingId(null)}
                    className="rounded p-1 hover:bg-yellow-100 transition-colors"
                  >
                    <X className="h-3 w-3 text-muted-foreground" />
                  </button>
                  <Button
                    size="sm"
                    className="h-6 text-xs px-2 bg-blue-600 hover:bg-blue-700"
                    onClick={() => handleUpdate(note)}
                    disabled={!editContent.trim() || updateNote.isPending}
                  >
                    Salvar
                  </Button>
                </div>
              </div>
            ) : (
              <>
                <p className="whitespace-pre-wrap break-words text-gray-800 mb-1.5">
                  {note.content}
                </p>
                <div className="flex items-center justify-between text-muted-foreground">
                  <span>
                    <span className="font-medium text-gray-700">{note.author?.name}</span>
                    {' · '}
                    {new Date(note.createdAt).toLocaleString('pt-BR', {
                      day: '2-digit',
                      month: '2-digit',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                  {canEditOrDelete(note) && (
                    <div className="flex gap-0.5">
                      <button
                        type="button"
                        onClick={() => { setEditingId(note.id); setEditContent(note.content); }}
                        className="rounded p-0.5 hover:bg-yellow-200 transition-colors"
                        title="Editar"
                      >
                        <Pencil className="h-3 w-3" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(note.id)}
                        className="rounded p-0.5 hover:bg-red-100 hover:text-red-600 transition-colors"
                        title="Deletar"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
