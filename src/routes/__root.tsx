import {
  createRootRoute,
  HeadContent,
  Link,
  Outlet,
  Scripts,
} from "@tanstack/react-router";
import { Toaster } from "@/components/toaster";
import { APP_LOCALE, APP_NAME } from "@/lib/app-chrome";
import "@fontsource/ibm-plex-sans/400.css";
import "@fontsource/ibm-plex-sans/500.css";
import "@fontsource/ibm-plex-sans/600.css";
import "@fontsource/ibm-plex-sans/700.css";
import "@fontsource/inter/600.css";
import "@fontsource/inter/700.css";
import "@fontsource/ibm-plex-mono/400.css";
import "@fontsource/ibm-plex-mono/500.css";
import "@fontsource/ibm-plex-mono/600.css";
import globalsCss from "@/styles/globals.css?url";
// Preload the faces painted on the first frame (body sans + cover mono) so
// the self-hosted fonts arrive before first paint instead of swapping in
// after it and flashing from the system fallback.
import plexSans400 from "@fontsource/ibm-plex-sans/files/ibm-plex-sans-latin-400-normal.woff2?url";
import plexSans500 from "@fontsource/ibm-plex-sans/files/ibm-plex-sans-latin-500-normal.woff2?url";
import plexMono400 from "@fontsource/ibm-plex-mono/files/ibm-plex-mono-latin-400-normal.woff2?url";

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: APP_NAME },
      { name: "description", content: "Business application for factory-floor operations." },
    ],
    links: [
      ...[plexSans400, plexSans500, plexMono400].map((href) => ({
        rel: "preload",
        as: "font",
        type: "font/woff2",
        href,
        crossOrigin: "anonymous" as const,
      })),
      { rel: "stylesheet", href: globalsCss },
      { rel: "icon", type: "image/svg+xml", href: "/builder-logo-dark.svg" },
    ],
  }),
  component: RootDocument,
  notFoundComponent: NotFound,
});

function RootDocument() {
  return (
    <html lang={APP_LOCALE} className="h-full antialiased font-sans">
      <head>
        <HeadContent />
      </head>
      <body className="min-h-full font-sans">
        <Outlet />
        <Toaster />
        <Scripts />
      </body>
    </html>
  );
}

function NotFound() {
  return (
    <div className="flex h-full items-center justify-center p-6 sm:p-12">
      <div className="text-center">
        <p className="text-4xl font-semibold sm:text-5xl">404</p>
        <p className="mt-2 text-sm text-muted-foreground sm:text-base">Page not found</p>
        <Link
          to="/"
          className="mt-4 inline-flex h-9 items-center justify-center rounded-md border border-border bg-card px-3 text-sm font-medium text-foreground shadow-sm transition-[background-color,border-color,box-shadow] duration-150 hover:border-border-strong hover:bg-background hover:shadow-md focus:border-highlight focus:outline-none"
        >
          Back Home
        </Link>
      </div>
    </div>
  );
}
