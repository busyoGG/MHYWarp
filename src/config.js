

const os = require('os');
const path = require('path')
const fs = require('fs-extra')

const config = {
    urls: [],
    current: 0,
    fetchFullHistory: false,
    userPath: {},
    game: "HSR",
    bg: "",
    blur: -1
}

const uigfDicBase = "https://api.uigf.org/dict/"

const jsonUrl = {
    "Genshin": [
        "https://act-api-takumi-static.mihoyo.com/common/blackboard/ys_obc/v1/home/content/list?app_sn=ys_obc&channel_id=25",
        "https://act-api-takumi-static.mihoyo.com/common/blackboard/ys_obc/v1/home/content/list?app_sn=ys_obc&channel_id=5"
    ],
    "HSR": "https://act-api-takumi-static.mihoyo.com/common/blackboard/sr_wiki/v1/home/content/list?app_sn=sr_wiki&channel_id=17",
    "ZZZ": "https://act-api-takumi-static.mihoyo.com/common/blackboard/zzz_wiki/v1/home/content/list?app_sn=zzz_wiki&channel_id=2"
}

var iconJsonData = [];

const sleep = (sec = 1) => {
    return new Promise(rev => {
        setTimeout(rev, sec * 1000)
    })
}

const userDataPath = path.resolve(os.homedir(), '.config/mhy_warp/userData')
const saveJSON = async (name, data) => {
    try {
        let savePath = path.join(userDataPath, name);
        // console.log(savePath)
        await fs.outputJSON(savePath, data)
    } catch (e) {
        console.log(e, 'ERROR')
        await sleep(3)
    }
}

const readJSON = async (dataPath, name) => {
    let data = null
    try {
        data = await fs.readJSON(path.join(dataPath, name))
    } catch (e) { }
    return data
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

async function setGame(game) {
    config.game = game
    // console.log('Game changed to', game)
    await saveConfig();
}

function getConfig() {
    return config;
}

function getUigfDicUrl() {
    let url;
    switch (config.game) {
        case "Genshin":
            url = uigfDicBase + "genshin/chs.json"
            break;
        case "HSR":
            url = uigfDicBase + "starrail/chs.json"
            break;
    }
    return url
}

module.exports = { setGame, config, changeCurrent, getConfig, saveConfig, iconJsonData, jsonUrl, getUigfDicUrl }