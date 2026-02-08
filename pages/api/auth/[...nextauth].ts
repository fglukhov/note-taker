// pages/api/auth/[...nextauth].ts

import type { NextApiHandler } from "next";
import NextAuth from "next-auth";
import { PrismaAdapter } from "@next-auth/prisma-adapter";
import GitHubProvider from "next-auth/providers/github";
import prisma from "../../../lib/prisma";

// ✅ ВАЖНО: экспортируем authOptions, чтобы getServerSession мог их импортировать
export const authOptions = {
	providers: [
		GitHubProvider({
			clientId: process.env.GITHUB_ID!,
			clientSecret: process.env.GITHUB_SECRET!,
		}),
	],
	adapter: PrismaAdapter(prisma),
	secret: process.env.NEXT_PUBLIC_SECRET,
	callbacks: {
		async session({ session, user }) {
			if (session?.user) {
				// @ts-expect-error: расширяем объект user
				session.user.id = user.id;
			}
			return session;
		},
	},
};

const authHandler: NextApiHandler = (req, res) => NextAuth(req, res, authOptions);
export default authHandler;
