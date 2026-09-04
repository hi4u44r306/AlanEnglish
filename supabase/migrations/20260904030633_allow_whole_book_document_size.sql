begin;

set local lock_timeout = '5s';

alter table public.speaking_source_documents
    drop constraint if exists speaking_source_documents_byte_size_check;

alter table public.speaking_source_documents
    add constraint speaking_source_documents_byte_size_check
    check (
        byte_size is null
        or (
            byte_size >= 1
            and byte_size <= case
                when chunk_count is null then 20971520
                else 104857600
            end
        )
    );

comment on constraint speaking_source_documents_byte_size_check
    on public.speaking_source_documents is
    'Single source files remain limited to 20MB; chunked whole-book source PDFs may be up to 100MB.';

commit;
