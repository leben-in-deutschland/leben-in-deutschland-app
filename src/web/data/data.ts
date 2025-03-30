import { State } from '@/types/state';
import statesJson from './states.json';
import questionsJson from './question.json';
import pruefstellenJson from './prüfstellen.json';
import enJson from './translations/en.json';
import deJson from './translations/de.json';
import { Question } from '@/types/question';
import { PrüfstellenData } from '@/types/prüfstellen';

export const pruefstellenData = () => JSON.parse(JSON.stringify(pruefstellenJson)) as PrüfstellenData[];
export const statesData = () => JSON.parse(JSON.stringify(statesJson)) as State[];
export const questionsData = () => JSON.parse(JSON.stringify(questionsJson)) as Question[];
export const getTranslations = (appLanguage: string) => {
    if (appLanguage === "de") {
        return deJson;
    }
    return enJson;
};