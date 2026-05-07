import NextAuth from "next-auth";
import type { NextAuthConfig } from "next-auth";
import Facebook from "next-auth/providers/facebook";
import Google from "next-auth/providers/google";

const providers: NextAuthConfig["providers"] = [Google];
if (process.env.AUTH_FACEBOOK_ID?.trim() && process.env.AUTH_FACEBOOK_SECRET?.trim()) {
  providers.push(Facebook);
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  trustHost: true,
  providers,
  callbacks: {
    authorized({ auth, request }) {
      const { pathname } = request.nextUrl;
      if (pathname.startsWith("/profiles")) {
        return !!auth?.user;
      }
      return true;
    },
  },
});
