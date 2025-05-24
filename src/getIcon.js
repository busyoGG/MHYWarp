const path = require("path")
const fs = require('fs')
const crypto = require('crypto');
const https = require('https');
const sqlite3 = require('sqlite3').verbose();
const os = require('os');
const cheerio = require('cheerio');
const { getConfig } = require("./config");

// const appDir = __dirname; // 你项目根目录或者用 electron app.getPath('userData')
// const dbPath = path.join(appDir, '../res/imageCache.db');
// const cacheDir = path.join(appDir, '../res/image_cache');

const dbPath = path.join(os.homedir(), '.config/hsr_warp/imageCache.db');
const cacheDir = path.join(os.homedir(), '.config/hsr_warp/image_cache');

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

    let promise = new Promise(async (resolve, reject) => {
        // console.log("http?", !url.startsWith('http'))
        if (!url.startsWith('http')) return resolve(url);
        console.log("加载图片", url, url.includes('wiki.biligame.com'))

        if (url.includes('wiki.biligame.com')) {
            const res = await request(url, true)
            const $ = cheerio.load(res);
            let alt = url.split('/').pop();
            const img = $(`img[alt="${alt}"]`);

            // console.log(img, img.src);

            if (img.length > 0) {
                console.log('✅ 找到图片 src:', img.attr('src'));
            } else {
                console.log('❌ 未找到对应 alt 的 <img>');
            }

            url = img.attr('src');
        }

        console.log("修改", url)

        const ext = path.extname(new URL(url).pathname) || '.png';
        const id = generateId(url);
        const fileName = id + ext;
        const folder = cacheDir + "_" + getConfig().game;
        const filePath = path.join(folder, fileName);

        console.log(folder, !fs.existsSync(folder))
        if (!fs.existsSync(folder)) {
            console.log("filePath", filePath)
            await fs.mkdirSync(folder, { recursive: true });
        }

        // 如果文件已存在，直接返回路径
        if (fs.existsSync(filePath)) {
            return resolve(filePath);
        }

        // console.log("image", url);

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

            // console.log("数据库 ", row, row.localPath, fs.existsSync(row.localPath))

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

const request = async (url, text = false) => {
    // console.log("连接", url)
    const res = await fetch(url, {
        timeout: 15 * 1000
    })

    if (text) {
        return await res.text()
    } else {
        return await res.json()
    }
}

const hsrBaseUrl = "https://raw.githubusercontent.com/Mar-7th/StarRailRes/refs/heads/master/icon/"
const genshinBaseUrl = "https://wiki.biligame.com/ys/"

const getLightConeIcon = (item) => {
    let url;
    switch (getConfig().game) {
        case "HSR":
            url = path.join(hsrBaseUrl, "light_cone", `${item.item_id}.png`)
            break;
        case "Genshin":
            url = path.join(genshinBaseUrl, `文件:${item.name}.png`)
            break;
    }
    // console.log("url", url)
    return url
}

const getCharacterIcon = (item) => {
    let url;
    switch (getConfig().game) {
        case "HSR":
            url = path.join(hsrBaseUrl, "character", `${item.item_id}.png`)
            break;
        case "Genshin":
            url = path.join(genshinBaseUrl, `文件:无背景-角色-${item.name}.png`)
            break;
    }
    // console.log("url", url)
    return url
}

module.exports = {
    getLightConeIcon,
    getCharacterIcon,
    getCachedImage
}