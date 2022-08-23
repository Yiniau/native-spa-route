import { Route } from "../main";

export function isCssReady(styleTag: HTMLStyleElement, globalCheck = false): boolean {
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
	if (!targetStyleSheet || !targetStyleSheet.cssRules.length) {
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
		let counter = 0;
		let max_counter = 30 * 60; // 1 secends 60 time, max wait 30 secends
		while (route.isActive()) {
			console.log('round afterCssReady...', counter);
			counter += 1;
			if (counter > max_counter) {
				console.warn('css check over max time');
				return res(false);
			}
			if (isCssReady(styleTag, route.disableShadow)) {
				return res(true);
 			}
			await sleep(16);		
		}
		res(false);
	});
}