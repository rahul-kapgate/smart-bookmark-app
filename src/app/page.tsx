import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import Bookmarks from "@/components/Bookmarks";

export default async function HomePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  return <Bookmarks userId={user.id} />;
}
