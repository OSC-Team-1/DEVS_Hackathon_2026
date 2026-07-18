const targetNode = document.body
const config = { attributes: true, childList: true, subtree: true };

function replace() {
	let links = document.getElementsByTagName("a")
	for (let link of links) {
		let destination = link.getAttribute("href")
		let origin = encodeURIComponent(window.location)
		if (/^(https?:\/\/)?localhost:8080.*$/.test(destination)) {
			continue;
		}
		if (/^\#.*$/.test(destination)) {
			continue;
		}
		if (/^\/.*$/.test(destination)) {
			let destination_final = encodeURIComponent(`https://${window.location.hostname}${destination}`)
			link.setAttribute("href", `http://localhost:8080/?dest=${destination_final}&origin=${origin}`)
		}
		if (/^(https?:\/\/).*$/.test(destination)) {
			let destination_final = encodeURIComponent(`${destination}`)
			link.setAttribute("href", `http://localhost:8080/?dest=${destination_final}&origin=${origin}`)
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
