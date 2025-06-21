let screenshotBtn;
let screenshotFiles;
let screenshotBox;
let screenshotContent;
let pagesBox;

let screenshotBoxOpen = false;
let screenshotItemCount = 0;
let screenshotPageCount = 0;

let pagesInited = false;

let renderedItems = [];

let pagesItems = [];

let frontBtn;
let lastBtn;
let nextBtn;
let endBtn;

const screenshotInit = () => {
    console.log("Screenshot init");

    screenshotBtn = document.getElementById("screenshot-btn");
    screenshotBox = document.getElementById("screenshot-box");
    screenshotContent = document.getElementById("screenshot-content");
    pagesBox = document.getElementById("pages-box");

    screenshotBtn.addEventListener("click", async () => {
        screenshotFiles = await window.utils.getScreenshotFiles();

        screenshotBoxOpen = !screenshotBoxOpen;
        showScreenshot(screenshotBoxOpen);
        generateScreenshot();

        !pagesInited && (pagesInited = true) && showPages();
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

    open ? screenshotBox.style.pointerEvents = "auto" : screenshotBox.style.pointerEvents = "none";

    screenshotBox.style.transition = 'none';
    screenshotBox.style.setProperty("--cx", `${x}px`)
    screenshotBox.style.setProperty("--cy", `${y}px`)

    //强制刷新一帧
    screenshotBox.offsetWidth;

    screenshotBox.style.transition = 'clip-path .6s ease-out';
    screenshotBox.style.setProperty("--ratio", open ? "150%" : "0%")

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
    console.log("repeatX", repeatX, repeatY, onePageTotal, width, imgWidth + offsetX);

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

function renderScreenshot(data) {

    for (let i = 0; i < data.length; i++) {
        const screenshot = renderedItems[i];
        screenshot.src = data[i];

        screenshot.classList.remove("hide");
    }

    if (data.length < renderedItems.length) {
        for (let i = data.length; i < renderedItems.length; i++) {
            const screenshot = renderedItems[i];
            screenshot.classList.add("hide");
        }
    }
}

function showPages() {

    //创建按钮
    frontBtn = document.createElement("button");
    frontBtn.innerText = "<<";
    // frontBtn.classList.add("btn");

    lastBtn = document.createElement("button");
    lastBtn.innerText = "<";
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
    nextBtn.innerText = ">";
    // nextBtn.classList.add("btn");

    endBtn = document.createElement("button");
    endBtn.innerText = ">>";
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
}

function updatePages() {
    let totalPage = Math.floor(screenshotFiles.length / screenshotItemCount);
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

window.screenshotInit = screenshotInit;