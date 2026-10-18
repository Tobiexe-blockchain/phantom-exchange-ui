import { config } from '../config';
import { createDemoFeed } from './demo';
import { createEngineFeed } from './engine';
import { createSocketIoFeed } from './socketio';
import type { Feed } from './types';

export function createFeed(): Feed {
  if (config.source === 'engine') return createEngineFeed(config.engineHttpUrl, config.engineWsUrl);
  if (config.source === 'mock') return createSocketIoFeed(config.wsUrl);
  return createDemoFeed();
}
