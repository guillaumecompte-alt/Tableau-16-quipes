import { QueryClient } from '@tanstack/react-query';
import { createMemoryHistory, createRouter, RouterProvider } from '@tanstack/react-router';
import { createRoot } from 'react-dom/client';
import { routeTree } from './routeTree.gen';
import './styles.css';

const queryClient = new QueryClient();
const router = createRouter({
  routeTree,
  context: { queryClient },
  history: createMemoryHistory({ initialEntries: ['/'] }),
  scrollRestoration: true,
  defaultPreloadStaleTime: 0,
});

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('Élément racine introuvable pour ZE PADEL.');
}

createRoot(rootElement).render(<RouterProvider router={router} />);
