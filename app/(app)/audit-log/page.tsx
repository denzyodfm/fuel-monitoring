import {redirect} from "next/navigation";
// The audit log now lives inside Settings; keep the old path working for bookmarks.
export default function Page(){redirect("/settings?tab=audit")}
