import { questionsData } from "@/data/data";
import { NextResponse } from "next/server";

export async function GET(): Promise<any> {
    try {
        let questions = questionsData();
        return NextResponse.json(
            questions,
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