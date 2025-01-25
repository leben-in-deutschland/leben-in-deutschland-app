import NextAuth from "@/node_modules/next-auth"

declare module "next-auth" {
    interface Session {
        user: {
            email: string,
            image: string,
            name: string,
            id: string
        }
    }
}