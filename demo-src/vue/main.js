import { createApp } from './node_modules/vue'
import App from './App.vue'

export function render(target) {
	return createApp(App).mount(target);
}