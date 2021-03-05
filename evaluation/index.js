require('dotenv').config();
const path = require('path');
const webExt = require('web-ext');
const puppeteer = require('puppeteer-core');
const createCsvWriter = require('csv-writer').createObjectCsvWriter;

const REPETITIONS = process.env['REPETITIONS'] || 1000;

function sleep(t) {
    return new Promise(resolve => setTimeout(resolve, t));
}

async function eval(mode) {
    let extension;
    let applicationURL = process.env['APPLICATION_URL'];
    const browserFetcher = puppeteer.createBrowserFetcher({ product: 'firefox' });
    const revisionInfo = await browserFetcher.download(process.env['BROWSER_REV']);
    console.log('starting with', mode);

    if (mode === 'baseline') {
        extension = './extensions/noop-extension';
        applicationURL += '/baseline.html';
    } else {
        extension = './extensions/wait-extension';
    }

    const extensionRunner = await webExt.cmd.run({
        noReload: true,
        firefox: revisionInfo.executablePath,
        sourceDir: path.resolve(__dirname, extension),
        args: [ '--headless', '--remote-debugging-port', '12345' ]
    }, { shouldExitProgram: false });

    await sleep(5000);
    const browser = await puppeteer.connect({
        browserURL: `http://localhost:12345`,
        ignoreHTTPSErrors: true,
        product: 'firefox'
    });

    await sleep(5000);
    const timings = [];

    for (let i = 0; i < REPETITIONS; i += 1) {
        const page = await browser.newPage();
        await page.setCacheEnabled(false);
        await page.goto(applicationURL);
        timings.push(JSON.parse(await page.evaluate(() => JSON.stringify(window.performance.timing))));
        await page.close();
    }

    await browser.close();

    const csvWriter = createCsvWriter({
        path: `times-${mode}.csv`,
        header: Object.keys(timings[0]).map(k => ({ id: k, title: k }))
    });

    await csvWriter.writeRecords(timings);
    console.log('done with', mode);

    if (mode !== 'baseline') {
	extensionRunner.exit();
    }
}

(async () => {
    try {
        await eval(process.argv[2]);
    } catch (e) {
        console.log(e);
        process.exit(1);
    }
})();
