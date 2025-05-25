const { app, BrowserWindow, dialog } = require('electron')
const path = require('path')
const fs = require('fs-extra')
const { glob } = require('glob')
const util = require('util')
const os = require('os');

const { mergeData } = require('./mergeData')
const { getLightConeIcon, getCharacterIcon, getBangbooIcon } = require('./getIcon')
const { getQuerystring, getGachaType, getGachaLogUrl, urlMatch, getNormalPickUpUrl, getHistoryUrl } = require('./getGacha')
const { config, changeCurrent, saveConfig } = require('./config')

// let apiDomain = 'https://api-takumi.mihoyo.com'
const localeMap = new Map([
    ['zh-cn', ['zh', 'zh-CN']],
    ['zh-tw', ['zh-TW']],
    ['de-de', ['de-AT', 'de-CH', 'de-DE', 'de']],
    ['en-us', ['en-AU', 'en-CA', 'en-GB', 'en-NZ', 'en-US', 'en-ZA', 'en']],
    ['es-es', ['es', 'es-419']],
    ['fr-fr', ['fr-CA', 'fr-CH', 'fr-FR', 'fr']],
    ['id-id', ['id']],
    ['ja-jp', ['ja']],
    ['ko-kr', ['ko']],
    ['pt-pt', ['pt-BR', 'pt-PT', 'pt']],
    ['ru-ru', ['ru']],
    ['th-th', ['th']],
    ['vi-vn', ['vi']]
])

let dataMap = new Map()
let history;

function sendMsg(...msg) {
    if (process.env.NODE_ENV === 'development') {
        console.log("send ", msg)
        const win = BrowserWindow.getAllWindows()[0];
        win.webContents.send('log-message', msg);
    }
}

const fetchData = async () => {
    await readData()

    // sendMsg(dataMap);
    // getNormalUpData();
    await getHistoryData();

    let url = await getUrl()

    if (!url) {
        sendMsg("No URL found")
        // throw new Error("No URL found")
        return false;
    }

    // console.log("url", url)

    let res = await tryRequest(url)
    if (!res) return false;

    const searchParams = await getQuerystring(url)

    // sendMsg(searchParams)

    let queryString = searchParams.toString()
    // const vUid = await tryGetUid(queryString)

    queryString = searchParams.toString()
    const gachaType = await getGachaType(searchParams.get('lang'))

    // sendMsg(searchParams, gachaType, queryString)

    const result = new Map()
    const typeMap = new Map()
    const lang = searchParams.get('lang')
    let originUid = ''
    let originRegion = ''
    let localTimeZone
    for (const type of gachaType) {
        // console.log(type, gachaType)

        let gachaLogs = await getGachaLogs(type, queryString);
        if (!gachaLogs) return false;

        const { list, uid, region, region_time_zone } = gachaLogs
        if (localTimeZone === undefined) {
            localTimeZone = dataMap.get(uid)?.region_time_zone
            if (localTimeZone === undefined) {
                localTimeZone = region_time_zone
            }
        }
        // sendMsg(list, region_time_zone, localTimeZone)
        // list.forEach(item => {
        //   item.time = convertTimeZone(item.time, region_time_zone, localTimeZone)
        // })
        const logs = list.map((item) => {
            const { id, item_id, item_type, name, rank_type, time, gacha_id, gacha_type, count } = item
            return { id, item_id, item_type, name, rank_type, time, gacha_id, gacha_type, count }
        })
        logs.reverse()
        typeMap.set(type.key, type.name)
        result.set(type.key, logs)
        if (!originUid) {
            originUid = uid
        }
        if (!originRegion) {
            originRegion = region
        }

        // sendMsg(logs, originRegion)
    }

    // sendMsg("typeMap", typeMap);
    const data = { result, typeMap, time: Date.now(), uid: originUid, lang, region: originRegion, region_time_zone: localTimeZone }
    // sendMsg(data)

    const localData = dataMap.get(originUid)
    const mergedResult = mergeData(localData, data)
    data.result = mergedResult
    dataMap.set(originUid, data)

    // sendMsg("result", data)
    await changeCurrent(originUid)
    await saveData(data)

    return true;
}

const readJSON = async (dataPath, name) => {
    let data = null
    try {
        data = await fs.readJSON(path.join(dataPath, name))
    } catch (e) { }
    return data
}

// let localDataReaded = false
const readdir = util.promisify(fs.readdir)
const readData = async () => {
    // if (localDataReaded) return
    // localDataReaded = true
    const fileMap = await collectDataFiles()

    history = [];
    // sendMsg(fileMap)

    for (let [name, dataPath] of fileMap) {
        try {
            const data = await readJSON(dataPath, name)

            // sendMsg(data);
            // console.log(name, dataPath)

            data.typeMap = new Map(data.typeMap)
            data.result = new Map(data.result)
            data.result.forEach((value, key) => {
                value.forEach(item => {
                    if (!('count' in item)) {
                        item.count = "1";
                    }
                });
            });
            if (data.uid) {
                dataMap.set(data.uid, data)
            }

            if (name.includes('history')) {
                history = data;
            }
        } catch (e) {
            sendMsg(e, 'ERROR')
        }
    }

    if ((!config.current && dataMap.size) || (config.current && dataMap.size && !dataMap.has(config.current))) {
        await changeCurrent(dataMap.keys().next().value)
    }
}

const collectDataFiles = async () => {
    await fs.ensureDir(userDataPath)
    const fileMap = new Map()
    await findDataFiles(userDataPath, fileMap)
    return fileMap
}

const findDataFiles = async (dataPath, fileMap) => {
    const files = await readdir(dataPath)
    if (files?.length) {
        const prefix = config.game;
        // console.log("prefix", prefix, `^${prefix}-gacha-list-\\d+\\.json$`)
        for (let name of files) {
            let regex = new RegExp(`^${prefix}-gacha-list-\\d+\\.json$`);

            // console.log(name, regex.test(name))
            if (regex.test(name) && !fileMap.has(name)) {
                fileMap.set(name, dataPath)
            }

            // regex = new RegExp(`^${prefix}_normal_up.json$`);

            // // console.log(name, regex.test(name))
            // if (regex.test(name) && !fileMap.has(name)) {
            //     fileMap.set(name, dataPath)
            // }

            regex = new RegExp(`^${prefix}_history.json$`);

            // console.log(name, regex.test(name))
            if (regex.test(name) && !fileMap.has(name)) {
                fileMap.set(name, dataPath)
            }
        }
    }
}

const sleep = (sec = 1) => {
    return new Promise(rev => {
        setTimeout(rev, sec * 1000)
    })
}

const saveData = async (data) => {
    const obj = Object.assign({}, data)
    obj.result = [...obj.result]
    obj.typeMap = [...obj.typeMap]
    // await config.save()
    await saveJSON(`${config.game}-gacha-list-${data.uid}.json`, obj)
}

const userDataPath = path.resolve(os.homedir(), '.config/mhy_warp/userData')
const saveJSON = async (name, data) => {
    try {
        let savePath = path.join(userDataPath, name);
        sendMsg(savePath)
        await fs.outputJSON(savePath, data)
    } catch (e) {
        sendMsg(e, 'ERROR')
        await sleep(3)
    }
}

const getGachaLogs = async ({ name, key }, queryString) => {
    // const text = i18n.log
    let page = 1
    let list = []
    let res = null
    let logs = []
    let uid = ''
    let region = ''
    let region_time_zone = ''
    let endId = '0'
    const url = `${getGachaLogUrl()}${queryString}`
    // sendMsg("gacha url ", url)
    do {
        // if (page % 10 === 0) {
        //   sendMsg(i18n.parse(text.fetch.interval, { name, page }))
        //   await sleep(1)
        // }
        await sleep(0.3)
        // sendMsg(i18n.parse(text.fetch.current, { name, page }))
        res = await getGachaLog({ key, page, name, url, endId, retryCount: 5 })

        //没有结果 返回错误
        if (!res) return false;

        logs = res?.list || []
        if (!uid && logs.length) {
            uid = logs[0].uid
        }
        if (!region) {
            region = res.region
        }
        if (!region_time_zone) {
            region_time_zone = res.region_time_zone
        }
        list.push(...logs)
        page += 1

        if (logs.length) {
            endId = logs[logs.length - 1].id
        }

        if (!config.fetchFullHistory && logs.length && uid && dataMap.has(uid)) {
            const result = dataMap.get(uid).result
            if (result.has(key)) {
                const arr = result.get(key)
                if (arr.length) {
                    const localLatestId = arr[arr.length - 1].id
                    if (localLatestId) {
                        let shouldBreak = false
                        logs.forEach(item => {
                            if (item.id === localLatestId) {
                                shouldBreak = true
                            }
                        })
                        if (shouldBreak) {
                            break
                        }
                    }
                }
            }
        }
    } while (logs.length > 0)
    return { list, uid, region, region_time_zone }
}

const getGachaLog = async ({ key, page, name, retryCount, url, endId }) => {
    // const text = i18n.log
    try {
        // console.log(key, page, name, url, endId, retryCount)
        let pramGacha = config.game === "ZZZ" ? "real_gacha_type" : "gacha_type"
        let reqUrl = `${url}&${pramGacha}=${key}&page=${page}&size=${20}${endId ? '&end_id=' + endId : ''}`;
        const res = await request(reqUrl)
        // console.log(reqUrl, res);
        if (res?.data?.list) {
            return res?.data
        }
        // throw new Error(res?.message || res)
        return false;
    } catch (e) {
        if (retryCount) {
            await sleep(5)
            retryCount--
            return await getGachaLog({ key, page, name, retryCount, url, endId })
        } else {
            return false;
        }
    }
}

const getUrl = async () => {
    let url = await readLog()
    return url
}

const request = async (url) => {
    // sendMsg("抽卡连接", url)
    const res = await fetch(url, {
        timeout: 15 * 1000
    })
    return await res.json()
}

const readLog = async () => {
    try {
        let userPath = config.userPath[config.game];

        if (!userPath) return false;

        switch (config.game) {
            case "HSR":
                userPath = path.join(userPath, `StarRail_Data`)
                break;
            case "Genshin":
                userPath = path.join(userPath, `YuanShen_Data`)
                break;
            case "ZZZ":
                userPath = path.join(userPath, `ZenlessZoneZero_Data`)
                break;
        }

        // sendMsg("path", userPath);

        const [cacheText, cacheFile] = await getCacheText(userPath)
        // console.log(cacheText)

        const urlMch = urlMatch(cacheText)
        // sendMsg(urlMch)
        if (urlMch) {
            cacheFolder = cacheFile.replace(/Cache_Data[/\\]data_2$/, '')
            return getLatestUrl(urlMch)
        }

        sendMsg("not found")
        return false
    } catch (e) {
        sendMsg("read fail!", e)
        return false
    }
}

const getLatestUrl = (list) => {
    let result = list[list.length - 1]
    return result
}

async function getCacheText(gamePath) {
    //处理路径
    let parttern = path.join(gamePath, 'webCaches/*/Cache/Cache_Data/data_2')
    const results = await glob(parttern, {
        stat: true,
        withFileTypes: true,
        nodir: true,
        windowsPathsNoEscape: true
    })

    // console.log(parttern)

    const timeSortedFiles = results
        .sort((a, b) => b.mtimeMs - a.mtimeMs)
        .map(path => path.fullpath())

    const cacheText = await fs.readFile(path.join(timeSortedFiles[0]), 'utf8')

    // sendMsg("time sorted files", timeSortedFiles[0], cacheText)

    return [cacheText, timeSortedFiles[0]]
}

const tryRequest = async (url, retry = false) => {
    const queryString = await getQuerystring(url)
    if (!queryString) return false
    const gachaTypeUrl = `${getGachaLogUrl()}${queryString}&page=1&size=5&gacha_type=1&end_id=0`
    try {
        sendMsg(gachaTypeUrl)
        const res = await request(gachaTypeUrl)
        // sendMsg(res)
        return checkResStatus(res)
    } catch (e) {
        if (e.code === 'ERR_PROXY_CONNECTION_FAILED' && !retry) {
            await disableProxy()
            return await tryRequest(url, true)
        }
        sendMsg(e.message.replace(url, '***'), 'ERROR')
        throw e
    }
}

const checkResStatus = (res) => {
    // const text = i18n.log
    console.log(res)
    if (res.retcode !== 0) {
        let message = res.message
        sendMsg("Try Res === ", message)
        // throw new Error(message)
        return false;
    }
    // sendMsg(false, 'AUTHKEY_TIMEOUT')
    return true
}

// async function getNormalUpData() {
//     let url = getNormalPickUpUrl();
//     let res = await request(url);

//     let list = [];

//     console.log(config.game, url)
//     switch (config.game) {
//         case "Genshin":
//             list = res.r5_prob_list.map(item => item.item_name);
//             break;
//         case "HSR":
//             list = res.items_avatar_star_5.map(item => item.item_name);
//             list.push(...res.items_light_cone_star_5.map(item => item.item_name));
//             break;
//         case "ZZZ":
//             list = res.items_avatar_star_5.map(item => item.item_name);
//             list.push(...res.items_light_cone_star_5.map(item => item.item_name));
//             break;
//     }

//     // console.log(list)

//     saveJSON(`${config.game}_normal_up.json`, list)
// }

async function getHistoryData() {
    let historyUrls = getHistoryUrl();
    let history = {};

    for (let url of historyUrls) {
        let historyData = await request(url)

        for (let value of historyData) {
            for (let item of value.items) {
                // console.log(item.name)
                if (!history[item.name]) {
                    history[item.name] = [{
                        start: value.start,
                        end: value.end,
                    }];
                } else {
                    history[item.name].push({
                        start: value.start,
                        end: value.end,
                    });
                }
            }
        }
    }

    // console.log(list)

    saveJSON(`${config.game}_history.json`, history)
}

const getCurrentData = async () => {
    dataMap = new Map()
    await readData();

    // sendMsg(config.current, dataMap, dataMap.size)

    let output = {};

    let data = dataMap.get(config.current);

    if (data) {
        // console.log(data);
        for (let [key, value] of data.result) {
            let keyName = data.typeMap.get(key)
            output[keyName] = []
            for (let item of value) {
                let outputItem = {
                    name: item.name,
                    count: item.count,
                    time: item.time,
                    id: item.id,
                    item_id: item.item_id,
                    item_type: item.item_type,
                    rank_type: item.rank_type,
                    gacha_id: item.gacha_id,
                    icon: (() => {
                        switch (item.item_type) {
                            case "角色":
                            case "代理人":
                                return getCharacterIcon(item)
                            case "邦布":
                                return getBangbooIcon(item)
                            default:
                                return getLightConeIcon(item)
                        }
                    })()
                }
                output[keyName].push(outputItem)
            }
        }
    }
    // sendMsg(output)

    // console.log(normalData);
    // if (normalData.length == 0) {
    //     await getNormalUpData()
    // }

    if (history.length == 0) {
        await getHistoryData()
    }

    // console.log("history", history)

    return { output, history }
}

async function openFolderSelector() {
    const result = await dialog.showOpenDialog({
        properties: ['openDirectory']
    });

    if (!result.canceled && result.filePaths.length > 0) {
        const folderPath = result.filePaths[0];
        // console.log('选择的文件夹路径:', folderPath);
        if (typeof config.userPath === 'string') {
            config.userPath = {};
        }
        config.userPath[config.game] = folderPath;
        // 这里你就得到了绝对路径，可以做后续操作

        // console.log(config.userPath, config.game);
        saveConfig();
        return folderPath;
    }
}

module.exports = { fetchData, getCurrentData, openFolderSelector }