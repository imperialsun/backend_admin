import type { ReactElement, ReactNode } from "react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render } from "@testing-library/react"
import { MemoryRouter } from "react-router-dom"

export function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
      mutations: {
        retry: false,
      },
    },
  })
}

export function renderWithProviders(
  ui: ReactElement,
  options?: {
    route?: string
    queryClient?: QueryClient
    wrapper?: (children: ReactNode) => ReactNode
  },
) {
  const queryClient = options?.queryClient ?? createTestQueryClient()
  const route = options?.route ?? "/"

  return {
    queryClient,
    ...render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={[route]}>
          {options?.wrapper ? options.wrapper(ui) : ui}
        </MemoryRouter>
      </QueryClientProvider>,
    ),
  }
}
