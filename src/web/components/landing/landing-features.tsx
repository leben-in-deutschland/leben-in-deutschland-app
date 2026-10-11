import { Surface } from "@/components/ui/surface";
import { IconBadge, type Accent } from "@/components/ui/icon-badge";
import {
    BookOpenIcon,
    ClipboardCheckIcon,
    DownloadIcon,
    FlameIcon,
    LayersIcon,
    MapPinIcon,
    MoonIcon,
    ShieldCheckIcon,
    TranslateIcon,
    TrendingUpIcon,
    type IconComponent,
} from "@/components/ui/icons";
import type { Translations } from "@/utils/i18n";
import { LandingSection } from "./landing-primitives";

const STEPS: { icon: IconComponent; title: string; description: string }[] = [
    { icon: MapPinIcon, title: "how_it_works_step1_title", description: "how_it_works_step1_desc" },
    { icon: BookOpenIcon, title: "how_it_works_step2_title", description: "how_it_works_step2_desc" },
    { icon: ClipboardCheckIcon, title: "how_it_works_step3_title", description: "how_it_works_step3_desc" },
];

/** Three steps from choosing a state to the mock exam. */
export function HowItWorks({ t }: { t: Translations }) {
    return (
        <LandingSection id="how-it-works" eyebrow={t.landing_how_eyebrow} title={t.how_it_works_title} description={t.landing_how_subtitle}>
            <ol className="grid gap-4 sm:grid-cols-3">
                {STEPS.map((step, index) => (
                    <Surface as="li" key={step.title} padding="lg" className="relative flex flex-col gap-3">
                        <div className="flex items-center justify-between">
                            <IconBadge icon={step.icon} accent="primary" size="lg" />
                            <span className="font-display text-3xl font-bold tabular text-default-200" aria-hidden="true">
                                {String(index + 1).padStart(2, "0")}
                            </span>
                        </div>
                        <h3 className="font-display text-lg font-semibold leading-tight text-foreground">
                            <span className="sr-only">{index + 1}. </span>
                            {t[step.title]}
                        </h3>
                        <p className="text-sm text-default-500">{t[step.description]}</p>
                    </Surface>
                ))}
            </ol>
        </LandingSection>
    );
}

const FEATURES: { icon: IconComponent; accent: Accent; key: string }[] = [
    { icon: LayersIcon, accent: "primary", key: "modes" },
    { icon: ClipboardCheckIcon, accent: "secondary", key: "mock" },
    { icon: FlameIcon, accent: "warning", key: "streak" },
    { icon: TrendingUpIcon, accent: "success", key: "progress" },
    { icon: TranslateIcon, accent: "primary", key: "translations" },
    { icon: MoonIcon, accent: "default", key: "dark" },
    { icon: DownloadIcon, accent: "secondary", key: "offline" },
    { icon: ShieldCheckIcon, accent: "success", key: "private" },
];

/** What the app does, in eight short cards. */
export function FeatureGrid({ t }: { t: Translations }) {
    return (
        <LandingSection id="features" eyebrow={t.landing_features_eyebrow} title={t.landing_features_title} description={t.landing_features_subtitle}>
            <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {FEATURES.map((feature) => (
                    <Surface as="li" key={feature.key} className="flex flex-col gap-3">
                        <IconBadge icon={feature.icon} accent={feature.accent} />
                        <div>
                            <h3 className="font-display text-base font-semibold leading-tight text-foreground">{t[`landing_feature_${feature.key}_title`]}</h3>
                            <p className="mt-1 text-sm text-default-500">{t[`landing_feature_${feature.key}_desc`]}</p>
                        </div>
                    </Surface>
                ))}
            </ul>
        </LandingSection>
    );
}
