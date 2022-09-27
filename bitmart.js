const WebSocket = require('ws').WebSocket;
const Fs = require('fs');
const Util = require('./util');
const Config = require('./config');

const loaded = (mm) => {
    let time = 0;
    try {
        const f = Fs.readFileSync('./db.json', 'utf8');
        const o = JSON.parse(f);
        time = o.time;
    } catch (e) {}
    const ws = new WebSocket('wss://ws-manager-compress.bitmart.com/api?protocol=1.1');
    ws.on('open', () => {
        const msg = JSON.stringify({"op":"subscribe","args":["spot/trade:PKT_USDT"]})
        console.log("SEND>", msg);
        ws.send(msg);
    });
    ws.on('message', (msg) => {
        const json = JSON.parse(msg);
        if (json.table !== 'spot/trade') {
            console.log('not trade', json);
            return;
        }
        if (!Array.isArray(json.data)) {
            console.log('not array', json);
            return;
        }
        json.data.sort((a,b) => a.s_t - b.s_t);
        for (const a of json.data) {
            if (a.s_t < time) {
                continue;
            }
            if (a.s_t > (time + 10)) {
                time = a.s_t;
                Fs.writeFileSync('./db.json', JSON.stringify({time}));
            }
            const d = new Date(a.s_t * 1000).toISOString().replace(/^[^T]*T([^.]*).[0-9]*Z$/, (_, x) => x);
            const msg = d + ' ' + Util.rightpad(a.side.toUpperCase(), 5) +
                Util.leftpad(a.size, 9) + ' PKT FOR' +
                Util.leftpad(' $' + Util.round2(Number(a.size) * Number(a.price)), 15) +
                Util.leftpad(' PRICE $' + a.price, 10)
            console.log(msg);
            mm.postMessage('`' + msg + '`', Config.bitmart_channel);
        }
        //console.log(msg.toString('utf8'));
    });
    ws.on('error', (err) => {
        console.log('err', err);
        process.exit(0);
    });
    ws.on('close', (err, reason) => {
        console.log('close', err, reason.toString('utf8'));
        process.exit(0);
    });
    setInterval(() => {
        ws.ping('ping', true, (err) => {
            if (err) {
                console.log('ping error', err);
                process.exit(0);
            }
        });
    }, 5000);
};

const main = async () => {
    const mm = await Util.mmLoginAsync(Config);
    loaded(mm);
};
const _ = main();