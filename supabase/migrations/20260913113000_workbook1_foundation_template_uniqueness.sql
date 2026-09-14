begin;

create unique index if not exists speaking_question_sets_foundation_template_active_unique
    on public.speaking_question_sets(book_id, (generation_metadata ->> 'template_key'))
    where status <> 'archived'
      and generation_metadata ->> 'template_key' in (
          'workbook_1_alphabet_round_v1',
          'workbook_1_p14_letter_spelling_v1',
          'workbook_1_p15_letter_spelling_v1',
          'workbook_1_p16_letter_spelling_v1',
          'workbook_1_p17_letter_spelling_v1'
      );

commit;
