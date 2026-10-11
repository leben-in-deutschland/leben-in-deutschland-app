import { Inter as FontSans, Plus_Jakarta_Sans as FontDisplay } from "next/font/google"

/*
 * Inter carries the reading text: neutral, very legible at small sizes and
 * on low-contrast backgrounds. Plus Jakarta Sans gives headings and large
 * numbers a rounder, contemporary voice. next/font copies the files into the
 * build, so the Android app works offline.
 */
export const fontSans = FontSans({
    subsets: ["latin", "latin-ext", "cyrillic"],
    variable: "--font-sans",
    display: "swap",
})

export const fontDisplay = FontDisplay({
    subsets: ["latin", "latin-ext", "cyrillic-ext"],
    weight: ["500", "600", "700", "800"],
    variable: "--font-display",
    display: "swap",
})
