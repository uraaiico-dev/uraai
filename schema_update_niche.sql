ALTER TABLE public.bot_settings 
ADD COLUMN IF NOT EXISTS business_category TEXT DEFAULT 'general',
ADD COLUMN IF NOT EXISTS primary_goal TEXT DEFAULT 'general',
ADD COLUMN IF NOT EXISTS niche_config JSONB DEFAULT '{}'::jsonb;

ALTER TABLE public.leads 
ADD COLUMN IF NOT EXISTS lead_score INT DEFAULT 50,
ADD COLUMN IF NOT EXISTS intent_label TEXT DEFAULT 'General';

-- Index for fast lead filtering in Live Inbox
CREATE INDEX IF NOT EXISTS idx_leads_intent ON public.leads(user_id, intent_label);
