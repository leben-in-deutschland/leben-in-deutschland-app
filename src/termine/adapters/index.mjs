// The course systems the sync can read. A source in sources.json names one.
import { isItemPage, parseItem } from "./item.mjs";
import { isKuferPage, parseKufer } from "./kufer.mjs";

export const ADAPTERS = {
    kufer: { parse: parseKufer, recognises: isKuferPage },
    item: { parse: parseItem, recognises: isItemPage },
};

export const ADAPTER_NAMES = Object.keys(ADAPTERS);
