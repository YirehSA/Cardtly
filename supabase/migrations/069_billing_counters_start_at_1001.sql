-- Migration 069: quotes, invoices and credit notes start at 1001
--
-- 064 started every counter at 1, so the first document out the door would be
-- INV-2026-0001. Starting at 1001 is the ordinary thing to do and costs
-- nothing: it does not announce to the first client that they are the first
-- client.
--
-- All three, so a credit note against INV-2026-1001 does not come back as
-- CN-2026-0001 and read like it came from a different system.
--
-- GUARDED, and the guard is the point. This may only move a counter that has
-- never issued anything. Run again later, after real documents exist, it does
-- nothing at all - because winding a counter backwards would hand out a number
-- that is already on a document somebody has, and the unique constraint would
-- then reject the second one at the worst possible moment.

do $$
declare
  v_doc_type text;
  v_issued   integer;
begin
  foreach v_doc_type in array array['quote', 'invoice', 'credit_note'] loop
    -- How many documents of this type have ever been numbered.
    if v_doc_type = 'quote' then
      select count(*) into v_issued from public.quotes where number is not null;
    elsif v_doc_type = 'invoice' then
      select count(*) into v_issued from public.invoices where number is not null;
    else
      select count(*) into v_issued from public.credit_notes where number is not null;
    end if;

    if v_issued = 0 then
      update public.billing_counters
         set next_value = 1001
       where doc_type = v_doc_type
         -- Only a counter still sitting at its default. One that has been moved
         -- on purpose is somebody's decision, not ours to overwrite.
         and next_value <= 1001;
    end if;
  end loop;
end $$;

comment on table public.billing_counters is
  'Gapless per-type document numbering, starting at 1001. The counter row is locked FOR UPDATE while a number is issued, so a rolled-back issue returns the number rather than burning it.';
