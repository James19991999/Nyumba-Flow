import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { LandlordBottomNav } from "@/components/BottomNav";
import { TopBar } from "@/components/TopBar";

export default async function LandlordLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role !== "LANDLORD") redirect("/tenant");

  return (
    <div className="flex flex-col min-h-screen w-full bg-surface">
      <TopBar title="NyumbaFlow" subtitle="Property Hub" fullName={user.fullName} />
      <main className="flex-1 w-full pt-16 pb-24 max-w-3xl mx-auto">{children}</main>
      <LandlordBottomNav />
    </div>
  );
}
