const fs = require('fs');
const axios = require('axios');
const puppeteer = require('puppeteer-core');

(async () => {
    const req = await axios.get('https://archive.mozilla.org/pub/firefox/nightly/latest-mozilla-central/');
    const rev = req.data.match(/firefox-([^-]*).en-US.linux-x86_64.checksums/)[1];
    process.env['BROWSER_REV'] = process.env['BROWSER_REV'] || rev;
    fs.writeFileSync('.env', `BROWSER_REV="${process.env['BROWSER_REV']}"`);

    const browserFetcher = puppeteer.createBrowserFetcher({ product: 'firefox' });
    await browserFetcher.download(process.env['BROWSER_REV']);
})();
