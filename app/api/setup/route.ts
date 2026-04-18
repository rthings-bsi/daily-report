import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import bcrypt from "bcryptjs";

// GET /api/setup — one-time admin user creation
export async function GET() {
  try {
    console.log("Starting setup...");
    const count = await prisma.user.count();
    if (count > 0) {
      return NextResponse.json({ error: "Already set up" }, { status: 400 });
    }

    const username = process.env.ADMIN_USERNAME ?? "admin";
    const password = process.env.ADMIN_PASSWORD ?? "spindo123";
    const hashed = await bcrypt.hash(password, 12);

    await prisma.user.create({
      data: { username, password: hashed, role: "admin" },
    });

    return NextResponse.json({ ok: true, username });
  } catch (error: any) {
    console.error("Setup error:", error);
    return NextResponse.json({ 
      error: "Setup failed", 
      details: error.message,
      stack: error.stack 
    }, { status: 500 });
  }
}

