const { app, BrowserWindow, dialog } = require('electron')
const path = require('path')
const fs = require('fs-extra')
const { glob } = require('glob')
const util = require('util')
const os = require('os');

const { mergeData } = require('./mergeData')
const { getLightConeIcon, getCharacterIcon, getBangbooIcon } = require('./getIcon')
const { getQuerystring, getGachaType, getGachaLogUrl, urlMatch, getNormalPickUpUrl, getHistoryUrl } = require('./getGacha')
const { config, changeCurrent, saveConfig, jsonUrl, iconJsonData, getUigfDicUrl } = require('./config')
const { send } = require('process')

// let apiDomain = 'https://api-takumi.mihoyo.com'

let dataMap = new Map()
let history;
let dic;
let reverseDic = {};

function sendMsg(msg) {
    // if (process.env.NODE_ENV === 'development') {

    // }
    // console.log("send ", msg)
    const win = BrowserWindow.getAllWindows()[0];
    win.webContents.send('logMessage', msg);
}

const fetchData = async () => {

    sendMsg("加载本地缓存");
    await readData()

    sendMsg("获取历史卡池信息");
    await getHistoryData();

    sendMsg("获取图标信息");
    await loadIconJson();

    // sendMsg("获取 UIGF 词典信息");
    await loadDicJson();

    sendMsg("获取抽卡链接");
    let url = await getUrl()

    switch (url) {
        case "incorrect path":
        case "url not found":
            return url;
    }

    // console.log("url", url)

    sendMsg("准备请求数据")
    let res = await tryRequest(url)
    if (res != true) return res;

    const searchParams = await getQuerystring(url)

    let queryString = searchParams.toString()
    // const vUid = await tryGetUid(queryString)

    queryString = searchParams.toString()
    const gachaType = await getGachaType()

    const result = new Map()
    const typeMap = new Map()
    const lang = searchParams.get('lang')
    let originUid = ''
    let originRegion = ''
    let localTimeZone;

    sendMsg("开始请求数据")

    // console.log(reverseDic);

    for (const type of gachaType) {
        // console.log(type, gachaType)

        let gachaLogs = await getGachaLogs(type, queryString);
        if (!gachaLogs) return gachaLogs;

        const { list, uid, region, region_time_zone } = gachaLogs
        if (localTimeZone === undefined) {
            localTimeZone = dataMap.get(uid)?.region_time_zone
            if (localTimeZone === undefined) {
                localTimeZone = region_time_zone
            }
        }

        const logs = list.map((item) => {
            let { id, item_id, item_type, name, rank_type, time, gacha_id, gacha_type, count } = item
            if (!item_id || item_id == '') {
                item_id = dic[name]
                console.log("no item id", id, name, dic[name])
            }
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

    }

    // console.log("时区", localTimeZone);
    const data = { result, typeMap, time: Date.now(), uid: originUid, lang, region: originRegion, region_time_zone: localTimeZone }

    const localData = dataMap.get(originUid)
    const mergedResult = mergeData(localData, data)
    data.result = mergedResult
    dataMap.set(originUid, data)

    await changeCurrent(originUid)
    await saveData(data)

    sendMsg("数据同步完成")

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

    iconJsonData.length = 0;

    for (let [name, dataPath] of fileMap) {
        try {
            const data = await readJSON(dataPath, name)

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
                //判断历史记录是否是旧的格式
                if (data["version"] != "1") {
                    await getHistoryData()
                }

                history = data;
            }

            if (name.includes('icon')) {
                iconJsonData.push(...data);
                // console.log("添加图标", new Date().toLocaleString())
            }

            if (name.includes('dic')) {
                dic = data;
                reverseDic = {};
                for (let key in dic) {
                    reverseDic[dic[key]] = key;
                }
            }
        } catch (e) {
            console.log(e)
        }
    }

    if ((!config.current && dataMap.size) || (config.current && dataMap.size && !dataMap.has(config.current))) {
        await changeCurrent(dataMap.keys().next().value)
    }
}

const collectDataFiles = async () => {
    // console.log("[MHYWarp] userDataPath ===== ", userDataPath)
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

            regex = new RegExp(`^${prefix}_history.json$`);

            // console.log(name, regex.test(name))
            if (regex.test(name) && !fileMap.has(name)) {
                fileMap.set(name, dataPath)
            }

            regex = new RegExp(`^${prefix}_icon.json$`);

            // console.log(name, regex.test(name))
            if (regex.test(name) && !fileMap.has(name)) {
                fileMap.set(name, dataPath)
            }

            regex = new RegExp(`^${prefix}_dic.json$`);

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
        await fs.outputJSON(savePath, data)
    } catch (e) {
        await sleep(3)
    }
}

const loadIconJson = async () => {
    const url = jsonUrl[config.game];
    iconJsonData.length = 0;
    if (typeof url === "string") {
        const res = await request(url)
        iconJsonData.push(...res.data.list[0].children)
    } else {
        for (let i = 0; i < url.length; i++) {
            const res = await request(url[i])
            // console.log(res.data.list[0])
            iconJsonData.push(...res.data.list)
        }
    }

    // console.log("加载图标", iconJsonData)

    await saveJSON(`${config.game}_icon.json`, iconJsonData)
}

const loadDicJson = async () => {
    const url = getUigfDicUrl();
    if (!url || url === "") {
        return "no url";
    }
    const res = await request(url)
    dic = res;
    reverseDic = {};
    for (let key in dic) {
        reverseDic[dic[key]] = key;
    }
    await saveJSON(`${config.game}_dic.json`, dic)
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
    let haveItemIdChecked = false;
    let haveItemId;
    do {
        await sleep(0.3)

        sendMsg(`当前请求：${name}\n第 ${page} 页 第 ${(page - 1) * 20} - ${page * 20} 条数据`)

        res = await getGachaLog({ key, page, name, url, endId, retryCount: 5 })

        //没有结果 返回错误
        if (!res) return "timeout";

        // console.log(res);

        logs = res?.list || []
        if (!uid && logs.length) {
            uid = logs[0].uid
        }
        if (!region) {
            region = res.region
        }
        if (!region_time_zone) {
            region_time_zone = res.region_time_zone | 8
        }
        list.push(...logs)
        page += 1

        if (logs.length) {
            endId = logs[logs.length - 1].id
        }

        if (!haveItemIdChecked) {
            haveItemIdChecked = true;
            // console.log(dataMap);
            haveItemId = dataMap.has(uid) && dataMap.get(uid).result.has(key) && !dataMap.get(uid).result.get(key).find(item => {
                // console.log(item.item_id);
                return !item.item_id || item.item_id == ''
            });
        }

        if (!config.fetchFullHistory && logs.length && uid && dataMap.has(uid) && haveItemId) {
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
                            console.log(`${name} 本地数据已是最新，中止请求`)
                            sendMsg(`${name}\n 数据已是最新，中止请求`)
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
        // console.log(reqUrl)
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

        if (!fs.existsSync(userPath)) {
            return "incorrect path";
        }

        const res = await getCacheText(userPath);

        if (!res) return "url not found";

        const [cacheText, cacheFile] = res;

        const urlMch = urlMatch(cacheText)
        // console.log(cacheText)
        if (urlMch) {
            cacheFolder = cacheFile.replace(/Cache_Data[/\\]data_2$/, '')
            return getLatestUrl(urlMch)
        }

        return "url not found"
    } catch (e) {
        return "url not found"
    }
}

const getLatestUrl = (list) => {
    let result = list[list.length - 1]
    // console.log(result)
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

    if (timeSortedFiles.length == 0) return null;

    const cacheText = await fs.readFile(path.join(timeSortedFiles[0]), 'utf8')

    return [cacheText, timeSortedFiles[0]]
}

const tryRequest = async (url, retry = false) => {
    const queryString = await getQuerystring(url)
    if (!queryString) return false
    const gachaTypeUrl = `${getGachaLogUrl()}${queryString}&page=1&size=5&gacha_type=1&end_id=0`
    try {
        const res = await request(gachaTypeUrl)
        return checkResStatus(res)
    } catch (e) {
        if (e.code === 'ERR_PROXY_CONNECTION_FAILED' && !retry) {
            await disableProxy()
            return await tryRequest(url, true)
        }
        throw e
    }
}

const checkResStatus = (res) => {
    // const text = i18n.log
    // console.log(res)
    if (res.retcode !== 0) {
        return "timeout";
    }
    return true
}

async function getNormalUpData() {
    let url = getNormalPickUpUrl();
    let res = await request(url);

    // console.log("normal ", res)

    let list = [];

    // console.log(config.game, url)
    switch (config.game) {
        case "Genshin":
            list = res.r5_prob_list;
            break;
        case "HSR":
            list = res.items_avatar_star_5.map(item => {
                let res = item;
                res.item_type = "角色";
                return res;
            });
            list.push(...res.items_light_cone_star_5.map(item => {
                let res = item;
                res.item_type = "武器";
                return res;
            }));
            break;
        case "ZZZ":
            list = res.items_avatar_star_5.map(item => {
                let res = item;
                res.item_type = "代理人";
                return res;
            });
            list.push(...res.items_light_cone_star_5.map(item => {
                let res = item;
                res.item_type = "音擎";
                return res;
            }));
            break;
    }

    // console.log(list)

    // saveJSON(`${config.game}_normal_up.json`, list)

    return list;
}

async function getHistoryData() {
    let historyUrls = getHistoryUrl();
    history = {
        itemType: {},
        rank: {}
    };

    for (let url of historyUrls) {
        let historyData = await request(url)

        for (let value of historyData) {
            for (let item of value.items) {
                if (!history[item.rankType]) {
                    history[item.rankType] = {};
                }
                // console.log(item.name)
                if (!history[item.rankType][item.name]) {
                    history[item.rankType][item.name] = [{
                        start: value.start,
                        end: value.end,
                    }];
                } else {
                    history[item.rankType][item.name].push({
                        start: value.start,
                        end: value.end,
                    });
                }

                history["itemType"][item.name] = item.itemType == "Character" ? "角色" : "武器";

                history["rank"][item.name] = item.rankType;
            }
        }
    }

    let normal = await getNormalUpData();
    for (let item of normal) {
        history["itemType"][item.item_name] = item.item_type;
        history["rank"][item.item_name] = 5;
        // console.log(item, history["itemType"][item.item_name], history["rank"][item.item_name])
    }

    // console.log(list)
    // console.log("history", history)
    history["version"] = "1";

    await saveJSON(`${config.game}_history.json`, history)
}

const getCurrentData = async () => {

    dataMap = new Map()

    await readData();

    let output = {};

    let data = dataMap.get(config.current);

    let error = false;

    if (data) {
        // console.log(data);
        for (let [key, value] of data.result) {
            let keyName = data.typeMap.get(key)
            output[keyName] = []
            for (let item of value) {

                if (!item.item_id || item.item_id == '') {
                    error = "no item id"
                }

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

    if (history.length == 0) {
        // console.log("加载 history")
        await getHistoryData()
    }

    if (iconJsonData.length == 0) {
        await loadIconJson();
    }
    // console.log("history", history)

    let history5 = history["5"];
    return { output, history5, error }
}


let games = {
    "Genshin": "hk4e",
    "HSR": "hkrpg",
    "ZZZ": "nap"
}

async function exportData() {

    const now = new Date();
    const formatted = now.toLocaleString('zh-CN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false // 24 小时制
    });
    const outputTime = formatted.replace(/\//g, '-').replace(' ', '-');

    const result = await dialog.showSaveDialog({
        title: '保存文件',
        defaultPath: app.getPath('downloads') + '/' + outputTime + "-" + config.game + '_export.json',
        filters: [
            { name: '文本文件', extensions: ['json'] },
            { name: '所有文件', extensions: ['*'] }
        ]
    });


    let filePath;
    if (!result.canceled && result.filePath.length > 0) {
        filePath = result.filePath;
    } else {
        return;
    }

    dataMap = new Map()

    await readData();

    let obj = {
        "info": {
            "export_timestamp": new Date().toLocaleString(),
            "export_app": app.getName(),
            "export_app_version": app.getVersion(),
            "version": "v4.0",
        },
        [games[config.game]]: []
    }

    for (let [uid, data] of dataMap) {

        let uidObj = {
            uid: uid,
            lang: data.lang,
            list: []
        }

        for (let [key, value] of data.result) {
            for (let item of value) {
                if (!uidObj["timezone"]) {
                    uidObj["timezone"] = data.region_time_zone;
                }

                let pullItem = {
                    uigf_gacha_type: key,
                    gacha_type: key,
                    name: item.name,
                    count: item.count,
                    time: item.time,
                    id: item.id,
                    item_id: item.item_id,
                    item_type: item.item_type,
                    rank_type: item.rank_type,
                    gacha_id: item.gacha_id,
                }
                uidObj.list.push(pullItem)
                // console.log(pullItem)
            }
        }

        obj[games[config.game]].push(uidObj);
    }

    await fs.outputJSON(filePath, obj)
}

async function importData() {
    const result = await dialog.showOpenDialog({
        defaultPath: app.getPath('downloads'),
        filters: [
            { name: '文本文件', extensions: ['json'] },
            { name: '所有文件', extensions: ['*'] }
        ]
    });

    let filePath;
    // console.log(result)
    if (!result.canceled && result.filePaths.length > 0) {
        filePath = result.filePaths[0];
    } else {
        return;
    }

    try {
        let data = await fs.readJSON(filePath);

        // console.log(data['info']?.uigf_version)
        let isV3 = data['info']?.uigf_version;
        if (!data[games[config.game]] && !isV3) return "wrong file";

        await readData();

        const typeMap = new Map()
        const result = new Map()

        const gachaType = await getGachaType()

        console.log("gachaType", gachaType)

        for (const type of gachaType) {
            typeMap.set(type.key, type.name)
        }

        // console.log(rankLevels)
        console.log("check keys");
        // if (data.keys()) {

        // }

        if (isV3) {

            console.log("v3", data.info)
            let timeOffset = 8 - data.info.region_time_zone;
            let localData = dataMap.get(data.info.uid);

            let importDatas = new Map();

            for (let item of data.list) {
                let key = item.gacha_type;
                if (!importDatas.has(key)) {
                    importDatas.set(key, []);
                }

                if (!item.name) {
                    if (!dic) {
                        dic = await loadDicJson();
                    }
                    item.name = reverseDic[item.item_id];
                }

                if (!item.rank_type) {
                    let isZZZ = config.game === "ZZZ";
                    item.rank_type = history["rank"][item.name] || (isZZZ ? 2 : 3);

                    // console.log("星级", item.name, rankLevels[item.name]);
                }

                if (!item.item_type) {
                    item.item_type = history["itemType"][item.name];
                }

                item.time = new Date(new Date(item.time).getTime() + timeOffset * 3600 * 1000).toLocaleString().replaceAll("/", "-");

                let importItem = item;
                delete importItem.uigf_gacha_type;
                // console.log("importItem", importItem)
                importDatas.get(key).push(importItem);
            }

            let mergedResult = mergeData(localData, {
                uid: data.info.uid,
                result: importDatas
            });

            const newData = { result, typeMap, time: Date.now(), uid: data.info.uid, lang: data.info.lang, region: "cn_gf01", region_time_zone: data.info.region_time_zone }
            newData.result = mergedResult
            if (localData) {
                newData.region = localData.region;
            }
            dataMap.set(data.info.uid, newData)

            await changeCurrent(data.info.uid)
            await saveData(newData)

        } else {
            for (let uidData of data[games[config.game]]) {
                // console.log(item);
                // console.log(uidData)
                //目前仅支持东八区
                let timeOffset = 8 - uidData.timezone;

                let localData = dataMap.get(uidData.uid);

                let importDatas = new Map();
                for (let item of uidData.list) {
                    let key = item.gacha_type;
                    if (!importDatas.has(key)) {
                        importDatas.set(key, []);
                    }

                    if (!item.name) {
                        if (!dic) {
                            dic = await loadDicJson();
                        }
                        item.name = reverseDic[item.item_id];
                    }

                    if (!item.rank_type) {
                        let isZZZ = config.game === "ZZZ";
                        item.rank_type = history["rank"][item.name] || (isZZZ ? 2 : 3);

                        // console.log("星级", item.name, rankLevels[item.name]);
                    }

                    if (!item.item_type) {
                        item.item_type = history["itemType"][item.name];
                    }

                    item.time = new Date(new Date(item.time).getTime() + timeOffset * 3600 * 1000).toLocaleString().replaceAll("/", "-");

                    let importItem = item;
                    delete importItem.uigf_gacha_type;
                    // console.log("importItem", importItem)
                    importDatas.get(key).push(importItem);
                }

                let mergedResult = mergeData(localData, {
                    uid: uidData.uid,
                    result: importDatas
                });

                const newData = { result, typeMap, time: Date.now(), uid: uidData.uid, lang: uidData.lang, region: "cn_gf01", region_time_zone: uidData.timezone }
                newData.result = mergedResult
                if (localData) {
                    newData.region = localData.region;
                    // data.region_time_zone = localData.region_time_zone;
                    // data.lang = localData.lang;
                }
                dataMap.set(uidData.uid, newData)

                await changeCurrent(uidData.uid)
                await saveData(newData)
            }
        }

        return true;
    } catch (e) {
        console.log("import failed", e)
        return "wrong file";
    }
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

function getAllUids() {
    let result = [];
    for (let [uid, data] of dataMap) {
        result.push(uid)
    }
    return result;
}

const bgCacheDir = path.resolve(os.homedir(), '.config/mhy_warp/bgCache')
if (!fs.existsSync(bgCacheDir)) {
    // console.log("filePath", filePath)
    fs.mkdirSync(bgCacheDir, { recursive: true });
}

async function setBg(clear) {
    let targetPath;

    console.log("是否清除", clear)
    if (clear) {
        targetPath = "";
    } else {
        let url = (await dialog.showOpenDialog({
            // properties: ['openDirectory'],
            defaultPath: app.getPath('pictures'),
            filters: [
                { name: '图片文件', extensions: ['jpg', 'png', 'jpeg', 'bmp'] },
            ]
        })).filePaths[0];

        const fileName = path.basename(url);                // 提取文件名
        targetPath = path.join(bgCacheDir, fileName);

        await fs.copyFile(url, targetPath)
    }

    config.bg = targetPath;
    saveConfig();

    // console.log('设置背景成功:', targetPath);

    return targetPath;
}

async function setBlur(blur) {
    config.blur = blur;
    saveConfig();
}

module.exports = { fetchData, getCurrentData, openFolderSelector, exportData, importData, getAllUids, changeCurrent, setBg, setBlur }