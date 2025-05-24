

const os = require('os');
const path = require('path')
const fs = require('fs-extra')

const config = {
    urls: [],
    current: 0,
    fetchFullHistory: false,
    userPath: {},
    game: "HSR"
}

const sleep = (sec = 1) => {
    return new Promise(rev => {
        setTimeout(rev, sec * 1000)
    })
}

const userDataPath = path.resolve(os.homedir(), '.config/hsr_warp/userData')
const saveJSON = async (name, data) => {
    try {
        let savePath = path.join(userDataPath, name);
        console.log(savePath)
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
    console.log('Game changed to', game)
    await saveConfig();
}

function getConfig() {
    return config;
}

module.exports = { setGame, config, changeCurrent, getConfig }