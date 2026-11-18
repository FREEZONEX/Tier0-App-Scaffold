import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
  RouterProvider,
  type ErrorRouteComponent,
} from '@tanstack/react-router';
import { RouteErrorBoundary } from '../src/components/ui/route-error-boundary';

const TANSTACK_RED_BOX = /Something went wrong!/;

// Server-render /stats under a pathless layout, the shape of the home page and
// generated pages under `_app`: the child loader fails and the child has no
// errorComponent unless one is passed.
async function renderFailingChild(options: {
  defaultErrorComponent?: ErrorRouteComponent;
  childErrorComponent?: ErrorRouteComponent;
}) {
  const rootRoute = createRootRoute({ component: Outlet });
  const layout = createRoute({
    getParentRoute: () => rootRoute,
    id: '_app',
    component: () => createElement('main', null, createElement(Outlet)),
    errorComponent: ({ error }) => createElement(RouteErrorBoundary, { error, scope: 'layout' }),
  });
  const stats = createRoute({
    getParentRoute: () => layout,
    path: '/stats',
    loader: () => {
      throw new Error('stats loader failed');
    },
    component: () => createElement('p', null, 'stats'),
    errorComponent: options.childErrorComponent,
  });
  const router = createRouter({
    routeTree: rootRoute.addChildren([layout.addChildren([stats])]),
    history: createMemoryHistory({ initialEntries: ['/stats'] }),
    defaultErrorComponent: options.defaultErrorComponent,
  });
  await router.load();
  return renderToString(createElement(RouterProvider, { router }));
}

test('without a default error component a failing child page server-renders the TanStack red box', async () => {
  const html = await renderFailingChild({});
  assert.match(html, TANSTACK_RED_BOX);
  assert.doesNotMatch(html, /data-route-error/);
});

test('the default error component server-renders the preview error marker instead of the red box', async () => {
  const html = await renderFailingChild({ defaultErrorComponent: RouteErrorBoundary });
  assert.doesNotMatch(html, TANSTACK_RED_BOX);
  assert.match(html, /data-route-error="page" hidden=""/);
  assert.match(html, /stats loader failed/);
  assert.match(html, /<main>/, 'the layout around the failed page still renders');
});

test('a route-level errorComponent still takes precedence over the default', async () => {
  const html = await renderFailingChild({
    defaultErrorComponent: RouteErrorBoundary,
    childErrorComponent: ({ error }) => createElement(RouteErrorBoundary, { error, scope: 'stats' }),
  });
  assert.match(html, /data-route-error="stats"/);
  assert.doesNotMatch(html, /data-route-error="page"/);
});

test('the App router uses RouteErrorBoundary as its default error component', () => {
  // src/router.tsx imports the generated route tree, which exists only after a
  // build, so the wiring is checked on the source.
  const router = readFileSync('src/router.tsx', 'utf8');
  assert.match(router, /defaultErrorComponent:\s*RouteErrorBoundary\b/);
});
