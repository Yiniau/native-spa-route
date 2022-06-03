export function hook_a_link() {
  document.body.addEventListener('click', (e) => {
    const target = e.composedPath()[0] as HTMLElement;
    if (target.tagName === 'A') {
      const href = target.getAttribute('href');
      if (typeof href === 'string') {
        e.preventDefault();

        history.pushState(
          // JSON.parse(
          //   JSON.stringify(document.body.__frameless_context?.routeData ?? {})
          // ),
          {},
          target.getAttribute('title') ?? '',
          href
        );
      }
    }
  });
}

export function hook_history_change(
  cb?: (
    type: 'push' | 'replace',
    data: any,
    unused: string,
    url?: string | URL | null | undefined
  ) => void
) {
  const prototype = Reflect.getPrototypeOf(history) as History;
  const originPushState = prototype.pushState;
  const originReplaceState = prototype.replaceState;

  History.prototype.pushState = function pushState(
    data: any,
    unused: string,
    url?: string | URL | null | undefined
  ) {
    // console.log('pushState', data, unused, url);
    originPushState.apply(this, [data, unused, url]);
    window.dispatchEvent(
      new CustomEvent('history:pushState', {
        detail: {
          data,
          unused,
          url,
        },
      })
    );
    cb?.('push', data, unused, url);
  };

  History.prototype.replaceState = function replaceState(
    data: any,
    unused: string,
    url?: string | URL | null | undefined
  ) {
    // console.log('replaceState', data, unused, url);
    originReplaceState.apply(this, [data, unused, url]);
    window.dispatchEvent(
      new CustomEvent('history:replaceState', {
        detail: {
          data,
          unused,
          url,
        },
      })
    );
    cb?.('replace', data, unused, url);
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
  window.addEventListener('popstate', callback as EventListener, false);
}

export function unhook_route_change(callback: (e: HistoryChangeEvent) => void) {
  window.removeEventListener('history:pushState', callback as EventListener);
  window.removeEventListener('history:replaceState', callback as EventListener);
  window.removeEventListener('popstate', callback as EventListener, false);
}

