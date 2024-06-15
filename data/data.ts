import { State } from '@/types/state';
import statesJson from './states.json';

export const statesData = () => JSON.parse(JSON.stringify(statesJson)) as State[];