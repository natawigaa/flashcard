-- 001_init.sql
-- Initial schema for Flashcards app: profiles, decks, flashcards, collaborators, study_sessions
-- Includes triggers to maintain deck.card_count and example RLS policies for Supabase

-- Enable uuid generator (pgcrypto provides gen_random_uuid)
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Profiles (linked to auth.users)
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username text UNIQUE,
  full_name text,
  avatar_url text,
  metadata jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Decks: a collection of flashcards
CREATE TABLE IF NOT EXISTS decks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  is_public boolean DEFAULT false,
  cover_image_url text,
  card_count integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT decks_owner_title_unique UNIQUE (owner, title)
);

-- Flashcards: each belongs to a deck
CREATE TABLE IF NOT EXISTS flashcards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  deck_id uuid NOT NULL REFERENCES decks(id) ON DELETE CASCADE,
  front text,
  back text,
  front_image_url text,
  back_image_url text,
  position integer DEFAULT 0,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Optional: collaborators / shared access to a deck
CREATE TABLE IF NOT EXISTS deck_collaborators (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  deck_id uuid NOT NULL REFERENCES decks(id) ON DELETE CASCADE,
  collaborator uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  role text DEFAULT 'editor',
  created_at timestamptz DEFAULT now(),
  UNIQUE (deck_id, collaborator)
);

-- Optional: study session tracking (simple)
CREATE TABLE IF NOT EXISTS study_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  deck_id uuid NOT NULL REFERENCES decks(id) ON DELETE CASCADE,
  score integer,
  duration_seconds integer,
  created_at timestamptz DEFAULT now()
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_decks_owner ON decks(owner);
CREATE INDEX IF NOT EXISTS idx_flashcards_deck_id ON flashcards(deck_id);
CREATE INDEX IF NOT EXISTS idx_flashcards_position ON flashcards(deck_id, position);

-- Trigger function to maintain decks.card_count automatically
CREATE OR REPLACE FUNCTION app_handle_flashcard_count() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE decks SET card_count = card_count + 1 WHERE id = NEW.deck_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE decks SET card_count = GREATEST(card_count - 1, 0) WHERE id = OLD.deck_id;
    RETURN OLD;
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.deck_id <> OLD.deck_id THEN
      UPDATE decks SET card_count = GREATEST(card_count - 1, 0) WHERE id = OLD.deck_id;
      UPDATE decks SET card_count = card_count + 1 WHERE id = NEW.deck_id;
    END IF;
    RETURN NEW;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Attach triggers
DROP TRIGGER IF EXISTS flashcards_count_trigger_insert ON flashcards;
CREATE TRIGGER flashcards_count_trigger_insert
AFTER INSERT ON flashcards
FOR EACH ROW EXECUTE FUNCTION app_handle_flashcard_count();

DROP TRIGGER IF EXISTS flashcards_count_trigger_delete ON flashcards;
CREATE TRIGGER flashcards_count_trigger_delete
AFTER DELETE ON flashcards
FOR EACH ROW EXECUTE FUNCTION app_handle_flashcard_count();

DROP TRIGGER IF EXISTS flashcards_count_trigger_update ON flashcards;
CREATE TRIGGER flashcards_count_trigger_update
AFTER UPDATE ON flashcards
FOR EACH ROW EXECUTE FUNCTION app_handle_flashcard_count();

-- Example Row-Level Security (RLS) policies for Supabase
-- Enable RLS on the tables
ALTER TABLE IF EXISTS decks ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS flashcards ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS profiles ENABLE ROW LEVEL SECURITY;

-- decks: owner can manage; others can SELECT if is_public
CREATE POLICY decks_owner_manage ON decks
  FOR ALL
  USING (auth.uid() = owner)
  WITH CHECK (auth.uid() = owner);

CREATE POLICY decks_public_read ON decks
  FOR SELECT
  USING (is_public OR auth.uid() = owner);

-- profiles: users can manage their own profile
CREATE POLICY profiles_self ON profiles
  FOR ALL
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- flashcards: allow operations only if the current user owns the deck
CREATE POLICY flashcards_deck_owner ON flashcards
  FOR ALL
  USING (EXISTS (SELECT 1 FROM decks WHERE id = flashcards.deck_id AND owner = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM decks WHERE id = flashcards.deck_id AND owner = auth.uid()));

-- If you want collaborator-based policies, add policies that check deck_collaborators table
-- e.g. allow editors to insert/update/delete flashcards for decks where they are collaborators

-- End of migration
