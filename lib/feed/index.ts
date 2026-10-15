import { config } from '../config';
import { createEngineFeed } from './engine';
import { createSocketIoFeed } from './socketio';
import type { Feed } from './types';

export function createFeed(): Feed {
  return config.source === 'engine'
    ? createEngineFeed(config.engineHttpUrl, config.engineWsUrl)
    : createSocketIoFeed(config.wsUrl);
}
