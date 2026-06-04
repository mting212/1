import NextAuth from "next-auth"
import Credentials from "next-auth/providers/credentials"

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Credentials({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const c = credentials as unknown as Record<string, string> | undefined
        if (!c?.email || !c?.password || c.password.length < 8) return null
        return { id: "dev-user", email: c.email, name: c.email.split("@")[0] ?? c.email }
      },
    }),
  ],
  session: { strategy: "jwt" },
  callbacks: {
    async jwt({ token, user }) {
      if (user?.id) { token.sub = user.id }
      return token
    },
  },
  pages: { signIn: "/login" },
})
