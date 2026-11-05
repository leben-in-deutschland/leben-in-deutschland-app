// @vitest-environment node
/*
 * Picture questions must work offline and without a third-party request
 * (the app promises "offline, private"): every `image` in the bundled
 * catalogue is "-" or a root-relative path to a file under public/, which
 * the web export and both native apps ship. src/catalogue/apply.mjs writes
 * those files from the official BAMF PDF.
 */
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { picturePath, pictureFor } from "../../catalogue/apply.mjs";

type Entry = { num: string; image: string };

const root = path.resolve(__dirname, "..");
const read = (file: string): Entry[] => JSON.parse(readFileSync(path.join(root, file), "utf8"));

describe("bundled question pictures", () => {
    for (const file of ["data/question.json", "data/questions-core.json"]) {
        it(`${file}: every picture is a bundled file`, () => {
            const questions = read(file);
            const pictures = questions.filter((question) => question.image !== "-");
            expect(pictures.length).toBeGreaterThan(0);
            for (const question of pictures) {
                expect(question.image, question.num).toBe(picturePath(question.num));
                expect(existsSync(path.join(root, "public", question.image)), question.image).toBe(true);
            }
        });
    }

    it("the coat-of-arms question of every state has its picture", () => {
        const nums = new Set(read("data/questions-core.json").filter((question) => question.image !== "-").map((question) => question.num));
        for (const code of ["BW", "BY", "BE", "BB", "HB", "HH", "HE", "MV", "NI", "NW", "RP", "SL", "SN", "ST", "SH", "TH"]) {
            expect(nums.has(`${code}-1`), code).toBe(true);
        }
    });

    it("pictureFor points a question at its own file only when the official question has pictures", () => {
        expect(pictureFor({ num: "BW-1", image: "https://example.org/x.png" }, { images: ["images/BW-1-1.png"] })).toBe("/questions/BW-1.webp");
        expect(pictureFor({ num: "7", image: "-" }, { answers: [] })).toBe("-");
        expect(pictureFor({ num: "7", image: "-" }, undefined)).toBe("-");
    });
});
