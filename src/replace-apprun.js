// scripts/replace-apprun.js
const path = require("path");
const fs = require("fs");

module.exports = async function (context) {
    const appDir = context.appOutDir;
    const customAppRun = path.join(__dirname, "../src/AppRun");
    const targetAppRun = path.join(appDir, "AppRun");

    console.log("⤴️ Replacing default AppRun with custom one...");

    fs.copyFileSync(customAppRun, targetAppRun);
    fs.chmodSync(targetAppRun, 0o755); // Ensure executable
};