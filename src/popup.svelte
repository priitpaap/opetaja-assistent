<script lang="ts">
    import { onMount } from 'svelte';
    import browser from 'webextension-polyfill';

    let storedApiKey: string | null = null;

    async function saveApiKey() {
        const apiKeyInput = document.getElementById('apiKeyInput') as HTMLInputElement;
        const apiKey = apiKeyInput.value.trim();

        if (apiKey) {
            try {
                await browser.runtime.sendMessage({ command: 'saveApiKey', apiKey: apiKey });
                console.log("API Key Sent to Background for Saving:", apiKey);
                alert("API key saved successfully!");
                apiKeyInput.value = '';
                storedApiKey = apiKey;

                window.close();

            } catch (error) {
                console.error('Failed to send API key to background:', error);
                alert('Failed to save API key.');
            }
        } else {
            alert("Please enter a valid API key.");
        }
    }

    async function clearApiKey() {
        try {
            await browser.runtime.sendMessage({ command: 'removeApiKey' });
            console.log("API Key cleared from storage.");
            alert("API key cleared successfully!");
            storedApiKey = null;
        } catch (error) {
            console.error('Failed to clear API key from storage:', error);
            alert('Failed to clear API key.');
        }
    }

    onMount(async () => {
        try {
            storedApiKey = await browser.runtime.sendMessage({ command: 'getApiKey' });
        } catch (error) {
            console.error('Failed to retrieve API key:', error);
        }
    });
</script>

<h2 class="dialog-title">
    Õpetaja-assistent
</h2>
<div class="content">
    <p>Palun sisesta oma kriit.eu API võti</p>
    <input type="text" id="apiKeyInput" class="input-field">

    <!-- Display the stored API key if available -->
    {#if storedApiKey}
        <div class="api-key-container">
            <p class="stored-api-key">Teil on salvestatud API võti: </p>
            <p> {storedApiKey}</p>
        </div>
    {/if}

    <div class="button-container">
        <button on:click={saveApiKey} class="save-button">Salvesta</button>
    </div>
</div>

<style>
    .dialog-title {
        background: linear-gradient(to right, #4CAF50, #3E8E41);
        color: white;
        padding: 15px;
        font-size: 20px;
        font-weight: bold;
        text-align: center;
        border-radius: 10px 10px 0 0;
        box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
    }

    .content {
        padding: 0 20px;
        min-width: 350px;
        display: flex;
        flex-direction: column;
        align-items: flex-start;
        box-sizing: border-box;
        width: 100%;
    }

    .content p {
        font-size: 15px;
    }

    .api-key-container {
        display: flex;
        align-items: center;
        margin-top: 10px;
    }

    .stored-api-key {
        font-size: 14px;
        color: #333;
        margin-right: 10px;
    }

    .button-container {
        display: flex;
        justify-content: flex-start;
        width: 100%;
    }

    .save-button {
        padding: 10px 20px;
        background-color: #4CAF50;
        margin-top: 1em;
        margin-bottom: 1em;
        color: white;
        border: none;
        opacity: 0.6;
        border-radius: 5px;
        font-size: 16px;
        cursor: pointer;
        transition: background-color 0.3s;
    }

    .save-button:hover {
        opacity: 1;
    }

    .clear-button {
        padding: 5px 10px; /* Make the button smaller */
        background-color: #f44336; /* Red color for the clear button */
        color: white;
        border: none;
        border-radius: 5px;
        font-size: 14px;
        cursor: pointer;
        transition: background-color 0.3s;
    }

    .clear-button:hover {
        background-color: #d32f2f;
    }

    .input-field {
        width: 100%;
        padding: 8px;
        margin-bottom: 10px;
        box-sizing: border-box;
    }

    .input-field:focus {
        border: 3px solid #555;
    }
</style>
