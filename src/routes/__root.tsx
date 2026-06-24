import {
  createRootRoute,
  HeadContent,
  Link,
  Outlet,
  Scripts,
} from "@tanstack/react-router";
import { Toaster } from "@/components/toaster";
import "@fontsource/ibm-plex-mono/400.css";
import "@fontsource/ibm-plex-mono/500.css";
import "@fontsource/ibm-plex-mono/600.css";
import globalsCss from "@/styles/globals.css?url";

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "HMI SCADA" },
      { name: "description", content: "Factory HMI process monitoring and control." },
    ],
    links: [
      { rel: "stylesheet", href: globalsCss },
      { rel: "icon", type: "image/svg+xml", href: "/builder-logo-dark.svg" },
    ],
  }),
  component: RootDocument,
  notFoundComponent: NotFound,
});

function RootDocument() {
  return (
    <html lang="zh-CN" className="h-full antialiased font-sans">
      <head>
        <HeadContent />
      </head>
      <body className="min-h-full font-mono">
        <Outlet />
        <Toaster />
        <Scripts />
      </body>
    </html>
  );
}

function NotFound() {
  return (
    <div className="flex h-full items-center justify-center p-12">
      <div className="text-center">
        <p className="text-4xl font-semibold">404</p>
        <p className="mt-2 text-xs text-muted-foreground">页面不存在</p>
        <Link
          to="/"
          className="mt-4 inline-flex h-8 items-center justify-center rounded-sm border border-border bg-card px-3 text-xs font-medium text-foreground shadow-sm transition-[background-color,border-color,box-shadow] duration-150 hover:border-border-strong hover:bg-background hover:shadow-md focus:border-highlight focus:outline-none"
        >
          返回首页
        </Link>
      </div>
    </div>
  );
}
