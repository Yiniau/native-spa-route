export function hook_a_link() {
  document.body.addEventListener('click', (e) => {
    const target = e.composedPath()[0] as HTMLElement;
    if (target.tagName === 'A') {
      const href = target.getAttribute('href');
      if (typeof href === 'string') {
        if (href.startsWith('http')) {
          return;
        }
        e.preventDefault();

        history.pushState(
          {},
          target.getAttribute('title') ?? '',
          href
        );
      }
    }
  });
}

export function hook_history_change(lifecycle?: {
  before?: (
    type: 'push' | 'replace' | 'back' | 'forward' | 'go',
    data: any,
    unused: string,
    url?: string | URL | null | undefined
  ) => void;
  after?: (
    type: 'push' | 'replace' | 'back' | 'forward' | 'go',
    data: any,
    unused: string,
    url?: string | URL | null | undefined
  ) => void;
  url_adapter?: (url: string | URL | null | undefined) => void;
}) {
  const prototype = Reflect.getPrototypeOf(history) as History;
  
  const originPushState = prototype.pushState;
  History.prototype.pushState = function pushState(
    data: any,
    unused: string,
    url?: string | URL | null | undefined
  ) {
    let _url = url;
    _url = lifecycle?.url_adapter?.(_url) ?? url;
    // console.log('pushState', data, unused, url);
    lifecycle?.before?.('push', data, unused, _url);
    originPushState.apply(this, [data, unused, _url]);
    window.dispatchEvent(
      new CustomEvent('history:pushState', {
        detail: {
          data,
          unused,
          _url,
        },
      })
    );
    lifecycle?.after?.('push', data, unused, _url);
  };

  const originReplaceState = prototype.replaceState;
  History.prototype.replaceState = function replaceState(
    data: any,
    unused: string,
    url?: string | URL | null | undefined
  ) {
    // console.log('replaceState', data, unused, url);
    let _url = url;
    _url = lifecycle?.url_adapter?.(_url) ?? url;
    lifecycle?.before?.('replace', data, unused, _url);
    originReplaceState.apply(this, [data, unused, _url]);
    window.dispatchEvent(
      new CustomEvent('history:replaceState', {
        detail: {
          data,
          unused,
          _url,
        },
      })
    );
    lifecycle?.after?.('replace', data, unused, _url);
  };

  const originBack = prototype.back;
  History.prototype.back = function back() {
    lifecycle?.before?.('back', null, '', null);
    originBack.apply(this, []);
    window.dispatchEvent(
      new CustomEvent('history:back', {
        detail: {},
      })
    );
    lifecycle?.after?.('back', null, '', null);
  };

  const originForward = prototype.forward;
  History.prototype.forward = function forward() {
    lifecycle?.before?.('forward', null, '', null);
    originForward.apply(this, []);
    window.dispatchEvent(
      new CustomEvent('history:forward', {
        detail: {},
      })
    );
    lifecycle?.after?.('forward', null, '', null);
  };
  
  const originGo = prototype.go;
  History.prototype.go = function go(delta?: number) {
    lifecycle?.before?.('go', null, '', null);
    originGo.apply(this, [delta]);
    window.dispatchEvent(
      new CustomEvent('history:go', {
        detail: {
          delta,
        },
      })
    );
    lifecycle?.after?.('go', null, '', null);
  };
}

export type HistoryChangeEvent = CustomEvent<{
  data: any;
  unused: string;
  url?: string | URL | null | undefined;
}>;

export function hook_route_change(callback: (e: HistoryChangeEvent) => void) {
  window.addEventListener('history:pushState', callback as EventListener);
  window.addEventListener('history:replaceState', callback as EventListener);
  window.addEventListener('history:back', callback as EventListener);
  window.addEventListener('history:forward', callback as EventListener);
  window.addEventListener('history:go', callback as EventListener);
  window.addEventListener('popstate', callback as EventListener, false);
}

export function unhook_route_change(callback: (e: HistoryChangeEvent) => void) {
  window.removeEventListener('history:pushState', callback as EventListener);
  window.removeEventListener('history:replaceState', callback as EventListener);
  window.removeEventListener('history:back', callback as EventListener);
  window.removeEventListener('history:forward', callback as EventListener);
  window.removeEventListener('history:go', callback as EventListener);
  window.removeEventListener('popstate', callback as EventListener, false);
}

export function redirect(
  from: string | URL | null | undefined,
  to: string | URL | null | undefined
) {
  if (location.pathname === from) {
    history.pushState(null, '', to);
  }
  hook_route_change(() => {
    if (location.pathname === from) {
      history.pushState(null, '', to);
    }
  });
}
