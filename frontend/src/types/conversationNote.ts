export interface ConversationNote {
  id: string;
  conversationId: string;
  companyId: string;
  authorId: string;
  author: { id: string; name: string };
  content: string;
  createdAt: string;
  updatedAt: string;
}
