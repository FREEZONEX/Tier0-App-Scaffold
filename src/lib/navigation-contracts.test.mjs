import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import {
  defaultModules,
  validateNavigationModules,
} from "../components/shell-modules.ts";
import { isAppChromeCompatibleHref } from "./app-chrome.ts";

function normalizeMenuPath(value) {
  if (!value) {
    return "/";
  }

  const withLeadingSlash = value.startsWith("/") ? value : `/${value}`;
  return withLeadingSlash === "/"
    ? "/"
    : withLeadingSlash.replace(/\/+$/, "");
}

function isMenuHrefActive(href, pathname) {
  const normalizedHref = normalizeMenuPath(href);
  const normalizedPathname = normalizeMenuPath(pathname);

  if (normalizedHref === "/") {
    return normalizedPathname === "/";
  }

  return (
    normalizedPathname === normalizedHref ||
    normalizedPathname.startsWith(`${normalizedHref}/`)
  );
}

function collectActiveCandidates(modules, pathname, candidates = []) {
  for (const module of modules) {
    if (module.href && isMenuHrefActive(module.href, pathname)) {
      candidates.push({
        key: module.key,
        href: normalizeMenuPath(module.href),
        order: candidates.length,
      });
    }

    if (module.children?.length) {
      collectActiveCandidates(module.children, pathname, candidates);
    }
  }

  return candidates;
}

function getActiveModuleKey(modules, pathname) {
  return collectActiveCandidates(modules, pathname).sort((a, b) => {
    if (a.href.length !== b.href.length) {
      return b.href.length - a.href.length;
    }

    return a.order - b.order;
  })[0]?.key;
}

function generatedPageRoutePatterns() {
  const routeTree = readFileSync(
    join(process.cwd(), "src/routeTree.gen.ts"),
    "utf8",
  );

  return [
    ...new Set(
      [...routeTree.matchAll(/\bfullPath:\s*'([^']+)'/g)]
        .map((match) => normalizeMenuPath(match[1]))
        .filter((path) => path !== "/api" && !path.startsWith("/api/")),
    ),
  ];
}

function routePatternMatches(pattern, href) {
  if (pattern === href) return true;

  const patternSegments = pattern.split("/").filter(Boolean);
  const hrefSegments = href.split("/").filter(Boolean);
  if (patternSegments.length !== hrefSegments.length) return false;

  return patternSegments.every(
    (segment, index) =>
      segment.startsWith("$") || segment === hrefSegments[index],
  );
}

function findMissingRouteTargets(leaves, routePatterns) {
  return leaves.filter(
    ({ href }) =>
      !routePatterns.some((pattern) => routePatternMatches(pattern, href)),
  );
}

describe("navigation contracts", () => {
  it("keeps sidebar active matching segment-aware and unique", () => {
    const modules = [
      { key: "home", href: "/" },
      { key: "material", href: "/material" },
      { key: "materialLots", href: "/material-lots" },
      {
        key: "inventory",
        children: [
          { key: "lots", href: "/inventory/lots" },
          { key: "lotHolds", href: "/inventory/lots/holds" },
        ],
      },
    ];

    assert.equal(getActiveModuleKey(modules, "/"), "home");
    assert.equal(getActiveModuleKey(modules, "/material"), "material");
    assert.equal(getActiveModuleKey(modules, "/material/123"), "material");
    assert.equal(getActiveModuleKey(modules, "/material-lots"), "materialLots");
    assert.equal(
      getActiveModuleKey(modules, "/inventory/lots/holds/42"),
      "lotHolds",
    );
    assert.equal(isMenuHrefActive("/material", "/material-lots"), false);
    assert.equal(isMenuHrefActive("/", "/material"), false);
  });

  it("keeps Shell, not Link activeProps, responsible for the selected menu", () => {
    const shell = readFileSync(
      join(process.cwd(), "src/components/Shell.tsx"),
      "utf8",
    );

    assert.match(shell, /const sidebarItemActive =[\s\S]*border-border bg-highlight-bg-accent/);
    assert.match(shell, /function isMenuHrefActive/);
    assert.match(shell, /function getActiveModuleKey/);
    assert.match(shell, /function isModuleInActiveBranch/);
    assert.match(shell, /activeOptions=\{\{ exact: true \}\}/);
    assert.match(shell, /aria-current=\{isDirectActive \? "page" : undefined\}/);
    assert.match(shell, /aria-current=\{isChildActive \? "page" : undefined\}/);
    assert.doesNotMatch(shell, /border-highlight-bg-primary.*sidebarItemActive/);
    assert.doesNotMatch(shell, /\bactiveProps\s*=/);
    assert.doesNotMatch(shell, /\binactiveProps\s*=/);
  });

  it("rejects ambiguous sidebar module declarations", () => {
    assert.throws(
      () =>
        validateNavigationModules([
          { key: "home", label: "Home", href: "/" },
          { key: "receipts", label: "Receipts", href: "/" },
        ]),
      /href "\/" is already used by Home/,
    );

    assert.throws(
      () =>
        validateNavigationModules([
          { key: "inventory", label: "Inventory" },
        ]),
      /clickable leaf requires href/,
    );

    assert.deepEqual(
      validateNavigationModules([
        { key: "home", label: "Home", href: "/" },
        {
          key: "inventory",
          label: "Inventory",
          children: [
            { key: "lots", label: "Lots", href: "/inventory/lots" },
            { key: "holds", label: "Holds", href: "/inventory/holds/" },
          ],
        },
      ]).map(({ href }) => href),
      ["/", "/inventory/lots", "/inventory/holds"],
    );

    assert.deepEqual(
      findMissingRouteTargets(
        [{ key: "missing", label: "Missing", href: "/missing" }],
        ["/", "/inventory", "/work-orders/$id"],
      ).map(({ href }) => href),
      ["/missing"],
    );
    assert.deepEqual(
      findMissingRouteTargets(
        [{ key: "detail", label: "Detail", href: "/work-orders/42" }],
        ["/work-orders/$id"],
      ),
      [],
    );
  });

  it("requires every generated sidebar target to be a real workspace page", () => {
    const leaves = validateNavigationModules(defaultModules);
    const routePatterns = generatedPageRoutePatterns();
    const incompatible = leaves.filter(
      ({ href }) =>
        href === "/api" ||
        href.startsWith("/api/") ||
        !isAppChromeCompatibleHref(href),
    );
    const missing = findMissingRouteTargets(leaves, routePatterns);

    assert.deepEqual(
      incompatible,
      [],
      `Sidebar targets must use workspace app chrome:\n${incompatible
        .map(({ key, href }) => `${key}: ${href}`)
        .join("\n")}`,
    );
    assert.deepEqual(
      missing,
      [],
      `Sidebar targets without a generated page route:\n${missing
        .map(({ key, href }) => `${key}: ${href}`)
        .join("\n")}\nAvailable routes: ${routePatterns.join(", ")}`,
    );
  });

});
