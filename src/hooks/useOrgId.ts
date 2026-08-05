import { getCurrentOrgId } from "@/lib/supabase";

export function useOrgId() {
  return getCurrentOrgId();
}
