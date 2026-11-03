require('@testing-library/jest-dom');
global.__offlineAttempts = [];
const deny = kind => () => {
    global.__offlineAttempts.push(kind);
    throw new Error(`Offline simulation blocked ${kind}`);
};
global.fetch = deny('fetch');
XMLHttpRequest.prototype.open = deny('XMLHttpRequest');
global.WebSocket = deny('WebSocket');
global.EventSource = deny('EventSource');
navigator.sendBeacon = deny('sendBeacon');
window.matchMedia = () => ({ matches: false, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {} });
window.scrollTo = () => {};
Element.prototype.scrollIntoView = () => {};
