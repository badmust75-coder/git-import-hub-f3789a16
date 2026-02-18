
-- Create student_ranking table to centralize points
CREATE TABLE public.student_ranking (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  total_points integer NOT NULL DEFAULT 0,
  sourates_points integer NOT NULL DEFAULT 0,
  nourania_points integer NOT NULL DEFAULT 0,
  ramadan_points integer NOT NULL DEFAULT 0,
  alphabet_points integer NOT NULL DEFAULT 0,
  invocations_points integer NOT NULL DEFAULT 0,
  prayer_points integer NOT NULL DEFAULT 0,
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.student_ranking ENABLE ROW LEVEL SECURITY;

-- Everyone can read rankings
CREATE POLICY "Anyone can read rankings"
  ON public.student_ranking FOR SELECT
  USING (true);

-- Admins can manage rankings
CREATE POLICY "Admins can manage rankings"
  ON public.student_ranking FOR ALL
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));

-- Users can read their own ranking (covered by the SELECT above)

-- Create trigger to update updated_at
CREATE TRIGGER update_student_ranking_updated_at
  BEFORE UPDATE ON public.student_ranking
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Create a function to recalculate points for a user
CREATE OR REPLACE FUNCTION public.recalculate_student_points(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sourates int;
  v_nourania int;
  v_ramadan int;
  v_alphabet int;
  v_invocations int;
  v_prayer int;
  v_total int;
BEGIN
  -- Sourates: 10 points per validated sourate
  SELECT COALESCE(COUNT(*) * 10, 0) INTO v_sourates
  FROM user_sourate_progress WHERE user_id = p_user_id AND is_validated = true;

  -- Nourania: 15 points per validated lesson
  SELECT COALESCE(COUNT(*) * 15, 0) INTO v_nourania
  FROM user_nourania_progress WHERE user_id = p_user_id AND is_validated = true;

  -- Ramadan: 5 points per completed day (video + quiz)
  SELECT COALESCE(COUNT(*) * 5, 0) INTO v_ramadan
  FROM user_ramadan_progress WHERE user_id = p_user_id AND video_watched = true AND quiz_completed = true;

  -- Alphabet: 5 points per validated letter
  SELECT COALESCE(COUNT(*) * 5, 0) INTO v_alphabet
  FROM user_alphabet_progress WHERE user_id = p_user_id AND is_validated = true;

  -- Invocations: 5 points per memorized invocation
  SELECT COALESCE(COUNT(*) * 5, 0) INTO v_invocations
  FROM user_invocation_progress WHERE user_id = p_user_id AND is_memorized = true;

  -- Prayer: 10 points per validated category
  SELECT COALESCE(COUNT(*) * 10, 0) INTO v_prayer
  FROM user_prayer_progress WHERE user_id = p_user_id AND is_validated = true;

  v_total := v_sourates + v_nourania + v_ramadan + v_alphabet + v_invocations + v_prayer;

  INSERT INTO student_ranking (user_id, total_points, sourates_points, nourania_points, ramadan_points, alphabet_points, invocations_points, prayer_points)
  VALUES (p_user_id, v_total, v_sourates, v_nourania, v_ramadan, v_alphabet, v_invocations, v_prayer)
  ON CONFLICT (user_id) DO UPDATE SET
    total_points = v_total,
    sourates_points = v_sourates,
    nourania_points = v_nourania,
    ramadan_points = v_ramadan,
    alphabet_points = v_alphabet,
    invocations_points = v_invocations,
    prayer_points = v_prayer;
END;
$$;

-- Create triggers on all progress tables to auto-recalculate points
CREATE OR REPLACE FUNCTION public.trigger_recalculate_points()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.recalculate_student_points(COALESCE(NEW.user_id, OLD.user_id));
  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE TRIGGER recalc_points_sourate
  AFTER INSERT OR UPDATE ON public.user_sourate_progress
  FOR EACH ROW EXECUTE FUNCTION public.trigger_recalculate_points();

CREATE TRIGGER recalc_points_nourania
  AFTER INSERT OR UPDATE ON public.user_nourania_progress
  FOR EACH ROW EXECUTE FUNCTION public.trigger_recalculate_points();

CREATE TRIGGER recalc_points_ramadan
  AFTER INSERT OR UPDATE ON public.user_ramadan_progress
  FOR EACH ROW EXECUTE FUNCTION public.trigger_recalculate_points();

CREATE TRIGGER recalc_points_alphabet
  AFTER INSERT OR UPDATE ON public.user_alphabet_progress
  FOR EACH ROW EXECUTE FUNCTION public.trigger_recalculate_points();

CREATE TRIGGER recalc_points_invocations
  AFTER INSERT OR UPDATE ON public.user_invocation_progress
  FOR EACH ROW EXECUTE FUNCTION public.trigger_recalculate_points();

CREATE TRIGGER recalc_points_prayer
  AFTER INSERT OR UPDATE ON public.user_prayer_progress
  FOR EACH ROW EXECUTE FUNCTION public.trigger_recalculate_points();

-- Enable realtime for rankings
ALTER PUBLICATION supabase_realtime ADD TABLE public.student_ranking;
