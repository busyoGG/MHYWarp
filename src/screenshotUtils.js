const fs = require('fs').promises;
const path = require('path');
const { config } = require('./config');

/**
 * 获取所有截图文件
 */
async function getScreenshotFiles() {

    let res = [];
    try {
        let screenshotDir = config.userPath[config.game];

        if (config.game === "HSR") {
            screenshotDir = path.join(screenshotDir, 'ScreenShots');
        } else {
            screenshotDir = path.join(screenshotDir, 'ScreenShot');
        }

        const files = await fs.readdir(screenshotDir);

        for (const file of files) {
            const fullPath = path.join(screenshotDir, file);
            const stat = await fs.stat(fullPath);
            if (stat.isFile()) {
                // console.log('文件:', fullPath);
                res.unshift(fullPath);
            }
        }
    } catch (error) {
        console.error(error);
    }

    // console.log('截图文件:', res);
    return res;
}

module.exports = { getScreenshotFiles };