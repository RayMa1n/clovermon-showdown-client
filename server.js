const fs = require('fs');
const path = require('path');
const http = require('http');
const https = require('https');
const axios = require('axios');
const express = require('express');
const bodyParser = require('body-parser');

const { ports, defaultserver, ssl, proxies } = require('./config/config-server');

const app = express()
const privateKey  = fs.readFileSync(ssl.privateKeyPath, 'utf8');
const certificate = fs.readFileSync(ssl.certificatePath, 'utf8');

app.use(bodyParser.urlencoded({ extended: true }));
app.post(`/~~${defaultserver.id}/action.php`, (request, response) => {
  if (request.body.act && request.body.act === 'register') {
    return response.send(']{"actionerror":"Please register on https:\/\/play.pokemonshowdown.com\/."}')
  }

  let headers = {};
  const cookieHeader = request.headers['Cookie'] || request.headers['cookie'];
  if (cookieHeader) {
    headers.cookie = cookieHeader;
  }

  const requestOptions = {
    method: 'POST',
    url: 'http://play.pokemonshowdown.com/action.php',
    data: request.body,
    headers,
  };

  if (proxies && proxies.length) {
    const proxy = proxies[Math.floor(Math.random() * proxies.length)];
    requestOptions.proxy = {
      protocol: proxy.protocol | 'http',
      host: proxy.ip,
      port: proxy.port,
    };

    if (proxy.username) {
      requestOptions.proxy.auth = {
        username: proxy.username,
        password: proxy.password || '',
      };
    }
  }

  axios(requestOptions).then((res) => {
    const setCookieHeader = res.headers['Set-Cookie'] || res.headers['set-cookie'];
    if (setCookieHeader) {
      if (Array.isArray(setCookieHeader)) {
        setCookieHeader.forEach((header) => {
          response.setHeader('set-cookie', header.replace('pokemonshowdown.com', 'clover.weedl.es'));
        });
      } else {
        response.setHeader('set-cookie', setCookieHeader.replace('pokemonshowdown.com', 'clover.weedl.es'));
      }
    };
    response.send(res.data)
  });
});
app.use('*.php', (request, response) => response.sendStatus(404));
app.get('/lobby-banner', (request, response) => {
  const banners = fs.readdirSync('./banners');
  const banner = banners[Math.floor(Math.random() * banners.length)];

  response.sendFile(path.join(__dirname, 'banners', banner));
});
app.get('*', (request, response, next) => {
  if (request.path.startsWith('/sprites/afd')) {
    const afdPath = path.join(__dirname, 'public', request.path);
    if (!fs.existsSync(afdPath)) {
      return response.redirect(request.path.replace('/sprites/afd', '/sprites/gen5'));
    }
  }

  next();
});
app.use(express.static('./public', { index: 'index.html', fallthrough: true }));
app.get('*', (request, response) => {
  response.sendFile(path.join(__dirname, './public/index.html'));
});

const httpApp = express();
httpApp.use('*', (request, response) => {
  response.redirect("https://" + request.headers.host + request.url);
});

const httpServer = http.createServer(httpApp);
const httpsServer = https.createServer({ key: privateKey, cert: certificate }, app);

httpServer.listen(ports.http, () => console.log(`Http redirect listening on ${ports.http}`));
httpsServer.listen(ports.https, () => console.log(`Listening on ${ports.https}`));
