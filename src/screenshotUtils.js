const fs = require('fs').promises;
const fsSync = require('fs');
const path = require('path');
const { config } = require('./config');
const sharp = require('sharp');
const os = require('os');
const { spawn } = require('child_process');
const { shell } = require('electron');


const thumbnailsDir = path.resolve(os.homedir(), '.config/mhy_warp/thumbnails')

if (!fsSync.existsSync(thumbnailsDir)) fsSync.mkdirSync(thumbnailsDir);

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

async function generateThumbnail(imagePath, width = 400) {
    const basename = path.basename(imagePath);
    const thumbPath = path.join(thumbnailsDir, `thumb-${width}-${basename}`);

    if (fsSync.existsSync(thumbPath)) return thumbPath; // ✅ 已生成过则直接返回

    try {
        await sharp(imagePath)
            .resize({ width })
            .jpeg({ quality: 100 })
            .toFile(thumbPath);

        return thumbPath;
    } catch (err) {
        console.error('生成缩略图失败:', err);
        return null;
    }
}

async function moveToTrash(filePath) {
    try {
        const result = await shell.trashItem(filePath);
        console.log('文件已成功移动到回收站:', result);
    } catch (error) {
        console.error('移动到回收站失败:', error);
    }
}

let lastCopyTime = 0;
function copyScreenshot(src) {

    if (!src.startsWith('file://')) {
        src = 'file://' + src;
    }

    const now = Date.now();
    if (now - lastCopyTime < 300) return; // 防止快速重复点击
    lastCopyTime = now;

    const proc = spawn('wl-copy', ['-t', 'text/uri-list']);

    setTimeout(() => {
        proc.stdin.write(src);
        proc.stdin.end();
    }, 10);

    proc.on('error', (err) => console.error('wl-copy error:', err));

    console.log('复制成功:', src);
}

module.exports = { getScreenshotFiles, generateThumbnail, copyScreenshot, moveToTrash };