/**
 * Locale primitives kept in a dependency-free module so that feature `locales.ts` files can
 * import the type contract without pulling in i18next, the database or the logger.
 *
 * IMPORTANT: When adding a new language, add it here AND in `locales.ts`. The i18n test suite
 * verifies that every locale defined in `locales.ts` is listed here, so a mismatch is caught in CI.
 */

export const SUPPORTED_LOCALES = ['en-US', 'pl'] as const;

export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number];

export const DEFAULT_LOCALE: SupportedLocale = 'en-US';

export function isSupportedLocale(value: string | null | undefined): value is SupportedLocale {
  return typeof value === 'string' && (SUPPORTED_LOCALES as readonly string[]).includes(value);
}

/**
 * Shape that every feature's `locales.ts` default export must satisfy. Using it with `satisfies`
 * makes TypeScript reject a locale that is missing a key, has a typo in one, or defines an extra
 * key that no other locale has.
 */
export type LocaleBundle<TStrings> = Record<SupportedLocale, TStrings>;
