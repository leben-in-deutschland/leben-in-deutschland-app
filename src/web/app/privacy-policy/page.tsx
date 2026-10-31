import type { Metadata } from "next";
import type { ReactNode } from "react";
import { PrivacyIntro } from "@/components/landing/privacy-intro";
import { Surface } from "@/components/ui/surface";

const LAST_UPDATED = "October 31, 2026";
const CONTACT_EMAIL = "hello@lamplitlabs.com";
const CONTROLLER = "Manish Tiwari";
const ADDRESS = "Am Potekamp 22, 40885 Ratingen, Germany";

export const metadata: Metadata = {
    title: "Privacy Policy",
    description: "Privacy notice of lebenindeutschland.org and the Einbürgerungstest app: no accounts, no tracking, no data collection.",
    alternates: { canonical: "/privacy-policy" },
};

const SECTIONS = [
    { id: "intro", title: "1. Introduction" },
    { id: "info-collection", title: "2. Information We Collect" },
    { id: "data-ownership", title: "3. Data Ownership & Control" },
    { id: "third-party", title: "4. Third-Party Services" },
    { id: "changes", title: "5. Changes to This Privacy Policy" },
    { id: "contact", title: "6. Your Rights & Contact" },
];

function Section({ id, title, children }: { id: string; title: string; children: ReactNode }) {
    return (
        <Surface as="section" id={id} aria-labelledby={`${id}-title`} padding="lg" className="scroll-mt-24">
            <h2 id={`${id}-title`} className="font-display text-lg font-semibold leading-tight text-foreground sm:text-xl">
                {title}
            </h2>
            <div className="rich-text mt-3 text-[0.9375rem] text-default-700">{children}</div>
        </Surface>
    );
}

export default function PrivacyPolicy() {
    return (
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
            <PrivacyIntro lastUpdated={LAST_UPDATED} />

            <Surface tone="sunken" as="nav" aria-label="Table of contents">
                <p className="font-display text-sm font-semibold uppercase tracking-wide text-default-500">Table of Contents</p>
                <ol className="mt-2 grid gap-1 text-sm sm:grid-cols-2">
                    {SECTIONS.map((section) => (
                        <li key={section.id}>
                            <a href={`#${section.id}`} className="inline-flex min-h-[36px] items-center font-medium text-primary hover:underline">
                                {section.title}
                            </a>
                        </li>
                    ))}
                </ol>
            </Surface>

            <Section id="intro" title={SECTIONS[0].title}>
                <p>
                    Thank you for choosing to be part of our community at Lamplit Labs, doing business as lebenindeutschland.org/Einbürgerungstest
                    (&quot;lebenindeutschland&quot;, &quot;Einbürgerungstest&quot;, &quot;we&quot;, &quot;us&quot;, or &quot;our&quot;). We are committed to protecting
                    your personal information and respecting your right to privacy. The controller responsible for any processing
                    under the GDPR is {CONTROLLER}, Lamplit Labs, {ADDRESS} (contact: <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>).
                    If you have any questions or concerns about this privacy notice or our practices regarding your personal information,
                    please contact us at <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
                </p>
            </Section>

            <Section id="info-collection" title={SECTIONS[1].title}>
                <p>This privacy notice explains how we handle your information if you:</p>
                <ul>
                    <li>Download and use our mobile application — Einbürgerungstest</li>
                    <li>Use our web application — lebenindeutschland.org</li>
                    <li>Interact with us in other ways, including sales, marketing, or events.</li>
                </ul>
                <p>When we refer to:</p>
                <ul>
                    <li>&quot;App,&quot; we mean any application we own or operate that links to this privacy policy, including the one mentioned above.</li>
                    <li>&quot;Services,&quot; we mean the App and any associated services, including sales, marketing, or events.</li>
                </ul>
                <p>
                    This notice is designed to clearly explain what data we may collect, how we use it, and what rights you have regarding your information.
                    If you disagree with any terms in this privacy policy, please stop using our Services immediately.
                </p>
            </Section>

            <Section id="data-ownership" title={SECTIONS[2].title}>
                <p>
                    At lebenindeutschland, we do not collect, store, or share any personal information. We do not require any personal data for you to use
                    our app. There are no forms to fill out, no accounts to create, and no data collection mechanisms in place. Your privacy is paramount,
                    and as such, we do not use cookies, tracking technologies, or third-party services like Google Analytics to collect or monitor your
                    activities.
                </p>
            </Section>

            <Section id="third-party" title={SECTIONS[3].title}>
                <p>
                    We do not share your data with any third parties. Our app does not send your learning data to any external services. We do not use
                    third-party analytics, advertising networks, or tracking systems of any kind. Your data remains private and secure in your hands only.
                </p>
                <p>
                    The Android app offers optional tips. If you choose to give a tip, the payment is handled entirely by Google Play&apos;s billing
                    system under Google&apos;s own terms and privacy policy; we never see your name, payment details, or address. The app only receives
                    an anonymous confirmation that a tip was paid and stores a simple count of your tips on your device. Tips do not unlock any
                    features. On Android, Google Play services may also be used for app updates and for the optional &quot;rate this app&quot; prompt.
                </p>
                <p>
                    The iOS app for iPhone and iPad offers the same optional tips. There the payment is handled entirely by Apple&apos;s In-App
                    Purchase system under Apple&apos;s own terms and privacy policy; we never see your name, Apple Account, payment details, or address.
                    The app only receives an anonymous confirmation that a tip was paid and stores a simple count of your tips on your device. Tips do
                    not unlock any features. On iOS, the App Store may also be used to check for app updates and for the optional &quot;rate this
                    app&quot; prompt.
                </p>
                <p>
                    To stay current between app updates, the Android and iOS apps download a few small public files at most once a day from GitHub, where
                    this project is published: the BAMF evaluation status, the official question catalogue, and occasional notices from us (for
                    example when a new version is available). These requests contain no account or learning data; like any internet request they
                    reveal your IP address to GitHub, whose privacy statement applies to that connection. If a download fails or you are offline,
                    the app simply uses the copy it was installed with. Notices you dismiss are remembered only on your device.
                </p>
            </Section>

            <Section id="changes" title={SECTIONS[4].title}>
                <p>
                    We reserve the right to update this privacy policy from time to time. If we make any changes, we will post the updated policy on this
                    page with an updated &quot;Last Updated&quot; date. We encourage you to review this privacy policy periodically to stay informed about how
                    we are protecting your privacy. Any updates will be effective as soon as they are posted, and by continuing to use our Services, you
                    agree to the revised policy.
                </p>
            </Section>

            <Section id="contact" title={SECTIONS[5].title}>
                <p>
                    Because we collect no personal data, the GDPR rights below normally have nothing to act on; still, you have the right of
                    access, rectification, erasure, restriction of processing, data portability, and objection (Art. 15–21 GDPR), and the right
                    to lodge a complaint with a supervisory authority — for example the Landesbeauftragte für Datenschutz und
                    Informationsfreiheit Nordrhein-Westfalen (LDI NRW) or the authority at your place of residence.
                </p>
                <p>
                    If you have any questions about this privacy policy or our practices, or if you wish to exercise any of your rights regarding your data,
                    please feel free to contact us at <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>. We will respond to your inquiries in a timely
                    manner.
                </p>
            </Section>
        </div>
    );
}
