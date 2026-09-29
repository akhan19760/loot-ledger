import fs from "node:fs";
import { notInArray } from "drizzle-orm";
import { z } from "zod";
import type { Db } from "./client.ts";
import { stores } from "./schema.ts";

const StoresFile = z.array(
  z.object({
    id: z.string().regex(/^[a-z0-9-]+$/),
    name: z.string().min(1),
    platform: z.enum(["shopify", "woocommerce"]),
    base: z.url().transform((u) => u.replace(/\/+$/, "")),
    link_style: z.enum(["query"]).optional(),
    delivery: z
      .object({
        karachi: z.array(z.number().min(0)).min(1),
        elsewhere: z.array(z.number().min(0)).min(1),
        checked: z.iso.date(),
        note: z.string().optional(),
      })
      .optional(),
  }),
);

/**
 * stores.json decides which stores exist. Upsert every entry (keeping fetch
 * status), and drop stores that were removed from the file along with their listings.
 */
export function syncStores(db: Db, file: string) {
  const entries = StoresFile.parse(JSON.parse(fs.readFileSync(file, "utf-8")));
  const ids = entries.map((s) => s.id);
  db.transaction((tx) => {
    for (const s of entries) {
      const settings = { name: s.name, platform: s.platform, base: s.base, linkStyle: s.link_style ?? null, delivery: s.delivery ?? null };
      tx.insert(stores)
        .values({ id: s.id, ...settings })
        .onConflictDoUpdate({ target: stores.id, set: settings })
        .run();
    }
    tx.delete(stores).where(notInArray(stores.id, ids)).run();
  });
  return ids;
}
