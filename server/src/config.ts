import { z } from "zod";

// All runtime settings come from environment variables (or server/.env in dev).
const Env = z.object({
  HOST: z.string().default("127.0.0.1"),
  PORT: z.coerce.number().int().positive().default(3001),
});

export const config = Env.parse(process.env);
