import debug from 'debug';
import { html, LitElement } from 'lit';
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

  // @property({ type: Boolean })
  // noWaitCSS: boolean = false;

  /**
   * alias as shadowCSSUrl, more readable
   */
  @property({ type: String, attribute: 'css-url' })
  cssUrl: string = '';

  @property({ type: Number })
  cssDelayRender: number = 32;

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

  protected render() {
    dlog('route render');
    // dlog('css content: ', this.cssContent);
    dlog('css ready status: ', this.cssReady);
    dlog('module: ', this._url_module);
    dlog('module ready status: ', this.moduleReady);
    let resultHTML = html``;
    if (!this.active) {
      return resultHTML;
    }

    if (this.shadowCSSUrl || this.cssUrl) {
      // prettier-ignore
      resultHTML = html`<style>${this.cssContent}</style>`;
    }

    if (this.renderAfterReady) {
      if (this.moduleReady !== 'fulfilled') {
        return resultHTML;
      }
      if (this.shadowCSSUrl || this.cssUrl) {
        if (this.cssReady !== 'fulfilled' && this.cssReady !== 'rejected') {
          return resultHTML;
        }
      }
    }

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
    const url = this.url;
    if (typeof url === 'string') {
      this.moduleReady = 'pending';
      this._url_module = import(/* @vite-ignore */ url)
        .then((t) => {
          // if (this.cssDelayRender) {
          //   dlog('attach css delay render, set timeout to release module ready with ', this.cssDelayRender);
          //   setTimeout(() => {
          //     dlog('recover module ready status');
          //     this.moduleReady = 'fulfilled';
          //   }, this.cssDelayRender);
          // } else {
          //   this.moduleReady = 'fulfilled';
          // }
          this.moduleReady = 'fulfilled';
          return t;
        })
        .catch((e) => {
          this.moduleReady = 'rejected';
          throw e;
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

  async updated(changedProperties: Map<string | number | symbol, unknown>) {
    if (changedProperties.has('active')) {
      if (!this.active) {
        return;
      }

      let module = this._url_module;

      if (this.lazy && this.url && !module) {
        this.loadAssets();
        dlog('await module, blocking updated');
        module = await this._url_module;
      }

      if (this.customRender === false) {
        return;
      }

      if (!module) {
        throw new Error('No component module found');
      }

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

      (await module)[
        typeof this.customRender === 'string'
          ? this.customRender === ''
            ? 'render'
            : this.customRender
          : 'render'
      ](customRenderDom);
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
