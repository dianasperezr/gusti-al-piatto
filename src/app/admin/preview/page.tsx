import type { Metadata } from "next";
import { requireUser } from "@/modules/auth/session";
import { getMenu } from "@/modules/catalog/menu";
import { MenuView } from "@/modules/catalog/menu-view";

export const metadata: Metadata = { robots: { index: false, follow: false } };

export default async function PreviewPage() {
  await requireUser();
  return <MenuView menu={await getMenu(new Date(), true)} preview />;
}
