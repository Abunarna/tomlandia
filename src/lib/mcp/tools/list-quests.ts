import { defineTool } from "@lovable.dev/mcp-js";
import { QUESTS } from "@/game/data";

export default defineTool({
  name: "list_quests",
  title: "List quests",
  description: "List every quest available in Tomlandia, with its objective and rewards.",
  inputSchema: {},
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: () => {
    const quests = QUESTS.map((q) => ({
      id: q.id,
      name: q.name,
      description: q.desc,
      kind: q.kind,
      target: q.key,
      count: q.count,
      goldReward: q.gold,
      xpReward: { skill: q.xpSkill, xp: q.xp },
      itemReward: q.reward ?? null,
    }));
    return {
      content: [
        {
          type: "text",
          text: quests.map((q) => `${q.name} — ${q.description} (${q.goldReward}g)`).join("\n"),
        },
      ],
      structuredContent: { quests },
    };
  },
});
