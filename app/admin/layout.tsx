import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

const ADMIN_USER_ID = "67320a39-948c-44d2-98e3-c0de49af1ec6";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user?.id !== ADMIN_USER_ID) {
    redirect("/");
  }

  return (
    <div className="bg-background min-h-screen">
      <div className="mx-auto max-w-[1400px] px-4 py-6 md:px-8">{children}</div>
    </div>
  );
}
