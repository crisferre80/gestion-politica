-- 20250527180000_create_messages_table.sql
-- Crea la tabla de mensajes y las políticas RLS para chat entre residentes y recicladores

CREATE TABLE IF NOT EXISTS public.messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id uuid NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
  receiver_id uuid NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_messages_sender_id ON public.messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_messages_receiver_id ON public.messages(receiver_id);

ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read their own messages"
  ON public.messages
  FOR SELECT
  USING (
    sender_id = auth.uid() OR receiver_id = auth.uid()
  );

CREATE POLICY "Users can send messages as sender"
  ON public.messages
  FOR INSERT
  WITH CHECK (
    sender_id = auth.uid()
    AND sender_id <> receiver_id
    AND EXISTS (SELECT 1 FROM profiles p WHERE p.user_id = sender_id)
    AND EXISTS (SELECT 1 FROM profiles p WHERE p.user_id = receiver_id)
  );

CREATE POLICY "Users can delete their own sent messages"
  ON public.messages
  FOR DELETE
  USING (
    sender_id = auth.uid()
  );
