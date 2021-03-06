import debug from 'debug';
import { css, html, LitElement, nothing } from 'lit';
import { customElement, property, query, state } from 'lit/decorators.js';
import { unsafeHTML } from 'lit/directives/unsafe-html.js';
import { cache } from 'lit/directives/cache.js';

import { hook_route_change, unhook_route_change } from '@/lib/hooks';

const dlog = debug('native-spa-route');
const dcachelog = debug('native-spa-route:cache');

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
    .loading-container {
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
  private cachelog(...args: any[]) {
    return dcachelog(`[${this.path}]`, ...args);
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

  @property({ type: Number })
  protected customCSSBlockRenderTime?: number;

  @property({ type: Number })
  protected cacheVaildTime: number = 10 * 60 * 1000;

  @state()
  isExactMatch: boolean = false;

  @state({ hasChanged: () => false })
  isModuleDestroyed: boolean = false;

  @state({ hasChanged: () => false })
  cacheDestroyTimer?: ReturnType<typeof setTimeout>;

  public checkIsExactMatch() {
    return this.isExactMatch;
  }

  public getFullPath() {
    return this.fullpath;
  }

  private isCssExsit() {
    return this.shadowCSSUrl || this.cssUrl;
  }

  public isActive() {
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

  private isRenderElement() {
    if (!this.renderAfterReady) return true;
    if (this.isCssExsit()) {
      if (this.cssReady === 'fulfilled') {
        return true;
      }
    } else {
      if (this.moduleReady === 'fulfilled') {
        return true;
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
      <div part="loading-container" class="loading-container">
        ${unsafeHTML(this.loadingElement)}
      </div>
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
            ? this.isRenderElement()
              ? this.renderElement()
              : nothing
            : html`<div
                part="custom-render-container"
                class="custom-render-container"
              ></div>`}
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
          if (!this.drop && !t.destroy) {
            console.error(
              `cannot found module [${this._url_module}] \`destroy\` method`
            );
          }
          // show loading in a fixed time for better experience
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

    const isCssExsit = this.isCssExsit();
    if (isCssExsit) {
      this.cssReady = 'pending';
      try {
        fetch(isCssExsit)
          .then((t) => t.text())
          .then((css) => {
            this.cssContent = css;
            if (this.renderAfterReady) {
              const contentLength = this.cssContent.length;
              if (contentLength > 9000) {
                console.warn(
                  'detect too big css content, may consider put to [head] or use `customCSSBlockRenderTime`, path: [',
                  this.path,
                  '] content length: ',
                  contentLength
                );
              }
              // delay setting status to make sure style content is parsed
              setTimeout(
                () => {
                  this.cssReady = 'fulfilled';
                },
                this.customCSSBlockRenderTime
                  ? this.customCSSBlockRenderTime
                  : contentLength > 3000
                  ? 32
                  : contentLength > 6000
                  ? 64
                  : contentLength > 9000
                  ? 96
                  : 128 // too big css content maybe should put it to head, or use custom block time
              );
            } else {
              this.cssReady = 'fulfilled';
            }
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

    this.isExactMatch = window.location.pathname === _path;

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

  private _could_set_cache_invalid_timer() {
    return this.customRender && !this.drop && this.moduleReady === 'fulfilled';
  }

  private _set_cache_invalid_timer() {
    if (!this._could_set_cache_invalid_timer()) {
      return this.cachelog('cannot set cache clear timer');
    }

    if (this.cacheDestroyTimer) {
      this.cachelog('clear cache timer');
      clearTimeout(this.cacheDestroyTimer);
      this.cacheDestroyTimer = undefined;
    }
    if (!this.active) {
      this.cachelog('start set cache clear timer');
      this._url_module?.then(({ destroy }) => {
        if (typeof destroy === 'function') {
          this.cachelog('set clear timer in ', this.cacheVaildTime);
          this.cacheDestroyTimer = setTimeout(() => {
            try {
              console.info('call module destory in module: ', this);
              destroy();
              this.isModuleDestroyed = true;
            } catch (error) {
              console.warn('module destory failed');
              console.warn(error);
            }
          }, this.cacheVaildTime);
        } else {
          this.cachelog('not found destroy function');
        }
      });
    }
  }

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
      const customRenderDom = this.cacheCustomRenderDom;
      if (!customRenderDom) {
        console.warn('not found custom render dom');
        return;
      }
      if (!this.drop) {
        if (this.isModuleDestroyed) {
          this.log('cache invalid, call `render` function');
          this.isModuleDestroyed = false;
          render(customRenderDom);
        } else if (!customRenderDom?.children?.length) {
          this.log('custom render target has no children, call `render`');
          render(customRenderDom);
        } else {
          this.log(
            'custom render target has children, will not duplicately call render'
          );
        }
      } else {
        render(customRenderDom);
      }
      return;
    }
  }

  async updated(changedProperties: Map<string | number | symbol, unknown>) {
    if (changedProperties.has('active')) {
      this.dispatchEvent(
        new CustomEvent(`route:${this.active ? 'active' : 'un_active'}`, {
          detail: {},
          bubbles: true,
          composed: true,
        })
      );
      if (this.active) {
        if (this.cacheDestroyTimer) {
          this.cachelog('current module active, clear timer', this);
          clearTimeout(this.cacheDestroyTimer);
          this.cacheDestroyTimer = undefined;
        }
        this.log('attach route active');
        if (
          this.lazy &&
          (!this._url_module ||
            this.moduleReady !== 'fulfilled' ||
            (this.isCssExsit() && this.cssReady !== 'fulfilled'))
        ) {
          this.log('in lazy mode, some source not loaded, call loadAssets');
          this.loadAssets();
        } else {
          this._render_url_module();
        }
      }
      if (!this.active) {
        this._set_cache_invalid_timer();
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

    if (changedProperties.has('isExactMatch')) {
      this.dispatchEvent(
        new CustomEvent('route:exact_match_change', {
          detail: this.isExactMatch,
          bubbles: true,
          composed: true,
        })
      );
    }

    // if (changedProperties.has('isModuleDestroyed')) {
    //   if (!changedProperties.get('isModuleDestroyed')) {
    //     this._render_url_module();
    //   }
    // }
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
