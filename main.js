const puppeteer = require('puppeteer');
const randomUA = require('user-agents');
const fs = require('fs-extra');
const moment = require('moment-timezone');
const dedent = require('dedent-js');
const chalk = require('chalk');
const Spinners = require('spinnies');
const now = require('performance-now');
const cluster = require('cluster');
const axios = require('axios');

require('dotenv').config();
const argv = require('optimist')
  .usage(
    color('[USAGE]:', 'yellow') +
    'node main --num [NUMBER OF VISITS] --min [MINIMUM DELAY IN MS] --max [MAXIMUM DELAY IN MS] --t [MAX THREADS] --headless [Boolean] --styling [0/1 (disable or enable css style)]'
  )
  .demand(["num"])
  .default('min', 15000)
  .default('max', 25000)
  .default('t', 1)
  .default('styling', '1')
  .default('headless', 'false')
  .argv;

async function doVisit(options) {
  let browser;
  let chromeTmpDataDir = null;

  try {
    const startTime = now();
    const units = ['y', 'mo', 'd', 'h', 'm', 's'];

    const frames = {
      interval: 200,
      frames: [
        "⠋",
        "⠙",
        "⠹",
        "⠸",
        "⠼",
        "⠴",
        "⠦",
        "⠧",
        "⠇",
        "⠏"
      ]
    };
    const spinner = new Spinners({
      spinner: frames,
      color: 'yellow',
      succeedColor: 'green',
      failColor: 'red',
      spinnerColor: 'blueBright'
    });

    spinner.add('spinner-main', {
      text: 'mencoba melakukan visit ke url...'
    });

    browser = await puppeteer.launch(options.chromeArgs);
    const page = await browser.newPage();

    if (options.useProxy && options.proxy.auth === true) {
      await page.authenticate({
        username: options.proxy.user,
        password: options.proxy.pass
      });
    }

    if (options.styling == '0') {
      await page.setRequestInterception(true);
      await page.on('request', (request) => {
        if (["stylesheet", "image", "video", "font", "css", "jpeg", "png"].includes(request.resourceType())) {
          request.abort();
        } else {
          request.continue();
        }
      });
    }

    await page.setViewport({
      width: options.viewport.width || 768,
      height: options.viewport.height || 1366
    });
    await page.setUserAgent(options.user_agent);
    await page.setExtraHTTPHeaders({
      referer: options.referer
    });

    var go = await page.goto(options.url, {
      waitUntil: 'domcontentloaded',
      timeout: 0
    });

    async function scrollPageToBottom() {
      const bodyHeight = await page.evaluate(() => document.body.scrollHeight);
      const viewportHeight = page.viewport().height;
      let scrollDistance = 0;

      while (scrollDistance + viewportHeight < bodyHeight) {
        scrollDistance += 50;
        await page.evaluate((distance) => {
          window.scrollTo(0, distance);
        }, scrollDistance);
        await page.waitForTimeout(50);
      }
    }

    //await scrollPageToBottom();
    await page.waitForTimeout(options.sleep);

    const chromeSpawnArgs = browser.process().spawnargs;
    for (let i = 0; i < chromeSpawnArgs.length; i++) {
      if (chromeSpawnArgs[i].startsWith("--user-data-dir=")) {
        chromeTmpDataDir = chromeSpawnArgs[i].replace("--user-data-dir=", "");
        break;
      }
    }

    await browser.close();
    spinner.remove('spinner-main');

    console.log(dedent(`
      ${color(`[#${cluster.worker.id} - ${cluster.worker.process.pid}]`, 'cyan')} ${color('AUTOMATTIC WEB TRAFFIC SOFTWARE', 'orange')} by ${color('@nopaleon.real', 'red')}
      ${color('URL', 'green')}: ${color(options.url, 'yellow')}
      ${color('Status', 'green')}: ${color('SUKSES', 'yellow')}
      ${color('Referer', 'green')}: ${color(options.referer, 'yellow')}
      ${color('Interval', 'green')}: ${color(options.sleep + ' ms', 'yellow')}
      ${color('Proxy', 'green')}: ${color(options.useProxy ? 'YES' : 'NO', 'yellow')}
      ${color('Threads Limit', 'green')}: ${color(argv.t + ' thread/run script', 'yellow')}
      ${color('User Agent', 'green')}: ${color(options.user_agent, 'yellow')}
      ${color('Visit Tersisa', 'green')}: ${color(argv.num - options.hits + ' hits', 'yellow')}
      ${color('Total Visit', 'green')}: ${color(options.total_hits + ' hits', 'yellow')}
      ${color('Waktu', 'green')}: ${color(moment.tz('Asia/Jakarta').locale('id').format('LLLL'), 'yellow')}
      ${color('Waktu Proses', 'green')}: ${color(((now() - startTime) / 1000).toFixed(2) + ' detik', 'yellow')}
      [${color(go.url(), 'orange')}] ${color("status code", 'green')}: ${color(go.status(), 'yellow')}

    `));

    return true;
  } catch (e) {
    console.log('error nih bro!\n');
    console.error(e);
    console.log("proxy err", options.proxy)
    return false;
  } finally {
    if (chromeTmpDataDir !== null) {
      try {
        fs.removeSync(chromeTmpDataDir);
      } catch (e) {
        console.error(`Failed to remove temporary data directory: ${chromeTmpDataDir}`, e);
      }
    }
  }
}

async function start(num) {
  var urls = fs.readFileSync('./data/urls.txt', 'utf8').toString().split('\n');
  var proxies = fs.readFileSync('./data/proxies.txt', 'utf8').toString().split('\n');
  var referers = fs.readFileSync('./data/referers.txt', 'utf8').toString().split('\n');
  if (cluster.isMaster) {
    for (let x = 1; x <= argv.t; x++) {
      cluster.fork();
    }
    cluster.on('exit', function (worker, code, signal) {
      console.log(color('[INFO]', 'cyan'), color(`1 worker is died, starting new worker #${worker.id}`, 'yellow'));
      cluster.fork();
    });
  } else {
    for (let i = 1; i <= num; i++) {
      try {
        var useHeadless = true;
        if (argv.headless == 'false') {
          useHeadless = false
        }
        var chromeArgs = {
          headless: useHeadless,
          args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-translate',
            '--disable-extensions',
            '--disable-sync',
            '--disable-features=site-per-process',
            '--disk-cache-size=10000000',
            '--num-raster-threads=1',
            '--renderer-process-limit=100'
          ],
          ignoreHTTPSErrors: true
        };
        if (proxies.length > 0 && proxies[0].length > 5) {
          var proxy = proxies[Math.floor(Math.random() * proxies.length)].split(':');
          var prx = `--proxy-server=http://${proxy[0]}:${proxy[1]}`
          chromeArgs.args.push(prx);
        }
        var referer = 'https://www.discordapp.com/';
        if (referers.length > 0) {
          referer = referers[Math.floor(Math.random() * referers.length)].replace(/\r/g, '');
        }
        if (proxies[0].length > 5 && proxy.length == 4) {
          var proxyArgs = {
            auth: true,
            user: proxy[2],
            pass: proxy[3]
          };
        } else {
          var proxyArgs = {
            auth: false
          };
        }
        var url = await urls[Math.floor(Math.random() * urls.length)];
        if (url.includes('youtube')) {
          var extPath = require('path').resolve('./ext');
          //chromeArgs.args.push(`--disable-extensions-except=${extPath}`);
          //chromeArgs.args.push(`--load-extension=${extPath}`);
        }
        var browserData = await getRandomUserAgent('random');
        var options = {
          url: url,
          useProxy: proxies.length > 0 && proxies[0].length > 5 ? true : false,
          proxy: proxyArgs,
          hits: i,
          user_agent: browserData.userAgent,
          viewport: {
            height: browserData.viewportHeight,
            width: browserData.viewportWidth
          },
          styling: argv.styling,
          chromeArgs: chromeArgs,
          referer: referer,
          sleep: getRandomInt(argv.min, argv.max),
          total_hits: num
        };

        await doVisit(options);

        if (i >= num) {
          process.exit(0);
        }
      } catch (e) {
        return;
      }
    }
  }
}

function color(text, color) {
  return !color ? chalk.green(text) : chalk.keyword(color)(text);
}

async function getRandomUserAgent(type = 'random') {
  switch (type.toLowerCase()) {
    case 'mobile':
      return new randomUA({ deviceCategory: 'mobile' }).data;
      break;
    case 'tablet':
      return new randomUA({ deviceCategory: 'tablet' }).data;
      break;
    case 'desktop':
    case 'dekstop':
      return new randomUA({ deviceCategory: 'desktop' }).data;
      break;
    default:
      return new randomUA().data;
  }
}

function getRandomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1) + min);
}

function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

start(argv.num);
