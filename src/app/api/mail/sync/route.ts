import { NextResponse } from "next/server";
import { getDefaultUser } from "@/lib/db/prisma";
import { syncAllAccounts } from "@/lib/jobs/sync-mails";

export async function POST() {
  const user = await getDefaultUser();
  const syncResults = await syncAllAccounts(user.id);

  return NextResponse.json({
    synced: syncResults
  });
}
