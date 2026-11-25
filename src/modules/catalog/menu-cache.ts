import "server-only";
import { revalidatePath, updateTag } from "next/cache";

export const publicMenuTag = "public-menu";

export function invalidatePublicMenu() {
  updateTag(publicMenuTag);
  revalidatePath("/menu");
}
