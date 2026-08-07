import { auth, defineMcp, type AnyToolDefinition } from "@lovable.dev/mcp-js";
import getCharacter from "./tools/get-character";
import listInventory from "./tools/list-inventory";
import browseMarket from "./tools/browse-market";
import listQuests from "./tools/list-quests";

// The OAuth issuer must be the direct Supabase host; the project ref is the only
// value that survives publish unchanged.
const projectRef = import.meta.env['VITE_SUPABASE_PROJECT_ID'] ?? "project-ref-unset";

export default defineMcp({
  name: "tomlandia",
  title: "Tomlandia",
  version: "0.1.0",
  instructions:
    "Tools for Tomlandia, a cozy pixel idle RPG. Use `get_character` for the signed-in adventurer's stats, `list_inventory` for their bag, `browse_market` for the shared player marketplace, and `list_quests` for available quests.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [getCharacter, listInventory, browseMarket, listQuests] as unknown as AnyToolDefinition[],
});
