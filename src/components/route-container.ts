import { html, LitElement, nothing, PropertyValueMap } from 'lit';
import { customElement, property, queryAll, state } from 'lit/decorators.js';
import { unsafeHTML } from 'lit/directives/unsafe-html.js';
import debug from 'debug';
import { hook_route_change, unhook_route_change } from '../lib/hooks';
import { Route } from './route';

const dlog = debug('native-spa-route');

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

  private _render_404() {
    if (!this.contentOf404) return nothing;
    let type = typeof this.contentOf404;
    if (type === 'string') {
      return html`${unsafeHTML(this.contentOf404 as string)}`;
    }
    if (type === 'function') {
      return html`${unsafeHTML((this.contentOf404 as () => string)() ?? '')}`;
    }
    return nothing;
  }

  private _render_with_light_dom() {
    if (this.active && this.status === '404') {
      return this._render_404();
    }
    return nothing;
  }

  private _render_with_shadow_dom() {
    if (this.active && this.status === '404') {
      return html`<slot name="404">${this._render_404()}</slot>`;
    }
    return html`<slot></slot>`;
  }

  protected render() {
    if (this.disableShadow) {
      return this._render_with_light_dom();
    } else {
      return this._render_with_shadow_dom();
    }
  }

  private async _is_match_route() {
    // if (!location.pathname.startsWith(this.rootPath)) return true; // not render 404 will this container is not active
    const scopedRoutes = this.querySelectorAll('native-route');
    await Promise.all(Array.from(scopedRoutes).map((r) => r.updateComplete));
    for (const route of scopedRoutes) {
      if (!route.virtualNode && route.isActive()) {
        dlog('this route is active: ',route);
        return true;
      }
    }
    return false;
  }

  protected override updated(
    _changedProperties: PropertyValueMap<any> | Map<PropertyKey, unknown>
  ): void {
    // if (_changedProperties.has('active')) {
    // }
  }

  protected override createRenderRoot() {
    if (!this.disableShadow) {
      return super.createRenderRoot();
    }
    return this;
  }

  private _route_change_callback = async () => {
    this.active = location.pathname.startsWith(this.rootPath);
    if (this.active) {
      const isMatch = await this._is_match_route();
      if (isMatch) {
        this.status = 'common';
      } else {
        this.status = '404';
      }
    } else {
      this.status = 'common';
    }
  };

  connectedCallback(): void {
    super.connectedCallback();
    // this._listen_route_active_status_change();
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
