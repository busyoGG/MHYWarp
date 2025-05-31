const path = require("path")
const fs = require('fs')
const crypto = require('crypto');
const https = require('https');
const os = require('os');
const { getConfig, iconJsonData } = require("./config");

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

const cacheDir = path.join(os.homedir(), '.config/mhy_warp/image_cache');

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
    const originalUrl = url;

    if (downloading.has(originalUrl)) {
        return downloading.get(originalUrl);
    }

    let promise = new Promise(async (resolve, reject) => {
        // console.log("http?", !url.startsWith('http'))
        if (url.endsWith('.png')) return resolve(url);
        // console.log("加载图片", url, url.includes('wiki.biligame.com'))

        // console.log("下载图片", url)
        let params = url.split("/");
        // console.log("params", params)
        // console.log(iconJsonData)
        let list = iconJsonData.find(item => item.id == params[0]).list;
        let item = list.find(item => {
            // console.log(item.title, params[1], item.alias_name)
            return item.title.includes(params[1]) || params[1].includes(item.title) || item.alias_name && (item.alias_name?.includes(params[1]) || params[1].includes(item.alias_name))
        })
        // console.log("item", item)
        url = item.icon;

        // console.log("图片链接", url)

        // console.log("修改", url)

        const ext = path.extname(new URL(url).pathname) || '.png';
        const id = generateId(url);
        const fileName = id + ext;
        const folder = cacheDir + "_" + getConfig().game;
        const filePath = path.join(folder, fileName);

        // console.log(folder, !fs.existsSync(folder))
        if (!fs.existsSync(folder)) {
            // console.log("filePath", filePath)
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
                    let res = downloading.delete(originalUrl);
                    console.log("✅ 下载完成", "删除完成", res);
                    resolve(filePath)
                });
            });
        }).on('error', (err) => {
            downloading.delete(originalUrl);
            fs.unlink(filePath, () => { });
            reject(err);
        });
    });
    downloading.set(originalUrl, promise);

    return promise;
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

const getLightConeIcon = (item) => {
    let url;
    switch (getConfig().game) {
        case "HSR":
            url = path.join("19", item.name)
            break;
        case "Genshin":
            url = path.join("5", item.name)
            break;
        case "ZZZ":
            url = path.join("45", item.name)
            break;
    }
    // console.log("url", url)
    return url
}

const getCharacterIcon = (item) => {
    let url;
    switch (getConfig().game) {
        case "HSR":
            url = path.join("18", item.name)
            break;
        case "Genshin":
            url = path.join("25", item.name)
            break;
        case "ZZZ":
            url = path.join("43", item.name)
            break;
    }
    // console.log("url", url)
    return url
}

const getBangbooIcon = (item) => {
    let url;
    switch (getConfig().game) {
        case "ZZZ":
            url = path.join("44", item.name)
            break;
    }
    // console.log("url", url)
    return url
}

module.exports = {
    getLightConeIcon,
    getCharacterIcon,
    getBangbooIcon,
    downloadImage
}