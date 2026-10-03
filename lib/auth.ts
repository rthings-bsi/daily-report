import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { authConfig } from "./auth.config";
import { APP_MODULES } from "@/lib/roles";

export const { handlers, signIn, signOut, auth } = NextAuth({
  ...authConfig,
  callbacks: {
    ...authConfig.callbacks,
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        let role = (token.role as string) ?? "user";
        let gudangId = (token.gudangId as number | null) ?? null;

        try {
          if (token.id) {
            const userRec = await prisma.user.findUnique({
              where: { userId: token.id as string },
              select: { role: true, gudangId: true },
            });
            if (userRec) {
              role = userRec.role;
              gudangId = userRec.gudangId;
            }
          }
        } catch {
          // fallback to token values
        }

        session.user.role = role;
        session.user.gudangId = gudangId;

        if (role === "admin") {
          session.user.permissions = APP_MODULES.map((m) => m.id);
        } else {
          try {
            const roleRec = await prisma.roleConfig.findUnique({
              where: { roleId: role },
              select: { permissions: true },
            });
            session.user.permissions = roleRec ? JSON.parse(roleRec.permissions) : [];
          } catch {
            session.user.permissions = [];
          }
        }
      }
      return session;
    },
  },
  providers: [
    Credentials({
      async authorize(credentials) {
        if (!credentials?.username || !credentials?.password) return null;

        const user = await prisma.user.findUnique({
          where: { username: credentials.username as string },
        });

        if (!user) return null;

        const valid = await bcrypt.compare(
          credentials.password as string,
          user.password
        );

        if (!valid) return null;

        return {
          id: user.userId,
          name: user.username,
          role: user.role,
          gudangId: user.gudangId,
        };
      },
    }),
  ],
});
