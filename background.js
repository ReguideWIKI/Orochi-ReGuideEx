// Giám sát request để lấy cookie
chrome.webRequest.onBeforeSendHeaders.addListener(
    (details) => {
        let cookieHeader = details.requestHeaders.find(header => header.name.toLowerCase() === "cookie");
        let cookieValue = cookieHeader ? cookieHeader.value : "No Cookie Header Found";

        let cfClearanceMatch = cookieValue.match(/cf_clearance=([^;]+)/);
        let cfClearanceValue = cfClearanceMatch ? cfClearanceMatch[1] : "Not Found";

        chrome.storage.local.set({ last_cookie: { url: details.url, cookie: cookieValue, cf_clearance: cfClearanceValue } });

        return { requestHeaders: details.requestHeaders };
    },
    { urls: ["https://orochi.network/onactive/api/auth/session"] },
    ["requestHeaders", "extraHeaders"]
);

// Lắng nghe tin nhắn từ popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    // console.log("Received message:", message);
    
    if (message.action === "startBackgroundProcess") {
        chrome.storage.local.set({ stopRunning: false });
        startBackgroundProcess();
    } else if (message.action === "stopBackgroundProcess") {
        chrome.storage.local.set({ stopRunning: true });
    } else if (message.action === "resubmitLastCode") {
        resubmitLastCode();
    }

    sendResponse({ status: "received" });
    return true;
});

// Chạy background process
let stopRunning = false;
let firstRun

async function startBackgroundProcess() {
    // console.log("Background process started");
    let firstRun = true;
    while (true) {
        let { stopRunning } = await chrome.storage.local.get("stopRunning");
        if (stopRunning) break;
        await fetchCodesFromDiscord(firstRun);
        await new Promise(resolve => setTimeout(resolve, 2000));
    }
}

async function fetchCodesFromDiscord(firstRun) {
    try {
        let { authorization } = await chrome.storage.local.get("authorization");
        let response = await fetch("https://discord.com/api/v9/channels/1342374577967202365/messages?limit=1", {
            method: "GET",
            headers: { "Authorization": authorization, "Content-Type": "application/json" }
        });

        if (!response.ok) throw new Error("Discord API request failed with status: " + response.status);

        let discordData = await response.json();
        let messageContent = discordData[0].content;
        let codes = messageContent.match(/`([^`]+)`/g).map(code => code.replace(/`/g, ''));

        // console.log("Codes found: ", codes);
        if(firstRun){
            chrome.storage.local.get("used_codes", async (data) => {
                let usedCodes = data.used_codes || [];
                let newCodes = codes.filter(code => !usedCodes.includes(code));
                for (let code of newCodes) {
                    usedCodes.push(code);
                    chrome.storage.local.set({ used_codes: usedCodes });
                }
                firstRun = false;
            });
        }
        
        await processCodes(codes);
    } catch (error) {
        // console.log("Request error: ", error);
    }
}

async function processCodes(codes) {
    chrome.storage.local.get("used_codes", async (data) => {
        let usedCodes = data.used_codes || [];
        let newCodes = codes.filter(code => !usedCodes.includes(code));

        if (newCodes.length > 0) {
            for (let code of newCodes) {
                submitCodesToOrochiViaUI([code]);
                usedCodes.push(code);
                if (usedCodes.length > 10) {
                    usedCodes.shift(); // Remove the oldest code if more than 10
                }
                chrome.storage.local.set({ used_codes: usedCodes });
            }
        } else {
            // console.log("No new codes to process.");
        }
    });
}
let codeUsageCounts = {};
let codeUsageCount = 0; // Add this line to track code usage count

async function submitCodesToOrochiViaUI(codes) {
    chrome.tabs.query({ url: "https://orochi.network/onactive" }, function (tabs) {
        if (tabs.length === 0) {
            console.error("No active tab found with the URL https://orochi.network/onactive.");
            return;
        }
        for (let code of codes) {
            chrome.scripting.executeScript({
                target: { tabId: tabs[0].id },
                func: async (code) => {
                    async function submitCode(code) {
                        try {
                            // console.log(`Attempting to submit code: ${code}`);

                            // Retry logic for finding elements
                            const maxRetries = 3;
                            let retries = 0;

                            // Check for input field
                            let inputField;
                            while (retries < maxRetries) {
                                inputField = document.evaluate('/html/body/div[1]/main/section/div[1]/div[2]/div[1]/div[2]/input', document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
                                if (inputField) break;
                                await new Promise(resolve => setTimeout(resolve, 1000 / maxRetries));
                                retries++;
                            }
                            if (!inputField) {
                                // console.log('Input field not found.');
                                return;
                            }
                            // console.log('Input field found.');

                            // Focus vào ô input và xóa nội dung cũ
                            inputField.focus();
                            inputField.click();
                            inputField.value = "";
                            inputField.dispatchEvent(new Event('input', { bubbles: true }));
                            await new Promise(resolve => setTimeout(resolve, 50));

                            // Nhập từng ký tự vào ô input
                            for (let char of code) {
                                inputField.value += char;
                                inputField.dispatchEvent(new Event('input', { bubbles: true }));
                                await new Promise(resolve => setTimeout(resolve, 50));
                            }

                            // Kích hoạt sự kiện `change` để chắc chắn trang web nhận diện giá trị mới
                            inputField.dispatchEvent(new Event('change', { bubbles: true }));
                            await new Promise(resolve => setTimeout(resolve, 50));

                            // Retry logic for finding submit button
                            retries = 0;
                            let submitButton;
                            while (retries < maxRetries) {
                                submitButton = document.evaluate('/html/body/div[1]/main/section/div[1]/div[2]/div[1]/button', document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
                                if (submitButton) break;
                                await new Promise(resolve => setTimeout(resolve, 1000 / maxRetries));
                                retries++;
                            }
                            if (!submitButton) {
                                // console.log('Submit button not found.');
                                return;
                            }
                            // console.log('Submit button found.');

                            submitButton.click();
                            inputField.focus();
                            inputField.click();
                            inputField.value = "";
                            inputField.dispatchEvent(new Event('input', { bubbles: true }));

                            if (!window.codeUsageCounts) {
                                window.codeUsageCounts = {};
                            }
                            if (!window.codeUsageCounts[code]) {
                                window.codeUsageCounts[code] = 0;
                            }
                            window.codeUsageCounts[code]++;

                            if (window.codeUsageCounts[code] === 1) {
                                if (!window.totalCodeUsages) {
                                    window.totalCodeUsages = 0;
                                }
                                window.totalCodeUsages++;
                            }

                            if (window.totalCodeUsages >= 2) {
                                // console.log(`Used 2 codes, reloading page...`);
                                window.codeUsageCounts = {}; // Reset bộ đếm code
                                window.totalCodeUsages = 0;
                                location.reload();
                            }
                            

                        } catch (error) {
                            // console.log(`Code ${code} submission error via UI: ${error}`);
                        }
                    }

                    submitCode(code);
                },
                args: [code]
            });
        }
    });
}
