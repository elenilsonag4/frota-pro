
const SUPABASE_URL = "https://uodbvprmzqnyfzariknr.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_YM3vDCaih_tGUbAh_HZoHA_wgyfO3R_";

window.frotaSupabase = window.supabase.createClient(
  SUPABASE_URL,
  SUPABASE_ANON_KEY
);
