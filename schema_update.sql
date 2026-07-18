-- Add new fields to users table for plan-gated features
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS broadcast_count_this_month INTEGER DEFAULT 0;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS broadcast_reset_date DATE DEFAULT CURRENT_DATE;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS team_role TEXT DEFAULT 'admin'; -- admin, staff

-- Add lead scoring field to leads table
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS lead_score TEXT; -- 'hot', 'warm', 'cold', or null if not scored
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS follow_up_sent BOOLEAN DEFAULT false;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS follow_up_step INTEGER DEFAULT 0; -- 0, 1, 2, 3 for Max multi-step

-- Create team_members table (Pro = 3 seats, Max = 10 seats)
CREATE TABLE IF NOT EXISTS public.team_members (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    owner_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
    member_email TEXT NOT NULL,
    role TEXT DEFAULT 'staff', -- admin, staff
    invited_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    accepted BOOLEAN DEFAULT false
);

ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owners manage own team" ON public.team_members
  FOR ALL USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);

-- WhatsApp message logs
CREATE TABLE IF NOT EXISTS public.whatsapp_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
    direction TEXT NOT NULL, -- 'inbound' or 'outbound'
    from_number TEXT NOT NULL,
    to_number TEXT NOT NULL,
    message_body TEXT NOT NULL,
    ai_reply TEXT,
    status TEXT DEFAULT 'received', -- received, replied, failed
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.whatsapp_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own logs" ON public.whatsapp_logs
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Add WhatsApp Business API credentials per user
ALTER TABLE public.users 
ADD COLUMN IF NOT EXISTS waba_id TEXT,
ADD COLUMN IF NOT EXISTS phone_number_id TEXT,
ADD COLUMN IF NOT EXISTS wa_access_token TEXT,
ADD COLUMN IF NOT EXISTS wa_connected BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS wa_display_name TEXT,
ADD COLUMN IF NOT EXISTS wa_phone_number TEXT;

-- Make sure existing users have wa_connected set to false rather than NULL
UPDATE public.users 
SET wa_connected = false 
WHERE wa_connected IS NULL;

-- Add wa_phone_number to bot_settings for routing
-- (already added to users table earlier, now need it in bot_settings too)
ALTER TABLE public.bot_settings 
ADD COLUMN IF NOT EXISTS wa_phone_number TEXT,
ADD COLUMN IF NOT EXISTS wa_number_id TEXT,
ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;

-- Create index for fast routing lookups
CREATE INDEX IF NOT EXISTS idx_bot_settings_wa_phone 
ON public.bot_settings(wa_phone_number);

-- Add reply count tracking for usage limits
ALTER TABLE public.bot_settings
ADD COLUMN IF NOT EXISTS reply_count_this_month INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS reply_reset_date DATE DEFAULT CURRENT_DATE;
