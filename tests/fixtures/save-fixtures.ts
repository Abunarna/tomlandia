import { skillIds, type StoredSaveContract } from "../../src/contracts/save";

const skills = Object.fromEntries(skillIds.map((id) => [id, { xp: 0 }]));

export function baseSave(): StoredSaveContract {
  return {
    v: 3,
    px: 700,
    py: 2400,
    hp: 30,
    gold: 0,
    inv: [],
    bank: { gold: 0, items: [] },
    skills: structuredClone(skills),
    weapon: { id: "wooden_club", plus: 0 },
    armor: { id: "copper_light_armor", plus: 0 },
    food: null,
    autoEatAt: 0.5,
    quest: null,
    completed: [],
    discovered: ["fields"],
    clock: 0.35,
  };
}

export const edgeSaveFixtures = {
  null_slots: {
    ...baseSave(),
    inv: [null, { id: "copper_ore", qty: 4 }, null],
  },
  short_bank: {
    ...baseSave(),
    bank: { gold: 17, items: [null, { id: "oak_logs", qty: 9 }, null] },
  },
  full_bag: {
    ...baseSave(),
    inv: Array.from({ length: 20 }, (_, index) => ({ id: `test_item_${index}`, qty: index + 1 })),
  },
  upgraded_gear: {
    ...baseSave(),
    inv: [{ id: "steel_sword", qty: 1, plus: 31 }],
    weapon: { id: "mithril_blade", plus: 100 },
    armor: "steel_heavy_armor",
  },
  active_buff: {
    ...baseSave(),
    inv: [{ id: "minor_venom_draught", qty: 2 }],
    buff: { dmg: 7, hits: 12, item: "minor_venom_draught" },
  },
} satisfies Record<string, StoredSaveContract>;

function lcg(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1_664_525) + 1_013_904_223) >>> 0;
    return state / 0x1_0000_0000;
  };
}

/** Deterministic property-style cases: broad state coverage without another dependency. */
export function generatedSaveCases(seed = 0x544f4d, count = 128) {
  const random = lcg(seed);
  return Array.from({ length: count }, (_, caseIndex) => {
    const save = baseSave();
    const invLength = Math.floor(random() * 21);
    const bankLength = Math.floor(random() * 61);
    save.inv = Array.from({ length: invLength }, (_, index) =>
      random() < 0.35
        ? null
        : {
            id: `generated_item_${caseIndex}_${index}`,
            qty: 1 + Math.floor(random() * 999),
            plus: Math.floor(random() * 101),
          },
    );
    save.bank = {
      gold: Math.floor(random() * 1_000_000),
      items: Array.from({ length: bankLength }, (_, index) =>
        random() < 0.5
          ? null
          : {
              id: `bank_item_${caseIndex}_${index}`,
              qty: 1 + Math.floor(random() * 999),
              plus: Math.floor(random() * 101),
            },
      ),
    };
    save.gold = Math.floor(random() * 1_000_000);
    save.weapon = { id: "steel_sword", plus: Math.floor(random() * 101) };
    save.armor = { id: "steel_heavy_armor", plus: Math.floor(random() * 101) };
    if (random() < 0.5) {
      save.buff = {
        dmg: Math.floor(random() * 100),
        hits: 1 + Math.floor(random() * 100),
        item: "minor_venom_draught",
      };
    }
    return { save, revision: Math.floor(random() * 20) };
  });
}
