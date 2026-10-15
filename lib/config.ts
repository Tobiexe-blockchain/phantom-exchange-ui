export type DataSource = 'mock' | 'engine';

export const config = {
  source: (process.env.NEXT_PUBLIC_DATA_SOURCE === 'engine' ? 'engine' : 'mock') as DataSource,
  wsUrl: process.env.NEXT_PUBLIC_WS_URL ?? 'http://localhost:4000',
  engineHttpUrl: process.env.NEXT_PUBLIC_ENGINE_HTTP_URL ?? 'http://localhost:8080',
  engineWsUrl: process.env.NEXT_PUBLIC_ENGINE_WS_URL ?? 'ws://localhost:8080',
};
