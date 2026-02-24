import { redirect } from "next/navigation";

export default async function BillingPage(props: {
  searchParams: Promise<{ success?: string }>;
}) {
  const searchParams = await props.searchParams;
  if (searchParams.success === "true") {
    redirect("/dashboard/profile?success=true");
  }
  redirect("/dashboard/profile");
}
