export type KnowledgeDocument = {
  id: string;
  title: string;
  source_type: "pdf" | "doc" | "image" | "text";
  mime_type: string | null;
  file_path: string | null;
  file_size: number | null;
  extracted_text: string | null;
  notes: string | null;
  expires_at: string | null;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
};

export type KnowledgeChunk = {
  id: string;
  document_id: string;
  chunk_index: number;
  content: string;
  created_at: string;
  knowledge_documents?: Pick<KnowledgeDocument, "id" | "title" | "source_type" | "expires_at">;
};

export type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};
