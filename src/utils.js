const { app, BrowserWindow, dialog } = require('electron')
const path = require('path')
const fs = require('fs-extra')
const { glob } = require('glob')
const util = require('util')
const os = require('os');

const { mergeData } = require('./mergeData')
const gachaTypeRaw = require('./gachaType.json')
const { getLightConeIcon, getCharacterIcon } = require('./getIcon')

let apiDomain = 'https://api-takumi.mihoyo.com'
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

// const langMap = new Map([
//     ['zh-cn', '简体中文'],
//     ['zh-tw', '繁體中文'],
//     ['de-de', 'Deutsch'],
//     ['en-us', 'English'],
//     ['es-es', 'Español'],
//     ['fr-fr', 'Français'],
//     ['id-id', 'Indonesia'],
//     ['ja-jp', '日本語'],
//     ['ko-kr', '한국어'],
//     ['pt-pt', 'Português'],
//     ['ru-ru', 'Pусский'],
//     ['th-th', 'ภาษาไทย'],
//     ['vi-vn', 'Tiếng Việt']
// ])

const defaultTypeMap = new Map([
    ['11', '角色活动跃迁'],
    ['12', '光锥活动跃迁'],
    ['1', '常驻跃迁'],
    ['2', '新手跃迁']
])

const detectLocale = (value) => {
    const locale = value || app.getLocale()
    let result = 'zh-cn'
    for (let [key, list] of localeMap) {
        if (locale === key || list.includes(locale)) {
            result = key
            break
        }
    }
    return result
}

const config = {
    urls: [],
    logType: 0,
    lang: detectLocale(),
    current: 0,
    proxyPort: 8325,
    proxyMode: false,
    autoUpdate: true,
    fetchFullHistory: false,
    hideNovice: false,
    userPath: ''
}

const dataMap = new Map()

function sendMsg(...msg) {
    if (process.env.NODE_ENV === 'development') {
        console.log("send ", msg)
        const win = BrowserWindow.getAllWindows()[0];
        win.webContents.send('log-message', msg);
    }
}

const fetchData = async () => {
    await readData()

    sendMsg(dataMap);

    let url = await getUrl()

    if (!url) {
        sendMsg("No URL found")
        // throw new Error("No URL found")
        return false;
    }

    await tryRequest(url)

    const searchParams = getQuerystring(url)

    sendMsg(searchParams)

    let queryString = searchParams.toString()
    // const vUid = await tryGetUid(queryString)

    queryString = searchParams.toString()
    const gachaType = await getGachaType(searchParams.get('lang'))

    sendMsg(searchParams, gachaType)

    const result = new Map()
    const typeMap = new Map()
    const lang = searchParams.get('lang')
    let originUid = ''
    let originRegion = ''
    let localTimeZone
    for (const type of gachaType) {
        let gachaLogs = await getGachaLogs(type, queryString);
        if (!gachaLogs) return false;

        const { list, uid, region, region_time_zone } = gachaLogs
        if (localTimeZone === undefined) {
            localTimeZone = dataMap.get(uid)?.region_time_zone
            if (localTimeZone === undefined) {
                localTimeZone = region_time_zone
            }
        }
        sendMsg(list, region_time_zone, localTimeZone)
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

        sendMsg(logs, originRegion)
    }

    sendMsg("typeMap", typeMap);
    const data = { result, typeMap, time: Date.now(), uid: originUid, lang, region: originRegion, region_time_zone: localTimeZone }
    sendMsg(data)

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

let localDataReaded = false
const readdir = util.promisify(fs.readdir)
const readData = async () => {
    if (localDataReaded) return
    localDataReaded = true
    const fileMap = await collectDataFiles()

    sendMsg(fileMap)

    for (let [name, dataPath] of fileMap) {
        try {
            const data = await readJSON(dataPath, name)

            // sendMsg(data);

            data.typeMap = new Map(data.typeMap) || defaultTypeMap
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
        for (let name of files) {
            if (/^gacha-list-\d+\.json$/.test(name) && !fileMap.has(name)) {
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
    await saveJSON(`gacha-list-${data.uid}.json`, obj)
}

const userDataPath = path.resolve(os.homedir(), '.config/hsr_warp/userData')
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

const changeCurrent = async (uid) => {
    config.current = uid
    // await config.save()
    saveConfig()
}

const saveConfig = async () => {
    let configTemp = config
    await saveJSON('config.json', configTemp)
}

const getLocalConfig = async () => {
    let localConfig = await readJSON(userDataPath, 'config.json')

    if (!localConfig) return
    const configTemp = {}
    for (let key in localConfig) {
        if (typeof config[key] !== 'undefined') {
            configTemp[key] = localConfig[key]
        }
    }
    Object.assign(config, configTemp)
    // console.log(config, configTemp)
}

getLocalConfig()

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
    const url = `${apiDomain}/common/gacha_record/api/getGachaLog?${queryString}`
    sendMsg("url ", url)
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
        const res = await request(`${url}&gacha_type=${key}&page=${page}&size=${20}${endId ? '&end_id=' + endId : ''}`)
        if (res?.data?.list) {
            return res?.data
        }
        // throw new Error(res?.message || res)
        return false;
    } catch (e) {
        if (retryCount) {
            // sendMsg(i18n.parse(text.fetch.retry, { name, page, count: 6 - retryCount }))
            await sleep(5)
            retryCount--
            return await getGachaLog({ key, page, name, retryCount, url, endId })
        } else {
            // sendMsg(i18n.parse(text.fetch.retryFailed, { name, page }))
            // throw e
            return false;
        }
    }
}

const gachaTypeMap = new Map(gachaTypeRaw)
const getGachaType = (lang) => {
    const locale = detectLocale(lang)
    return gachaTypeMap.get(locale || lang)
}



const getUrl = async () => {
    let url = await readLog()
    return url
}

const request = async (url) => {
    const res = await fetch(url, {
        timeout: 15 * 1000
    })
    return await res.json()
}

// const tryGetUid = async (queryString) => {
//     const url = `${apiDomain}/common/gacha_record/api/getGachaLog?${queryString}`
//     try {
//         for (let [key] of defaultTypeMap) {
//             const res = await request(`${url}&gacha_type=${key}&page=1&size=6`)
//             if (res.data.list && res.data.list.length) {
//                 return res.data.list[0].uid
//             }
//         }
//     } catch (e) { }
//     return config.current
// }

const readLog = async () => {
    try {
        let userPath = config.userPath;

        if (!userPath) return false;

        userPath = path.join(userPath, `StarRail_Data`)

        sendMsg("path", userPath);

        const [cacheText, cacheFile] = await getCacheText(userPath)
        const urlMch = cacheText.match(/https[^?]+?\?[^?]+?&auth_appid=webview_gacha&.+?authkey=.+?&game_biz=hkrpg_/g)
        sendMsg(urlMch)
        if (urlMch) {
            cacheFolder = cacheFile.replace(/Cache_Data[/\\]data_2$/, '')
            return getLatestUrl(urlMch)
        }

        const result = await Promise.all(promises)
        for (let url of result) {
            if (url) {
                return url
            }
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
    // gamePath = gamePath.replace('W:/', '/mnt/')
    // gamePath = gamePath.replace('X:/', '~/')

    // let parttern = path.join(gamePath, 'webCaches/*/Cache_Data/data_2')
    let parttern = path.join(gamePath, 'webCaches/*/Cache/Cache_Data/data_2')
    const results = await glob(parttern, {
        stat: true,
        withFileTypes: true,
        nodir: true,
        windowsPathsNoEscape: true
    })

    const timeSortedFiles = results
        .sort((a, b) => b.mtimeMs - a.mtimeMs)
        .map(path => path.fullpath())

    sendMsg(timeSortedFiles)
    const cacheText = await fs.readFile(path.join(timeSortedFiles[0]), 'utf8')

    return [cacheText, timeSortedFiles[0]]
}

// const detectGameLocale = async (userPath) => {
//     let list = []
//     // const lang = app.getLocale()
//     const arr = ['/miHoYo/崩坏：星穹铁道/', '/Cognosphere/Star Rail/']
//     arr.forEach(str => {
//         try {
//             const pathname = path.join(userPath, '/AppData/LocalLow/', str, 'Player.log')
//             // console.log(pathname)
//             fs.accessSync(pathname, fs.constants.F_OK)
//             list.push(pathname)
//         } catch (e) { }
//     })
//     // if (config.logType) {
//     //     if (config.logType === 2) {
//     //         list.reverse()
//     //     }
//     //     list = list.slice(0, 1)
//     // } else if (lang !== 'zh-CN') {
//     //     list.reverse()
//     // }
//     return list
// }

const tryRequest = async (url, retry = false) => {
    const queryString = getQuerystring(url)
    if (!queryString) return false
    const gachaTypeUrl = `${apiDomain}/common/gacha_record/api/getGachaLog?${queryString}&page=1&size=5&gacha_type=1&end_id=0`
    try {
        sendMsg(gachaTypeUrl)
        const res = await request(gachaTypeUrl)
        sendMsg(res)
        checkResStatus(res)
    } catch (e) {
        if (e.code === 'ERR_PROXY_CONNECTION_FAILED' && !retry) {
            await disableProxy()
            return await tryRequest(url, true)
        }
        sendMsg(e.message.replace(url, '***'), 'ERROR')
        throw e
    }
}

const getQuerystring = (url) => {
    // const text = i18n.log
    const { searchParams, host } = new URL(fixAuthkey(url))
    if (host.includes('webstatic-sea') || host.includes('hkrpg-api-os') || host.includes('api-os-takumi') || host.includes('hoyoverse.com')) {
        apiDomain = 'https://public-operation-hkrpg-sg.hoyoverse.com'
    } else {
        apiDomain = 'https://public-operation-hkrpg.mihoyo.com'
    }
    const authkey = searchParams.get('authkey')
    if (!authkey) {
        sendMsg("no authkey")
        return false
    }
    searchParams.delete('page')
    searchParams.delete('size')
    searchParams.delete('gacha_type')
    searchParams.delete('end_id')
    return searchParams
}

const fixAuthkey = (url) => {
    const mr = url.match(/authkey=([^&]+)/)
    if (mr && mr[1] && mr[1].includes('=') && !mr[1].includes('%')) {
        return url.replace(/authkey=([^&]+)/, `authkey=${encodeURIComponent(mr[1])}`)
    }
    return url
}

const checkResStatus = (res) => {
    // const text = i18n.log
    if (res.retcode !== 0) {
        let message = res.message
        if (res.message === 'authkey timeout') {
            message = "timeout"
            sendMsg(true, 'AUTHKEY_TIMEOUT')
        }
        sendMsg(message)
        // throw new Error(message)
        return false;
    }
    sendMsg(false, 'AUTHKEY_TIMEOUT')
    return res
}

const getCurrentData = async () => {
    if (dataMap.size === 0) {
        await readData();
    }
    // sendMsg(config.current, dataMap, dataMap.size)

    let output = {};

    let data = dataMap.get(config.current);

    if (data) {
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
                    icon: item.item_type == "角色" ? getCharacterIcon(item.item_id) : getLightConeIcon(item.item_id)
                }
                output[keyName].push(outputItem)
            }
        }
    }
    // sendMsg(output)

    return output
}

async function openFolderSelector() {
    const result = await dialog.showOpenDialog({
        properties: ['openDirectory']
    });

    if (!result.canceled && result.filePaths.length > 0) {
        const folderPath = result.filePaths[0];
        // console.log('选择的文件夹路径:', folderPath);
        config.userPath = folderPath;
        // 这里你就得到了绝对路径，可以做后续操作

        saveConfig();
        return folderPath;
    }
}

function getConfig() {
    return config;
}

module.exports = { fetchData, getCurrentData, openFolderSelector, getConfig }