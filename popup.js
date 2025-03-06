document.addEventListener("DOMContentLoaded", function () {
    chrome.storage.local.get(["last_cookie", "used_codes", "stopRunning", "authorization"], (data) => {
        let cookieInfo = data.last_cookie
            ? `REQUEST URL:\n${data.last_cookie.url}\n\nCloudflare Cookies:\n${data.last_cookie.cf_clearance}`
            : "No cookie data found.";

        document.getElementById("cookie_output").textContent = cookieInfo;

        if (!data.used_codes) {
            chrome.storage.local.set({ used_codes: [] });
        }

        document.getElementById("authorization_input").value = data.authorization || "";
        document.getElementById("stop_running_status").textContent = data.stopRunning ? "Stopped" : "Running";
        document.getElementById("loading_bars").style.display = data.stopRunning ? "none" : "flex";
    });

    document.getElementById("start_button").addEventListener("click", function () {
        chrome.runtime.sendMessage({ action: "startBackgroundProcess" });
        chrome.storage.local.set({ stopRunning: false });
        document.getElementById("stop_running_status").textContent = "Running";
        document.getElementById("loading_bars").style.display = "flex";
    });

    document.getElementById("stop_button").addEventListener("click", function () {
        chrome.runtime.sendMessage({ action: "stopBackgroundProcess" });
        chrome.storage.local.set({ stopRunning: true });
        document.getElementById("stop_running_status").textContent = "Stopped";
        document.getElementById("loading_bars").style.display = "none";
    });

    document.getElementById("save_auth_button").addEventListener("click", function () {
        let authValue = document.getElementById("authorization_input").value;
        chrome.storage.local.set({ authorization: authValue });
    });

    const authorizationInput = document.getElementById('authorization_input');
    chrome.storage.sync.get(['authorization'], function(result) {
        if (result.authorization) {
            authorizationInput.value = result.authorization;
        }
    });
});
