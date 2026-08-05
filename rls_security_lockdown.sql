-- 1. SECURE THE `users` TABLE
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own profile" ON public.users;
CREATE POLICY "Users can view own profile" ON public.users
    FOR SELECT USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update own profile" ON public.users;
CREATE POLICY "Users can update own profile" ON public.users
    FOR UPDATE USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "Users can insert own profile" ON public.users;
CREATE POLICY "Users can insert own profile" ON public.users
    FOR INSERT WITH CHECK (auth.uid() = id);

-- 2. SECURE THE `bot_settings` TABLE
ALTER TABLE public.bot_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own bot settings" ON public.bot_settings;
CREATE POLICY "Users can view own bot settings" ON public.bot_settings
    FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own bot settings" ON public.bot_settings;
CREATE POLICY "Users can insert own bot settings" ON public.bot_settings
    FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own bot settings" ON public.bot_settings;
CREATE POLICY "Users can update own bot settings" ON public.bot_settings
    FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own bot settings" ON public.bot_settings;
CREATE POLICY "Users can delete own bot settings" ON public.bot_settings
    FOR DELETE USING (auth.uid() = user_id);

-- 3. SECURE THE `leads` TABLE
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own leads" ON public.leads;
CREATE POLICY "Users can view own leads" ON public.leads
    FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own leads" ON public.leads;
CREATE POLICY "Users can insert own leads" ON public.leads
    FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own leads" ON public.leads;
CREATE POLICY "Users can update own leads" ON public.leads
    FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own leads" ON public.leads;
CREATE POLICY "Users can delete own leads" ON public.leads
    FOR DELETE USING (auth.uid() = user_id);

-- 4. SECURE THE `faqs` TABLE
ALTER TABLE public.faqs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own faqs" ON public.faqs;
CREATE POLICY "Users can view own faqs" ON public.faqs
    FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own faqs" ON public.faqs;
CREATE POLICY "Users can insert own faqs" ON public.faqs
    FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own faqs" ON public.faqs;
CREATE POLICY "Users can update own faqs" ON public.faqs
    FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own faqs" ON public.faqs;
CREATE POLICY "Users can delete own faqs" ON public.faqs
    FOR DELETE USING (auth.uid() = user_id);
