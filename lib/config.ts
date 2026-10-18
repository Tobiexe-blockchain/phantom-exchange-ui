export type DataSource = 'demo' | 'mock' | 'engine';

export const config = {
  /** demo: simulated in the browser, no server. mock: the Socket.io demo server. engine: phantom-matcher. */
  source: (process.env.NEXT_PUBLIC_DATA_SOURCE === 'engine' ? 'engine' : process.env.NEXT_PUBLIC_DATA_SOURCE === 'mock' ? 'mock' : 'demo') as DataSource,
  wsUrl: process.env.NEXT_PUBLIC_WS_URL ?? 'http://localhost:4000',
  engineHttpUrl: process.env.NEXT_PUBLIC_ENGINE_HTTP_URL ?? 'http://localhost:8080',
  engineWsUrl: process.env.NEXT_PUBLIC_ENGINE_WS_URL ?? 'ws://localhost:8080',
};
