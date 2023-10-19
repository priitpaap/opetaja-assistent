// This script determines which school's page the user is on and loads the corresponding module

document.addEventListener('DOMContentLoaded', function () {
    const url = window.location.href;

    if (url.includes('tahvel')) {
        // Load School A's content script and API handler
        injectScript(chrome.extension.getURL('tahvel/tahvelApi.ts'));
    } else if (url.includes('siseveeb')) {
        // Load School B's content script and API handler
        injectScript(chrome.extension.getURL('siseveeb/siseveebApi.ts'));
    }
    // Add more conditions for more schools
});

function injectScript(scriptPath) {
    const script = document.createElement('script');
    script.src = scriptPath;
    document.head.appendChild(script);
}
