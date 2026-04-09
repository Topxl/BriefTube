import { redirect } from "next/navigation";

// Email/password signup removed. Google OAuth only.
// Keep this redirect so old links/bookmarks still work.
export default function SignupPage() {
  redirect("/login");
}
