export const env = {
  enableMocks: import.meta.env.VITE_ENABLE_MOCKS !== 'false',
  defaultScenario: import.meta.env.VITE_MOCK_SCENARIO ?? 'default',
  apiBaseUrl: import.meta.env.VITE_API_BASE_URL ?? '/api',
} as const
