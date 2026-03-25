import { redirect } from "next/navigation";
import { env } from "@/lib/env";
import { getUser } from "./auth-user";

export async function requireAdmin() {
  const user = await getUser();

  if (!env.ADMIN_USER_ID || user?.id !== env.ADMIN_USER_ID) {
    redirect("/dashboard");
  }

  return user;
}
