const signalR = require('signalr-client');
const zlib = require('zlib');
const crypto = require('crypto');
const uuid = require('uuid');
const Util = require('./util');

const Config = require('./config.js');

const url = 'wss://socket-v3.bittrex.com/signalr';
const hub = ['c3'];

const apikey = '';
const apisecret = '';

var client;
let mm;
var resolveInvocationPromise = () => { };

async function main() {
    client = await connect();
    mm = await Util.mmLoginAsync(Config);
    if (apisecret) {
        await authenticate(client);
    } else {
        console.log('Authentication skipped because API key was not provided')
    }
    await subscribe(client);
}

async function connect() {
  return new Promise((resolve) => {
    const client = new signalR.client(url, hub);
    client.serviceHandlers.messageReceived = messageReceived;
    client.serviceHandlers.connected = () => {
      console.log('Connected');
      return resolve(client)
    }
    client.serviceHandlers.disconnected = () => {
        console.log('DISCONNECTED');
        process.exit(0);
    };
  });
}

async function authenticate(client) {
  const timestamp = new Date().getTime()
  const randomContent = uuid.v4()
  const content = `${timestamp}${randomContent}`
  const signedContent = crypto.createHmac('sha512', apisecret)
    .update(content).digest('hex').toUpperCase()

  const response = await invoke(client, 'authenticate',
    apikey,
    timestamp,
    randomContent,
    signedContent);

  if (response['Success']) {
    console.log('Authenticated');
  }
  else {
    console.log('Authentication failed: ' + response['ErrorCode']);
  }
}

async function subscribe(client) {
  const channels = [
    'heartbeat',
    'trade_PKT-USDT',
    //'trade_BTC-USD',
    //'balance'
  ];
  const response = await invoke(client, 'subscribe', channels);

  for (var i = 0; i < channels.length; i++) {
    if (response[i]['Success']) {
      console.log('Subscription to "' + channels[i] + '" successful');
    }
    else {
      console.log('Subscription to "' + channels[i] + '" failed: ' + response[i]['ErrorCode']);
    }
  }
}

async function invoke(client, method, ...args) {
  return new Promise((resolve, reject) => {
    resolveInvocationPromise = resolve; // Promise will be resolved when response message received

    client.call(hub[0], method, ...args)
      .done(function (err) {
        if (err) { return reject(err); }
      });
  });
}

function messageReceived(message) {
  const data = JSON.parse(message.utf8Data);
  if (data['R']) {
    resolveInvocationPromise(data.R);
  } else if (data['M']) {
    data.M.forEach(function (m) {
      if (m['A']) {
        if (m.A[0]) {
          const b64 = m.A[0];
          const raw = new Buffer.from(b64, 'base64');

          zlib.inflateRaw(raw, function (err, inflated) {
            if (err) {
                console.log(err);
                return;
            }
            const json = JSON.parse(inflated.toString('utf8'));
            if (m.M !== 'trade') {
                console.log(json);
                return;
            }
            //console.log(m.M + ': ');
            let totq = 0;
            let totc = 0;
            let minP = Infinity;
            let maxP = 0;
            let ts = '';
            let time = '';
            for (const d of json.deltas) {
                maxP = Math.max(maxP, Number(d.rate));
                minP = Math.min(minP, Number(d.rate));
                ts = d.takerSide;
                totq += Number(d.quantity);
                totc += Number(d.quantity) * Number(d.rate);
                time = d.executedAt.replace(/^[^T]*T([^.]*).[0-9]*Z$/, (all, x) => x);
            }
            let price;
            if (ts === 'BUY') {
                ts += ' ';
                price = minP;
            } else {
                price = maxP;
            }
            const msg = time + ' ' + ts + Util.leftpad(Math.round(totq), 8) + ' PKT\tFOR $' +
              Util.round2(totc) + '\tPRICE $' + price;
            console.log(msg);
            mm.postMessage('`' + msg + '`', Config.bittrex_channel);
          });
        }
        else if (m.M == 'heartbeat') {
          //console.log('\u2661');
        }
        else if (m.M == 'authenticationExpiring') {
          console.log('Authentication expiring...');
          authenticate(client);
        }
      }
    });
  }
}

const _ = main();
