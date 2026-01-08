DO $$
DECLARE
  t TEXT;
  tables TEXT[] := ARRAY[
    'admin_users',
    'admin_activity_log',
    'brand_domains',
    'brand_user_assignments',
    'shared_templates',
    'cross_brand_analytics'
  ];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    IF to_regclass('public.' || t) IS NOT NULL THEN
      EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);

      IF NOT EXISTS (
        SELECT 1
        FROM pg_policies
        WHERE schemaname = 'public'
          AND tablename = t
          AND policyname = format('Service role can do everything on %s', t)
      ) THEN
        EXECUTE format(
          'CREATE POLICY %L ON public.%I FOR ALL USING (auth.role() = ''service_role'')',
          format('Service role can do everything on %s', t),
          t
        );
      END IF;
    END IF;
  END LOOP;
END $$;
