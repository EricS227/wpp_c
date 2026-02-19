'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Zap, Plus, Trash2, X, ChevronRight } from 'lucide-react';
import {
    useQuickReplies,
    useCreateQuickReply,
    useDeleteQuickReply,
} from '@/hooks/useQuickReplies';
import { toast } from 'sonner';

interface QuickRepliesPanelProps {
    onSelect: (content: string) => void;
}

export function QuickRepliesPanel({ onSelect }: QuickRepliesPanelProps) {
    const [open, setOpen] = useState(false);
    const [tab, setTab] = useState<'use' | 'manage'>('use');
    const [newTitle, setNewTitle] = useState('');
    const [newContent, setNewContent] = useState('');
    const [newShortcut, setNewShortcut] = useState('');
    const [isCreating, setIsCreating] = useState(false);

    const { data: replies = [] } = useQuickReplies();
    const createMutation = useCreateQuickReply();
    const deleteMutation = useDeleteQuickReply();

    const handleSelect = (content: string) => {
        onSelect(content);
        setOpen(false);
    };

    const handleCreate = async () => {
        if (!newTitle.trim() || !newContent.trim()) {
            toast.error('Título e conteúdo são obrigatórios');
            return;
        }
        setIsCreating(true);
        try {
            await createMutation.mutateAsync({
                title: newTitle.trim(),
                content: newContent.trim(),
                shortcut: newShortcut.trim() || undefined,
            });
            setNewTitle('');
            setNewContent('');
            setNewShortcut('');
            toast.success('Prompt criado!');
            setTab('use');
        } catch {
            toast.error('Erro ao criar prompt');
        } finally {
            setIsCreating(false);
        }
    };

    const handleDelete = async (id: string, title: string) => {
        if (!confirm(`Deletar "${title}"?`)) return;
        try {
            await deleteMutation.mutateAsync(id);
            toast.success('Prompt deletado');
        } catch {
            toast.error('Erro ao deletar prompt');
        }
    };

    return (
        <div className="relative">
            <Button
                type="button"
                variant="ghost"
                size="icon"
                className={`h-10 w-10 shrink-0 transition-colors ${open ? 'bg-green-100 text-green-700' : ''}`}
                title="Respostas rápidas"
                onClick={() => setOpen(!open)}
                id="quick-replies-btn"
            >
                <Zap className="h-4 w-4" />
            </Button>

            {open && (
                <>
                    {/* Backdrop */}
                    <div
                        className="fixed inset-0 z-40"
                        onClick={() => setOpen(false)}
                    />

                    {/* Panel */}
                    <div className="absolute bottom-12 left-0 z-50 w-80 rounded-xl border bg-white shadow-xl overflow-hidden">
                        {/* Header */}
                        <div className="flex items-center justify-between px-4 py-3 border-b bg-gray-50">
                            <div className="flex gap-1">
                                <button
                                    className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${tab === 'use'
                                        ? 'bg-white shadow text-green-700 border'
                                        : 'text-muted-foreground hover:text-foreground'
                                        }`}
                                    onClick={() => setTab('use')}
                                >
                                    ⚡ Usar
                                </button>
                                <button
                                    className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${tab === 'manage'
                                        ? 'bg-white shadow text-green-700 border'
                                        : 'text-muted-foreground hover:text-foreground'
                                        }`}
                                    onClick={() => setTab('manage')}
                                >
                                    ✏️ Gerenciar
                                </button>
                            </div>
                            <button
                                onClick={() => setOpen(false)}
                                className="text-muted-foreground hover:text-foreground"
                            >
                                <X className="h-4 w-4" />
                            </button>
                        </div>

                        {/* Tab: Use */}
                        {tab === 'use' && (
                            <div className="max-h-64 overflow-y-auto">
                                {replies.length === 0 ? (
                                    <div className="flex flex-col items-center justify-center py-8 text-center text-muted-foreground">
                                        <Zap className="h-8 w-8 mb-2 opacity-30" />
                                        <p className="text-sm">Nenhum prompt ainda</p>
                                        <button
                                            className="mt-2 text-xs text-green-600 hover:underline"
                                            onClick={() => setTab('manage')}
                                        >
                                            Criar meu primeiro prompt →
                                        </button>
                                    </div>
                                ) : (
                                    replies.map((reply) => (
                                        <button
                                            key={reply.id}
                                            className="w-full text-left px-4 py-3 hover:bg-gray-50 transition-colors border-b last:border-b-0 flex items-start justify-between gap-2 group"
                                            onClick={() => handleSelect(reply.content)}
                                        >
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2">
                                                    <span className="text-sm font-medium text-gray-900 truncate">
                                                        {reply.title}
                                                    </span>
                                                    {reply.shortcut && (
                                                        <span className="text-xs bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded font-mono shrink-0">
                                                            /{reply.shortcut}
                                                        </span>
                                                    )}
                                                </div>
                                                <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                                                    {reply.content}
                                                </p>
                                            </div>
                                            <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 shrink-0 mt-0.5" />
                                        </button>
                                    ))
                                )}
                            </div>
                        )}

                        {/* Tab: Manage */}
                        {tab === 'manage' && (
                            <div className="flex flex-col">
                                {/* Create form */}
                                <div className="p-4 border-b bg-green-50/50">
                                    <p className="text-xs font-semibold text-muted-foreground uppercase mb-3">
                                        Novo Prompt
                                    </p>
                                    <div className="space-y-2">
                                        <Input
                                            placeholder="Título (ex: Saudação)"
                                            value={newTitle}
                                            onChange={(e) => setNewTitle(e.target.value)}
                                            className="h-8 text-sm"
                                            maxLength={80}
                                        />
                                        <textarea
                                            placeholder="Conteúdo da mensagem..."
                                            value={newContent}
                                            onChange={(e) => setNewContent(e.target.value)}
                                            className="w-full text-sm resize-none rounded-md border border-gray-300 bg-white px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-500"
                                            rows={3}
                                            maxLength={1000}
                                        />
                                        <Input
                                            placeholder="Atalho opcional (ex: oi)"
                                            value={newShortcut}
                                            onChange={(e) => setNewShortcut(e.target.value)}
                                            className="h-8 text-sm"
                                            maxLength={30}
                                        />
                                        <Button
                                            size="sm"
                                            className="w-full bg-green-600 hover:bg-green-700 text-white"
                                            onClick={handleCreate}
                                            disabled={isCreating || !newTitle.trim() || !newContent.trim()}
                                        >
                                            <Plus className="h-3 w-3 mr-1" />
                                            {isCreating ? 'Salvando...' : 'Salvar Prompt'}
                                        </Button>
                                    </div>
                                </div>

                                {/* Existing list */}
                                <div className="max-h-48 overflow-y-auto">
                                    {replies.length === 0 ? (
                                        <p className="text-xs text-muted-foreground text-center py-4">
                                            Nenhum prompt criado ainda
                                        </p>
                                    ) : (
                                        replies.map((reply) => (
                                            <div
                                                key={reply.id}
                                                className="flex items-center justify-between px-4 py-2.5 border-b last:border-b-0 hover:bg-gray-50"
                                            >
                                                <div className="flex-1 min-w-0">
                                                    <span className="text-sm font-medium truncate block">
                                                        {reply.title}
                                                    </span>
                                                    {reply.shortcut && (
                                                        <span className="text-xs text-muted-foreground">
                                                            /{reply.shortcut}
                                                        </span>
                                                    )}
                                                </div>
                                                <button
                                                    onClick={() => handleDelete(reply.id, reply.title)}
                                                    className="ml-2 p-1.5 rounded hover:bg-red-50 hover:text-red-600 text-muted-foreground transition-colors shrink-0"
                                                    title="Deletar"
                                                >
                                                    <Trash2 className="h-3.5 w-3.5" />
                                                </button>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                </>
            )}
        </div>
    );
}
