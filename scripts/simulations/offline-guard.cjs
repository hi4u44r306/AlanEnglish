// Loaded before Jest: no network or environment-file reads are permitted.
const fs = require('node:fs');
const forbidden = value => /(^|[\\/])\.env(?:[.\\/]|$)/.test(String(value));
for (const method of ['readFileSync', 'readFile', 'openSync', 'open', 'createReadStream']) {
    const original = fs[method];
    fs[method] = function (path, ...args) {
        if (forbidden(path)) throw new Error('Offline simulation forbids .env reads');
        return original.call(this, path, ...args);
    };
}
for (const method of ['readFile', 'open']) {
    const original = fs.promises[method];
    fs.promises[method] = function (path, ...args) {
        if (forbidden(path)) throw new Error('Offline simulation forbids .env reads');
        return original.call(this, path, ...args);
    };
}
const deny = () => { throw new Error('Offline simulation forbids network access'); };
for (const name of ['http', 'https']) {
    const module = require(`node:${name}`);
    module.request = deny;
    module.get = deny;
}
require('node:net').Socket.prototype.connect = deny;
require('node:tls').connect = deny;
require('node:dns').lookup = deny;
global.fetch = deny;
