import NextAuth from "next-auth";
import MicrosoftEntraID from "next-auth/providers/microsoft-entra-id";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      name?: string | null;
      email?: string | null;
      image?: string | null;
    };
  }
}

declare module "@auth/core/jwt" {
  interface JWT {
    userId?: string;
  }
}

export const {
  handlers: { GET, POST },
  auth,
  signIn,
  signOut,
} = NextAuth({
  providers: [MicrosoftEntraID],
  callbacks: {
    jwt({ token, profile }) {
      if (profile?.oid && typeof profile.oid === "string") {
        token.userId = profile.oid;
      }
      return token;
    },
    session({ session, token }) {
      if (token.userId) {
        session.user.id = token.userId;
      }
      return session;
    },
    authorized({ auth: session }) {
      return !!session;
    },
  },
});
