function $(id) {
    return document.getElementById(id);
}

function bisect(x, A) {
    let l = 0;
    let r = A.length;

    while (l + 1 < r) {
        const m = Math.floor((l + r) / 2);
        if (x < A[m])
            r = m;
        else
            l = m;
    }
    return l;
}

function hermite(x, x0, x1, y0, y1, v0, v1) {
    x = (x - x0) / (x1 - x0);
    v0 *= (x1 - x0);
    v1 *= (x1 - x0);

    const a = 2 * y0 - 2 * y1 + v0 + v1;
    const b = -3 * y0 + 3 * y1 - 2 * v0 - v1;
    const c = v0;
    const d = y0;

    const y = a * x * x * x + b * x * x + c * x + d;

    return y;
}

function spline(x) {
    const i = bisect(x, xs);
    return hermite(x, xs[i], xs[i + 1], ys[i], ys[i + 1], vs[i], vs[i + 1]);
}

function hermite_derivative(x, x0, x1, y0, y1, v0, v1) {
    x = (x - x0) / (x1 - x0);
    v0 *= (x1 - x0);
    v1 *= (x1 - x0);

    const a = 2 * y0 - 2 * y1 + v0 + v1;
    const b = -3 * y0 + 3 * y1 - 2 * v0 - v1;
    const c = v0;
    const d = y0;

    const y = 3 * a * x * x + 2 * b * x + c;

    return y / (x1 - x0);
}

function spline_derivative(x) {
    const i = bisect(x, xs);
    return hermite_derivative(x, xs[i], xs[i + 1], ys[i], ys[i + 1], vs[i], vs[i + 1]);
}

let N = 5;
let xs = [0, 1, 3, 5, 8];
let ys = [10, 20, 30, 0, 10];
let vs = [60, 80, 100, 40, 20];

let videoElement;
function openVideo() {
    const file = $("video_file").files[0];
    if (file) {
        const url = URL.createObjectURL(file);
        videoElement = createVideo([url]);
        videoElement.hide();
        videoElement.loop();
        playing = true;
    }
}

let editing = 0;
let play_start = -100000;

let scaleX = 200;
let scaleY = 3;
let offsetX = 10;
let offsetY = 0;
let areaX = 0;
let areaY = 300;
let areaW = 1200;
let areaH = 300;

function setup() {
    setDirectInput();
    loadStorage();
    windowResized();
}

function windowResized() {
    createCanvas(windowWidth - 30, windowHeight - 30);

    areaW = width;
    areaH = 300;
    areaX = 0;
    areaY = height - areaH - 10;

    setDirectInput();
}

function trans(x, y) {
    return [x * scaleX + offsetX + areaX, -y * scaleY + offsetY + areaY + areaH];
}

function invTrans(x, y) {
    return [(x - offsetX - areaX) / scaleX, (y - offsetY - areaY - areaH) / -scaleY];
}

function drawBackground() {
    //下敷き
    noStroke();
    fill(200, 200, 200);
    rect(areaX, areaY, areaW, areaH);

    noStroke();
    fill(150, 150, 150);
    //0より左側
    if (0 < offsetX)
        rect(areaX, areaY, offsetX, areaH);

    //0より左側
    if (videoElement) {
        const xMax = trans(videoElement.duration(), 0)[0];
        rect(xMax, areaY, areaW - xMax, areaH);
    }
    stroke(0, 0, 0, 80);
    noFill();

    // グリッド縦線
    const xStep = 1;
    for (let x = 0; ; x += xStep) {
        const _x = trans(x, 0)[0];
        if (areaX + areaW < _x) break;
        line(_x, areaY, _x, areaY + areaH);
    }

    // xサブグリッド
    stroke(0, 0, 0, 40);
    const xSubStep = 1 / xGlidDensity();
    if (5 < xSubStep * scaleX) {
        for (let x = 0; ; x += xSubStep) {
            const _x = trans(x, 0)[0];
            if (areaX + areaW < _x) break;
            line(_x, areaY, _x, areaY + areaH);
        }
    }

    // グリッド縦軸数値
    const xlabelStep = 50 < scaleX ? 1 : 10;
    noStroke();
    fill(80);
    for (let x = 0; ; x += xlabelStep) {
        const _x = trans(x, 0)[0];
        if (areaX + areaW < _x) break;
        text(x.toString() + "s", _x, areaY);
    }

    // グリッド横線
    stroke(0, 0, 0, 40);
    const yStep = 100 / yGlidDensity();
    for (let y = ceil(-offsetY / scaleY / yStep) * yStep; ; y += yStep) {
        const _y = trans(0, y)[1];
        if (_y < areaY || areaY + areaH < _y) break;
        line(areaX, _y, areaX + areaW, _y);
    }

    noStroke();
    fill(80);
    const yLabelStep = 20;
    for (let y = ceil(-offsetY / scaleY / yLabelStep) * yLabelStep; ; y += yLabelStep) {
        const _y = trans(0, y)[1];
        if (_y < areaY || areaY + areaH < _y) break;
        text(y.toString() + "%", areaX + areaW - 30, _y);
    }
}

// 曲線を表示
function drawSpline() {
    stroke(0);
    noFill();
    const step = 1 / scaleX;
    for (let x = xs[0]; x < xs[N - 1]; x += step) {
        y = spline(x);
        _y = spline(x + step);
        line(...trans(x, y), ...trans((x + step), _y));
    }
}

// 曲線を表示
function drawAnchors() {
    stroke(255, 0, 0);
    noFill();
    for (let i = 0; i < N; i++) {
        if (i == editing)
            circle(...anchorPos(i), 20);
        circle(...anchorPos(i), 10);
        //circle(...handlePos(i), 10);

        const dx = handlePos(i)[0] - anchorPos(i)[0];
        const dy = handlePos(i)[1] - anchorPos(i)[1];
        line(anchorPos(i)[0] - dx, anchorPos(i)[1] - dy, ...handlePos(i));

        const n = sqrt(dx * dx + dy * dy);
        const ndx = dx / n;
        const ndy = dy / n;

        const rotx1 = ndx * cos(60) - ndy * sin(60);
        const roty1 = ndx * sin(60) + ndy * cos(60);

        const rotx2 = ndx * cos(-60) - ndy * sin(-60);
        const roty2 = ndx * sin(-60) + ndy * cos(-60);


        line(...handlePos(i), handlePos(i)[0] + rotx1 * 15, handlePos(i)[1] + roty1 * 15);
        line(...handlePos(i), handlePos(i)[0] + rotx2 * 15, handlePos(i)[1] + roty2 * 15);
    }
}

// 動画の再生位置にクロスヘアを表示
function drawCrosshair(x) {
    const y = spline(x);
    const [_x, _y] = trans(x, y);

    stroke(0, 0, 255);
    noFill();
    line(_x, areaY, _x, areaY + areaH); // 縦線
    line(areaX, _y, areaX + areaW, _y); // 横線
    circle(_x, _y, 5); //交点に円
}

function drawVideo() {
    const srcH = videoElement.height;
    const srcW = videoElement.width;
    const distH = areaY - 20;
    const distW = srcW * areaY / srcH;
    const distY = 0
    const distX = width - distW;

    image(videoElement, distX, distY, distW, distH);
}

function draw() {
    background(255);

    if (frameCount % 600 == 0) saveStorage();

    if (videoElement)
        drawVideo();

    drawBackground();

    // グリッドを表示
    stroke(0);
    noFill();

    // 曲線を表示
    drawSpline();

    // アンカーを表示
    drawAnchors();

    // 動画の再生位置にクロスヘアを表示
    if (videoElement) drawCrosshair(videoElement.time());

    noStroke();
    fill(0);

    if (playing)
        updateSeekbar();

    // 操作を受け付け
    if (!$("x_snap").checked) {
        if (keyIsDown(65)) {  // A
            xs[editing] -= 0.01;
            setDirectInput();
        }
        if (keyIsDown(68)) { // D
            xs[editing] += 0.01;
            setDirectInput();
        }
    }
    if (!$("y_snap").checked) {
        if (keyIsDown(87)) {  // W
            ys[editing] += 0.5;
            setDirectInput();
        }
        if (keyIsDown(83)) { // S
            ys[editing] -= 0.5;
            setDirectInput();
        }
    }
    if (keyIsDown(81)) { // Q
        vs[editing] -= 0.5;
        setDirectInput();
    }
    if (keyIsDown(69)) { // E
        vs[editing] += 0.5;
        setDirectInput();
    }
    if (keyIsDown(37)) { offsetX -= 5; }
    if (keyIsDown(39)) { offsetX += 5; }

    ///*
    // 頂点との衝突判定
    for (let i = 0; i < N; i++) {
        if (anchorHit(i)) {
            stroke(255, 0, 0);
            fill(255, 0, 0);

            const [x, y] = anchorPos(i);
            circle(x, y, 5);

            noStroke()
            fill(255, 0, 0)
            if (!mouseIsPressed)
                text("ドラッグ　　　：移動 \n ダブルクリック：削除", x, y - 15);
            return;
        }
        if (handleHit(i)) {
            stroke(255, 0, 0);
            fill(255, 0, 0);
            const [x, y] = handlePos(i);
            circle(x, y, 5);

            noStroke()
            fill(255, 0, 0)
            if (!mouseIsPressed)
                text("ドラッグ：回転", x, y - 15);
            return;
        }
    }
    const sprineHitResult = sprineHit();
    if (sprineHitResult !== undefined) {
        stroke(255, 0, 0);
        fill(255, 0, 0);
        const [x, y] = sprineHitResult;

        circle(x, y, 5);

        noStroke()
        fill(255, 0, 0)
        if (!mouseIsPressed)
            text("ダブルクリック：追加", x, y - 15);
        return;
    }//*/
}

let playing = false;
let playStartPos;

function seek(value) {
    if (!videoElement) return;
    videoElement.time(value);
    updateSeekbar();
}

function updateSeekbar() {
    if (!videoElement) return;

    $("seekbar").max = videoElement.duration();
    $("seekbar").value = videoElement.time();
    $("seekbar_label").innerText = round(videoElement.time() / 60).toString().padStart(2, "0") + ":" + round(videoElement.time() % 60).toString().padStart(2, "0");
}

function togglePlay() {
    if (playing) {
        videoElement.pause();
        if ($("pause_restore").checked)
            videoElement.time(playStartPos);
    }
    else {
        videoElement.loop();
        playStartPos = videoElement.time();
    }
    playing = !playing;
    updateSeekbar();
}

// 入力を正規化
function valifyInput() {
    if (editing < 0) editing = 0;
    if (N <= editing) editing = N - 1;

    xs[editing] = constrain(xs[editing], xs[editing - 1] || -Infinity, xs[editing + 1] || Infinity);
    ys[editing] = constrain(ys[editing], 0, 100);

    if ($("x_snap").checked) {
        xs[editing] = round(xs[editing] * xGlidDensity()) / xGlidDensity();
    }

    if ($("y_snap").checked) {
        ys[editing] = round(ys[editing] * yGlidDensity() / 100) / yGlidDensity() * 100;
    }

    xs[0] = 0;
    ys[0] = 0;

    xs[editing] = round(xs[editing] * 100) / 100;
    ys[editing] = round(ys[editing] * 100) / 100;
    vs[editing] = round(vs[editing] * 100) / 100;
}


function addAnchor() {
    const x = (editing + 1 < N) ? (xs[editing] + xs[editing + 1]) / 2 : xs[editing] + 1;
    addAnchorAt(x);
}

function addAnchorAt(x) {
    stock();

    const i = bisect(x, xs) + 1;
    const y = spline(x);
    const v = spline_derivative(x);

    xs.splice(i, 0, x);
    ys.splice(i, 0, y);
    vs.splice(i, 0, v);

    N += 1;
    editing = i;

    setDirectInput();
}

function deleteAnchor(i) {
    stock();

    if (i == 0) {
        alert("最初のアンカーは削除できません");
        return;
    }

    xs.splice(i, 1);
    ys.splice(i, 1);
    vs.splice(i, 1);

    N -= 1;
    editing = i - 1;

    setDirectInput();
}

function deleteEditing() {
    deleteAnchor(editing);
}

function setDirectInput() {
    valifyInput();

    $("direct_input_x").value = xs[editing];
    $("direct_input_y").value = ys[editing];
    $("direct_input_v").value = vs[editing];
    $("index_label").innerText = `${editing + 1} / ${N}`
}

function getDirectInput() {
    xs[editing] = $("direct_input_x").value;
    ys[editing] = $("direct_input_y").value;
    vs[editing] = $("direct_input_v").value;

    valifyInput();

    setDirectInput();
}

function xGlidDensity() {
    const value = $("x_glid_density").value;
    if (value == 0) return 1;
    return value;
}

function yGlidDensity() {
    const value = $("y_glid_density").value;
    if (value == 0) return 1;
    return value;
}

window.onkeydown = function (e) {
    console.log(e.key);
    if (e.key == " ")
        togglePlay();

    if (e.key == "o") {
        editing--;
        setDirectInput();
    }
    if (e.key == "p") {
        editing++;
        setDirectInput();
    }
    if (e.key == "Enter") {
        addAnchor();
        stock();
    }
    if (e.key == "Delete" || e.key == "Backspace") {
        deleteAnchor(editing);
        stock();
    }
    if (e.key == "a") {  // A
        stock();
        if ($("x_snap").checked) xs[editing] -= 1 / xGlidDensity();
        setDirectInput();
    }
    if (e.key == "d") { // D
        stock();
        if ($("x_snap").checked) xs[editing] += 1 / xGlidDensity();
        setDirectInput();
    }
    if (e.key == "w") {  // w
        stock();
        if ($("y_snap").checked) ys[editing] += 100 / yGlidDensity();
        setDirectInput();
    }
    if (e.key == "s") { // s
        stock();
        if ($("y_snap").checked) ys[editing] -= 100 / yGlidDensity();
        setDirectInput();
    }
    if (e.key == "z" && e.getModifierState("Control")) {
        undo();
    }
    if (e.key == "Z" && e.getModifierState("Control")) {
        redo();
    }
    if (e.key == "y" && e.getModifierState("Control")) {
        redo();
    }

    if (key == "ArrowUp") {
        const centerX = (-offsetX + areaW / 2) / scaleX;
        scaleX *= 1.1;
        if (scaleX < 0.1) scaleX = 0.1;
        offsetX = -centerX * scaleX + areaW / 2;
    }
    if (key == "ArrowDown") {
        const centerX = (-offsetX + areaW / 2) / scaleX;
        scaleX /= 1.1;
        if (scaleX < 0.1) scaleX = 0.1;
        offsetX = -centerX * scaleX + areaW / 2;
    }
}


const HANDLE_LENGTH = 40;
const CLICK_RANGE = 10;

function anchorPos(i) {
    return trans(xs[i], ys[i]);
}

function handlePos(i) {
    let h = HANDLE_LENGTH / scaleX;
    return trans(xs[i] + h, ys[i] + h * vs[i]);
}

let holdingIndex = -1;
let holdingType = -1; //0:Anchor　1:Handle
let dragging = false;

function circleMouseHit(x, y) {
    dx = x - mouseX;
    dy = y - mouseY;
    return dx * dx + dy * dy < CLICK_RANGE * CLICK_RANGE;
}

function anchorHit(i) {
    const [x, y] = anchorPos(i);
    return circleMouseHit(x, y);
}

function handleHit(i) {
    const [x, y] = handlePos(i);
    return circleMouseHit(x, y);
}

function sprineHit() {
    for (let _x = mouseX - CLICK_RANGE; _x < mouseX + CLICK_RANGE; _x += 1) {
        const x = invTrans(_x, 0)[0];
        const y = spline(x);
        if (circleMouseHit(...trans(x, y))) return trans(x, y);
    }
}

function mousePressed() {
    // 左クリックされたら、近くの頂点を移動対象に
    for (i = 0; i < N; i++) {
        if (anchorHit(i)) {
            stock();
            holdingIndex = i;
            editing = i;
            holdingType = 0;
            return;
        }
        if (handleHit(i)) {
            stock();
            holdingIndex = i;
            editing = i;
            holdingType = 1;
            return;
        }
    }

    if (areaX <= mouseX && mouseX < areaX + areaW && areaY < mouseY && mouseY < areaY + areaH)
        dragging = true;
}

function mouseDragged() {
    if (holdingType == 0) {
        [xs[holdingIndex], ys[holdingIndex]] = invTrans(mouseX, mouseY);
    }
    else if (holdingType == 1) {
        const [_mouseX, _mouseY] = invTrans(mouseX, mouseY);
        const dx = _mouseX - xs[holdingIndex];
        const dy = _mouseY - ys[holdingIndex];
        if (0 < dx) {
            v = dy / dx;
            vs[holdingIndex] = v;
        }
    }
    else if (dragging) {
        const dx = mouseX - pmouseX;
        offsetX += dx;
    }
    valifyInput();
}

function mouseReleased() {
    holdingIndex = -1;
    holdingType = -1;
    dragged = false;
}

function doubleClicked() {
    //　近くの頂点を削除
    for (i = 0; i < N; i++) {
        if (anchorHit(i))
            deleteAnchor(i);
    }
    //曲線をクリックしたら追加
    const sprineHitResult = sprineHit();
    if (sprineHitResult !== undefined) {
        const [_x, _y] = sprineHitResult;
        const [x, y] = invTrans(_x, _y);
        addAnchorAt(x);
    }
}

$("seekbar").addEventListener("change", (e) => seek(e.target.value));

function saveJsonFile() {
    // 保存するデータ（例として、JavaScriptオブジェクト）
    const jsonString = JSON.stringify({ N, xs, ys, vs });

    // Blobを使ってJSONファイルを生成
    const blob = new Blob([jsonString], { type: "application/json" });

    // 日付をファイル名に
    const dateString = new Date().toLocaleDateString("ja-JP", { year: "numeric", month: "2-digit", day: "2-digit" }).replaceAll('/', '-');

    // aタグを生成してダウンロードリンクを作成
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = "curvedata" + dateString + ".json";  // ファイル名

    // ダウンロードを開始
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    saved = true;
}

function loadJsonFile() {
    console.log("startLoad");
    const fileInput = document.createElement("input");
    fileInput.type = "file";
    fileInput.accept = ".json";

    fileInput.onchange = () => {
        console.log("file changed");
        const file = fileInput.files[0];  // ユーザーが選択したファイル
        const reader = new FileReader();  // FileReaderを使ってファイルを読み込む
        reader.onload = (e) => {
            const jsonString = e.target.result;  // 読み込まれたファイルの内容（文字列）
            try {
                const jsonData = JSON.parse(jsonString);  // JSONをパース

                if (!jsonData.N || !jsonData.xs || !jsonData.ys || !jsonData.vs)
                    throw 0;

                N = jsonData.N;
                xs = jsonData.xs;
                ys = jsonData.ys;
                vs = jsonData.vs;
            } catch (err) {
                console.error("Invalid JSON file", err);
                alert("ファイルが破損しています…");
            }
        };
        reader.readAsText(file);  // ファイルの内容をテキストとして読み込む
    };

    document.body.appendChild(fileInput);
    fileInput.click();
    document.body.removeChild(fileInput);
}

function saveStorage() {
    settings = {
        pauseRestore: $("pause_restore").checked,
        xSnap: $("x_snap").checked,
        ySnap: $("y_snap").checked,
        xGlidDensity: $("x_glid_density").value,
        yGlidDensity: $("y_glid_density").value,
    }
    // 保存するデータ（例として、JavaScriptオブジェクト）
    const jsonString = JSON.stringify({ N, xs, ys, vs, settings });

    localStorage.setItem("hermite_editor", jsonString);
}

function loadStorage() {
    const jsonString = localStorage.getItem("hermite_editor");

    if (!jsonString) return;

    try {
        const jsonData = JSON.parse(jsonString);

        if (Object.hasOwn(jsonData, "N")) N = jsonData.N;
        if (Object.hasOwn(jsonData, "xs")) xs = jsonData.xs;
        if (Object.hasOwn(jsonData, "ys")) ys = jsonData.ys;
        if (Object.hasOwn(jsonData, "vs")) vs = jsonData.vs;

        if (Object.hasOwn(jsonData, "settings")) {
            if (Object.hasOwn(jsonData.settings, "pauseRestore")) $("pause_restore").checked = jsonData.settings.pauseRestore;
            if (Object.hasOwn(jsonData.settings, "xSnap")) $("x_snap").checked = jsonData.settings.xSnap;
            if (Object.hasOwn(jsonData.settings, "ySnap")) $("y_snap").checked = jsonData.settings.ySnap;
            if (Object.hasOwn(jsonData.settings, "xGlidDensity")) $("x_glid_density").value = jsonData.settings.xGlidDensity;
            if (Object.hasOwn(jsonData.settings, "yGlidDensity")) $("y_glid_density").value = jsonData.settings.yGlidDensity;
        }
    } catch { }
}


const undoBuffer = [];
const redoBuffer = [];
let saved;

function deepcopy(object) {
    return JSON.parse(JSON.stringify(object));
}

// 任意の操作ステップの前に一回だけ呼び出す
function stock() {
    saved = false;
    // 状態をundoBufferにストック
    undoBuffer.push(deepcopy({ N, xs, ys, vs }));
    // 一定数以上はストックしない
    while (100 < undoBuffer.length) undoBuffer.shift();
    // 何か操作したらredoを削除
    redoBuffer.length = 0;

    console.log("stock", undoBuffer, redoBuffer);
}

function undo() {
    const data = undoBuffer.pop();
    if (!data) return;

    redoBuffer.push(deepcopy({ N, xs, ys, vs }));
    // 一定数以上はストックしない
    while (100 < redoBuffer.length) redoBuffer.shift();

    console.log("undo", undoBuffer, redoBuffer);
    N = data.N;
    xs = data.xs;
    ys = data.ys;
    vs = data.vs;

    setDirectInput();
}

function redo() {
    const data = redoBuffer.pop();
    if (!data) return;

    //undoに移す
    undoBuffer.push(deepcopy({ N, xs, ys, vs }));
    // 一定数以上はストックしない
    while (100 < undoBuffer.length) undoBuffer.shift();

    console.log("redo", undoBuffer, redoBuffer);
    N = data.N;
    xs = data.xs;
    ys = data.ys;
    vs = data.vs;

    setDirectInput();
}

window.onbeforeunload = function (e) {
    saveStorage();
    if (!saved) {
        e.preventDefault();
        return "ブラウザを閉じても良いでしょうか？";
    }
}