-- 1. Add subscription expiration & promo code columns
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS subscription_end_date TIMESTAMP WITH TIME ZONE;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS promo_code TEXT;

-- Initialize existing max/pro users with 30 days if null (for legacy users)
UPDATE public.users 
SET subscription_end_date = CURRENT_TIMESTAMP + INTERVAL '30 days' 
WHERE plan != 'starter' AND subscription_end_date IS NULL;

-- 2. Trigger for Team Members Limit
CREATE OR REPLACE FUNCTION check_team_member_limit()
RETURNS TRIGGER AS $$
DECLARE
    owner_plan TEXT;
    owner_sub_end TIMESTAMP WITH TIME ZONE;
    current_count INTEGER;
    max_allowed INTEGER;
BEGIN
    -- Get the owner's plan and subscription status
    SELECT plan, subscription_end_date INTO owner_plan, owner_sub_end
    FROM public.users WHERE id = NEW.owner_id;

    -- If subscription is expired, treat as starter
    IF owner_sub_end IS NOT NULL AND CURRENT_TIMESTAMP > owner_sub_end THEN
        owner_plan := 'starter';
    END IF;

    -- Determine limit
    IF owner_plan = 'max' THEN
        max_allowed := 10;
    ELSIF owner_plan = 'pro' THEN
        max_allowed := 3;
    ELSE
        max_allowed := 0;
    END IF;

    -- Count existing team members
    SELECT COUNT(*) INTO current_count FROM public.team_members WHERE owner_id = NEW.owner_id;

    IF current_count >= max_allowed THEN
        RAISE EXCEPTION 'Team member limit reached for % plan (limit: %)', owner_plan, max_allowed;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_check_team_member_limit ON public.team_members;
CREATE TRIGGER trg_check_team_member_limit
BEFORE INSERT ON public.team_members
FOR EACH ROW
EXECUTE FUNCTION check_team_member_limit();

-- 3. Trigger for Bot Settings (Active Bots / Platforms & Languages)
CREATE OR REPLACE FUNCTION check_bot_settings_limit()
RETURNS TRIGGER AS $$
DECLARE
    owner_plan TEXT;
    owner_sub_end TIMESTAMP WITH TIME ZONE;
    lang_array TEXT[];
    lang TEXT;
    starter_allowed_langs TEXT[] := ARRAY['english', 'hindi', 'tamil'];
    pro_allowed_langs TEXT[] := ARRAY['english', 'hindi', 'tamil', 'telugu', 'kannada'];
BEGIN
    -- Get the owner's plan
    SELECT plan, subscription_end_date INTO owner_plan, owner_sub_end
    FROM public.users WHERE id = NEW.user_id;

    -- If subscription is expired, treat as starter
    IF owner_sub_end IS NOT NULL AND CURRENT_TIMESTAMP > owner_sub_end THEN
        owner_plan := 'starter';
    END IF;

    -- Check Platforms for Starter
    IF owner_plan = 'starter' THEN
        IF NEW.instagram_handle IS NOT NULL AND NEW.instagram_handle != '' THEN
            RAISE EXCEPTION 'Starter plan does not support Instagram bot. Please upgrade.';
        END IF;
        IF NEW.business_email IS NOT NULL AND NEW.business_email != '' THEN
            RAISE EXCEPTION 'Starter plan does not support Email bot. Please upgrade.';
        END IF;
    END IF;

    -- Check Languages
    IF NEW.languages IS NOT NULL THEN
        lang_array := ARRAY(SELECT jsonb_array_elements_text(NEW.languages));
        
        FOREACH lang IN ARRAY lang_array
        LOOP
            IF owner_plan = 'starter' AND NOT (lang = ANY(starter_allowed_langs)) THEN
                RAISE EXCEPTION 'Language % is not supported on the Starter plan. Please upgrade.', lang;
            END IF;
            IF owner_plan = 'pro' AND NOT (lang = ANY(pro_allowed_langs)) THEN
                RAISE EXCEPTION 'Language % is not supported on the Pro plan. Please upgrade to Max.', lang;
            END IF;
        END LOOP;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_check_bot_settings_limit ON public.bot_settings;
CREATE TRIGGER trg_check_bot_settings_limit
BEFORE INSERT OR UPDATE ON public.bot_settings
FOR EACH ROW
EXECUTE FUNCTION check_bot_settings_limit();

-- 4. Function for Lead CRM Extraction (to enforce limits)
-- This replaces the direct `from('leads').select('*')` query in the frontend.
CREATE OR REPLACE FUNCTION get_leads_for_user(req_user_id UUID)
RETURNS TABLE (
    id UUID,
    name TEXT,
    phone TEXT,
    channel TEXT,
    message TEXT,
    lead_score TEXT,
    created_at TIMESTAMP WITH TIME ZONE
) AS $$
DECLARE
    owner_plan TEXT;
    owner_sub_end TIMESTAMP WITH TIME ZONE;
    max_leads INTEGER;
BEGIN
    -- Get plan
    SELECT plan, subscription_end_date INTO owner_plan, owner_sub_end
    FROM public.users WHERE users.id = req_user_id;

    -- Expired check
    IF owner_sub_end IS NOT NULL AND CURRENT_TIMESTAMP > owner_sub_end THEN
        owner_plan := 'starter';
    END IF;

    -- Set limit
    IF owner_plan = 'max' THEN
        max_leads := NULL; -- unlimited
    ELSIF owner_plan = 'pro' THEN
        max_leads := 500;
    ELSE
        max_leads := 10;
    END IF;

    IF max_leads IS NULL THEN
        RETURN QUERY
        SELECT leads.id, leads.name, leads.phone, leads.channel, leads.message, leads.lead_score, leads.created_at
        FROM public.leads
        WHERE leads.user_id = req_user_id
        ORDER BY leads.created_at DESC;
    ELSE
        RETURN QUERY
        SELECT leads.id, leads.name, leads.phone, leads.channel, leads.message, leads.lead_score, leads.created_at
        FROM public.leads
        WHERE leads.user_id = req_user_id
        ORDER BY leads.created_at DESC
        LIMIT max_leads;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
