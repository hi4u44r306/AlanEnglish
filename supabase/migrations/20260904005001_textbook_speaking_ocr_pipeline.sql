begin;

alter table public.speaking_source_documents
    add column if not exists byte_size bigint,
    add column if not exists ocr_status text not null default 'not_requested',
    add column if not exists ocr_model text,
    add column if not exists ocr_error_code text,
    add column if not exists ocr_input_tokens integer not null default 0,
    add column if not exists ocr_output_tokens integer not null default 0,
    add column if not exists ocr_total_tokens integer not null default 0,
    add column if not exists ocr_started_at timestamptz,
    add column if not exists ocr_completed_at timestamptz;

do $$
begin
    if not exists (select 1 from pg_constraint where conname = 'speaking_source_documents_byte_size_check') then
        alter table public.speaking_source_documents
            add constraint speaking_source_documents_byte_size_check
            check (byte_size is null or byte_size between 1 and 20971520);
    end if;
    if not exists (select 1 from pg_constraint where conname = 'speaking_source_documents_ocr_status_check') then
        alter table public.speaking_source_documents
            add constraint speaking_source_documents_ocr_status_check
            check (ocr_status in ('not_requested', 'processing', 'review_required', 'completed', 'failed'));
    end if;
    if not exists (select 1 from pg_constraint where conname = 'speaking_source_documents_ocr_tokens_check') then
        alter table public.speaking_source_documents
            add constraint speaking_source_documents_ocr_tokens_check
            check (ocr_input_tokens >= 0 and ocr_output_tokens >= 0 and ocr_total_tokens >= 0);
    end if;
end $$;

create index if not exists speaking_source_documents_ocr_status_idx
    on public.speaking_source_documents(ocr_status, updated_at desc);

comment on column public.speaking_source_documents.private_object_key is
    'Private Cloudflare R2 object key. Never expose a public object URL.';
comment on column public.speaking_source_documents.ocr_status is
    'OCR lifecycle. Extracted text remains review_required until an administrator confirms it.';

commit;
