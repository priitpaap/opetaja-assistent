// Manages caching logic

function saveToCache(key, data) {
    const payload = {};
    payload[key] = data;
    chrome.storage.local.set(payload, () => {
        console.log('Data saved to cache:', key);
    });
}

function getFromCache(key, callback) {
    chrome.storage.local.get([key], (result) => {
        callback(result[key]);
    });
}

function invalidateCache(key) {
    chrome.storage.local.remove([key], () => {
        console.log('Cache invalidated:', key);
    });
}
