import './components/route';
import './components/route-container';

import {
  hook_a_link,
  hook_history_change,
} from './lib/hooks';

let initted = false;

export function version() { return '0.2.8'; }

export function preload() {
  if (initted) return;
  initted = true;
  hook_a_link();
  hook_history_change();
}

export * from './lib/hooks';
export * from './components/route';
export * from './components/route-container';