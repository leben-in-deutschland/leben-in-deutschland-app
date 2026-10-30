import type { Metadata } from "next";

export const metadata: Metadata = {
    title: "Impressum",
    description: "Impressum (legal notice) of lebenindeutschland.org and the Einbürgerungstest app, § 5 DDG.",
    alternates: { canonical: "/impressum" },
};

const CONTROLLER = "Manish Tiwari";
const STREET = "Am Potekamp 22";
const CITY = "40885 Ratingen";
const COUNTRY = "Deutschland";
const CONTACT_EMAIL = "hello@lamplitlabs.com";

/** German legal notice (§ 5 DDG, § 18 Abs. 2 MStV) with a short English summary. */
export default function Impressum() {
    return (
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
            <div className="flex flex-col gap-3">
                <h1 className="font-display text-3xl font-bold leading-tight text-foreground sm:text-4xl">Impressum</h1>
                <p className="text-sm text-default-500">Angaben gemäß § 5 Digitale-Dienste-Gesetz (DDG)</p>
            </div>

            <div className="rich-text flex flex-col gap-6 text-[0.9375rem] text-default-700">
                <section aria-labelledby="impressum-diensteanbieter">
                    <h2 id="impressum-diensteanbieter" className="font-display text-lg font-semibold leading-tight text-foreground sm:text-xl">
                        Diensteanbieter
                    </h2>
                    <p className="mt-3">
                        Lamplit Labs
                        <br />
                        Inhaber: {CONTROLLER}
                        <br />
                        {STREET}
                        <br />
                        {CITY}
                        <br />
                        {COUNTRY}
                    </p>
                </section>

                <section aria-labelledby="impressum-kontakt">
                    <h2 id="impressum-kontakt" className="font-display text-lg font-semibold leading-tight text-foreground sm:text-xl">
                        Kontakt
                    </h2>
                    <p className="mt-3">
                        E-Mail: <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>
                    </p>
                </section>

                <section aria-labelledby="impressum-verantwortlich">
                    <h2 id="impressum-verantwortlich" className="font-display text-lg font-semibold leading-tight text-foreground sm:text-xl">
                        Inhaltlich verantwortlich (§ 18 Abs. 2 MStV)
                    </h2>
                    <p className="mt-3">
                        {CONTROLLER}, Anschrift wie oben
                    </p>
                </section>

                <section aria-labelledby="impressum-streitbeilegung">
                    <h2 id="impressum-streitbeilegung" className="font-display text-lg font-semibold leading-tight text-foreground sm:text-xl">
                        Streitbeilegung
                    </h2>
                    <p className="mt-3">
                        Wir sind nicht bereit und nicht verpflichtet, an Streitbeilegungsverfahren vor einer
                        Verbraucherschlichtungsstelle teilzunehmen (§ 36 VSBG).
                    </p>
                </section>

                <section aria-labelledby="impressum-en" lang="en">
                    <h2 id="impressum-en" className="font-display text-lg font-semibold leading-tight text-foreground sm:text-xl">
                        English summary
                    </h2>
                    <p className="mt-3">
                        Legal notice for lebenindeutschland.org and the Einbürgerungstest app: Lamplit Labs, operated by{" "}
                        {CONTROLLER}, {STREET}, {CITY}, Germany. Contact:{" "}
                        <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>. Content responsibility: {CONTROLLER} (§ 18 Abs. 2
                        MStV). We are neither willing nor obliged to participate in dispute-resolution proceedings before a
                        consumer arbitration board (§ 36 VSBG).
                    </p>
                </section>
            </div>
        </div>
    );
}
