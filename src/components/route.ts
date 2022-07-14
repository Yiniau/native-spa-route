import debug from 'debug';
import { html, LitElement, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { unsafeHTML } from 'lit/directives/unsafe-html.js';

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

  @property({ attribute: 'custom-render' })
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

  private renderLoading() {
    return html`
      <div
        style="display: flex; align-items: center; justify-content: space-around;width: 100%; height: 100%;"
      >
        ${unsafeHTML(this.loadingElement)}
      </div>
    `;
  }

  protected render() {
    this.log('route render');
    let resultHTML = html``;
    if (!this.active) {
      this.log('not active, return empty');
      return nothing;
    }

    // this.log('css content: ', this.cssContent);
    this.log('css ready status: ', this.cssReady);
    this.log('module: ', this._url_module);
    this.log('module ready status: ', this.moduleReady);

    let isCssExsit = this.shadowCSSUrl || this.cssUrl;

    // error render handle
    if (this.errorRender) {
      let errorContent = null;

      if (this.moduleReady === 'rejected') {
        errorContent = new Error('module load rejected');
      }
      if (isCssExsit) {
        if (this.cssReady === 'rejected') {
          errorContent = new Error('css load rejected');
        }
      }

      if (errorContent) {
        const errorElement = this.errorRender(errorContent);
        if (typeof errorElement !== 'string') {
          return resultHTML;
        } else {
          return html`${unsafeHTML(errorElement)}`;
        }
      }
    }

    // if not error, make style content be parsed fisrt
    if (isCssExsit) {
      // prettier-ignore
      resultHTML = html`<style>${this.cssContent}</style>`;
    }

    // loading render handle
    if (this.renderAfterReady) {
      if (this.moduleReady !== 'fulfilled') {
        if (this.loadingElement) {
          return html`${resultHTML}${this.renderLoading()}`;
        }
        return resultHTML;
      }
      if (isCssExsit) {
        if (this.cssReady !== 'fulfilled') {
          if (this.loadingElement) {
            return html`${resultHTML}${this.renderLoading()}`;
          }
          return resultHTML;
        }
      }
    }

    // source ready, render real content
    if (!this.customRender) {
      resultHTML = html`${resultHTML}${unsafeHTML(this.element)}`;
    }

    resultHTML =
      this.appendDirection === 'before'
        ? html`<slot></slot>${resultHTML}`
        : html`${resultHTML}<slot></slot>`;

    return resultHTML;
  }

  private loadAssets() {
    this.log('start load assets');
    const url = this.url;
    if (typeof url === 'string') {
      this.moduleReady = 'pending';
      const loadStartTime = Date.now();
      this._url_module = import(/* @vite-ignore */ url)
        .then((t) => {
          // if (this.cssDelayRender) {
          //   this.log('attach css delay render, set timeout to release module ready with ', this.cssDelayRender);
          //   setTimeout(() => {
          //     this.log('recover module ready status');
          //     this.moduleReady = 'fulfilled';
          //   }, this.cssDelayRender);
          // } else {
          //   this.moduleReady = 'fulfilled';
          // }
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
        fetch(this.shadowCSSUrl || this.cssUrl, {
          headers: { 'content-type': 'text' },
        })
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
      if (typeof this.customRender === 'string') {
        render = module[this.customRender];
      } else if (this.customRender) {
        render = module['render'];
      } else {
        // do nothing
      }
    }
    if (render) {
      const customRenderDom = document.createElement('div');

      if (this.appendDirection === 'before') {
        if (!(this.renderRoot.firstElementChild instanceof HTMLElement)) {
          this.renderRoot.appendChild(customRenderDom);
        } else {
          this.renderRoot.insertBefore(
            this.renderRoot.firstElementChild,
            customRenderDom
          );
        }
      } else {
        this.renderRoot.appendChild(customRenderDom);
      }

      render(customRenderDom);
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
            (this.shadowCSSUrl || this.cssUrl) && this.cssReady !== 'fulfilled')
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
