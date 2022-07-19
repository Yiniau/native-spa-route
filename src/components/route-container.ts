import { html, LitElement, nothing, PropertyValueMap } from 'lit';
import { customElement, property, queryAll, state } from 'lit/decorators.js';
import { unsafeHTML } from 'lit/directives/unsafe-html.js';
import { hook_route_change, unhook_route_change } from '../lib/hooks';
import { Route } from './route';

@customElement('native-route-container')
export class RouteContainer extends LitElement {
  /**
   * config container work route path, default is `/`
   * @default '/'
   */
  @property({ type: String, attribute: 'root-path', reflect: true })
  rootPath: string = '/';

  /**
   * config should cacht event where the target has `href` attribute
   * if enable this, click a link will auto use `history.pushState`.
   * @default true
   */
  @property({ type: Boolean })
  autoCatchHrefClick: boolean = true;

  /**
   * config is this component use shadow dom.
   * @default false
   */
  @property({ type: Boolean })
  disableShadow: boolean = false;

  @queryAll('native-route')
  allRouteNode!: NodeListOf<Route>;

  @state()
  statusRenderMap!: Record<string, (status: string) => string>;

  @state()
  status: 'common' | '404' = 'common';

  @state()
  contentOf404?: string | (() => string);

	@state()
	active: boolean = false;

  // constructor() {
  // 	super();
  // }

  /**
   * get current container's status
   */
  public getStatus() {
    return this.status;
  }

  /**
   * if disabled shadow dom, this is the only way to add 404 status content
   */
  public set404Content(content: string | (() => string)) {
    this.contentOf404 = content;
  }

  private _render_with_light_dom() {
    if (this.active && this.status === '404') {
      if (!this.contentOf404) return nothing;
      let type = typeof this.contentOf404;
			if (type === 'string') {
				return html`${unsafeHTML(this.contentOf404 as string)}`;
			}
			if (type === 'function') {
				return html`${unsafeHTML((this.contentOf404 as () => string)() ?? '')}`
			}
			return nothing;
    }
		return nothing;
  }

	private _render_with_shadow_dom() {
		if (this.active && this.status === '404') {
      return html`<slot name="404"></slot>`;
    }
    return html`<slot name="common"></slot>`;
	}
 
  protected render() {
    if (this.disableShadow) {
      return this._render_with_light_dom();
    } else {
			return this._render_with_shadow_dom();
		}
  }

  private _is_match_route() {
		if (!location.pathname.startsWith(this.rootPath)) return true; // not render 404 will this container is not active
    const scopedRoutes = this.querySelectorAll('native-route');
    for (const route of scopedRoutes) {
      if (route.checkIsExactMatch()) {
        return true;
      }
    }
    return false;
  }

  protected override createRenderRoot() {
    if (!this.disableShadow) {
      return super.createRenderRoot();
    }
    return this;
  }

  private _listen_route_active_status_change() {
    let d_timer: ReturnType<typeof setTimeout>;
    this.addEventListener('route:exact_match_change', () => {
      if (d_timer) {
        clearTimeout(d_timer);
      }
      d_timer = setTimeout(() => {
        if (this._is_match_route()) {
          this.status = 'common';
        } else {
          this.status = '404';
        }
      }, 64);
    });
  }

  @state({
    hasChanged() {
      return false;
    },
  })
  _cache_ret?: string;

  protected override updated(
    _changedProperties: PropertyValueMap<any> | Map<PropertyKey, unknown>
  ): void {
    if (this.disableShadow && this.contentOf404) {
      // if (_changedProperties.get('status') === '404') {
      // 	this._render_404();
      // } else {
      // 	debugger;
      // 	this.renderRoot.innerHTML = this._cache_ret ?? '';
      // }
    }
  }

	private _route_change_callback() {
		this.active = location.pathname.startsWith(this.rootPath);
	}

  connectedCallback(): void {
    super.connectedCallback();
    this._listen_route_active_status_change();
		this._route_change_callback();
    hook_route_change(this._route_change_callback);
  }

	disconnectedCallback() {
    super.disconnectedCallback();
    unhook_route_change(this._route_change_callback);
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'native-route-container': RouteContainer;
  }
}
