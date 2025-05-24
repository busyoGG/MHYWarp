const path = require("path")
const fs = require('fs')
const crypto = require('crypto');
const https = require('https');
const sqlite3 = require('sqlite3').verbose();
const os = require('os');

// const appDir = __dirname; // 你项目根目录或者用 electron app.getPath('userData')
// const dbPath = path.join(appDir, '../res/imageCache.db');
// const cacheDir = path.join(appDir, '../res/image_cache');

const dbPath = path.join(os.homedir(), '.config/hsr_warp/imageCache.db');
const cacheDir = path.join(os.homedir(), '.config/hsr_warp/image_cache');

if (!fs.existsSync(cacheDir)) fs.mkdirSync(cacheDir, { recursive: true });
// 打开数据库
const db = new sqlite3.Database(dbPath);
// 初始化表
db.serialize(() => {
    db.run(`
      CREATE TABLE IF NOT EXISTS images (
        id TEXT PRIMARY KEY,
        localPath TEXT,
        url TEXT,
        cachedAt INTEGER
      )
    `);
});

/**
 * 生成唯一id（md5）用于缓存标识
 */
function generateId(url) {
    return crypto.createHash('md5').update(url).digest('hex');
}

const downloading = new Map(); // 用于去重，key 是 url

/**
 * 下载远程图片，保存到本地缓存目录
 */
function downloadImage(url) {
    if (downloading.has(url)) {
        return downloading.get(url);
    }

    let promise = new Promise((resolve, reject) => {
        // console.log("http?", !url.startsWith('http'))
        if (!url.startsWith('http')) return resolve(url);

        const ext = path.extname(new URL(url).pathname) || '.png';
        const id = generateId(url);
        const fileName = id + ext;
        const filePath = path.join(cacheDir, fileName);

        // 如果文件已存在，直接返回路径
        if (fs.existsSync(filePath)) {
            return resolve(filePath);
        }

        const file = fs.createWriteStream(filePath);
        https.get(url, (res) => {
            if (res.statusCode !== 200) {
                fs.unlink(filePath, () => { });
                return reject(new Error(`Failed to get image: ${res.statusCode}`));
            }
            res.pipe(file);
            file.on('finish', () => {
                file.close(() => {
                    downloading.delete(url);
                    resolve(filePath)
                });
            });
        }).on('error', (err) => {
            downloading.delete(url);
            fs.unlink(filePath, () => { });
            reject(err);
        });
    });
    downloading.set(url, promise);

    return promise;
}

/**
 * 获取图片本地缓存路径
 * 若无缓存则下载并保存，数据库记录路径和时间戳
 */
function getCachedImage(url) {
    return new Promise((resolve, reject) => {
        const id = generateId(url);

        db.get('SELECT localPath, cachedAt FROM images WHERE id = ?', [id], async (err, row) => {
            if (err) return reject(err);

            // 如果数据库有记录，且文件存在，直接返回
            if (row && row.localPath && fs.existsSync(row.localPath)) {
                return resolve(row.localPath);
            }

            // 否则下载图片
            try {
                const localPath = await downloadImage(url);

                // 更新或插入数据库记录
                const now = Date.now();
                db.run(
                    `INSERT OR REPLACE INTO images (id, localPath, url, cachedAt) VALUES (?, ?, ?, ?)`,
                    [id, localPath, url, now],
                    (dbErr) => {
                        if (dbErr) console.error('DB insert error:', dbErr);
                        resolve(localPath);
                    }
                );
            } catch (downloadErr) {
                reject(downloadErr);
            }
        });
    });
}

// /**
//  * 可选：定期清理超过一定时间的缓存，比如超过7天的图片
//  */
// function clearOldCache(days = 7) {
//     const expireTime = Date.now() - days * 24 * 60 * 60 * 1000;
//     db.all('SELECT id, localPath FROM images WHERE cachedAt < ?', [expireTime], (err, rows) => {
//         if (err) return console.error(err);
//         rows.forEach(row => {
//             if (fs.existsSync(row.localPath)) {
//                 fs.unlinkSync(row.localPath);
//             }
//             db.run('DELETE FROM images WHERE id = ?', [row.id]);
//         });
//     });
// }

const baseUrl = "https://raw.githubusercontent.com/Mar-7th/StarRailRes/refs/heads/master/icon/"

const getLightConeIcon = (id) => {
    let url = path.join(baseUrl, "light_cone", `${id}.png`)
    return url
}

const getCharacterIcon = (id) => {
    let url = path.join(baseUrl, "character", `${id}.png`)
    return url
}

module.exports = {
    getLightConeIcon,
    getCharacterIcon,
    downloadImage
}