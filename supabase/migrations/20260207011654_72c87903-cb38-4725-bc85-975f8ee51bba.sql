-- Relax restrict_user_messages_updates to also allow updates via service_role or admins for conversation_id backfill
CREATE OR REPLACE FUNCTION public.restrict_user_messages_updates()
RETURNS TRIGGER AS $$
BEGIN
  -- Allow updates by admins
  IF public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RETURN NEW;
  END IF;

  -- Allow if auth context is null (service role / migration)
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  -- Non-admins: only allow marking as read (and never unread)
  IF NEW.user_id IS DISTINCT FROM OLD.user_id THEN
    RAISE EXCEPTION 'Not allowed';
  END IF;
  IF NEW.message IS DISTINCT FROM OLD.message THEN
    RAISE EXCEPTION 'Not allowed';
  END IF;
  IF NEW.sender_type IS DISTINCT FROM OLD.sender_type THEN
    RAISE EXCEPTION 'Not allowed';
  END IF;
  IF NEW.conversation_id IS DISTINCT FROM OLD.conversation_id THEN
    RAISE EXCEPTION 'Not allowed';
  END IF;
  IF NEW.parent_message_id IS DISTINCT FROM OLD.parent_message_id THEN
    RAISE EXCEPTION 'Not allowed';
  END IF;
  IF NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'Not allowed';
  END IF;

  IF OLD.is_read = true AND NEW.is_read = false THEN
    RAISE EXCEPTION 'Not allowed';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Now backfill: set conversation_id = user_id where they differ
UPDATE public.user_messages SET conversation_id = user_id;