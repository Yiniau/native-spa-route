# native-spa-route

[![Published on webcomponents.org](https://img.shields.io/badge/webcomponents.org-published-blue.svg)](https://www.webcomponents.org/element/owner/native-spa-route)

provide SPA route's experience with native web component

![Online Demo]([https://](https://native-spa-route.vercel.app/))

## Installation

`pnpm install native-spa-route`

## Usage

the fully example are ready in the index.html.

here are just some brief descriptions.

### 1. Init module

run this in the top of your application

```typescript
import { preload } from 'native-spa-route';
preload();
```

**At current time (2022/6/6-17:04), this `preload` only supportted fully history API hook and fully `a` tag hook**,
This means that there is a high possibility of conflict with the routing scheme of some existing libraries.

in this version, the hook of history api implament by add function to origin `history`'s prototype.

```typescript
export function hook_history_change(
  cb?: (...)
) {
  const prototype = Reflect.getPrototypeOf(history) as History;
  const originPushState = prototype.pushState;
  const originReplaceState = prototype.replaceState;

  History.prototype.pushState = function pushState(...) {...};

  History.prototype.replaceState = function replaceState(...) {...};
}
```

to direct use hook functions or write your own hook is toally supported.

EVEN! You can use the `history:replaceState` event and `history:pushState` event to use this module in any enviroment

```typescript
function hook_route_change(callback: (e: HistoryChangeEvent) => void) {
  window.addEventListener('history:pushState', callback as EventListener);
  window.addEventListener('history:replaceState', callback as EventListener);
  window.addEventListener('popstate', callback as EventListener, false);
}
```

### 2. use Route

```html
<native-route path="/">
	<!-- exact case, only active while pathname full match /root -->
	<native-route
		path="root"
		exact
		element="exact /root path route here"
	></native-route>
	<native-route path="root" element="<div>ROOT HERE</div>">
		<native-route path="all" element="<div>ALL HERE</div>">
		</native-route>
	</native-route>
</native-route>
```

if this module could write content as child, like `<native-route>content here </native-route>`

Sure, that is possible. But you need to do some extra work to make it look like good.

Becouse the Broswer will take unregisted component as `HTMLUnknowElement`, the content of them will visibale.
So you need to hidden them by css:

```css
native-route {
	display: none;
}
native-route:defined {
	display: block;
}
```

> The `visibility` property on my pc(MacBook Pro 12.3.1 M1) causes height changes, components to flicker.

example code:

```html
<native-route path="/lazy">
	<ul>
		<li><a href="/lazy/sl/button">@shoelace-style/shoelace Button</a></li>
		<li>
			<a href="/lazy/sl/ready_button">
				render shoelace Button after module ready, disable cache to
				get clear effect
			</a>
		</li>
	</ul>
</native-route>
```

Those `a` tags only show while `/^\/lazy/.test(location.pathname) === true`.


## disable Shadow DOM wrapper

the Shadow DOM wrapper is default provide by `lit`.

In some cases, it may cause strange problems, such as Antd's pop-up window mounting problem.
use `shadow="false"` could disable it. But! it may cause more content leak.

example:

```html
<native-route xxxx shadow="false"></native-route>
```

## Online Demo

![Online Demo]([https://](https://native-spa-route.vercel.app/))

## next step plan

1. [ ] implament `<native-redirect from="/" to="/home"></native-redirect>` component
2. [ ] support scoped route to avoud global history api change.

```html
<native-router>
	<native-route xxxx>
		<naitve-link>link to other route</native-link>
	</native-route>
</native-router>
```

## Contributing

1. Fork it!
2. Create your feature branch: `git checkout -b feature/my-new-feature`
3. Commit your changes: `git commit -am 'feat: Add some feature'`
4. Push to the branch: `git push origin feature/my-new-feature`
5. Submit a pull request :D

## License

MIT License
