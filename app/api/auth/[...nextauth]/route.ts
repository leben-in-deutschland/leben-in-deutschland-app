import { NextAuthOptions } from 'next-auth'
import NextAuth from 'next-auth/next'
import GoogleProvider from 'next-auth/providers/google'

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID!
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET!

const authOption: NextAuthOptions = {
    session: {
        strategy: 'jwt',
    },
    providers: [
        GoogleProvider({
            clientId: GOOGLE_CLIENT_ID,
            clientSecret: GOOGLE_CLIENT_SECRET,
        }),
    ],
    callbacks: {
        session({ session, token, user }) {
            return session
        },
        async signIn({ account, profile }) {
            if (!profile?.email) {
                throw new Error('No profile')
            }
            return true
        },
        async jwt({ token, user, account, profile }) {
            if (profile) {
                if (!user) {
                    throw new Error('No user found')
                }
                token.id = user.id
                if (account) {
                    token.accessToken = account.access_token;
                }
            }
            return token
        },
    },
}

const handler = NextAuth(authOption)
export { handler as GET, handler as POST }