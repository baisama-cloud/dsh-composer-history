/**
 * dsh-composer-history — host half.
 *
 * This bundle is purely client-side: the loader row exists so the web
 * profile activates the package and `dsh-client-modules` serves
 * /plugins/dsh-composer-history/client.js. The host half intentionally
 * provides nothing; all behavior lives in the browser (lib/client.js).
 */
export const name = 'dsh-composer-history';

export const inject = [];

export function apply() {}
