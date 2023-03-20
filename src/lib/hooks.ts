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

        history.pushState({}, target.getAttribute('title') ?? '', href);
      }
    }
  });
}

type historyLifecycle = {
  before?: (
    type: 'pushState' | 'replaceState' | 'back' | 'forward' | 'go',
    data: any,
    unused: string,
    url?: string | URL | null | undefined
  ) => void;
  after?: (
    type: 'pushState' | 'replaceState' | 'back' | 'forward' | 'go',
    data: any,
    unused: string,
    url?: string | URL | null | undefined
  ) => void;
  url_adapter?: (url: string | URL | null | undefined) => string;
}

function _hook_3_params_func(lifecycle: historyLifecycle, func_name: 'replaceState' | 'pushState') {
  window.history[func_name] = new Proxy(window.history[func_name], {
    apply: (
      target,
      thisArg,
      argArray: [any, string, string | URL | null | undefined]
    ) => {
      const arg0 = argArray[0];
      const arg1 = argArray[1];
      const arg2 = argArray[2];

      let _url = arg2;
      if (typeof lifecycle?.url_adapter === 'function') {
        _url = lifecycle.url_adapter(_url);
      }

      lifecycle?.before?.(func_name, arg0, arg1, _url);
      const ret = target.apply(thisArg, [arg0, arg1, _url]);
      lifecycle?.after?.(func_name, arg0, arg1, _url);

      window.dispatchEvent(
        new CustomEvent(`history:${func_name}`, {
          detail: {
            type: func_name,
            data: arg0,
            unused: arg1,
            url: _url,
          },
        })
      );

      return ret;
    },
  });
}

function _hook_0_params_func(lifecycle: historyLifecycle, func_name: 'back' | 'forward') {
  window.history[func_name] = new Proxy(window.history[func_name], {
    apply: (
      target,
      thisArg,
    ) => {
      lifecycle?.before?.(func_name, undefined, '', undefined);
      const ret = target.apply(thisArg, []);
      lifecycle?.after?.(func_name, undefined, '', undefined);

      window.dispatchEvent(
        new CustomEvent(`history:${func_name}`, {
          detail: {
            type: func_name,
          },
        })
      );

      return ret;
    },
  });
}

function _hook_1_params_func(lifecycle: historyLifecycle, func_name: 'go') {
  window.history[func_name] = new Proxy(window.history[func_name], {
    apply: (
      target,
      thisArg,
      argArray: [number],
    ) => {
      lifecycle?.before?.(func_name, argArray[0], '', undefined);
      const ret = target.apply(thisArg, argArray);
      lifecycle?.after?.(func_name, argArray[0], '', undefined);

      window.dispatchEvent(
        new CustomEvent(`history:${func_name}`, {
          detail: {
            type: func_name,
            delta: argArray[0]
          },
        })
      );

      return ret;
    },
  });
}

let hook_history_change_hooked = false;
export function hook_history_change(lifecycle: historyLifecycle = {}) {
  if (hook_history_change_hooked) return;
  hook_history_change_hooked = true;
  _hook_3_params_func(lifecycle, 'pushState');
  _hook_3_params_func(lifecycle, 'replaceState');
  _hook_0_params_func(lifecycle, 'back');
  _hook_0_params_func(lifecycle, 'forward');
  _hook_1_params_func(lifecycle, 'go');
}

// export function hook_history_change(lifecycle?: historyLifecycle) {
//   const prototype = Reflect.getPrototypeOf(history) as History;

//   const originPushState = prototype.pushState;
//   History.prototype.pushState = function pushState(
//     data: any,
//     unused: string,
//     url?: string | URL | null | undefined
//   ) {
//     let _url = url;
//     _url = lifecycle?.url_adapter?.(_url) ?? url;
//     // console.log('pushState', data, unused, url);
//     lifecycle?.before?.('push', data, unused, _url);
//     originPushState(data, unused, _url);
//     window.dispatchEvent(
//       new CustomEvent('history:pushState', {
//         detail: {
//           type: 'pushState',
//           data,
//           unused,
//           url: _url,
//         },
//       })
//     );
//     lifecycle?.after?.('push', data, unused, _url);
//   };

//   const originReplaceState = prototype.replaceState;
//   History.prototype.replaceState = function replaceState(
//     data: any,
//     unused: string,
//     url?: string | URL | null | undefined
//   ) {
//     // console.log('replaceState', data, unused, url);
//     let _url = url;
//     _url = lifecycle?.url_adapter?.(_url) ?? url;
//     lifecycle?.before?.('replace', data, unused, _url);
//     originReplaceState(data, unused, _url);
//     window.dispatchEvent(
//       new CustomEvent('history:replaceState', {
//         detail: {
//           type: 'replaceState',
//           data,
//           unused,
//           url: _url,
//         },
//       })
//     );
//     lifecycle?.after?.('replace', data, unused, _url);
//   };

//   const originBack = prototype.back;
//   History.prototype.back = function back() {
//     lifecycle?.before?.('back', null, '', null);
//     originBack();
//     window.dispatchEvent(
//       new CustomEvent('history:back', {
//         detail: {
//           type: 'back',
//         },
//       })
//     );
//     lifecycle?.after?.('back', null, '', null);
//   };

//   const originForward = prototype.forward;
//   History.prototype.forward = function forward() {
//     lifecycle?.before?.('forward', null, '', null);
//     originForward.apply(this, []);
//     window.dispatchEvent(
//       new CustomEvent('history:forward', {
//         detail: {
//           type: 'forward',
//         },
//       })
//     );
//     lifecycle?.after?.('forward', null, '', null);
//   };

//   const originGo = prototype.go;
//   History.prototype.go = function go(delta?: number) {
//     lifecycle?.before?.('go', null, '', null);
//     originGo.apply(this, [delta]);
//     window.dispatchEvent(
//       new CustomEvent('history:go', {
//         detail: {
//           type: 'go',
//           delta,
//         },
//       })
//     );
//     lifecycle?.after?.('go', null, '', null);
//   };
// }

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
