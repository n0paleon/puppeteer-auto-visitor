const puppeteer = require('puppeteer')
      randomUA = require('random-useragent')
      fs = require('fs-extra')
      moment = require('moment-timezone')
      dedent = require('dedent-js')
      chalk = require('chalk')
      Spinners = require('spinnies')
      now = require('performance-now')
      humanizeDuration = require('humanize-duration')
      cluster = require('cluster')
      

const argv = require('optimist')
      .usage(color('[USAGE]:', 'yellow') + 'node main --num [NUMBER OF VISITS] --min [MINIMUM DELAY IN MS] --max [MAXIMUM DELAY IN MS] --t [MAX THREADS]')
      .demand(["num"])
      .default('min', 15000)
      .default('max', 25000)
      .default('t', 1)
      .argv

async function doVisit (options) {
  try {
    const startTime = now()
    const units = ['y', 'mo', 'd', 'h', 'm', 's']
    
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
    }
    const spinner = new Spinners({
      spinner: frames,
      color: 'yellow',
      succeedColor: 'green',
      failColor: 'red',
      spinnerColor: 'blueBright'
    })
    
    await spinner.add('spinner-main', {
      text: 'mencoba melakukan visit ke url...'
    })
    
    const browser = await puppeteer.launch(options.chromArgs)
    
    const page = await browser.newPage()
    
    if (options.useProxy && options.proxy.auth == true) {
      await page.authenticate({
        username: options.proxy.user,
        password: options.proxy.password
      })
    }
    
    await page.setRequestInterception(true)
    page.on('request', (request) => {
      if (["stylesheet", "image", "video", "font"].includes(request.resourceType())) {
        request.abort()
      } else {
        request.continue()
      }
    })
    
    await page.setUserAgent(options.user_agent)
    await page.setExtraHTTPHeaders({
      referer: options.referer
    })
    
    await page.goto(options.url, {
      waitUntil: 'networkidle0',
      timeout: 0
    })
    
    await sleep(options.sleep)
    
    let chromeSpawnArgs = browser.process().spawnargs;
        chromeTmpDataDir = null
    for (let i = 0; i < chromeSpawnArgs.length; i++) {
      if (chromeSpawnArgs[i].indexOf("--user-data-dir=") === 0) {
        chromeTmpDataDir = chromeSpawnArgs[i].replace("--user-data-dir=", "");
      }
    }
    
    browser.close()
    
    await spinner.remove('spinner-main')
    await console.log(dedent(`
      ${color(`[x]`, 'cyan')} ${color('AUTOMATTIC WEB TRAFFIC SOFTWARE', 'orange')} by ${color('@bangnopal_real', 'red')}
      ${color('URL', 'green')}: ${color(options.url, 'yellow')}
      ${color('Status', 'green')}: ${color('SUKSES', 'yellow')}
      ${color('Referer', 'green')}: ${color(options.referer, 'yellow')}
      ${color('Interval', 'green')}: ${color(options.sleep + ' ms', 'yellow')}
      ${color('Proxy', 'green')}: ${color(options.useProxy ? 'YES' : 'NO', 'yellow')}
      ${color('Threads Limit', 'green')}: ${color(argv.t + ' thread/run script', 'yellow')}
      ${color('User Agent', 'green')}: ${color(options.user_agent, 'yellow')}
      ${color('Visit Tersisa', 'green')}: ${color(argv.num - options.hits + ' hits', 'yellow')}
      ${color('Waktu', 'green')}: ${color(moment.tz('Asia/Jakarta').locale('id').format('LLLL'), 'yellow')}
      ${color('Waktu Proses', 'green')}: ${color(((now() - startTime) / 1000).toFixed(2) + ' detik', 'yellow')}
      
      
    `))
    
    if (chromeTmpDataDir !== null) {
      fs.removeSync(chromeTmpDataDir);
    }
  } catch (e) {
    console.log('error nih bro!\n')
    console.error(e)
  }
}

async function start (num) {
  var urls = fs.readFileSync('./data/urls.txt', 'utf8').toString().split('\n')
  var proxies = fs.readFileSync('./data/proxies.txt', 'utf8').toString().split('\n')
  var referers = fs.readFileSync('./data/referers.txt', 'utf8').toString().split('\n')
  if (cluster.isMaster) {
    for (let x = 1; x <= argv.t; x++) {
      cluster.fork()
    }
  } else {
    for (let i = 1; i <= num; i++) {
      var chromeArgs = {
        headless: true,
        args: [
          '--no-sandbox',
          '--no-first-run',
          '--no-zygote'
          ]
      }
      if (proxies.length > 0) {
        var proxy = proxies[Math.floor(Math.random() * proxies.length)].split(':')
        chromeArgs.args.push(`--proxy-server=http://${proxy[0]}:${proxy[1]}`)
      }
      var referer = 'https://www.discordapp.com/'
      if (referers.length > 0) {
        referer = referers[Math.floor(Math.random() * referers.length)].replace(/\r/g, '')
      }
      if (proxy.length == 4) {
        var proxyArgs = {
          auth: true,
          user: proxy[2],
          pass: proxy[3]
        }
      } else {
        var proxyArgs = {
          auth: false
        }
      }
      var url = urls[Math.floor(Math.random() * urls.length)]
      var options = {
        url: url,
        useProxy: proxies.length > 0 ? true : false,
        proxy: proxyArgs,
        hits: i,
        user_agent: getRandomUserAgent(),
        chromeArgs: chromeArgs,
        referer: referer,
        sleep: getRandomInt(argv.min, argv.max)
      }
      
      await doVisit(options)
      
      if (i >=  num) {
        process.exit()
      }
    }
  }
}

function color(text, color) {
  return !color ? chalk.green(text) : chalk.keyword(color)(text)
}

function getRandomUserAgent(type = 'random') {
  var browserList = [
    'Mozilla',
    'Firefox',
    'Chrome',
    'Opera',
    'Brave',
    'Safari',
    'Samsung',
    'Android'
    ]
  return randomUA.getRandom (function (ua) {
    switch (type.toLowerCase()) {
      case 'random':
        return ua.browserName == browserList[Math.floor(Math.random() * browserList.length)]
        break
      case 'mobile':
        var mobileOsList = ['android', 'ios', 'windows phone']
        return ua.osName.toLowerCase() == mobileOsList[Math.floor(Math.random() * mobileOsList.length)]
        break
      case 'dekstop':
        var dekstopOsList = ['windows', 'linux', 'macos', 'ubuntu', 'debian', 'centos']
        return ua.osName.toLowerCase() == dekstopOsList[Math.floor(Math.random() * dekstopOsList.length)]
        break
      default:
        return ua.browserName == browserList[Math.floor(Math.random() * browserList.length)]
    }
  })
}

function getRandomInt (min, max) { // min and max included 
  return Math.floor(Math.random() * (max - min + 1) + min)
}

function sleep (ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms)
  })
}



start (argv.num)