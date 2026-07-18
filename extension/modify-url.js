const targetNode = document.body
const config = { attributes: true, childList: true, subtree: true };

function replace() {
	let links = document.getElementsByTagName("a")
	for (let link of links) {
		destination = link.getAttribute("href")
		if (/^(https?:\/\/)?127\.0\.0\.1.*$/.test(destination)) {
			continue;
		}
		if (/^\#.*$/.test(destination)) {
			continue;
		}
		if (/^\/.*$/.test(destination)) {
			link.setAttribute("href", `https://127.0.0.1/?dest=https://${window.location.hostname}${destination}`)
		}
		if (/^(https?:\/\/).*$/.test(destination)) {
			console.log("alsdkjfhalskdf")
			link.setAttribute("href", `https://127.0.0.1/?dest=${destination}`)
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
