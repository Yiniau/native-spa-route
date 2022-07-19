import './components/route';
import './components/route-container';

import {
  hook_a_link,
  hook_history_change,
} from './lib/hooks';

let initted = false;

export function preload() {
  if (initted) return;
  initted = true;
  hook_a_link();
  hook_history_change();
}

export * from './lib/hooks';