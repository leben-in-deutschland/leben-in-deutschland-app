import { State } from '@/src/types/state';
import statesJson from './states.json';
import questionsJson from './question.json';
import { Question } from '@/src/types/question';

export const statesData = () => JSON.parse(JSON.stringify(statesJson)) as State[];
export const questionsData = () => JSON.parse(JSON.stringify(questionsJson)) as Question[];