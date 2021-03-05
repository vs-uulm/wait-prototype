browser.runtime.onMessage.addListener((request) => {
    const response = [];
    let hasSRI = true;

    if (request.type === 'script') {
        for (const script of document.querySelectorAll(`script[src="${request.url}"]`)) {
            if (!script.getAttribute("integrity") || script.getAttribute("integrity").length < 20) {
                hasSRI = false;
            } else {
                response.push(script.getAttribute("integrity"));
            }
        }
    } else if (request.type === 'stylesheet') {
        for (const link of document.querySelectorAll(`link[href="${request.url}"]`)) {
            if (!link.getAttribute("integrity") || link.getAttribute("integrity").length < 20) {
                hasSRI = false;
            } else {
                response.push(link.getAttribute("integrity"));
            }
        }
    }

    return Promise.resolve({
        hasSRI: hasSRI,
        response: response
    });
});

document.addEventListener('readystatechange', (event) => {
    // remove all scripts and styles without SRI
    document.querySelectorAll('script:not([integrity]),link[rel="stylesheet"]:not([integrity])')
        .forEach(e => e.parentNode.removeChild(e));
});
