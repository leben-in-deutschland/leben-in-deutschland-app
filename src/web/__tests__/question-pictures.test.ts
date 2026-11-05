// @vitest-environment node
/*
 * Picture questions must work offline and without a third-party request
 * (the app promises "offline, private"): every `image` in the bundled
 * catalogue is "-" or a root-relative path to a file under public/, which
 * the web export and both native apps ship. src/catalogue/apply.mjs writes
 * those files from the official BAMF PDF. The downloaded catalogue file
 * (questions-core.json) carries the same pictures as URLs on the website, so
 * apps up to 2.1.25, which do not bundle them, still show them; this build
 * maps those URLs back to its bundled files.
 */
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { picturePath, pictureFor } from "../../catalogue/apply.mjs";
import { siteConfig } from "@/config/site";
import { questionsData } from "@/data/data";
import { bundledPicture, PICTURE_ORIGIN, websitePicture, withBundledPictures } from "@/utils/question-pictures";

type Entry = { num: string; image: string };

const root = path.resolve(__dirname, "..");
const read = (file: string): Entry[] => JSON.parse(readFileSync(path.join(root, file), "utf8"));

describe("bundled question pictures", () => {
    it("data/question.json: every picture is a bundled file", () => {
        const pictures = read("data/question.json").filter((question) => question.image !== "-");
        expect(pictures.length).toBeGreaterThan(0);
        for (const question of pictures) {
            expect(question.image, question.num).toBe(picturePath(question.num));
            expect(existsSync(path.join(root, "public", question.image)), question.image).toBe(true);
        }
    });

    it("data/questions-core.json: every picture is the website URL of a bundled file, for apps up to 2.1.25", () => {
        expect(PICTURE_ORIGIN).toBe(new URL(siteConfig.links.website).origin);
        const pictures = read("data/questions-core.json").filter((question) => question.image !== "-");
        expect(pictures.length).toBe(read("data/question.json").filter((question) => question.image !== "-").length);
        for (const question of pictures) {
            expect(question.image, question.num).toBe(`${PICTURE_ORIGIN}${picturePath(question.num)}`);
            expect(existsSync(path.join(root, "public", new URL(question.image).pathname)), question.image).toBe(true);
        }
    });

    it("this build shows its bundled files, never the website URL", () => {
        const pictures = questionsData().filter((question) => question.image !== "-");
        expect(pictures.length).toBeGreaterThan(0);
        for (const question of pictures) {
            expect(question.image, question.num).toBe(picturePath(question.num));
        }
    });

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

describe("mapping website picture URLs to bundled files", () => {
    it("maps a picture this build bundles back to its file", () => {
        expect(bundledPicture(`${PICTURE_ORIGIN}/questions/BW-1.webp`)).toBe("/questions/BW-1.webp");
        expect(bundledPicture("/questions/26.webp")).toBe("/questions/26.webp");
        expect(websitePicture("/questions/26.webp")).toBe(`${PICTURE_ORIGIN}/questions/26.webp`);
        expect(bundledPicture(websitePicture("/questions/26.webp"))).toBe("/questions/26.webp");
    });

    it("leaves pictures this build lacks, other hosts and no picture alone", () => {
        expect(bundledPicture(`${PICTURE_ORIGIN}/questions/999.webp`)).toBe(`${PICTURE_ORIGIN}/questions/999.webp`);
        expect(bundledPicture("https://example.org/questions/26.webp")).toBe("https://example.org/questions/26.webp");
        expect(bundledPicture(`${PICTURE_ORIGIN}/questions/26.webp?x=1`)).toBe(`${PICTURE_ORIGIN}/questions/26.webp?x=1`);
        expect(bundledPicture("-")).toBe("-");
        expect(websitePicture("-")).toBe("-");
    });

    it("keeps unchanged entries and copies changed ones", () => {
        const plain = { num: "1", image: "-" };
        const picture = { num: "26", image: `${PICTURE_ORIGIN}/questions/26.webp` };
        const [first, second] = withBundledPictures([plain, picture]);
        expect(first).toBe(plain);
        expect(second).toEqual({ num: "26", image: "/questions/26.webp" });
        expect(picture.image).toBe(`${PICTURE_ORIGIN}/questions/26.webp`);
    });
});
