import { Route } from "../main";

export function isCssReady(styleTag: HTMLStyleElement, globalCheck = false): boolean {
	// empty style content, direct pass
	if (!styleTag.getAttribute('src') && !styleTag.textContent) {
		return true;
	}
	let targetStyleSheet: CSSStyleSheet | null;
	if (globalCheck) {
		let targetStyleSheetIndex = Array.from(document.styleSheets).findIndex(t => t.ownerNode === styleTag);
		if (targetStyleSheetIndex < 0) {
			return false;
		}
		targetStyleSheet = document.styleSheets[targetStyleSheetIndex];
	} else {
		targetStyleSheet = styleTag.sheet;
	}
	if (!targetStyleSheet?.cssRules?.length) {
		return false;
	}
	return true;
}

function sleep(time: number): Promise<void> {
	return new Promise((res) => {
		setTimeout(() => {
			res();
		}, time);
	});
}

export async function afterCssReady(route: Route, styleTag: HTMLStyleElement): Promise<boolean> {
	return new Promise(async (res) => {
		let c = 0;
		let w = 50;
		let m_c = 5 * 60 * 1000 / w;
		while (route.isActive()) {
			// console.log('into css check')
			if (c > m_c) {
				console.warn('css check over max time');
				return res(false);
			}
			c += 1;
			// if (isCssReady(styleTag, route.disableShadow)) {
			if (isCssReady(styleTag, false)) {
				return res(true);
 			}
			await sleep(w); // 0.02 s once time
			await route.updateComplete; // make sure style content or base64 url appended
		}
		res(false);
	});
}