// cors error
// import React from "http://esm.sh/react@17";
// import reactDOM from "http://esm.sh/react-dom@17";

import React from './node_modules/react/index.js';
import ReactDOM from './node_modules/react-dom/index.js';

import App from './App';

export function render(target) {
	ReactDOM.render(<div>baisc react 17 custom render</div>, target);
}

export function customRenderFunction(target) {
	ReactDOM.render(<div>react 17 custom render function name</div>, target);
}

export function withCss(target) {
	ReactDOM.render(<App></App>, target);
}