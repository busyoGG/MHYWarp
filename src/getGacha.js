const { getConfig, config } = require("./config")


let apiDomain = 'https://api-takumi.mihoyo.com'

const hsrTypeMap = new Map([
    ['11', '角色活动跃迁'],
    ['12', '光锥活动跃迁'],
    ['1', '常驻跃迁'],
    ['2', '新手跃迁']
])

const genshinTypeMap = new Map([
    ['301', '角色活动祈愿'],
    ['302', '武器活动祈愿'],
    ['500', '集录祈愿'],
    ['200', '常驻祈愿'],
    ['100', '新手祈愿']
])

function updateApiDomain(host) {
    switch (config.game) {
        case 'HSR':
            if (host.includes('webstatic-sea') || host.includes('hkrpg-api-os') || host.includes('api-os-takumi') || host.includes('hoyoverse.com')) {
                apiDomain = 'https://public-operation-hkrpg-sg.hoyoverse.com'
            } else {
                apiDomain = 'https://public-operation-hkrpg.mihoyo.com'
            }
            break;
        case 'Genshin':
            apiDomain = 'https://public-operation-hk4e.mihoyo.com'
            break;
    }
}

function urlMatch(cacheText) {
    let res;
    switch (config.game) {
        case 'HSR':
            res = cacheText.match(/https[^?]+?\?[^?]+?&auth_appid=webview_gacha&.+?authkey=.+?&game_biz=hkrpg_/g)
            break;
        case 'Genshin':
            res = cacheText.match(/https[^?]+?\?[^?]+?&auth_appid=webview_gacha&.+?authkey=.+?&game_biz=hk4e_/g)
            break;
    }
    return res;
}

function getQuerystring(url) {
    // const text = i18n.log
    const { searchParams, host } = new URL(fixAuthkey(url))
    updateApiDomain(host)
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

/** 获取对应语言的卡池 map */
async function getGachaType() {
    let gachaTypeMap;

    switch (await getConfig().game) {
        case 'HSR':
            gachaTypeMap = hsrTypeMap;
            break;
        case 'Genshin':
            gachaTypeMap = genshinTypeMap;
            break;
    }

    if (!gachaTypeMap) return null;

    return [...gachaTypeMap].map(([key, name]) => ({ key, name }));
}

const fixAuthkey = (url) => {
    const mr = url.match(/authkey=([^&]+)/)
    if (mr && mr[1] && mr[1].includes('=') && !mr[1].includes('%')) {
        return url.replace(/authkey=([^&]+)/, `authkey=${encodeURIComponent(mr[1])}`)
    }
    return url
}

function getGachaLogUrl() {
    let url;
    switch (getConfig().game) {
        case 'HSR':
            url = `${apiDomain}/common/gacha_record/api/getGachaLog?`
            break;
        case 'Genshin':
            url = `${apiDomain}/gacha_info/api/getGachaLog?`
            break;
    }
    return url;
}

module.exports = { getQuerystring, getGachaType, getGachaLogUrl, urlMatch };