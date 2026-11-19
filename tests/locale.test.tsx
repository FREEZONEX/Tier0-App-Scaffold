import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, test } from "node:test";
import { createElement } from "react";
import { renderToString } from "react-dom/server";
import {
  APP_DEFAULT_LOCALE,
  APP_SUPPORTED_LOCALES,
  UI_COPY,
  defineCopy,
  resolveAppLocale,
  translate,
} from "../src/lib/app-chrome";
import { LocaleProvider, UiText, useCopy, useLocale } from "../src/lib/locale";

// The platform page runtime, as the front door installs it (2.2.0 has
// getPlatformLanguage); tests set what the host page has sent.
const RUNTIME_KEY = Symbol.for("tier0.page-runtime.v1");
afterEach(() => {
  delete (globalThis as Record<symbol, unknown>)[RUNTIME_KEY];
});
function runtimeWithLanguage(language: string | undefined) {
  (globalThis as Record<symbol, unknown>)[RUNTIME_KEY] = Object.freeze({
    version: "2.2.0",
    appId: "a",
    policy: "visible",
    getState: () => "running",
    getSleepAt: () => null,
    on: () => () => undefined,
    reportAuthError: () => undefined,
    keepAwake: () => undefined,
    getPlatformLanguage: () => language,
  });
}

test("maps platform language tags to supported App locales, else the default", () => {
  assert.deepEqual([...APP_SUPPORTED_LOCALES], ["en", "zh-CN"]);
  assert.equal(APP_DEFAULT_LOCALE, "en");
  assert.equal(resolveAppLocale("zh-cn"), "zh-CN");
  assert.equal(resolveAppLocale("ZH-CN"), "zh-CN");
  assert.equal(resolveAppLocale("zh-tw"), "zh-CN", "same primary language");
  assert.equal(resolveAppLocale("en"), "en");
  assert.equal(resolveAppLocale("en-gb"), "en");
  for (const unsupported of ["ja", "ko", "th", "ru"]) assert.equal(resolveAppLocale(unsupported), APP_DEFAULT_LOCALE, unsupported);
  assert.equal(resolveAppLocale(undefined), APP_DEFAULT_LOCALE, "top-level page, older runtime or host, not sent yet");
});

test("translate fills placeholders and leaves unknown ones visible", () => {
  const copy = defineCopy({
    en: { min: "At least {count} characters", plain: "Name" },
    "zh-CN": { min: "至少 {count} 个字符", plain: "名称" },
  });
  assert.equal(translate(copy, "en", "min", { count: 3 }), "At least 3 characters");
  assert.equal(translate(copy, "zh-CN", "min", { count: 3 }), "至少 3 个字符");
  assert.equal(translate(copy, "zh-CN", "min"), "至少 {count} 个字符");
  assert.equal(translate(copy, "en", "plain", { count: 3 }), "Name");
});

test("every UI label exists in every supported locale", () => {
  const keys = Object.keys(UI_COPY.en).sort();
  for (const locale of APP_SUPPORTED_LOCALES) {
    assert.deepEqual(Object.keys(UI_COPY[locale]).sort(), keys, locale);
    for (const key of keys) assert.ok((UI_COPY[locale] as Record<string, string>)[key], `${locale}.${key}`);
  }
});

test("the server and the first client render use the default locale, whatever the platform sent", () => {
  const copy = defineCopy({ en: { title: "Work orders" }, "zh-CN": { title: "工单" } });
  function Page() {
    const t = useCopy(copy);
    return createElement("p", { "data-locale": useLocale() }, t("title"), " ", createElement(UiText, { id: "save" }));
  }
  for (const sent of [undefined, "zh-cn"]) {
    runtimeWithLanguage(sent);
    const html = renderToString(createElement(LocaleProvider, null, createElement(Page)));
    assert.match(html, /data-locale="en"/, String(sent));
    assert.equal(html.replace(/<!-- -->/g, ""), '<p data-locale="en">Work orders Save</p>', String(sent));
  }
});

// Switching language must keep unsaved input: only the provider's value
// changes. These are the ways to lose it that the scaffold rules out.
test("switching language never remounts, reloads or re-navigates", () => {
  const source = (path: string) => readFileSync(join(process.cwd(), path), "utf8");
  const locale = source("src/lib/locale.tsx");
  const root = source("src/routes/__root.tsx");
  assert.match(locale, /useSyncExternalStore\(onPlatformLanguage, platformLocale, firstScreenLocale\)/);
  assert.match(locale, /document\.documentElement\.lang = locale/);
  for (const [name, text] of [["locale.tsx", locale], ["__root.tsx", root]] as const) {
    assert.doesNotMatch(text, /key=\{[^}]*locale/i, `${name}: no element keyed on the locale`);
    assert.doesNotMatch(text, /location\.reload|router\.invalidate|navigate\(/, `${name}: no reload or navigation`);
  }
  assert.match(root, /<html lang=\{APP_DEFAULT_LOCALE\}/, "<html lang> renders the first-screen locale only");
  assert.match(root, /<LocaleProvider>\s*<Outlet \/>/, "one provider around the whole app, in the root document");
});
