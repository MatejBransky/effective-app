import {} from "@yielded/auth";
import { AuthPersistence } from "@yielded/auth-persistence-drizzle/SqliteNode";
import { AppAuth } from "./auth.ts";

export const Persistence = AuthPersistence.make(AppAuth);

export const storage = Persistence.managed({
  subjects: {
    // TODO: add drizzle schema for customers
    table: customers,
  },
});
