import debug from 'debug';
import { css, html, LitElement, nothing } from 'lit';
import { customElement, property, query, state } from 'lit/decorators.js';
import { unsafeHTML } from 'lit/directives/unsafe-html.js';
import { cache } from 'lit/directives/cache.js';

import { hook_route_change, unhook_route_change } from '@/lib/hooks';

const dlog = debug('native-spa-route');

export type RouteConfig = {
  path: string;
  title: string;
  children?: RouteConfig[];
}[];

function getFullPath(url: string, node: HTMLElement): string {
  let isR = /^\//.test(url);
  if (node.parentElement && node.parentElement.tagName !== 'BODY') {
    if (node.parentElement.tagName === 'NATIVE-ROUTE') {
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

@customElement('native-route')
export class Route extends LitElement {
  static styles = css`
    :host .loading-wrapper {
      display: flex;
      align-items: center;
      justify-content: space-around;
      width: 100%;
      height: 100%;
    }
  `;

  @property({ type: String })
  path: string = '';

  @property({ type: Boolean })
  exact: boolean = false;

  @property({ type: String })
  element: string = '';

  @property({ type: String })
  url?: string;

  @property({ type: Boolean })
  lazy: boolean = false;

  @property({ type: String, attribute: 'append-direction' })
  appendDirection: 'before' | 'after' = 'after';

  @property({
    attribute: 'custom-render',
    converter: {
      fromAttribute: (value) => {
        if (value === '') {
          return true;
        } else {
          return value;
        }
      },
      toAttribute: (value) => {
        if (typeof value !== 'string') {
          if (!value) {
            return 'false';
          } else {
            return '';
          }
        } else {
          return value;
        }
      },
    },
  })
  customRender: boolean | string = false;

  @property({ type: Boolean, attribute: 'render-after-ready' })
  renderAfterReady: boolean = false;

  @property({ type: Boolean, attribute: 'disable-shadow' })
  disableShadow: boolean = false;

  @property({ type: String })
  shadowCSSUrl: string = '';

  @property({ type: String })
  loadingElement?: string;

  @property({ type: Number })
  lockLoadingTime?: number;

  /**
   * alias as shadowCSSUrl, more readable
   */
  @property({ type: String, attribute: 'css-url' })
  cssUrl: string = '';

  @property({ type: Number })
  cssDelayRender: number = 32;

  @property({ type: Function })
  errorRender?: (error: Error) => string;

  @property({ type: Boolean })
  drop: boolean = false;

  private log(...args: any[]) {
    return dlog(`[${this.path}]`, ...args);
  }

  @state()
  private active: boolean = false;

  @state({ hasChanged: () => false })
  private fullpath: string = '';

  @state({ hasChanged: () => false })
  protected _url_module?: Promise<any>;

  @state()
  protected moduleReady: 'nothing' | 'pending' | 'fulfilled' | 'rejected' =
    'nothing';

  @state()
  protected cssReady: 'nothing' | 'pending' | 'fulfilled' | 'rejected' =
    'nothing';

  @state({ hasChanged: () => false })
  protected cssContent: string = '';

  private isCssExsit() {
    return this.shadowCSSUrl || this.cssUrl;
  }

  private isActive() {
    return this.active;
  }

  private isRenderError() {
    if (this.errorRender) {
      if (
        this.moduleReady === 'rejected' ||
        ((this.shadowCSSUrl || this.cssUrl) && this.cssReady === 'rejected')
      ) {
        return true;
      }
    }
    return false;
  }

  private isRenderLoading() {
    if (this.renderAfterReady) {
      if (this.moduleReady !== 'fulfilled') {
        if (this.loadingElement) {
          return true;
        }
        return false;
      }
      if (this.isCssExsit()) {
        if (this.cssReady !== 'fulfilled') {
          if (this.loadingElement) {
            return true;
          }
          return false;
        }
      }
    }
    return false;
  }

  private renderErrorContent() {
    if (!this.errorRender) return nothing;

    if (this.moduleReady === 'rejected') {
      return html`${unsafeHTML(
        this.errorRender(new Error('module load rejected'))
      )}`;
    }

    if (this.isCssExsit()) {
      if (this.cssReady === 'rejected') {
        return html`${unsafeHTML(
          this.errorRender(new Error('css load rejected'))
        )}`;
      }
    }

    return nothing;
  }

  private renderLoading() {
    return html`
      <div class="loading-wrapper">${unsafeHTML(this.loadingElement)}</div>
    `;
  }

  private renderElement() {
    return html`${unsafeHTML(this.element)}`;
  }

  protected render() {
    const content = !this.isActive()
      ? nothing
      : this.isRenderError()
      ? this.renderErrorContent()
      : html`
          ${this.appendDirection === 'before' ? html`<slot></slot>` : ''}
          <style>
            ${this.cssContent}
          </style>
          ${this.isRenderLoading()
            ? this.renderLoading()
            : !this.customRender
            ? this.renderElement()
            : // : html`<div data-render="custom-render"></div>`}
              html`<div class="custom-render-container"></div>`}
          ${this.appendDirection !== 'before' ? html`<slot></slot>` : ''}
        `;
    return this.drop ? content : html`${cache(content)}`;
  }

  private loadAssets() {
    this.log('start load assets');
    const url = this.url;
    if (typeof url === 'string') {
      this.moduleReady = 'pending';
      const loadStartTime = Date.now();
      this._url_module = import(/* @vite-ignore */ url)
        .then((t) => {
          this.log('module load fulfilled');
          if (this.lockLoadingTime) {
            const _now = Date.now();
            const _now_d = _now - loadStartTime;
            if (_now_d < this.lockLoadingTime) {
              setTimeout(() => {
                this.moduleReady = 'fulfilled';
              }, this.lockLoadingTime - _now_d);
            } else {
              this.moduleReady = 'fulfilled';
            }
          } else {
            this.moduleReady = 'fulfilled';
          }
          return t;
        })
        .catch((e) => {
          console.error(e);
          this.log('module load rejected');
          this.moduleReady = 'rejected';
        });
    }

    if (this.shadowCSSUrl || this.cssUrl) {
      this.cssReady = 'pending';
      try {
        fetch(this.shadowCSSUrl || this.cssUrl)
          .then((t) => t.text())
          .then((css) => {
            this.cssContent = css;
            this.cssReady = 'fulfilled';
          });
      } catch (error) {
        console.error(error);
        this.cssReady = 'rejected';
      }
    }

    return;
  }

  private route_change_callback = () => {
    let _path = this.fullpath;

    if (this.exact) {
      this.active = window.location.pathname === _path;
      return;
    }

    const pathname = window.location.pathname ?? '';
    const local_pg = pathname.split('/').filter((t) => !!t);
    const route_pg = _path.split('/').filter((t) => !!t);

    if (route_pg.length > local_pg.length) {
      this.active = false;
      return;
    }

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

    return;
  };

  // @query('div.custom-render-container', true)
  @query('div.custom-render-container', false)
  cacheCustomRenderDom?: HTMLDivElement;

  private async _render_url_module() {
    if (this.shadowCSSUrl && this.cssUrl) {
      if (this.cssReady !== 'fulfilled' && this.cssReady !== 'rejected') return;
    }
    if (this.moduleReady !== 'fulfilled' && this.moduleReady !== 'rejected')
      return;

    this.log('all source load end, continue logic');
    let render;
    if (this.moduleReady === 'rejected') {
      if (this.errorRender) {
        render = this.errorRender;
      } else {
        throw new Error(
          'No component render found, and error render not found'
        );
      }
    }
    if (this.moduleReady === 'fulfilled') {
      let module = await this._url_module;
      this.log('module: ', module);
      this.log('this.customRender: ', this.customRender);
      if (typeof this.customRender === 'string') {
        render = module[this.customRender];
      } else if (this.customRender) {
        render = module['render'];
      } else {
        // do nothing
      }
    }
    this.log('render function: ', render);
    if (render) {
      await this.updateComplete; // wait dom render end
      const customRenderDom = this.cacheCustomRenderDom as HTMLDivElement;
      if (!this.drop) {
        if (!customRenderDom?.children?.length) {
          render(customRenderDom);
        }
      } else {
        customRenderDom.innerHTML = '';
        const inner = document.createElement('div');
        customRenderDom.appendChild(inner);
        render(inner);
      }
      return;
    }
  }

  async updated(changedProperties: Map<string | number | symbol, unknown>) {
    if (changedProperties.has('active')) {
      if (this.active) {
        this.log('attach route active');

        if (
          this.lazy &&
          (!this._url_module ||
            this.moduleReady !== 'fulfilled' ||
            ((this.shadowCSSUrl || this.cssUrl) &&
              this.cssReady !== 'fulfilled'))
        ) {
          this.log('in lazy mode, some source not loaded, call loadAssets');
          this.loadAssets();
        } else {
          this._render_url_module();
        }
      }
    }

    if (changedProperties.has('moduleReady')) {
      if (changedProperties.get('moduleReady') === 'pending') {
        this._render_url_module();
      }
    }
    if (changedProperties.has('cssReady')) {
      if (changedProperties.get('cssReady') === 'pending') {
        this._render_url_module();
      }
    }

    if (changedProperties.has('path')) {
      this.fullpath = getFullPath(this.path, this);
    }
  }

  connectedCallback() {
    super.connectedCallback();
    this.fullpath = getFullPath(this.path, this);
    if (!this.lazy && this.url) {
      this.loadAssets();
    }
    this.route_change_callback();
    hook_route_change(this.route_change_callback);
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    unhook_route_change(this.route_change_callback);
  }

  protected createRenderRoot() {
    if (!this.disableShadow) {
      return super.createRenderRoot();
    }
    return this;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'native-route': Route;
  }
}
