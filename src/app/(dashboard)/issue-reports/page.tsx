import { redirect } from "next/navigation";

// Issue Reports were merged into Support & Disputes (one queue): booking
// "Report an Issue" submissions now arrive there as support tickets.
export default function IssueReportsPage() {
  redirect("/support-disputes");
}
