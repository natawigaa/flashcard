-- 003_add_notes.sql
-- Add notes text column to flashcards so exports can include notes
ALTER TABLE flashcards
  ADD COLUMN IF NOT EXISTS notes text;
