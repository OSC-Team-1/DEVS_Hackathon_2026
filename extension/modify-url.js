const targetNode = document.body
const config = { attributes: true, childList: true, subtree: true };

function replace() {
	let links = document.getElementsByTagName("a")
	for (let link of links) {
		let destination = link.getAttribute("href")
		let origin = window.location
		if (/^(https?:\/\/)?127\.0\.0\.1.*$/.test(destination)) {
			continue;
		}
		if (/^\#.*$/.test(destination)) {
			continue;
		}
		if (/^\/.*$/.test(destination)) {
			link.setAttribute("href", `https://127.0.0.1/?dest=https://${window.location.hostname}${destination}&origin=${origin}`)
		}
		if (/^(https?:\/\/).*$/.test(destination)) {
			link.setAttribute("href", `https://127.0.0.1/?dest=${destination}&origin=${origin}`)
		}
	}
}

function callback(mutationList, observer) {
	replace()
}

// https://developer.mozilla.org/en-US/docs/Web/API/MutationObserver

const observer = new MutationObserver(callback);
observer.observe(targetNode, config);

replace()
