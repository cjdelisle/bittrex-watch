const Mattermost = require('mattermost-client');

module.exports.round2 = (n) => Math.round(n * 100) / 100;

module.exports.leftpad = (x, count) => {
    x = ''+x;
    if (x.length >= count) { return x; }
    return new Array(count - x.length).join(' ') + x;
};

module.exports.rightpad = (x, count) => {
    x = ''+x;
    if (x.length >= count) { return x; }
    return x + new Array(count - x.length).join(' ');
};

module.exports.mmLoginAsync = (config) => {
    process.env.MATTERMOST_LOG_LEVEL = 'notice';
    const mm = new Mattermost(config.server, config.team, { wssPort: 443, httpPort: null });
    mm.login(config.email, config.passwd);
    return new Promise((resolve) => {
        mm.on('loggedIn', () => {
            console.log('logged in');
            resolve(mm);
        });
    });
};