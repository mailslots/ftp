create extension if not exists pg_trgm;

create table if not exists public.ptech_knowledge_documents (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  source_type text not null check (source_type in ('pdf', 'doc', 'image', 'text')),
  mime_type text,
  file_path text,
  file_size bigint,
  extracted_text text,
  notes text,
  category text not null default 'other' check (category in ('branch', 'academic', 'student_development', 'academic_staff', 'administration', 'other')),
  expires_at timestamptz,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.ptech_knowledge_chunks (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.ptech_knowledge_documents(id) on delete cascade,
  chunk_index integer not null default 0,
  content text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.ptech_nineq_assessments (
  id uuid primary key default gen_random_uuid(),
  client_id text,
  total_score integer not null,
  severity text not null check (severity in ('minimal', 'mild', 'moderate', 'severe')),
  severity_label text not null,
  q9_score integer not null,
  answers integer[] not null,
  is_at_risk boolean not null default false,
  voluntary_name text,
  voluntary_year text,
  voluntary_group text,
  voluntary_phone text,
  consent_contact boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.ptech_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists ptech_knowledge_documents_set_updated_at on public.ptech_knowledge_documents;
create trigger ptech_knowledge_documents_set_updated_at
before update on public.ptech_knowledge_documents
for each row execute function public.ptech_set_updated_at();

drop trigger if exists ptech_nineq_assessments_set_updated_at on public.ptech_nineq_assessments;
create trigger ptech_nineq_assessments_set_updated_at
before update on public.ptech_nineq_assessments
for each row execute function public.ptech_set_updated_at();

create index if not exists ptech_knowledge_documents_active_idx on public.ptech_knowledge_documents (deleted_at, expires_at, created_at desc);
create index if not exists ptech_knowledge_documents_title_trgm_idx on public.ptech_knowledge_documents using gin (title gin_trgm_ops);
create index if not exists ptech_knowledge_chunks_document_id_idx on public.ptech_knowledge_chunks (document_id);
create index if not exists ptech_knowledge_chunks_content_trgm_idx on public.ptech_knowledge_chunks using gin (content gin_trgm_ops);
create index if not exists ptech_nineq_assessments_risk_created_idx on public.ptech_nineq_assessments (is_at_risk, created_at desc);

alter table public.ptech_knowledge_documents enable row level security;
alter table public.ptech_knowledge_chunks enable row level security;
alter table public.ptech_nineq_assessments enable row level security;

grant usage on schema public to service_role;
grant select, insert, update, delete on public.ptech_knowledge_documents to service_role;
grant select, insert, update, delete on public.ptech_knowledge_chunks to service_role;
grant select, insert, update, delete on public.ptech_nineq_assessments to service_role;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('ptech-knowledge', 'ptech-knowledge', false, 52428800, null)
on conflict (id) do nothing;
