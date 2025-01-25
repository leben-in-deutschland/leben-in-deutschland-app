import { authOptions } from "@/src/types/auth-option";
import { User } from "@/src/types/user";
import { kv } from "@vercel/kv";
import { getServerSession } from "next-auth";
import { NextRequest, NextResponse } from "next/server";

export async function GET(): Promise<any> {
    const session = await getServerSession(authOptions);
    if (session) {
        const data = await kv.get<User>(session.user.id);
        if (data) {
            return NextResponse.json(
                data,
                {
                    status: 200,
                }
            );
        }
        return new Response(null, {
            status: 204,
        })
    }

    return NextResponse.json(
        { error: "You must be sign in to view the protected content on this page." },
        {
            status: 403,
        }
    );
}

export async function POST(req: NextRequest): Promise<any> {
    const session = await getServerSession(authOptions);

    if (session) {
        const user: User = await req.json();
        user.id = session.user.id;
        await kv.set(session.user.id, user);
        return NextResponse.json(
            user,
            {
                status: 200,
            }
        );
    }

    return NextResponse.json(
        { error: "You must be sign in to view the protected content on this page." },
        {
            status: 403,
        }
    );
}

export async function DELETE(): Promise<any> {
    const session = await getServerSession(authOptions);

    if (session) {
        await kv.del(session.user.id);
        return NextResponse.json(
            {
                status: 204,
            }
        );
    }

    return NextResponse.json(
        { error: "You must be sign in to view the protected content on this page." },
        {
            status: 403,
        }
    );
}