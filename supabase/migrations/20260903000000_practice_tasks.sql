-- ============================================================================
-- Das Aufgabenboard der Praxis.
--
-- Bewusst neben `buildDashboardWorklist`, nicht darin: die Worklist leitet
-- ab, was die Daten ohnehin schon sagen (offener Plan, neuer Fragebogen).
-- Diese Tabelle hält das, was nirgendwo sonst steht, weil es jemand von Hand
-- notiert hat — "Kühlschrank Praxis pruefen", "Rückruf Kasse".
--
-- `position` ist float8, damit eine Karte zwischen zwei andere geschoben
-- werden kann, ohne die ganze Spalte neu zu nummerieren: die neue Position ist
-- die Mitte der beiden Nachbarn. Der Preis ist, dass die Abstaende bei sehr
-- vielen Verschiebungen an derselben Stelle irgendwann klein werden; bei einem
-- Board von der Größe einer Praxisliste ist das kein realistischer Fall.
--
-- `completed_at` ist abgeleitet, wird aber gespeichert statt berechnet: nur so
-- lässt sich spaeter "in dieser Woche erledigt" beantworten, ohne eine
-- Historie einzufuehren.
-- ============================================================================

CREATE TABLE practice_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL CHECK (length(trim(title)) > 0),
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'todo' CHECK (status IN ('todo', 'in_progress', 'done')),
  priority TEXT NOT NULL DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high')),
  due_date DATE,
  position DOUBLE PRECISION NOT NULL DEFAULT 0,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Das Board liest immer eine Spalte eines Nutzers, sortiert nach position.
CREATE INDEX practice_tasks_board_idx
  ON practice_tasks (user_id, status, position, created_at);

CREATE TRIGGER practice_tasks_updated_at
  BEFORE UPDATE ON practice_tasks
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE practice_tasks IS
  'Handgeschriebene Aufgaben des Dashboard-Boards. Abgeleitete Arbeit steht in lib/dashboard-worklist.ts.';

COMMENT ON COLUMN practice_tasks.position IS
  'Sortierung innerhalb der Spalte. Einfügen zwischen zwei Karten nimmt die Mitte der Nachbarpositionen.';

ALTER TABLE practice_tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "practice_tasks_select_own" ON practice_tasks
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "practice_tasks_insert_own" ON practice_tasks
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "practice_tasks_update_own" ON practice_tasks
  FOR UPDATE USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "practice_tasks_delete_own" ON practice_tasks
  FOR DELETE USING (user_id = auth.uid());
