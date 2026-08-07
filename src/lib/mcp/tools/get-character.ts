import { defineTool } from "@lovable.dev/mcp-js";
import { supabaseForUser } from "../supabase";
import { levelFromXp } from "@/game/progression";
import { SKILL_IDS, type SaveState } from "@/game/types";

export default defineTool({
  name: "get_character",
  title: "Get character",
  description:
    "Get the signed-in Tomlandia adventurer's character sheet: name, gold, health, equipment, skill levels and active quest.",
  inputSchema: {},
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async (_input, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    }
    const supabase = supabaseForUser(ctx);
    const [{ data: profile }, { data: row, error }] = await Promise.all([
      supabase.from("profiles").select("username").eq("id", ctx.getUserId()).maybeSingle(),
      supabase.from("player_saves").select("data").eq("user_id", ctx.getUserId()).maybeSingle(),
    ]);
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    const save = (row?.data as unknown as SaveState | undefined) ?? null;
    if (!save) {
      return { content: [{ type: "text", text: "No saved character yet — play the game once to create one." }] };
    }

    const skills = Object.fromEntries(
      SKILL_IDS.map((id) => {
        const xp = save.skills?.[id]?.xp ?? 0;
        const { level, into, need } = levelFromXp(xp);
        return [id, { level, xp, xpIntoLevel: into, xpToNextLevel: need }];
      }),
    );
    const character = {
      name: profile?.username ?? "Adventurer",
      gold: save.gold ?? 0,
      hp: save.hp ?? 0,
      weapon: save.weapon ?? null,
      armor: save.armor ?? null,
      food: save.food ?? null,
      skills,
      combatLevel: skills["combat"]?.level ?? 1,
      activeQuest: save.quest ?? null,
      completedQuests: save.completed ?? [],
      discoveredRegions: save.discovered ?? [],
    };
    return {
      content: [{ type: "text", text: JSON.stringify(character, null, 2) }],
      structuredContent: { character },
    };
  },
});
