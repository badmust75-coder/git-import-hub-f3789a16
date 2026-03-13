
CREATE TABLE IF NOT EXISTS public.devoirs (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  titre text NOT NULL,
  type text NOT NULL CHECK (type IN ('sourate', 'nourania', 'recitation', 'exercice_pdf', 'autre')),
  description text,
  lien_lecon text,
  fichier_pdf_url text,
  date_limite timestamptz,
  assigned_to text NOT NULL CHECK (assigned_to IN ('all', 'group', 'student')),
  group_id uuid REFERENCES public.student_groups(id),
  student_id uuid,
  created_by uuid,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.devoirs_rendus (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  devoir_id uuid REFERENCES public.devoirs(id) ON DELETE CASCADE,
  student_id uuid NOT NULL,
  audio_url text,
  statut text DEFAULT 'rendu' CHECK (statut IN ('rendu', 'corrige', 'a_refaire')),
  commentaire_admin text,
  rendu_at timestamptz DEFAULT now()
);

ALTER TABLE public.devoirs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.devoirs_rendus ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_manage_devoirs" ON public.devoirs
FOR ALL TO authenticated
USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "students_read_devoirs" ON public.devoirs
FOR SELECT TO authenticated
USING (
  assigned_to = 'all'
  OR student_id = auth.uid()
  OR group_id IN (
    SELECT group_id FROM public.student_group_members WHERE user_id = auth.uid()
  )
);

CREATE POLICY "admin_manage_rendus" ON public.devoirs_rendus
FOR ALL TO authenticated
USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "students_manage_own_rendus" ON public.devoirs_rendus
FOR ALL TO authenticated
USING (student_id = auth.uid())
WITH CHECK (student_id = auth.uid());

INSERT INTO storage.buckets (id, name, public)
VALUES ('devoirs-audios', 'devoirs-audios', false)
ON CONFLICT DO NOTHING;

CREATE POLICY "Users can upload own audio" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'devoirs-audios' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Users can read own audio" ON storage.objects
FOR SELECT TO authenticated
USING (bucket_id = 'devoirs-audios' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Admins can read all audio" ON storage.objects
FOR SELECT TO authenticated
USING (bucket_id = 'devoirs-audios' AND has_role(auth.uid(), 'admin'));
