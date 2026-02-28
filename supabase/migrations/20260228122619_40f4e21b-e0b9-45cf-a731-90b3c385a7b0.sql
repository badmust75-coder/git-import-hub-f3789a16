
-- Table to track individual video watches per user per day
CREATE TABLE public.user_ramadan_video_watched (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  day_id integer NOT NULL REFERENCES public.ramadan_days(id),
  video_id uuid NOT NULL,
  watched_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Unique constraint: one record per user/video
ALTER TABLE public.user_ramadan_video_watched ADD CONSTRAINT unique_user_video UNIQUE (user_id, video_id);

-- RLS
ALTER TABLE public.user_ramadan_video_watched ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own video watches"
  ON public.user_ramadan_video_watched FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can view all video watches"
  ON public.user_ramadan_video_watched FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));
