import { NextRequest, NextResponse } from "next/server";
import { statesData } from "@/data/data"
import { authOption } from "@/app/api/auth/[...nextauth]/route";
import { getServerSession } from "next-auth";
//get states
export async function GET(): Promise<any> {
    try {
        let states = statesData();
        return NextResponse.json(
            states,
            {
                status: 200,
            }
        );
    } catch (error) {
        return NextResponse.json(
            { error: (error as Error).message },
            {
                status: 500,
            }
        );
    }
}

export async function POST(req: NextRequest): Promise<any> {
    const session = await getServerSession(authOption);

    if (session) {
        return NextResponse.json(
            "This is protected content. You can access this content because you are signed in.",
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