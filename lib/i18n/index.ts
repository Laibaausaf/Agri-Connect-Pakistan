import {
  ACCOUNT_STATUSES,
  CHAT_ACTION_PATTERNS,
  DAY_PERIODS,
  DEDUCTION_PATTERNS,
  DEDUCTION_TYPES,
  ERROR_MESSAGES,
  ERROR_PATTERNS,
  GRADES,
  NAV_LABELS,
  NAV_ROLE_LABELS,
  NAV_SECTIONS,
  PACKAGING,
  PAYMENT_METHODS,
  PLACES,
  QUICK_PROMPTS,
  ROLE_NAMES,
  STATUSES,
  STORED_TEXT_TEMPLATES,
  UI,
  type Lang,
  type UiKey,
} from '@/lib/i18n/translations';

export type { Lang } from '@/lib/i18n/translations';

/** Cookie that remembers the chosen language (per browser). */
export const LANG_COOKIE = 'lang';

export function parseLang(value: string | undefined | null): Lang {
  return value === 'ur' ? 'ur' : 'en';
}

type Vars = Record<string, string | number>;

/** Keys that have `.one` and `.other` variants. */
type PluralBase = UiKey extends infer K
  ? K extends `${infer Base}.one`
    ? Base
    : never
  : never;

function fill(text: string, vars?: Vars) {
  if (!vars) return text;
  return text.replace(/\{(\w+)\}/g, (match, name: string) =>
    name in vars ? String(vars[name]) : match
  );
}

// Fills {1}, {2}… from a regex match.
function fillMatch(template: string, match: RegExpMatchArray, mapPart?: (value: string, index: number) => string) {
  return template.replace(/\{(\d)\}/g, (_, n: string) => {
    const value = match[Number(n)] ?? '';
    return mapPart ? mapPart(value, Number(n)) : value;
  });
}

/**
 * All language-dependent text and formatting for one language. Works on the
 * server (from the cookie) and in the browser (from LanguageProvider).
 */
export function makeI18n(lang: Lang) {
  const ur = lang === 'ur';
  const locale = ur ? 'ur-PK' : 'en-PK';

  const number = (n: number, maximumFractionDigits = 0) =>
    n.toLocaleString('en-PK', { maximumFractionDigits });

  // Urdu dates/times: replace the English "AM"/"PM" the system writes.
  const dayPeriods = (text: string) =>
    ur ? text.replace(/\bAM\b/g, DAY_PERIODS.AM.ur).replace(/\bPM\b/g, DAY_PERIODS.PM.ur) : text;

  function t(key: UiKey, vars?: Vars) {
    const entry = UI[key];
    return fill(ur ? entry.ur : entry.en, vars);
  }

  function place(value: string | null | undefined) {
    if (!value) return '';
    if (!ur) return value;
    const whole = PLACES[value.trim()];
    if (whole) return whole.ur;
    return value
      .split(',')
      .map((part) => {
        const trimmed = part.trim();
        return PLACES[trimmed]?.ur ?? trimmed;
      })
      .join('، ');
  }

  return {
    lang,
    isUrdu: ur,
    dir: (ur ? 'rtl' : 'ltr') as 'rtl' | 'ltr',
    t,

    /** Plural helper for keys with `.one` / `.other` variants. */
    plural(base: PluralBase, count: number) {
      return t(`${base}.${count === 1 ? 'one' : 'other'}` as UiKey, { count });
    },

    role(role: string) {
      const entry = ROLE_NAMES[role];
      return entry ? (ur ? entry.ur : entry.en) : role;
    },

    nav(label: string, role?: string) {
      if (!ur) return label;
      return (role && NAV_ROLE_LABELS[`${role}:${label}`]) ?? NAV_LABELS[label] ?? label;
    },

    navSection(title: string) {
      return ur ? NAV_SECTIONS[title] ?? title : title;
    },

    /** Crop name from the database: `nameUrdu` in Urdu mode when present. */
    crop(crop: { name: string; nameUrdu?: string | null }) {
      return ur && crop.nameUrdu ? crop.nameUrdu : crop.name;
    },

    place,

    status(value: string) {
      const entry = STATUSES[value];
      if (entry) return ur ? entry.ur : entry.en;
      return value.replace(/_/g, ' ').toLowerCase().replace(/^\w/, (c) => c.toUpperCase());
    },

    accountStatus(value: string) {
      const entry = ACCOUNT_STATUSES[value];
      return entry ? (ur ? entry.ur : entry.en) : value;
    },

    grade(value: string | null | undefined) {
      if (!value) return '';
      return ur ? GRADES[value]?.ur ?? value : value;
    },

    packaging(value: string | null | undefined) {
      if (!value) return '';
      return ur ? PACKAGING[value]?.ur ?? value : value;
    },

    paymentMethod(value: string) {
      return ur ? PAYMENT_METHODS[value]?.ur ?? value : value;
    },

    deduction(type: string, description: string) {
      if (!ur) return description;
      for (const { pattern, ur: template } of DEDUCTION_PATTERNS) {
        const match = description.match(pattern);
        if (match) return fillMatch(template, match);
      }
      return DEDUCTION_TYPES[type] ?? description;
    },

    /** Server error messages (several may be joined with ", "). */
    error(message: string) {
      if (!ur) return message;
      const one = (text: string) => {
        if (ERROR_MESSAGES[text]) return ERROR_MESSAGES[text];
        for (const { pattern, ur: template } of ERROR_PATTERNS) {
          const match = text.match(pattern);
          if (match) return fillMatch(template, match);
        }
        return null;
      };
      return one(message) ?? message.split(', ').map((part) => one(part) ?? part).join('، ');
    },

    /**
     * The same server error as a list of things to fix, for the summary at the
     * top of a form. Validation errors arrive joined with ", "; a message that
     * is known as a whole stays one item.
     */
    errorList(message: string): string[] {
      const one = (text: string) => {
        if (ERROR_MESSAGES[text]) return ur ? ERROR_MESSAGES[text] : text;
        for (const { pattern, ur: template } of ERROR_PATTERNS) {
          const match = text.match(pattern);
          if (match) return ur ? fillMatch(template, match) : text;
        }
        return null;
      };
      const whole = one(message);
      if (whole) return [whole];
      return message.split(', ').map((part) => (ur ? one(part) ?? part : part));
    },

    /** AI chat quick-prompt button text. */
    quickPrompt(prompt: string) {
      return ur ? QUICK_PROMPTS[prompt] ?? prompt : prompt;
    },

    /** AI chat pending-action summary written by the server. */
    chatAction(summary: string, cropNames: Record<string, string>) {
      if (!ur) return summary;
      for (const { pattern, ur: template } of CHAT_ACTION_PATTERNS) {
        const match = summary.match(pattern);
        if (match) {
          return fillMatch(template, match, (value, index) => {
            if (match.length === 4 && index === 2) return cropNames[value] ?? value;
            if (match.length === 4 && index === 3) return place(value);
            if (match.length === 2 && index === 1) return cropNames[value] ?? value;
            return value;
          });
        }
      }
      return summary;
    },

    /**
     * Notification / supply-chain event text stored in English. In Urdu mode it
     * is translated when it matches a known template (STORED_TEXT_TEMPLATES);
     * otherwise it is returned exactly as stored. `cropNames` maps English crop
     * names to Urdu (matched without regard to case).
     */
    storedText(text: string, cropNames: Record<string, string>) {
      if (!ur || !text) return text;
      const cropUr = (value: string) => {
        const key = value.trim().toLowerCase();
        for (const [en, urName] of Object.entries(cropNames)) {
          if (en.toLowerCase() === key) return urName;
        }
        return value;
      };
      for (const { pattern, ur: template, parts } of STORED_TEXT_TEMPLATES) {
        const match = text.match(pattern);
        if (!match) continue;
        return fillMatch(template, match, (value, index) => {
          switch (parts?.[index - 1]) {
            case 'kg':
              return `${value} کلو`;
            case 'rs':
              return `${value} روپے`;
            case 'perKg':
              return `${value} روپے فی کلو`;
            case 'crop':
              return cropUr(value);
            case 'variety': {
              // "Roma tomato": the variety is typed text, the last word is the crop.
              const words = value.split(' ');
              const last = words.pop() ?? '';
              return [...words, cropUr(last)].join(' ');
            }
            case 'place':
              return place(value);
            case 'grade':
              return GRADES[value]?.ur ?? value;
            default:
              return value;
          }
        });
      }
      return text;
    },

    number,

    /** "Rs 9,200" / "9,200 روپے" */
    money(n: number) {
      const value = number(Math.round(n));
      return ur ? `${value} روپے` : `Rs ${value}`;
    },

    /** Like money() but keeps one decimal (for rates such as Rs 92.5). */
    rate(n: number) {
      const value = number(n, 1);
      return ur ? `${value} روپے` : `Rs ${value}`;
    },

    /** "Rs 92/kg" / "92 روپے فی کلو" */
    perKg(n: number) {
      const value = number(Math.round(n));
      return ur ? `${value} روپے فی کلو` : `Rs ${value}/kg`;
    },

    /** "500 kg" / "500 کلو" */
    kg(n: number) {
      const value = number(n, 1);
      return ur ? `${value} کلو` : `${value} kg`;
    },

    /** Same wording as formatDistance() in lib/geo.ts, in the active language. */
    distance(km: number | null) {
      if (km === null) return ur ? 'فاصلہ معلوم نہیں' : 'Distance unknown';
      if (km < 1) {
        const m = Math.round(km * 1000);
        return ur ? `${m} میٹر دور` : `${m} m away`;
      }
      return ur ? `${km} کلومیٹر دور` : `${km} km away`;
    },

    /** Dates with Urdu month names in Urdu mode; digits stay Western. */
    date(value: Date | string, options: Intl.DateTimeFormatOptions = {}) {
      const date = typeof value === 'string' ? new Date(value) : value;
      return date.toLocaleDateString(locale, { numberingSystem: 'latn', ...options });
    },

    dateTime(value: Date | string, options: Intl.DateTimeFormatOptions = {}) {
      const date = typeof value === 'string' ? new Date(value) : value;
      return dayPeriods(date.toLocaleString(locale, { numberingSystem: 'latn', ...options }));
    },

    time(value: Date | string, options: Intl.DateTimeFormatOptions = {}) {
      const date = typeof value === 'string' ? new Date(value) : value;
      return dayPeriods(date.toLocaleTimeString(locale, { numberingSystem: 'latn', ...options }));
    },
  };
}

export type I18n = ReturnType<typeof makeI18n>;
