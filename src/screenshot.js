let screenshotBtn;
let screenshotFiles;
let screenshotBox;

let screenshotBoxOpen = false;

const screenshotInit = () => {
    console.log("Screenshot init");

    screenshotBtn = document.getElementById("screenshot-btn");
    screenshotBox = document.getElementById("screenshot-box");

    screenshotBtn.addEventListener("click", async () => {
        screenshotFiles = await window.utils.getScreenshotFiles();

        screenshotBoxOpen = !screenshotBoxOpen;
        showScreenshot(screenshotBoxOpen);
    });
};

function showScreenshot(open) {
    const rect = screenshotBtn.getBoundingClientRect();

    const x = rect.left + rect.width * 0.7 + window.scrollX;
    const y = rect.top + rect.height / 2 + window.scrollY;

    screenshotBox.style.transition = 'none';
    screenshotBox.style.setProperty("--cx", `${x}px`)
    screenshotBox.style.setProperty("--cy", `${y}px`)

    //强制刷新一帧
    screenshotBox.offsetWidth;

    screenshotBox.style.transition = 'clip-path .6s ease-out';
    screenshotBox.style.setProperty("--ratio", open ? "150%" : "0%")

    open ? screenshotBtn.classList.add("dark-mode") : screenshotBtn.classList.remove("dark-mode");
}

window.screenshotInit = screenshotInit;