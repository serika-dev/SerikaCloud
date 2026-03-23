import NextAuth from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { authConfig } from "./auth.config";

export const { handlers, signIn, signOut, auth } = NextAuth({
  ...authConfig,
  providers: [
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null;
        }

        if (
          process.env.ADMIN_USER &&
          process.env.ADMIN_PASS &&
          credentials.email === process.env.ADMIN_USER &&
          credentials.password === process.env.ADMIN_PASS
        ) {
          let adminUser = await prisma.user.findUnique({
            where: { email: process.env.ADMIN_USER },
          });

          if (!adminUser) {
            const hashedPassword = await bcrypt.hash(process.env.ADMIN_PASS, 10);
            adminUser = await prisma.user.create({
              data: {
                email: process.env.ADMIN_USER,
                name: "Administrator",
                password: hashedPassword,
                emailVerified: true,
                isAdmin: true,
              },
            });
          }

          return {
            id: adminUser.id,
            email: adminUser.email,
            name: adminUser.name,
            isAdmin: adminUser.isAdmin,
          };
        }

        const user = await prisma.user.findUnique({
          where: { email: credentials.email as string },
        });

        if (!user) return null;

        const isPasswordValid = await bcrypt.compare(
          credentials.password as string,
          user.password
        );

        if (!isPasswordValid) return null;

        if (!user.emailVerified) {
          throw new Error("EMAIL_NOT_VERIFIED");
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          isAdmin: user.isAdmin,
        };
      },
    }),
  ],
  session: {
    strategy: "jwt",
  },
});
