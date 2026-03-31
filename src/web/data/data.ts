import { State } from '@/types/state';
import statesJson from './states.json';
import questionsJson from './questions-core.json';
import pruefstellenJson from './prüfstellen.json';
import evaluationJson from './current-evaluation.json';
import enJson from './translations/en.json';
import deJson from './translations/de.json';
import { Question } from '@/types/question';
import { PrüfstellenData } from '@/types/prüfstellen';
import { EvaluationData } from '@/types/evaluation';

export const pruefstellenData = () => JSON.parse(JSON.stringify(pruefstellenJson)) as PrüfstellenData[];
export const statesData = () => JSON.parse(JSON.stringify(statesJson)) as State[];
export const questionsData = () => JSON.parse(JSON.stringify(questionsJson)) as Question[];
export const evaluationData = () => JSON.parse(JSON.stringify(evaluationJson)) as EvaluationData;
export const getTranslations = (appLanguage: string) => {
    if (appLanguage === "de") {
        return deJson;
    }
    return enJson;
};