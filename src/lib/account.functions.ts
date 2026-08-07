import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { emailForUsername, USERNAME_RE } from "./account";

const schema = z.object({
  username: z.string().trim().regex(USERNAME_RE, "3-16 letters, numbers or underscores"),
  password: z.string().min(6, "Password must be at least 6 characters").max(72),
});

export const createAccount = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => schema.parse(input))
  .handler(async ({ data }) => {
    const username = data.username.trim();
    const lower = username.toLowerCase();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: taken, error: lookupError } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .eq("username_lower", lower)
      .maybeSingle();
    if (lookupError) throw new Error("Could not check that name right now.");
    if (taken) throw new Error("That username is already taken.");

    const { data: created, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email: emailForUsername(lower),
      password: data.password,
      email_confirm: true,
      user_metadata: { username },
    });
    if (createError || !created.user) {
      throw new Error("That username is already taken.");
    }

    const { error: profileError } = await supabaseAdmin
      .from("profiles")
      .insert({ id: created.user.id, username, username_lower: lower });
    if (profileError) {
      await supabaseAdmin.auth.admin.deleteUser(created.user.id);
      throw new Error("That username is already taken.");
    }

    return { ok: true as const, username };
  });
