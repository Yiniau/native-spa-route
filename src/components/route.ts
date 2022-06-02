import { html, LitElement, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';

import { hook_route_change, unhook_route_change } from '@/lib/hooks';
const a = import('@/lib/hooks');

export type RouteConfig = {
  path: string;
  title: string;
  children?: RouteConfig[];
}[];

function getFullPath(url: string, node: HTMLElement): string {
  let isR = /^\//.test(url);
  if (node.parentElement && node.parentElement.tagName !== 'BODY') {
    if (node.parentElement.tagName === 'NATIVE-SPA-ROUTE') {
      const parentPath = node.parentElement.getAttribute('path') ?? '';
      const _url = `${isR ? '' : '/'}${url}`;
      if (parentPath === '' || parentPath === '/') {
        return _url;
      } else {
        return getFullPath(`${parentPath}${_url}`, node.parentElement);
      }
    } else {
      return getFullPath(url, node.parentElement);
    }
  }
  if (!isR) {
    return `/${url}`;
  }
  return url;
}

function isEmpty(obj: any): boolean {
  return [null, undefined].includes(obj);
}

/**
 * An example element.
 *
 * @slot - This element has a slot
 * @csspart button - The button
 */
@customElement('native-route')
export class MyElement extends LitElement {
  @property({ type: String, reflect: true })
  // path: string = this.getAttribute('path') ?? '';
  path: string = '';

  @property({ type: Boolean, reflect: true })
  exact: boolean = false;

  @property({ type: String, reflect: true })
  // element: string = this.getAttribute('element') ?? '';
  element: string = '';

  @property({ type: String, reflect: true })
  url?: string;

  @property({ type: Boolean, reflect: true })
  // lazy: boolean = ['', 'true'].includes(this.getAttribute('lazy') ?? 'false');
  lazy: boolean = false;

  @property({ type: String, reflect: true, attribute: 'append-direction' })
  appendDirection: 'before' | 'after' = 'after';

  @property({ reflect: true, attribute: 'custom-render' })
  customRender: boolean | string = false;

  @state()
  private active: boolean = false;

  @state({ hasChanged: () => false })
  private _url_module?: Promise<any>;

  constructor() {
    super();
  }

  render() {
    const content = this.active
      ? this.customRender
        ? nothing
        : this.element
      : nothing;
    return html`
      ${this.appendDirection === 'before'
        ? html`${content}<slot></slot>`
        : html`<slot></slot>${content}`}
    `;
  }

  loadAssets() {
    const url = this.getAttribute('url');
    if (typeof url === 'string') {
      // Route.LOADED_URL[url] = 1;
      this._url_module = import(url);
      return this._url_module;
    }
    return null;
  }

  route_change_callback() {
    let _path = this.path;
    if (!/^\//.test(_path)) {
      _path = getFullPath(_path, this);
    }

    if (this.exact) {
      this.active = window.location.pathname === _path;
      return;
    }

    const local_pg = window.location.pathname.split('/').filter((t) => !!t);
    const route_pg = _path.split('/').filter((t) => !!t);
    let isMatch = true;
    for (let i = 0; i < route_pg.length; i++) {
      if (i >= local_pg.length) break;
      const l_p = local_pg[i];
      const r_p = route_pg[i];
      if (l_p !== r_p) {
        isMatch = false;
        break;
      }
    }

    this.active = isMatch;
  }

	updated(changedProperties: Map<string | number | symbol, unknown>) {
		let module;
		if (changedProperties.has('active')) {
			if (!this.active) {
				return;
			}

			if (!this.lazy) {
				if (!this._url_module) {
					const module = await this.loadAssets();
					if (module.render) {
						
					}
				}
			}

			if (this.lazy && !this._url_module) {
				this.loadAssets();
			}
			if (this.url && this.lazy) {
				if (!this._url_module) {
					module = this.loadAssets();
				}
			}
		}
	}

  connectedCallback() {
    if (!this.lazy && this.url) {
      this.loadAssets();
    }
    this.route_change_callback();
    hook_route_change(this.route_change_callback);
  }

  disconnectedCallback() {
    unhook_route_change(this.route_change_callback);
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'native-route': MyElement;
  }
}
