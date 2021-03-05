const fs = require('fs/promises');
const crypto = require('crypto');
const https = require('https');

const jwt = require('jsonwebtoken');
const puppeteer = require('puppeteer');
const express = require('express');
const JSZip = require('jszip');

const tokens = new Map();
const app = express();

app.use(express.urlencoded({ extended: true }));

async function crawlBundle(url, signature) {
    const secretKey = await fs.readFile('private.pem', 'utf-8');

    const browser = await puppeteer.launch();
    const page = await browser.newPage();

    let error;
    let token;
    let mainURL;
    let bundleHash;
    let mainDocument;
    const bundle = new JSZip();

    page.on('response', async (response) => {
        if (error) {
            return;
        }

        switch (response.request().resourceType()) {
            case 'document':
                if (!bundleHash) {
                    const csp = response.headers()['content-security-policy'];
                    if (!csp || csp.includes('unsafe')) {
                        error = 'csp too lenient';
                        return;
                    }

                    mainURL = response.request().url();
                    mainDocument = await response.buffer();
                    const hash = crypto.createHash('sha512');
                    hash.update(mainDocument);
                    bundleHash = hash.digest('hex');

                    if (tokens.has(mainURL)) {
                        const decoded = jwt.decode(tokens.get(mainURL));
                        if (decoded.exp * 1000 > Date.now()) {
                            error = 'previous token is still valid';
                            return;
                        }
                    }

                    token = jwt.sign({
                        url: mainURL,
                        hash: bundleHash
                    }, secretKey, {
                        expiresIn: '1h',
                        algorithm: 'ES256'
                    });
                }

            case 'stylesheet':
            case 'script':
                const url = new URL(response.request().url());
                bundle.file(`${url.protocol.host}/${url.protocol.pathname}`, await response.buffer());
                break;
        }
    });

    await page.goto(url, { waitUntil: ['load', 'networkidle0'] });

    if (!error) {
        if (await page.evaluate(() => document.querySelector('script:not([integrity])') !== null)) {
            error = 'script without integrity attribute';
        }
        if (await page.evaluate(() => document.querySelector('link[rel="stylesheet"]:not([integrity])') !== null)) {
            error = 'link without integrity attribute';
        }
    }

    if (!error) {
        const developerKey = await page.evaluate(() => document.querySelector('meta[name="wait-developer-key"]')?.getAttribute('content'));
        if (!developerKey) {
            error = 'document does not contain a developer key';
        } else {
            const publicKey = crypto.createPublicKey(`-----BEGIN PUBLIC KEY-----\n${developerKey}\n-----END PUBLIC KEY-----`);
            if (!crypto.verify('sha512', mainDocument, publicKey, Buffer.from(signature, 'hex'))) {
                error = 'provided signature does not match developer key';
            }
        }
    }

    await browser.close();

    if (!error) {
        const bundleZip = await bundle.generateAsync({ type: 'nodebuffer' });
        await fs.writeFile(`bundles/${bundleHash}.zip`, bundleZip);
        tokens.set(mainURL, token);

        return token;
    } else {
        throw error;
    }
}

app.get('/', (req, res) => {
    res.json(Object.fromEntries(tokens));
});

app.post('/', async (req, res) => {
    try {
        res.send(await crawlBundle(req.body.url, req.body.signature));
    } catch (e) {
        console.log(e);
        res.status(400).send(e);
    }
});

(async () => {
    const port = process.env['PORT'] || 3000;
    const host = process.env['HOST'] || '127.0.0.1';

    const server = https.createServer({
        key: await fs.readFile('server.key', 'utf-8'),
        cert: await fs.readFile('server.crt', 'utf-8'),
    }, app);

    server.listen(port, host, () => console.log(`listening on https://${host}:${port}/`));
})();
