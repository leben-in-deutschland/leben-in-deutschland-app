import { NextAuthOptions } from "next-auth";
import Auth0Provider from "next-auth/providers/auth0";

const AUTH0_CLIENT_ID = process.env.AUTH0_CLIENT_ID!
const AUTH0_CLIENT_SECRET = process.env.AUTH0_CLIENT_SECRET!
const AUTH0_ISSUER = process.env.AUTH0_ISSUER!
const DEBUG:boolean = (process.env.DEBUG === 'true') ?? false

export const authOptions: NextAuthOptions = {
    session: {
        strategy: 'jwt',
    },
    providers: [
        Auth0Provider({
            clientId: AUTH0_CLIENT_ID,
            clientSecret: AUTH0_CLIENT_SECRET,
            issuer: AUTH0_ISSUER,
          }
        )
    ],
    debug: DEBUG,
    logger: {
        error(code, metadata) {
          console.error(code, metadata)
        },
        warn(code) {
            console.warn(code)
        },
        debug(code, metadata) {
            console.log(code, metadata)
        }
    },
    callbacks: {
        session({ session, token, user }) {
            session.user.id = token.sub ?? "";
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
