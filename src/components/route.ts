import debug from 'debug';
import { css, html, LitElement, nothing, PropertyValueMap } from 'lit';
import { customElement, property, query, state } from 'lit/decorators.js';
import { unsafeHTML } from 'lit/directives/unsafe-html.js';
import { cache } from 'lit/directives/cache.js';
import { createRef, ref } from 'lit/directives/ref.js';
import { ifDefined } from 'lit/directives/if-defined.js';

import { hook_route_change, unhook_route_change } from '../lib/hooks';
import { afterCssReady } from '../lib/cssReady';

const dlog = debug('native-spa-route');
const dcachelog = debug('native-spa-route:cache');

export type RouteConfig = {
  path: string;
  title: string;
  children?: RouteConfig[];
}[];

const DYNAMIC_ROUTE_PATH_REGEXP = /^\:/;

function getFullPath(url: string, node: HTMLElement): string {
  let isR = /^\//.test(url);
  if (node.parentElement && node.parentElement.tagName !== 'BODY') {
    if (node.parentElement.tagName === 'NATIVE-ROUTE') {
      const parentPath = node.parentElement.getAttribute('path') ?? '';
      let _url = `${isR ? '' : '/'}${url}`;
      if (parentPath === '' || parentPath === '/') {
        return _url;
      } else {
        return getFullPath(`${parentPath}${_url}`, node.parentElement);
      }
    } else {
      return getFullPath(url, node.parentElement);
    }
  }
  let ret = url;
  if (!isR) {
    ret = `/${url}`;
  }
  if (ret !== '/') {
    ret = ret.replace(/\/$/, '');
  }
  return ret;
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
  @property({
    attribute: 'css-url',
    converter: {
      fromAttribute(value) {
        if (!value) return '';
        if (/\[.*\]/.test(value)) {
          return JSON.parse(value);
        } else {
          return value;
        }
      },
      toAttribute(value: string | string[]) {
        if (Array.isArray(value)) {
          return JSON.stringify(value);
        } else {
          return value;
        }
      },
    },
  })
  cssUrl: string | string[] = '';

  @property({ type: String })
  cssParseMode: 'inline' | 'base64' = 'inline';

  @property({ type: Number })
  cssDelayRender: number = 32;

  @property({ type: Function })
  errorRender?: (error: Error) => string;

  @property({ type: Boolean })
  drop: boolean = false;

  @property({ type: Boolean })
  cssOnly: boolean = false;

  @property({ type: Number })
  customCSSBlockRenderTime?: number;

  @property({ type: Number })
  cacheVaildTime: number = 10 * 60 * 1000;

  /**
   * if enabled virtualNode, native-route-container will ignore this node.
   */
  @property({ type: Boolean })
  virtualNode: boolean = false;

  @property({ type: Boolean })
  groupMatchMode: boolean = false;

  private _style_tag_ref = createRef<HTMLStyleElement>();

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

  @state()
  protected cssContent: string = '';

  @state({ hasChanged: () => false })
  protected _css_base64?: string;

  @state()
  isExactMatch: boolean = false;

  @state({ hasChanged: () => false })
  isModuleRenderInstanceDestroied: boolean = false;

  @state({ hasChanged: () => false })
  cacheDestroyTimer?: ReturnType<typeof setTimeout>;

  public checkIsExactMatch() {
    return this.isExactMatch;
  }

  public getFullPath() {
    return this.fullpath;
  }

  private isCssExsit(): boolean {
    const cssUrl = this.shadowCSSUrl || this.cssUrl;
    if (Array.isArray(cssUrl)) {
      return cssUrl.length > 0;
    } else {
      return cssUrl !== '';
    }
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
      if (this.cssReady !== 'fulfilled') {
        return false;
      }
    }
    if (this.moduleReady !== 'fulfilled') {
      return false;
    }
    return true;
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
    // console.groupCollapsed('render');
    const content = !this.active
      ? nothing
      : this.isRenderError()
      ? this.renderErrorContent()
      : html`
          ${this.appendDirection === 'before' ? html`<slot></slot>` : nothing}
          <style ${ref(this._style_tag_ref)} src=${ifDefined(this._css_base64)}>
            ${this.cssParseMode === 'base64' ? '' : this.cssContent}
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
          ${this.appendDirection !== 'before' ? html`<slot></slot>` : nothing}
        `;
    // console.log('this.cssContent: ', this.cssContent);
    // console.groupEnd();
    return this.drop ? content : html`${cache(content)}`;
  }

  private setCSSContent(css: string, append: boolean = false) {
    if (append) {
      this.cssContent += css;
    } else {
      this.cssContent = css;
    }
  }

  private async _load_CSS() {
    if (!this.isCssExsit() || this.cssReady === 'fulfilled') {
      return;
    }

    if (this.cssContent) {
      this.cssReady = 'pending';
      this.setCSSContent(this.cssContent, false);
    } else {
      const css_url = this.shadowCSSUrl || this.cssUrl;
      if (css_url) {
        this.cssReady = 'pending';
        try {
          // fetch css content
          if (Array.isArray(css_url)) {
            const css_content = await Promise.all(
              css_url.map((l) => fetch(l).then((t) => t.text()))
            );
            this.setCSSContent(css_content.join(''), false);
          } else {
            const css_content = await fetch(css_url).then((t) => t.text());
            this.setCSSContent(css_content, false);
          }
        } catch (error) {
          console.error(error);
          this.cssReady = 'rejected';
          return;
        }
      }
    }

    await this.updateComplete;

    // block custom render until style parse end
    if (this.renderAfterReady) {
      let styleTag = this._style_tag_ref.value;
      if (!styleTag) {
        // try find style dom
        let t;
        if (this.disableShadow) {
          t = this.querySelector('style');
        } else {
          t = this.renderRoot.querySelector('style');
        }
        if (t?.tagName === 'STYLE') {
          styleTag = t;
        }
      }
      if (!styleTag) {
        console.error('cannot found style tag, make css load rejected');
        this.cssReady = 'rejected';
        return;
      }

      let isReady = await afterCssReady(this, styleTag);
      if (isReady) {
        this.cssReady = 'fulfilled';
      } else {
        this.cssReady = 'rejected';
      }
    } else {
      this.cssReady = 'fulfilled';
    }
  }

  private async _load_URL_module() {
    const url = this.url;
    if (typeof url === 'string' && this.moduleReady !== 'fulfilled') {
      this.moduleReady = 'pending';
      const loadStartTime = Date.now();
      this._url_module = import(
        /* @vite-ignore */ /* webpackIgnore: true */ url
      )
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
  }

  private async loadAssets() {
    this.log('start load assets');
    this._load_CSS();
    this._load_URL_module();
  }

  _route_match_check_path: string = '';
  _route_match_check_grouped_path: (string | RegExp)[] = [];

  private route_change_callback = () => {
    let _path = this.fullpath;
    let _grouped_path = this._route_match_check_grouped_path;

    this.isExactMatch = window.location.pathname === _path;
    if (this.isExactMatch) {
      this.active = true;
      return;
    }

    if (this.exact) {
      this.active = window.location.pathname === _path;
      return;
    }

    const pathname = window.location.pathname ?? '/';
    const local_pg = pathname.split('/');
    const route_pg = _grouped_path;

    if (route_pg.length > local_pg.length) {
      this.active = false;
      return;
    }

    let isMatch = true;
    for (let i = 0; i < route_pg.length; i++) {
      if (i >= local_pg.length) break;
      const l_p = local_pg[i];
      const r_p = route_pg[i];
      if (r_p instanceof RegExp) {
        if (!r_p.test(l_p)) {
          isMatch = false;
          break;
        }
      } else if (l_p !== r_p) {
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

  private _call_module_destroy() {
    this.log('call module destroy');
    if (this.moduleReady === 'fulfilled') {
      if (this.cacheDestroyTimer) {
        this.log('clear destroy timer first');
        clearTimeout(this.cacheDestroyTimer);
        this.cacheDestroyTimer = undefined;
      }
      this._url_module?.then(({ destroy }) => {
        if (typeof destroy === 'function') {
          try {
            this.cachelog('call module destory in module: ', this);
            destroy();
            if (!this.drop) {
              this.isModuleRenderInstanceDestroied = true;
            }
          } catch (error) {
            console.warn('module destory failed');
            console.warn(error);
          }
        } else {
          this.cachelog('not found destroy function');
        }
      });
    } else {
      console.warn(
        'module not fullfilled, cannot call route component destroy'
      );
    }
  }

  private _set_cache_invalid_timer() {
    this.log('call cache invaild timer');
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
      this.cacheDestroyTimer = setTimeout(() => {
        this._call_module_destroy();
      }, this.cacheVaildTime);
    }
  }

  private async _render_url_module() {
    if (this.shadowCSSUrl && this.cssUrl) {
      if (this.cssReady !== 'fulfilled' && this.cssReady !== 'rejected') {
        return;
      }
    }
    if (this.moduleReady !== 'fulfilled' && this.moduleReady !== 'rejected') {
      return;
    }

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

      let customRenderDom = this.disableShadow
        ? (this.querySelector('div.custom-render-container') as HTMLDivElement)
        : this.cacheCustomRenderDom;

      if (!customRenderDom) {
        console.warn('not found custom render dom');
        return;
      }

      if (!this.drop) {
        if (this.isModuleRenderInstanceDestroied) {
          this.log('cache invalid, call `render` function');
          this.isModuleRenderInstanceDestroied = false;
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

  protected willUpdate(
    _changedProperties: PropertyValueMap<any> | Map<PropertyKey, unknown>
  ): void {
    if (this.cssParseMode === 'base64') {
      if (_changedProperties.has('cssContent')) {
        this._css_base64 = Buffer.from(this.cssContent, 'base64url').toString();
      }
    }
  }

  async updated(changedProperties: Map<string | number | symbol, unknown>) {
    if (changedProperties.has('active')) {
      this.dispatchEvent(
        new CustomEvent('route:active_status_change', {
          detail: {
            current: this.active,
            previous: changedProperties.get('active'),
          },
          bubbles: true,
          composed: true,
        })
      );
      this.dispatchEvent(
        new CustomEvent(`route:${this.active ? 'active' : 'un_active'}`, {
          detail: {},
          bubbles: true,
          composed: true,
        })
      );
      if (this.url) {
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
        } else {
          if (this.drop) {
            this._call_module_destroy();
          } else {
            this._set_cache_invalid_timer();
          }
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

    if (changedProperties.has('isExactMatch')) {
      this.dispatchEvent(
        new CustomEvent('route:exact_match_change', {
          detail: this.isExactMatch,
          bubbles: true,
          composed: true,
        })
      );
    }
  }

  private _parse_route_match_check_group() {
    let _fullpath = this.fullpath;

    let _grouped_path: string[];

    const baseSplit = (path: string) => {
      if (path === '/') {
        // '/'.split('/') === ['', '']
        // expact as ['']
        return [''];
      }
      let pathGroup = path.split('/');
      return pathGroup;
    };

    if (this.groupMatchMode) {
      _grouped_path = _fullpath.split(this.path);
      if (_fullpath.endsWith(this.path)) {
        _grouped_path = _grouped_path.slice(0, -1); // remove lastest empty str
      }
      _grouped_path = _grouped_path.map((t) => t.replace(/\/$/, '')); // remove lastest `/`
      _grouped_path = [
        ...baseSplit(_grouped_path[0]),
        this.path,
        ..._grouped_path.slice(1),
      ];
    } else {
      _grouped_path = baseSplit(_fullpath);
    }

    return _grouped_path.map((t) =>
      DYNAMIC_ROUTE_PATH_REGEXP.test(t)
        ? new RegExp(t.replace(DYNAMIC_ROUTE_PATH_REGEXP, ''))
        : t
    );
  }

  connectedCallback() {
    super.connectedCallback();
    this.fullpath = getFullPath(this.path, this);

    // parse route group
    this._route_match_check_path = this.fullpath;
    this._route_match_check_grouped_path =
      this._parse_route_match_check_group();

    if (!this.lazy && this.url) {
      this.loadAssets();
    }
    // while css only mode, direct set module load fulfilled;
    if (this.cssOnly) {
      this.moduleReady = 'fulfilled';
      this._url_module = Promise.resolve({
        render() {},
        destroy() {},
      });
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
