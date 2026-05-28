import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";

const GUDANG_PREFIX: Record<string, string> = {
  '1': '5A', '2': '5B', '3': '5C', '4': '5D',
  '5': '5E', '6': '5F', '7': '5G', '8': '5H',
  '9': '5I', '10': '5J', '11': '5K', '12': '5L',
  '13': '5M', '14': '5N',
};

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { searchParams } = new URL(request.url);
    const gudang = searchParams.get('gudang');
    const prefix = gudang ? GUDANG_PREFIX[gudang] : null;

    const where = prefix
      ? { storageLocation: { startsWith: prefix } }
      : {};

    const recentMovements = await prisma.movement.groupBy({
      by: ['dateStr', 'group'],
      _sum: {
        quantity: true,
      },
      where,
      orderBy: {
        dateStr: 'desc',
      },
      // We take more just in case we need multiple groups per date, then we'll process in code
      take: 20, 
    });

    const map = new Map<string, { date: string, masuk: number, keluar: number }>();
    
    // Sort ascending for chart display (oldest to newest)
    const sorted = recentMovements.sort((a, b) => b.dateStr.localeCompare(a.dateStr));

    for (const item of sorted) {
      const date = item.dateStr;
      if (!map.has(date)) {
        if (map.size >= 5) continue; // Only keep up to 5 distinct dates
        map.set(date, { date, masuk: 0, keluar: 0 });
      }
      
      const entry = map.get(date)!;
      if (item.group === 'Masuk') entry.masuk += item._sum.quantity || 0;
      if (item.group === 'Keluar') entry.keluar += item._sum.quantity || 0;
    }

    // Convert to array and sort chronologically
    const result = Array.from(map.values()).sort((a, b) => a.date.localeCompare(b.date));

    return NextResponse.json(result);
  } catch (error) {
    console.error("Trend error:", error);
    return NextResponse.json({ error: "Failed to load trend" }, { status: 500 });
  }
}
