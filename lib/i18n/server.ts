import { cookies } from 'next/headers';
import { LANG_COOKIE, makeI18n, parseLang, type Lang } from '@/lib/i18n';

/** The language chosen with the header toggle (English by default). */
export async function getLang(): Promise<Lang> {
  const store = await cookies();
  return parseLang(store.get(LANG_COOKIE)?.value);
}

export async function getI18n() {
  return makeI18n(await getLang());
}
