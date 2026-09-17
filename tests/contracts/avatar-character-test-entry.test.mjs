import { describe, expect, test } from "bun:test";
import { readFile } from "node:fs/promises";

describe("character test entry point", () => {
  test("replaces the knight debug panel with a character creator link", async () => {
    const playRoute = await readFile("src/routes/_authenticated/play.tsx", "utf8");
    const button = await readFile("src/components/game/CharacterTestButton.tsx", "utf8");
    const creator = await readFile("src/routes/character-test.tsx", "utf8");
    const oldRoute = await readFile("src/routes/character-creation.tsx", "utf8");

    expect(playRoute).toContain("<CharacterTestButton />");
    expect(playRoute).not.toContain("<KnightDebug");
    expect(button).toContain('href="/character-test"');
    expect(button).toContain("Character test");
    expect(creator).not.toContain("VITE_AVATAR_CREATOR");
    expect(creator).toContain("return <CharacterCreator />");
    expect(creator).toContain('to="/play"');
    expect(creator).not.toContain("frames ·");
    expect(creator).toContain("Exact checked-in files");
    expect(creator).toContain("src={entry.url}");
    expect(creator).toContain("Candidate pixel-art source layers");
    expect(oldRoute).toContain('redirect({ to: "/character-test", replace: true })');
  });
});
