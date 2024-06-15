import { NextRequest, NextResponse } from "next/server";
import { statesData } from "@/data/data"
import { getSession } from "next-auth/react";
import { NextApiRequest, NextApiResponse } from "next";
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

export async function POST(req: NextApiRequest, res: NextApiResponse): Promise<any> {
    const session = await getSession({ req })

    if (session) {
        return res.send({
            content:
                "This is protected content. You can access this content because you are signed in.",
        })
    }
    res.send({
        statusCode: 403,
        error: "You must be sign in to view the protected content on this page.",
    })
}