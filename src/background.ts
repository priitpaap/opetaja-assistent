import browser from 'webextension-polyfill';

// Define the message interface for handling various commands
interface Message {
    command: 'saveApiKey' | 'getApiKey' | 'removeApiKey' | 'getFromStorage' | 'setInStorage' | 'removeFromStorage';
    apiKey?: string; // Optional, only needed for 'saveApiKey'
    key?: string;    // Optional, for getFromStorage, setInStorage, removeFromStorage
    value?: string;  // Optional, only needed for 'setInStorage'
}

// Function to save data to sync storage
async function saveApiKey(apiKey: string) {
    try {
        await browser.storage.sync.set({ KRIIT_API_KEY: apiKey });
        console.log('API key saved successfully.');
    } catch (error) {
        console.error('Failed to save API key:', error);
    }
}

// Function to retrieve data from sync storage
async function getApiKey() {
    try {
        const result = await browser.storage.sync.get('KRIIT_API_KEY');
        if (result.KRIIT_API_KEY) {
            console.log('Retrieved API key:', result.KRIIT_API_KEY);
            return result.KRIIT_API_KEY;
        } else {
            console.log('No API key found.');
            return null;
        }
    } catch (error) {
        console.error('Failed to retrieve API key:', error);
        return null; // Return null if there's an error
    }
}

// Function to remove data from sync storage
async function removeApiKey() {
    try {
        await browser.storage.sync.remove('KRIIT_API_KEY');
        console.log('API key removed successfully.');
    } catch (error) {
        console.error('Failed to remove API key:', error);
    }
}

// General function to retrieve data from sync storage
//eslint-disable-next-line
async function getFromStorage(key: string): Promise<any> {
    try {
        const result = await browser.storage.sync.get(key);
        return result[key] || null;
    } catch (error) {
        console.error(`Failed to retrieve ${key} from storage:`, error);
        return null;
    }
}

// General function to save data to sync storage
async function setInStorage(key: string, value: string) {
    try {
        await browser.storage.sync.set({ [key]: value });
        console.log(`${key} saved successfully.`);
    } catch (error) {
        console.error(`Failed to save ${key}:`, error);
    }
}

// General function to remove data from sync storage
async function removeFromStorage(key: string) {
    try {
        await browser.storage.sync.remove(key);
        console.log(`${key} removed successfully.`);
    } catch (error) {
        console.error(`Failed to remove ${key}:`, error);
    }
}

// Listen for messages from other parts of the extension
browser.runtime.onMessage.addListener(async (message: Message) => {
    try {
        switch (message.command) {
            case 'saveApiKey':
                if (message.apiKey) {
                    await saveApiKey(message.apiKey);
                } else {
                    throw new Error('API key is missing for saveApiKey command.');
                }
                break;
            case 'getApiKey':
                return await getApiKey();
            case 'removeApiKey':
                await removeApiKey();
                break;
            case 'getFromStorage':
                if (message.key) {
                    return await getFromStorage(message.key);
                } else {
                    throw new Error('Key is missing for getFromStorage command.');
                }
            case 'setInStorage':
                if (message.key && message.value) {
                    await setInStorage(message.key, message.value);
                } else {
                    throw new Error('Key or value is missing for setInStorage command.');
                }
                break;
            case 'removeFromStorage':
                if (message.key) {
                    await removeFromStorage(message.key);
                } else {
                    throw new Error('Key is missing for removeFromStorage command.');
                }
                break;
            default:
                console.error('Unknown command:', message.command);
        }
    } catch (error) {
        console.error('Error handling message:', error);
    }
});
