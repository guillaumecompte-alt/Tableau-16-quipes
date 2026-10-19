CREATE TABLE public.padel_tournaments (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 owner_id uuid NOT NULL DEFAULT auth.uid(),
 title text NOT NULL DEFAULT 'P100 · Ze Padel',
 state jsonb NOT NULL DEFAULT '{}'::jsonb,
 updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(owner_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.padel_tournaments TO authenticated;
GRANT ALL ON public.padel_tournaments TO service_role;
ALTER TABLE public.padel_tournaments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owners read their tournaments" ON public.padel_tournaments FOR SELECT TO authenticated USING (owner_id = auth.uid());
CREATE POLICY "Owners create their tournaments" ON public.padel_tournaments FOR INSERT TO authenticated WITH CHECK (owner_id = auth.uid());
CREATE POLICY "Owners update their tournaments" ON public.padel_tournaments FOR UPDATE TO authenticated USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());
CREATE POLICY "Owners delete their tournaments" ON public.padel_tournaments FOR DELETE TO authenticated USING (owner_id = auth.uid());