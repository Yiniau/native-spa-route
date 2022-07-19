import debug from 'debug';
import { css, html, LitElement, nothing } from 'lit';
import { customElement, property, query, queryAll, state } from 'lit/decorators.js';
import { unsafeHTML } from 'lit/directives/unsafe-html.js';
import { cache } from 'lit/directives/cache.js';
import { Route } from './route';


@customElement('native-route')
export class RouteContainer extends LitElement {

	@queryAll('native-route')
	allRouteNode!: NodeListOf<Route>;

	private _is_match_route() {
		for (const route of this.allRouteNode) {
			if (route.isActive()) {
				return true;
			}
		}
		return false;
	}

	protected render() {
		return html`
			<slot @slotchanged></slot>
		`;
	}

	connectedCallback(): void {
		
	}
}