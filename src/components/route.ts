import { html, LitElement, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { unsafeHTML } from 'lit/directives/unsafe-html.js';

import { hook_route_change, unhook_route_change } from '@/lib/hooks';

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
export class MyElement extends LitElement {
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

  @state()
  private active: boolean = false;

  @state({ hasChanged: () => false })
  private fullpath: string = '';

  @state({ hasChanged: () => false })
  protected _url_module?: Promise<any>;

  @state()
  protected moduleReady: 'nothing' | 'pending' | 'fulfilled' | 'rejected' =
    'nothing';

  render() {
    if (!this.active) {
      return nothing;
    }

    if (this.renderAfterReady && this.moduleReady !== 'fulfilled') {
      return nothing;
    }

    const content = this.customRender ? nothing : unsafeHTML(this.element);
    return this.appendDirection === 'before'
      ? html`${content}<slot></slot>`
      : html`<slot></slot>${content}`;
  }

  private loadAssets() {
    const url = this.url;
    if (typeof url === 'string') {
      this.moduleReady = 'pending';
      this._url_module = import(/* @vite-ignore */ url)
        .then((t) => {
          this.moduleReady = 'fulfilled';
          return t;
        })
        .catch((e) => {
          this.moduleReady = 'rejected';
          throw e;
        });
      return this._url_module;
    }
    return null;
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
      let module = this._url_module;
      if (!this.active) {
        return;
      }

      if (this.lazy && this.url && !module) {
        module = this.loadAssets() ?? undefined;
      }

      if (this.customRender === false) {
        return;
      }

      if (!module) {
        throw new Error('No component module found');
      }

      const customRenderDom = document.createElement('div');

      if (this.renderAfterReady) {
        await module;
      }

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
    return this;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'native-route': MyElement;
  }
}
