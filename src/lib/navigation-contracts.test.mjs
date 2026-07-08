import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";

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

  it("does not ship Overview as a required default workspace page", () => {
    const shellModules = readFileSync(
      join(process.cwd(), "src/components/shell-modules.ts"),
      "utf8",
    );
    const permissions = readFileSync(
      join(process.cwd(), "src/lib/permissions.ts"),
      "utf8",
    );
    const blankRoute = readFileSync(
      join(process.cwd(), "src/routes/_app.index.tsx"),
      "utf8",
    );

    assert.match(shellModules, /export const defaultModules: NavModule\[\] = \[\]/);
    assert.doesNotMatch(shellModules, /\bOverview\b/);
    assert.doesNotMatch(shellModules, /\bview_dashboard\b/);
    assert.doesNotMatch(permissions, /\bview_dashboard\b/);
    assert.match(blankRoute, /Do not create an\s+ \* overview\/dashboard page unless/);
  });
});
