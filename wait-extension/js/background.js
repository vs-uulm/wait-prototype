const decoder = new TextDecoder();
const encoder = new TextEncoder();

const REQUIRED_INCLUSION_PROOFS = 1;
const TRUSTED_KEY = KEYUTIL.getKey(`-----BEGIN PUBLIC KEY-----
MFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAE3rPxaDs2KCD0PCmAq0WVoMKAiIyY
yGh6jO/y0euo5YwUfZWtM0hAAOU+NH2TrKikEhQeuv11NPDwjNH0FHJuvA==
-----END PUBLIC KEY-----`);

function getBlockPage(reason) {
    return encoder.encode(`<!DOCTYPE html>
        <html>
            <head>
                <meta charset="UTF-8">
                <title>Warning! Web content validation failed.</title>
            </head>

            <body class="wait-body">
                <div class="wait-block">
                    <h2>Warning! Web content validation failed.</h2>
                    <p>
                        To mitigate the possibility of servers attacking specific 
                        clients with tampered content, servers need to publish a
                        unique identifier for each web resource. With this identifier,
                        the browser can validate the received web resource before executing it. If the
                        validation fails, the browser automatically blocks the resource.
                        This was the case on this website. There are multiple reasons for failed validation:
                        <ul>
                            <li>The server did not publish identifiers for its web resoureces.</li>
                            <li>The published identifier does not match the calculated identifier.</li>
                        </ul>
                    </p>
                    <br>
                    <br>
                    <p>Why are you seeing this?</p>
                    <pre id="message">${reason}</pre>
                </div>
            </body>
        </html>`);
}

browser.webRequest.onHeadersReceived.addListener(async (details) => {
    if (details.type !== 'main_frame' && details.type !== 'sub_frame') {
        return;
    }

    const securityInfo = browser.webRequest.getSecurityInfo(details.requestId, {});
    const filter = browser.webRequest.filterResponseData(details.requestId);

    let data = new ArrayBuffer(0);
    filter.ondata = (event) => {
        const stored = new Uint8Array(data);
        const received = new Uint8Array(event.data);
        const newData = new Uint8Array(stored.length + received.length);
        newData.set(stored, 0);
        newData.set(received, stored.length);
        data = newData.buffer;
    };

    filter.onstop = async () => {
        const digest = window.crypto.subtle.digest({ name: 'SHA-512' }, data);
        try {
            if ((await securityInfo).state !== 'secure') {
                throw 'Connection is not secure';
            }

            const waitHeader = details.responseHeaders.find(h => h.name === 'X-WAIT-Inclusion-Proofs');
            if (!waitHeader) {
                throw 'No WAIT Header';
            }
            const inclusionProofs =  waitHeader.value.split(' ');
            if (inclusionProofs.length < REQUIRED_INCLUSION_PROOFS) {
                throw 'Not enough inclusion proofs';
            }

            if (!inclusionProofs.every((proof) => KJUR.jws.JWS.verifyJWT(proof, TRUSTED_KEY, { alg: ['ES256'] }))) {
                throw 'Supplied inclusion proof is invalid';
            }

            const cspHeader = details.responseHeaders.find(h => h.name === 'Content-Security-Policy');
            if (!cspHeader) {
                throw 'No CSP Header';
            }

            if (cspHeader.value.includes('unsafe')) {
                throw 'CSP too lenient';
            }
            const hash = Array.prototype.map.call(new Uint8Array(await digest), x => `00${x.toString(16)}`.slice(-2)).join('');

            if (!inclusionProofs.every((proof) => {
                const payload = JSON.parse(atob(proof.split('.', 3)[1].replace(/-/g, '/')));
                return payload.url === details.url && payload.hash === hash;
            })) {
                throw 'Inclusion proof not matching document hash or URL';
            }

            filter.write(data);
        } catch (e) {
            console.log('[WAIT] error', e);
            filter.write(getBlockPage(e));
        } finally {
            filter.disconnect();
        }
    };
}, { urls: ['*://*/*'] }, ['blocking', 'responseHeaders']);
