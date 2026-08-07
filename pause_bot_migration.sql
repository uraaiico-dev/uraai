-- Migration: Add AI Pause toggle to leads table
ALTER TABLE leads ADD COLUMN is_ai_paused BOOLEAN DEFAULT false;
