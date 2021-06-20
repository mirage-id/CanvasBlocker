// this script will read our settings from the remote plugin and apply them
(function () {
    "use strict";
    const logging = require("../lib/logging");
    logging.setPrefix("settingsAutomator");

    const settings = require("../lib/settings");
    const settingsMigration = require("../lib/settingsMigration");


    // apply our settings to the plugin
    // the parameter here is named json to conform with exiting code, but we are actually passing in an object
    const applySettings = function (json) {
        // this code is lifted from options/options.js:118
        while (settingsMigration.transitions.hasOwnProperty(json.storageVersion)) {
            const oldVersion = json.storageVersion;
            const modifiedData = settingsMigration.transitions[json.storageVersion](json);
            Object.keys(modifiedData).forEach(function (key) {
                json[key] = modifiedData[key];
            });
            if (oldVersion === json.storageVersion) {
                break;
            }
        }
        delete json.storageVersion;
        const keys = Object.keys(json).filter(function (key) {
            const setting = settings.getDefinition(key);
            if (!setting) {
                logging.error("Unknown setting " + key + ".");
                return false;
            }
            if (!setting.fixed && setting.invalid(json[key])) {
                logging.error("Invalid value " + json[key] + " for " + key + ".");
                return false;
            }
            return true;
        });
        keys.forEach(function (key) {
            settings[key] = json[key];
        });
        logging.message("MirageID Config Loaded");
    };

    // accept some messages
    const handleMessage = function (message, sender, sendResponse) {
        if (sender.id == "main@mirageid.com") {
            switch (message.action) {
                case "send_canvas_settings":
                    try {
                        applySettings(message.payload)
                        sendResponse({ error: false, errorMessage: null });
                    } catch (e) {
                        sendResponse({ error: true, errorMessage: e })
                    }
                    break;
                default:
                    return false;
            }
        }
    };
    const handleInternalMessage = function (message, sender, sendResponse) {
        // if it's the content-script sending us an error we forward it on to the main script
        switch (message.action) {
            case "error":
                browser.runtime.sendMessage("main@mirageid.com", { action: "error", message: message.message }, null)
                break;
            default:
                return false;
        }
    };

    // listen for messages
    browser.runtime.onMessage.addListener(handleInternalMessage);
    browser.runtime.onMessageExternal.addListener(handleMessage);
    // TODO: handle errors here (disable proxy)
    browser.runtime.sendMessage("main@mirageid.com", { action: "get_canvas_settings" }, null)
        .then(function (response) {
            // errors are handled in the logging functions
            applySettings(response.payload);
        });
}());