var renderData;
var specialCount = 0;
var normalCount = 0;
var bangbuCount = 0;
var gachaType;
var normalUp;
var historyData;
var errorModel = true;
var uids = [];
var currentData;

var errorList = {
    "incorrect path": {
        title: "错误码：15-4001",
        message: "未匹配到游戏文件夹，请选择正确的游戏路径"
    },
    "url not found": {
        title: "错误码：10010-4001",
        message: "未找到抽卡历史记录，请在游戏中重新打开抽卡历史记录"
    },
    "timeout": {
        title: "错误码：10310-4001",
        message: "网络连接超时或抽卡链接过期，请检查网络连接或在游戏中重新打开抽卡历史记录"
    },
    "wrong file": {
        title: "错误码：10612-4001",
        message: "错误的数据文件"
    },
    "no item id": {
        title: "错误码：10351-4001",
        message: "未找到物品ID，请尽快重新同步抽卡记录"
    }
}

let errorMessageBg = document.getElementById('error-message-bg');
let errorMessageBox = document.getElementById('error-message-box');
let errorMessageTitle = document.getElementById('error-message-title');
let errorMessage = document.getElementById('error-message-content');
let errorMessageButton = document.getElementById('error-message-button');

const log = (message) => {
    let date = new Date();
    console.log(date + ":" + new Date().getMilliseconds(), JSON.stringify(message), message.indexOf('\n'));
}

const showSync = (message) => {
    log(message);
    showError("同步抽卡记录", message, false, true);
}

function showError(title, content, model = true, center = false) {

    if (errorModel != model) {
        errorModel = model;
        errorMessageBox.classList.remove('show');
        setTimeout(() => {
            errorMessageBox.classList.add('show');
        }, 200);
    } else {
        errorMessageBox.classList.add('show');
    }

    errorMessageBg.classList.remove('error-message-bg-hide');
    errorMessageTitle.textContent = title;
    errorMessage.textContent = content;

    if (model) {
        errorMessageButton.classList.remove("hide");
    } else {
        errorMessageButton.classList.add("hide");
    }

    if (center) {
        errorMessage.classList.add("text-center");
    } else {
        errorMessage.classList.remove("text-center")
    }

    if (content.includes("完成")) {
        hideError();
    }
}

function hideError() {
    errorMessageBg.classList.add('error-message-bg-hide');
    errorMessageBox.classList.remove('show');
    errorMessageButton.classList.remove("hide");
}

const init = async () => {

    log("初始化");

    //注册全局函数
    window.utils.registerLog((message) => {
        showSync(message);
    })

    // await window.utils.loadIconJson();

    await initData();

    initHtml();

    log("初始化本地抽卡记录数据");

    initAverage();
    initPieChart();

    log("初始化数据统计")

    const container = document.getElementById('scroll-container');
    const spacer = document.getElementById('spacer');

    // 1. 创建懒加载 observer
    const imgObserver = new IntersectionObserver((entries) => {
        entries.forEach(async entry => {
            if (entry.isIntersecting) {
                const img = entry.target;
                let local = await window.utils.downloadImage(img.dataset.src); // 加载图片
                // console.log("本地图片", local)
                img.src = local; // 设置真实 src
                imgObserver.unobserve(img); // 只加载一次
            }
        });
    }, {
        root: container,
        rootMargin: '100px', // 提前加载
        threshold: 0.1
    });

    let renderType = gachaType[0].name;
    const itemHeight = 60;
    let items = renderData[renderType];


    const renderedItems = new Map();

    function renderItems() {

        let length = renderData[renderType]?.length;
        let totalItems = length;
        spacer.style.height = `${totalItems * itemHeight}px`;
        let visibleCount = Math.ceil(container.clientHeight / itemHeight) + 5;

        const scrollTop = container.scrollTop;
        const startIndex = Math.floor(scrollTop / itemHeight);
        const endIndex = Math.min(startIndex + visibleCount, totalItems);

        // console.log(startIndex, endIndex, startIndex, visibleCount, totalItems)

        // 移除不需要的项
        for (let key of renderedItems.keys()) {
            if (key < startIndex || key >= endIndex) {
                const el = renderedItems.get(key);
                container.removeChild(el);
                renderedItems.delete(key);
            }
        }

        // 添加需要显示的项
        for (let i = startIndex; i < endIndex; i++) {
            if (!renderedItems.has(i)) {
                const el = document.createElement('div');
                el.className = 'item';
                el.style.top = `${i * itemHeight}px`;
                el.style.width = `100%`
                el.style.display = 'flex';
                el.style.alignItems = 'center';
                el.classList.remove('ou');
                el.classList.remove('fei');

                if (items[i].name != "未出货") {
                    if (items[i].count > 80) {
                        el.classList.add('fei');
                    } else if (items[i].count < 10) {
                        el.classList.add('ou');
                    }
                }

                let color = "#4caf50";
                if (items[i].count > 70) {
                    color = "#f44336";
                } else if (items[i].count > 50) {
                    color = "#ff9800";
                }

                let wai = "";

                if (!renderType.includes("邦布")) {
                    let pickTime = new Date(items[i].time);
                    let historyTime = historyData[items[i].name];

                    // console.log(pickTime, historyData, items[i].name);
                    let waiMark = true;
                    if (historyTime) {
                        for (let j = 0; j < historyTime.length; j++) {
                            // console.log(pickTime, pickTime >= historyTime[j].start)
                            if (pickTime >= new Date(historyTime[j].start) && pickTime <= new Date(historyTime[j].end)) {
                                waiMark = false;
                                break;
                            }
                        }
                    }

                    if (items[i].name != "未出货" && (!renderType.includes("常驻") && !renderType.includes("新手") && !renderType.includes("集录祈愿")) && waiMark) {
                        // console.log(items[i].name, "歪了")
                        wai = "<span class='wai'>歪</span>"
                    }
                }
                // console.log(items[i])
                el.innerHTML = `
                        <span style="width:48px">${items[i].count} 抽</span>
                        <span style="margin-left: 20px;"></span>
                        <img data-src="${items[i].icon}" style="vertical-align: middle; margin-right: 8px; height:100%;aspect-ratio:1;border-radius: 5px;background-color:#f3dc9f;" />
                        <div style="width:100%">
                            <div style="width:100%;display:flex;justify-content:center;align-items: center;margin-bottom:5px">
                                <span>${items[i].name}</span>
                                ${wai}
                                <span style="margin-left: auto;">${items[i].time}</span>
                            </div>
                            <div class="progress-container" style="outline:1px solid rgb(134, 161, 164)">
                                <div class="progress-bar" id="progressBar" style="width: ${items[i].count * 100 / 90}%;background-color: ${color};"></div>
                            </div>
                        </div>
                        `;
                const img = el.querySelector('img');
                imgObserver.observe(img);

                container.appendChild(el);
                renderedItems.set(i, el);
            }
        }
    }

    // 初始渲染
    renderItems();

    log("初始化数据渲染")

    container.addEventListener('scroll', () => {
        renderItems();
    });

    let lastBtn = document.querySelector('.active');
    document.getElementById('filter-buttons').addEventListener('click', (e) => {
        if (e.target.tagName === 'BUTTON' && e.target.dataset.filter) {
            const filterType = e.target.dataset.filter;

            renderType = filterType;
            items = renderData[renderType];

            // 清除旧渲染项
            renderedItems.forEach(el => container.removeChild(el));
            renderedItems.clear();

            // 重新渲染
            renderItems();

            if (lastBtn) {
                lastBtn.classList.remove('active');
            }
            lastBtn = e.target;
            lastBtn.classList.add('active');
            // console.log("激活", lastBtn)
        }
    });

    async function reset() {
        await initData();
        // console.log(renderData)
        initAverage();
        initPieChart();
        initInfo();

        items = renderData[renderType];

        // 清除旧渲染项
        renderedItems.forEach(el => container.removeChild(el));
        renderedItems.clear();

        // 重新渲染
        renderItems();
    }

    let refreshBtn = document.getElementById('sync-data');
    refreshBtn.addEventListener('click', async () => {

        refreshBtn.firstElementChild.classList.add('fa-spin');
        let res = await window.utils.fetchData()
        refreshBtn.firstElementChild.classList.remove('fa-spin');

        if (res != true) {
            refreshBtn.firstElementChild.classList.add('fa-warning');
            refreshBtn.firstElementChild.style.color = 'red';

            showError(errorList[res].title, errorList[res].message)

            return;
        } else {
            //样式变化
            refreshBtn.firstElementChild.classList.add('fa-check');
            refreshBtn.firstElementChild.style.color = 'green';

            setTimeout(() => {
                refreshBtn.firstElementChild.classList.remove('fa-check');
                refreshBtn.firstElementChild.style.color = 'black';
            }, 1000);
        }

        await reset();
    });

    const btn = document.getElementById('selectFolderBtn');
    const selectFolder = document.getElementById('selectedFolder');
    btn.addEventListener('click', async () => {
        // input.click(); // 点击按钮时触发隐藏的input打开文件夹选择
        let folder = await window.utils.getFolder();
        // console.log(folder)
        if (folder) {
            selectFolder.textContent = `当前游戏文件夹: ${folder}`;
        }
    });

    // 鼠标悬停时调整位置
    let btns = document.querySelectorAll('.tooltip');
    let tips = document.querySelectorAll('.tooltiptext');
    for (let i = 0; i < btns.length; i++) {
        btns[i].addEventListener('mouseenter', () => {
            adjustTooltipPosition(tips[i]);
        });
    }

    initInfo();

    function clearAllDropdown(input) {

        if (input != dropdown && dropdown.style.display == "block") {
            dropdown.style.display = "none";
        }

        if (input != uidDropdown && uidDropdown.style.display == "block") {
            uidDropdown.style.display = "none";
        }
    }

    let changeBtn = document.querySelector('.game-change');
    let dropdown = document.querySelector('#dropdown');
    changeBtn.addEventListener('click', async (event) => {
        clearAllDropdown(dropdown)
        dropdown.style.display = dropdown.style.display === 'block' ? 'none' : 'block';
        event.stopPropagation();
    });

    let uidBtn = document.querySelector('#uid');
    let uidDropdown = document.querySelector('#uid-dropdown');
    uidBtn.addEventListener('click', async (event) => {
        clearAllDropdown(uidDropdown);
        uidDropdown.style.display = uidDropdown.style.display === 'block' ? 'none' : 'block';
        event.stopPropagation();
    });

    // 点击其它地方时隐藏下拉菜单
    document.addEventListener('click', () => {
        clearAllDropdown()
    });

    let gameIconMap = {
        "Genshin": "../res/genshin_logo.png",
        "HSR": "../res/hsr_logo.png",
        "ZZZ": "../res/zzz_logo.png"
    }

    let config = await window.utils.getConfig();
    let gameIcon = document.getElementById('game-icon');
    gameIcon.src = gameIconMap[config.game];
    // console.log(gameIcon.src, config.game)

    dropdown.addEventListener('click', async (e) => {
        if (e.target.tagName === 'LI') {
            const selected = e.target.getAttribute('data-game');
            console.log('选择了游戏:', selected);
            await window.utils.setGame(selected);
            location.reload();

        }
    });

    uidDropdown.addEventListener('click', async (e) => {
        if (e.target.tagName === 'LI') {
            const selected = e.target.getAttribute('data-uid');
            console.log('选择了 UID:', selected);
            await window.utils.changeCurrent(selected);
            // location.reload();

            await reset();
        }
    });

    document.getElementById('error-message-confirm').addEventListener('click', () => {

        hideError();

        refreshBtn.firstElementChild.classList.remove('fa-warning');
        refreshBtn.firstElementChild.style.color = 'black';
    });

    errorMessageBg.addEventListener('click', () => {
        if (errorModel) {
            hideError();
            refreshBtn.firstElementChild.classList.remove('fa-warning');
            refreshBtn.firstElementChild.style.color = 'black';
        }
    });

    errorMessageBox.addEventListener('click', function (event) {
        event.stopPropagation(); // 阻止事件继续冒泡到父元素
    });

    let bgBox = document.querySelector(".normal-box");
    if (config.bg && config.bg != "") {
        // bgBox.computedStyleMap().get("background-image").value = `url(${config.bg})`;
        bgBox.style.backgroundImage = `url(${config.bg})`;
    }

    let bgChangeBtn = document.getElementById("bg-change-btn");
    bgChangeBtn.addEventListener('mousedown', async (e) => {

        if (e.button == 0) {
            let url = await window.utils.setBg();
            bgBox.style.backgroundImage = `url(${url})`;
        } else if (e.button == 2) {
            let url = await window.utils.setBg(true);
            bgBox.style.backgroundImage = `url(${url})`;
        }
    });

    let blur = parseInt(getComputedStyle(bgBox).getPropertyValue("--bgBlur"));
    if (config.blur == -1) {
        window.utils.setBlur(blur);
    } else {
        blur = config.blur;
        bgBox.style.setProperty("--bgBlur", blur)
    }
    // console.log(blur)
    bgChangeBtn.addEventListener("wheel", (e) => {
        e.preventDefault();
        let offset = e.deltaY > 0 ? 1 : -1;
        blur += offset;
        blur = Math.max(0, Math.min(blur, 20));
        bgBox.style.setProperty("--bgBlur", blur)

        window.utils.setBlur(blur);
    });

    document.getElementById("export-btn").addEventListener('click', async () => {
        await window.utils.exportData();
        console.log("导出成功")
    });

    document.getElementById("import-btn").addEventListener('click', async () => {
        let res = await window.utils.importData();
        // console.log(res)
        if (res == true) {
            console.log("导入成功")
            location.reload();
        } else {
            showError(errorList[res].title, errorList[res].message, true, true)
        }

        // await reset();
    });

    log("初始化完成");
}

function initHtml(skip = false) {

    if (skip) return;

    let buttons = document.getElementById("buttons");
    buttons.innerHTML = '';

    let charts = document.getElementById("chart-box");
    charts.innerHTML = '';

    let i = 0;
    for (let data of gachaType) {

        // console.log("生成", data)
        //生成按钮
        const btn = document.createElement('button');
        btn.dataset.filter = data.name; // 设置 data-filter 属性
        if (i == 0) {
            btn.classList.add('active');         // 添加 class
        }
        btn.textContent = data.name;    // 设置按钮文字

        buttons.appendChild(btn);

        //生成图表
        const container = document.createElement('div');
        container.className = 'chart-container';

        // 第一个 <div>：标题
        const title = document.createElement('div');
        title.textContent = data.name;

        // 第二个 <div>：包含 canvas 的 chart 区域
        const chartDiv = document.createElement('div');
        chartDiv.className = 'chart';

        const canvas = document.createElement('canvas');
        canvas.id = data.name + "-chart";
        canvas.style.height = '100px';

        chartDiv.appendChild(canvas);

        // 第三个 <div>：描述文字
        const note = document.createElement('div');
        note.style.fontSize = '14px';
        note.style.color = '#b88b11';
        note.textContent = '五星平均';

        // 组装结构
        container.appendChild(title);
        container.appendChild(chartDiv);
        container.appendChild(note);

        charts.appendChild(container);

        i++;
    }

    let uidDropdown = document.getElementById("uid-dropdown");
    uidDropdown.innerHTML = '';
    for (let uid of uids) {
        // let html = `<li data-uid="${uid}">${uid}</li>`
        let html = document.createElement('li');
        html.dataset.uid = uid;
        html.textContent = uid;
        uidDropdown.appendChild(html);
    }

    // await new Promise(resolve => requestAnimationFrame(() => resolve()));
}

async function initInfo() {
    const selectFolder = document.getElementById('selectedFolder');
    let config = await window.utils.getConfig();

    if (config.userPath[config.game]) {
        selectFolder.textContent = `游戏路径: ${config.userPath[config.game]}`;
    }

    if (config.current) {
        document.getElementById('uid').textContent = `UID: ${config.current}`;
    }

    switch (config.game) {
        case 'HSR':
            document.getElementById('special-icon').src = "../res/102.png";
            document.getElementById('normal-icon').src = "../res/101.png";
            break;
        case 'Genshin':
            document.getElementById('special-icon').src = "../res/jczy.png";
            document.getElementById('normal-icon').src = "../res/xyzy.png";
            break;
        case 'ZZZ':
            document.getElementById('special-icon').src = "../res/jmmd.png";
            document.getElementById('normal-icon').src = "../res/yzmd.png";
            break;
    }
    document.getElementById('special-count').textContent = `限定消耗: ${specialCount} 抽`;
    document.getElementById('normal-count').textContent = `常驻消耗: ${normalCount} 抽`;

}

async function initData() {
    gachaType = await window.utils.getGachaType();
    currentData = await window.utils.getCurrentData();
    const { output, history5, error } = currentData;

    if (error != false) {
        showError(errorList[error].title, errorList[error].message, true, true)
    }
    // console.log('读取当前数据:', output, history5);
    let res = output;
    historyData = history5;
    // renderData = res;

    uids = await window.utils.getUids();

    let result = {};
    specialCount = 0;
    normalCount = 0;
    bangbuCount = 0;

    let config = await window.utils.getConfig();

    for (let key in res) {
        let value = res[key];
        result[key] = [];
        let count = 0;
        for (let i = 0; i < value.length; i++) {
            let item = value[i];
            count++;
            if (key.includes("活动") || key.includes("集愿") || key.includes("独家") || key.includes("音擎")) {
                specialCount += 1;
            } else if (key.includes("邦布")) {
                bangbuCount += 1;
            } else {
                normalCount += 1;
            }
            // console.log(item.rank_type)
            if (item.rank_type == (config.game === "ZZZ" ? 4 : 5)) {
                result[key].unshift({
                    name: item.name,
                    icon: item.icon,
                    time: item.time,
                    count: count
                });
                count = 0;
            }

            if (i == value.length - 1) {
                result[key].unshift({
                    name: "未出货",
                    icon: "../res/mark_question.png",
                    time: item.time,
                    count: count
                });
            }
        }
    }

    renderData = result;
    // console.log(renderData)

    // let result = res;
    // renderData = result.map(item => {
    // }
}

function initAverage() {

    const averageList = {}

    for (let data of gachaType) {
        console.log("获取", data.name)
        averageList[data.name] = document.querySelector(`#${data.name}-chart`).parentElement.nextElementSibling;
    }

    // console.log(averageList)

    for (let key in averageList) {
        let ele = averageList[key];
        // console.log(key, ele)
        let values = renderData[key];

        if (values && values?.length != 0) {
            let average = 0;
            for (let i = 0; i < values.length; i++) {
                if (values[i].name == "未出货") continue;
                average += values[i].count;
            }
            average = average / (values.length - 1);
            ele.textContent = `五星平均: ${average.toFixed(0)} 抽`;

            // console.log(average, values.length,ele)
        }
    }
}

let myPieChart = {}; // 定义在模块外部，保持引用
async function initPieChart() {

    let config = await window.utils.getConfig();
    //初始化数据
    let { output } = currentData;
    let res = output;

    // console.log(Object.keys(res))

    if (Object.keys(res).length == 0) {
        document.getElementById("chart-box").classList.add("hide");
        document.getElementById("no-data").classList.remove("hide");
    } else {
        document.getElementById("chart-box").classList.remove("hide");
        document.getElementById("no-data").classList.add("hide");
    }

    let pieData = {}
    //绝区零星级比其他少一级，需要补正 
    let bonus = config.game == "ZZZ" ? 1 : 0;

    for (let key in res) {
        let value = res[key];
        pieData[key] = []

        let count = {}
        for (let i = 0; i < value.length; i++) {
            let item = value[i];
            let rank = parseInt(item.rank_type) + bonus;
            if (count[rank]) {
                count[rank] += 1;
            } else {
                count[rank] = 1;
            }
        }

        pieData[key].unshift(count[5] || 0);
        pieData[key].unshift(count[4] || 0);
        pieData[key].unshift(count[3] || 0);

        // console.log(pieData[key])
    }

    // console.log(pieData, res, gachaType)

    let pieList = []

    for (let data of gachaType) {
        pieList.push({
            chart: `${data.name}-chart`,
            data: pieData[data.name]
        })
    }


    for (let item of pieList) {
        // console.log(item)
        let pieId = item.chart;
        let ele = document.getElementById(pieId);
        let ctx = ele.getContext('2d');

        if (!item.data || item.data[0] == 0 && item.data[1] == 0 && item.data[2] == 0) {
            ele.parentElement.parentElement.classList.add('hide');
            // console.log(ele.parentElement)
        } else {
            ele.parentElement.parentElement.classList.remove('hide');
            // console.log(item.data);
            myPieChart[item.chart]?.destroy();

            myPieChart[item.chart] = new Chart(ctx, {
                type: 'pie', // 或 'doughnut'
                data: {
                    labels: ['三星', '四星', '五星'],
                    datasets: [{
                        data: item.data,
                        backgroundColor: [
                            'rgba(54, 162, 235, 0.7)',
                            'rgba(255, 99, 132, 0.7)',
                            'rgba(255, 206, 86, 0.7)'
                        ],
                        borderColor: '#fff',
                        borderWidth: 2
                    }]
                },
                options: {
                    maintainAspectRatio: false, // ✅ 允许高度固定
                    layout: {
                        padding: {
                            top: 20,
                            bottom: 0,
                            left: 40,   // 左右根据标签外扩调整
                            right: 40
                        }
                    },
                    plugins: {
                        tooltip: {
                            callbacks: {
                                label: function (context) {
                                    const total = context.chart._metasets[0].total;
                                    const value = context.raw;
                                    const percentage = ((value / total) * 100).toFixed(1);
                                    return `${context.label}: ${value} 个 (${percentage}%)`;
                                }
                            }
                        },
                        legend: {
                            display: true,
                            position: 'bottom',
                            labels: {
                                boxWidth: 12,
                                padding: 8,
                                font: {
                                    size: 12
                                }
                            }
                        },
                        datalabels: {
                            formatter: (value, ctx) => {
                                let sum = ctx.chart._metasets[0].total;
                                let percentage = (value * 100 / sum).toFixed(1) + "%";
                                return percentage;
                            },
                            color: '#000',
                            anchor: 'end', // 👉 标签锚点位置
                            align: 'end',  // 👉 标签对齐方式（控制显示在外面）
                            offset: -6,    // 👉 标签与饼图之间的距离
                        }
                    }
                },
                plugins: [ChartDataLabels]
            });
        }
    }
}

function adjustTooltipPosition(tooltip) {
    tooltip.style.left = '50%';  // 先恢复默认水平居中
    tooltip.style.right = 'auto';

    // console.log(tooltip);

    const rect = tooltip.getBoundingClientRect();
    const padding = 10; // 距离窗口边缘的最小距离

    // 右边超出视口
    if (rect.right > window.innerWidth - padding) {
        const overflowRight = rect.right - window.innerWidth + padding;
        // 往左移动tooltip
        tooltip.style.left = `calc(50% - ${overflowRight}px)`;
    }

    // 左边超出视口
    if (rect.left < 0) {
        tooltip.style.left = `calc(100% + ${padding * 2}px)`;
    }

    // if (rect.top < padding) {
    //     tooltip.style.top = `calc(100% + ${padding * 2}px)`;
    // }

    // if (rect.bottom > window.innerHeight - padding) {
    //     tooltip.style.bottom = `${padding}px`;
    // }
}

window.init = init;