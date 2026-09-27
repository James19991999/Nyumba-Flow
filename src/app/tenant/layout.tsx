import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { TopBar } from "@/components/TopBar";

export default async function TenantLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role !== "TENANT") redirect("/landlord");

  return (
    <div className="flex flex-col min-h-screen w-full bg-surface">
      <TopBar title="NyumbaFlow" subtitle="Tenant Portal" fullName={user.fullName} />
      <main className="flex-1 w-full pt-16 pb-space-lg max-w-2xl mx-auto">{children}</main>
    </div>
  );
}
