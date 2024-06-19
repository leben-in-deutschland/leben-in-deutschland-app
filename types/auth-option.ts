import { getUserData } from "@/services/user";
import { NextAuthOptions } from "next-auth";
import GoogleProvider from 'next-auth/providers/google'
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID!
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET!


export const authOptions: NextAuthOptions = {
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
            session.user.id = token.sub ?? "";
            return session
        },
        async signIn({ account, profile }) {
            if (!profile?.email) {
                throw new Error('No profile')
            }
            getUserData(true, true);
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
