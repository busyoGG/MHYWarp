let screenshotFiles;

let screenshotBtn;
let screenshotBox;
let screenshotContent;
let pagesBox;
let imgViewerBoxBg;
let imgViewerBox;
let imgViewerImg;
let viwerCloseBtn;
let imgMenu;

let screenshotBoxOpen = false;
let screenshotItemCount = 0;
let screenshotPageCount = 0;

let scale = 1;
let offsetX = 0;
let offsetY = 0;
let isDragging = false;
let dragStartX = 0;
let dragStartY = 0;

let renderedItems = [];

let pagesItems = [];

let frontBtn;
let lastBtn;
let nextBtn;
let endBtn;

let switcherParent;

const screenshotInit = async () => {
    console.log("Screenshot init");

    screenshotBtn = document.getElementById("screenshot-btn");
    screenshotBox = document.getElementById("screenshot-box");
    screenshotContent = document.getElementById("screenshot-content");
    pagesBox = document.getElementById("pages-box");
    imgViewerBoxBg = document.getElementById("img-viewer-box-bg");
    imgViewerBox = document.getElementById("img-viewer-box");
    imgViewerImg = document.getElementById("img-viewer-img");
    viwerCloseBtn = document.getElementById("img-viewer-close");
    imgMenu = document.getElementById("img-menu");

    screenshotFiles = await window.utils.getScreenshotFiles();

    initPages();
    initViewer();


    switcherParent = screenshotBtn.parentElement;
    screenshotBtn.addEventListener("click", async () => {

        screenshotBoxOpen = !screenshotBoxOpen;
        showScreenshot(screenshotBoxOpen);
        generateScreenshot();

        updatePages();
    });

    window.addEventListener("resize", () => {
        if (screenshotBoxOpen) {
            showScreenshot(screenshotBoxOpen);
            generateScreenshot();

            updateScreenshot();
            updatePages();
        }
    });
};

function showScreenshot(open) {

    const rect = screenshotBtn.getBoundingClientRect();

    const x = rect.left + rect.width * 0.7 + window.scrollX;
    const y = rect.top + rect.height / 2 + window.scrollY;

    // screenshotBox.style.clipPath = "circle(var(--ratio) at var(--cx) var(--cy))";

    screenshotBox.style.transition = 'none';
    screenshotBox.style.setProperty("--cx", `${x}px`)
    screenshotBox.style.setProperty("--cy", `${y}px`)

    //强制刷新一帧
    screenshotBox.offsetWidth;

    screenshotBox.style.transition = 'clip-path .6s ease-out';
    screenshotBox.style.setProperty("--ratio", open ? "140%" : "0%")

    open ? screenshotBtn.classList.add("dark-mode") : screenshotBtn.classList.remove("dark-mode");
}

function updateScreenshot() {
    const rect = screenshotBtn.getBoundingClientRect();
    const x = rect.left + rect.width * 0.7 + window.scrollX;
    const y = rect.top + rect.height / 2 + window.scrollY;

    screenshotBox.style.transition = 'none';
    screenshotBox.style.setProperty("--cx", `${x}px`)
    screenshotBox.style.setProperty("--cy", `${y}px`)

    //强制刷新一帧
    screenshotBox.offsetWidth;

    screenshotBox.style.transition = 'clip-path .6s ease-out';
}

function generateScreenshot() {

    //计算布局
    let rect = screenshotContent.parentElement.getBoundingClientRect();
    let height = rect.height;
    let width = window.innerWidth;

    let imgHeight = 108;
    let imgWidth = 192;
    let offsetX = 10;
    let offsetY = 10;

    let repeatX = Math.floor(width / (imgWidth + offsetX * 2));
    let repeatY = Math.floor(height / (imgHeight + offsetY * 2));


    let onePageTotal = repeatX * repeatY;
    // console.log("repeatX", repeatX, repeatY, onePageTotal, width, imgWidth + offsetX);

    //计算页数
    let pageCount = Math.ceil(screenshotFiles.length / onePageTotal);

    //如果一页显示的内容没有变化就退出
    if (screenshotItemCount == onePageTotal && screenshotPageCount == pageCount) return;

    screenshotItemCount = onePageTotal;

    let totalWidth = (imgWidth + offsetX * 2) * repeatX;
    let diffWidth = width - totalWidth;

    offsetX = 10 + diffWidth / repeatX * 0.5;

    let totalHeight = (imgHeight + offsetY * 2) * repeatY;
    let diffHeight = height - totalHeight;

    offsetY = 10 + diffHeight / repeatY * 0.5;

    let imgCss = `width: ${imgWidth}px; 
                height: ${imgHeight}px;
                margin: ${offsetY}px ${offsetX}px; 
                `;

    //初始化图片容器数量
    if (renderedItems.length > onePageTotal) {
        for (let i = onePageTotal - 1; i < renderedItems.length; i++) {
            let ele = renderedItems[i];
            screenshotContent.removeChild(ele);
            renderedItems.splice(i, 1);
        }
    } else if (renderedItems.length < onePageTotal) {
        for (let i = renderedItems.length; i < onePageTotal; i++) {

            const screenshot = new Image();
            screenshot.loading = "lazy";
            // screenshot.style.cssText = imgCss;
            screenshot.classList.add("screenshot-img");
            screenshotContent.appendChild(screenshot);

            renderedItems.push(screenshot);

            screenshot.addEventListener("click", () => {
                showImg(screenshot.dataset.src);
            });
        }
    }

    for (let i = 0; i < renderedItems.length; i++) {
        let ele = renderedItems[i];
        ele.style.cssText = imgCss;
    }

    // 2. 加载图片
    let startIndex = screenshotPageCount * onePageTotal;
    let endIndex = startIndex + onePageTotal;

    if (endIndex > screenshotFiles.length) {
        endIndex = screenshotFiles.length;
    }

    let imgs = screenshotFiles.slice(startIndex, endIndex);

    renderScreenshot(imgs);
}

let cachedThumbnail = {};
async function renderScreenshot(data) {

    for (let i = 0; i < data.length; i++) {
        const screenshot = renderedItems[i];
        if (!cachedThumbnail[data[i]]) {
            screenshot.src = "../res/loading.gif?v=" + i;
        }
        screenshot.classList.remove("hide");
    }

    for (let i = 0; i < data.length; i++) {
        const screenshot = renderedItems[i];
        cachedThumbnail[data[i]] = await window.utils.generateThumbnail(data[i], 400);
        screenshot.src = cachedThumbnail[data[i]];
        screenshot.dataset.src = data[i];

        screenshot.classList.remove("hide");
    }

    if (data.length < renderedItems.length) {
        for (let i = data.length; i < renderedItems.length; i++) {
            const screenshot = renderedItems[i];
            screenshot.classList.add("hide");
        }
    }
}

async function initPages() {

    let config = await window.utils.getConfig();
    let title = document.getElementById("screenshot-title");

    let titleText;
    switch (config.game) {
        case "Genshin":
            titleText = "原神 截图";
            break;
        case "HSR":
            titleText = "崩坏：星穹铁道 截图";
            break;
        case "ZZZ":
            titleText = "绝区零 截图";
            break;
    }

    title.textContent = titleText;

    //创建按钮
    frontBtn = document.createElement("button");
    frontBtn.innerHTML = "<i class='fa fa-angle-double-left'></i>";
    // frontBtn.classList.add("btn");

    lastBtn = document.createElement("button");
    lastBtn.innerHTML = "<i class='fa fa-angle-left'></i>";
    // lastBtn.classList.add("btn");

    pagesBox.appendChild(frontBtn);
    pagesBox.appendChild(lastBtn);

    for (let i = 0; i < 7; i++) {
        let pageBtn = document.createElement("button");
        pageBtn.classList.add("page-btn");
        pageBtn.innerText = i + 1;
        // pageBtn.classList.add("btn");
        pagesBox.appendChild(pageBtn);

        pagesItems.push(pageBtn);

        pageBtn.addEventListener("click", () => {
            screenshotPageCount = pageBtn.innerText - 1;
            updatePages();
            generateScreenshot();
        });
    }

    nextBtn = document.createElement("button");
    nextBtn.innerHTML = "<i class='fa fa-angle-right'></i>";
    // nextBtn.classList.add("btn");

    endBtn = document.createElement("button");
    endBtn.innerHTML = "<i class='fa fa-angle-double-right'></i>";
    // endBtn.classList.add("btn");

    pagesBox.appendChild(nextBtn);
    pagesBox.appendChild(endBtn);

    frontBtn.addEventListener("click", () => {
        screenshotPageCount = 0;
        updatePages();
        generateScreenshot();
    });

    lastBtn.addEventListener("click", () => {
        screenshotPageCount--;
        updatePages();
        generateScreenshot();
    });

    nextBtn.addEventListener("click", () => {
        screenshotPageCount++;
        updatePages();
        generateScreenshot();
    });

    endBtn.addEventListener("click", () => {
        screenshotPageCount = Math.ceil(screenshotFiles.length / screenshotItemCount) - 1;
        updatePages();
        generateScreenshot();
    });

    screenshotBox.addEventListener("transitionend", () => {
        screenshotBoxOpen ? screenshotBox.style.pointerEvents = "auto" : screenshotBox.style.pointerEvents = "none";
        // screenshotBoxOpen && (screenshotBox.style.clipPath = "none");
    })
}

function updatePages() {
    let totalPage = Math.ceil(screenshotFiles.length / screenshotItemCount) - 1;
    let startIndex = Math.max(0, screenshotPageCount - 3);
    let endIndex = Math.min(screenshotPageCount + 3, totalPage);

    if (screenshotPageCount > totalPage) {
        screenshotPageCount = totalPage;
    }

    // let 
    if (screenshotPageCount == 0) {
        frontBtn.classList.add("hide");
        lastBtn.classList.add("hide");
        nextBtn.classList.remove("hide");
        endBtn.classList.remove("hide");
    } else if (screenshotPageCount == totalPage) {
        nextBtn.classList.add("hide");
        endBtn.classList.add("hide");
        frontBtn.classList.remove("hide");
        lastBtn.classList.remove("hide");
    } else {
        frontBtn.classList.remove("hide");
        lastBtn.classList.remove("hide");
        nextBtn.classList.remove("hide");
        endBtn.classList.remove("hide");
    }

    for (let i = 0; i < 7; i++) {
        let pageBtn = pagesItems[i];
        let pageIndex = startIndex + i;

        pageBtn.classList.remove("hide");
        if (pageIndex == screenshotPageCount) {
            pageBtn.classList.add("page-active");
        } else if (pageIndex > endIndex) {
            pageBtn.classList.add("hide");
        } else {
            pageBtn.classList.remove("page-active");
        }

        pageBtn.innerText = pageIndex + 1;
    }
}

function initViewer() {

    imgViewerBox.addEventListener("wheel", (e) => {
        e.preventDefault();

        const prevScale = scale;
        const zoomFactor = 1.1;
        const delta = e.deltaY > 0 ? 1 / zoomFactor : zoomFactor;
        const rect = imgViewerBox.getBoundingClientRect();

        // 鼠标在容器中的位置
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;

        // 计算鼠标在图像坐标系中的点
        const dx = (mouseX - offsetX) / prevScale;
        const dy = (mouseY - offsetY) / prevScale;

        // 更新缩放值
        scale = Math.min(Math.max(0.1, scale * delta), 10);

        // 缩放后，重新计算偏移量，确保鼠标指针指向图像原点不变
        offsetX = mouseX - dx * scale;
        offsetY = mouseY - dy * scale;

        imgViewerImg.style.transform = `translate(${offsetX}px, ${offsetY}px) scale(${scale})`;
    });

    imgViewerBox.addEventListener('mousedown', (e) => {
        if (e.button === 0) {
            isDragging = true;
            dragStartX = e.clientX - offsetX;
            dragStartY = e.clientY - offsetY;
            imgViewerBox.classList.add('dragging');
            imgViewerImg.style.transition = 'none';
        } else if (e.button === 2) {
            imgMenu.classList.remove("hide");
            imgMenu.style.left = (e.clientX + 5) + "px";
            imgMenu.style.top = (e.clientY + 5) + "px";
        }

    });

    window.addEventListener('mousemove', (e) => {
        if (!isDragging) return;
        offsetX = e.clientX - dragStartX;
        offsetY = e.clientY - dragStartY;
        // console.log("拖拽", offsetX, offsetY)
        imgViewerImg.style.transform = `translate(${offsetX}px, ${offsetY}px) scale(${scale})`;
    });

    window.addEventListener('mouseup', () => {
        isDragging = false;
        imgViewerBox.classList.remove('dragging');
        imgViewerImg.style.transition = 'transform .2s ';
    });

    viwerCloseBtn.addEventListener("click", () => {
        imgViewerBoxBg.classList.add("invisible");
        // imgViewerImg.src = "";
    });

    imgMenu.addEventListener("click", (e) => {
        if (e.target.id === "img-menu-item-copy") {
            // console.log("复制", imgViewerImg.src);
            window.utils.copyScreenshot(imgViewerImg.src);
            imgMenu.classList.add("hide");
        }
    });

    imgViewerBox.addEventListener("click", (e) => {
        imgMenu.classList.add("hide");
    });
}

let imgClones = {};
const cacheOrder = []; // 记录缓存顺序
const maxCacheSize = 25;

async function showImg(src) {
    imgViewerBoxBg.classList.remove("invisible");

    let img = imgClones[src];
    // console.log("showImg", img)
    if (!img) {
        let clone = imgViewerImg.cloneNode(true);
        clone.src = src;
        imgClones[src] = clone;
        img = clone;

        cacheOrder.push(src);
    } else {
        // 访问过，把它排到缓存尾部
        const index = cacheOrder.indexOf(src);
        if (index > -1) {
            cacheOrder.splice(index, 1);
            cacheOrder.push(src);
        }
    }

    // imgViewerImg.src = url;
    imgViewerImg.parentNode.replaceChild(img, imgViewerImg);
    imgViewerImg = img;

    scale = 1;
    offsetX = 0;
    offsetY = 0;
    dragStartX = 0;
    dragStartY = 0;
    imgViewerImg.style.transform = `translate(0px, 0px) scale(1)`;

    // 超出缓存大小，清理最早缓存
    if (cacheOrder.length > maxCacheSize) {
        const oldestSrc = cacheOrder.shift();
        const oldestImg = imgClones[oldestSrc];
        if (oldestImg.parentNode) oldestImg.parentNode.removeChild(oldestImg);
        delete imgClones[oldestSrc];
        console.log("清理缓存", oldestSrc)
    }
}

window.screenshotInit = screenshotInit;