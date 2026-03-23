import { Suspense, lazy } from 'react';

const PageClient = lazy(() => import('./PageClient'));

export default function Home() {
  return (
    <>
      <div id="boot-screen" aria-hidden="true">
        <div id="boot-lines" />
      </div>

      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:px-4 focus:py-2 focus:bg-white focus:text-black"
      >
        Skip to content
      </a>

      <Suspense fallback={null}>
        <PageClient />
      </Suspense>
    </>
  );
}