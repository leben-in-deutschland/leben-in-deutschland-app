import { State } from '@/types/state';
import statesJson from './states.json';
import questionsJson from './questions-core.json';
import pruefstellenJson from './prüfstellen.json';
import evaluationJson from './current-evaluation.json';
import enJson from './translations/en.json';
import deJson from './translations/de.json';
import commonEn from './translations/areas/common.en.json';
import commonDe from './translations/areas/common.de.json';
import homeEn from './translations/areas/home.en.json';
import homeDe from './translations/areas/home.de.json';
import practiceEn from './translations/areas/practice.en.json';
import practiceDe from './translations/areas/practice.de.json';
import examEn from './translations/areas/exam.en.json';
import examDe from './translations/areas/exam.de.json';
import progressEn from './translations/areas/progress.en.json';
import progressDe from './translations/areas/progress.de.json';
import settingsEn from './translations/areas/settings.en.json';
import settingsDe from './translations/areas/settings.de.json';
import onboardingEn from './translations/areas/onboarding.en.json';
import onboardingDe from './translations/areas/onboarding.de.json';
import landingEn from './translations/areas/landing.en.json';
import landingDe from './translations/areas/landing.de.json';
import catalogueEn from './translations/areas/catalogue.en.json';
import catalogueDe from './translations/areas/catalogue.de.json';
import { Question } from '@/types/question';
import { PrüfstellenData } from '@/types/prüfstellen';
import { EvaluationData } from '@/types/evaluation';

export const pruefstellenData = () => JSON.parse(JSON.stringify(pruefstellenJson)) as PrüfstellenData[];
export const statesData = () => JSON.parse(JSON.stringify(statesJson)) as State[];
export const questionsData = () => JSON.parse(JSON.stringify(questionsJson)) as Question[];
export const evaluationData = () => JSON.parse(JSON.stringify(evaluationJson)) as EvaluationData;

/**
 * Interface texts. The original files hold the texts of version 2.0; every
 * screen area added in 2.1 keeps its texts in `translations/areas/`, so areas
 * can change independently. Area keys are prefixed with the area name.
 */
export type AppTranslations = typeof enJson & Record<string, string>;

/** Area files per language, merged in this order (later wins). */
export const translationAreas = {
    en: { common: commonEn, home: homeEn, practice: practiceEn, exam: examEn, progress: progressEn, settings: settingsEn, onboarding: onboardingEn, landing: landingEn, catalogue: catalogueEn },
    de: { common: commonDe, home: homeDe, practice: practiceDe, exam: examDe, progress: progressDe, settings: settingsDe, onboarding: onboardingDe, landing: landingDe, catalogue: catalogueDe },
} as const;

const mergeAreas = (base: typeof enJson, areas: Record<string, Record<string, string>>): AppTranslations =>
    Object.assign({}, base, ...Object.values(areas)) as AppTranslations;

const EN = mergeAreas(enJson, translationAreas.en);
const DE = mergeAreas(deJson, translationAreas.de);

export const getTranslations = (appLanguage: string): AppTranslations => {
    if (appLanguage === "de") {
        return DE;
    }
    return EN;
};
