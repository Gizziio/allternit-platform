import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { users } from "@/db/schema";

export async function hasAdminAccount(env: CloudflareEnv): Promise<boolean> {
	const db = getDb(env);
	const [admin] = await db
		.select({ id: users.id })
		.from(users)
		.where(eq(users.role, "admin"))
		.limit(1);

	return !!admin;
}
