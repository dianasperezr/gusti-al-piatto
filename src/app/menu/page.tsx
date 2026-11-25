import { connection } from "next/server";
import { getMenu } from "@/modules/catalog/menu";
import { MenuView } from "@/modules/catalog/menu-view";


export default async function MenuPage() {
  await connection();
  return <MenuView menu={await getMenu()} />;
}
