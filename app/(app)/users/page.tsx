import {redirect} from "next/navigation";
// User management now lives inside Settings; keep the old path working for bookmarks.
export default function Page(){redirect("/settings?tab=users")}
