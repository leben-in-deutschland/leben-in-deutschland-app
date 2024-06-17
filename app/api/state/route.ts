import { NextResponse } from "next/server";
import { statesData } from "@/data/data"
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