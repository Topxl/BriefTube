import { redirect } from "next/navigation";

export default async function BillingPage(props: {
  searchParams: Promise<{ success?: string; annual?: string }>;
}) {
  const searchParams = await props.searchParams;
  const annual = searchParams.annual === "true";
  if (searchParams.success === "true") {
    redirect(`/dashboard/profile?success=true${annual ? "&annual=true" : ""}`);
  }
  redirect(`/dashboard/profile${annual ? "?annual=true" : ""}`);
}
