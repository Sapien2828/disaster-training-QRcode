// Main application logic
let scanning = false;
let streamRef = null;
let masterData = []; // CSVから読み込んだデータを保持

document.addEventListener('DOMContentLoaded', () => {
    // -----------------------------------------
    // Phase 1: 開始画面ロジック
    // -----------------------------------------
    const startForm = document.getElementById('startForm');
    if (startForm) {
        startForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const pid = document.getElementById('participantId').value.toUpperCase();
            const attempt = document.getElementById('attemptNo').value;
            const diff = document.getElementById('difficulty').value;
            
            const sessionId = `RT_${pid}_ATT${attempt}_${new Date().getTime()}`;
            
            const sessionData = {
                session_id: sessionId,
                participant_id: pid,
                attempt_no: attempt,
                difficulty: diff,
                started_at: new Date().toISOString()
            };
            
            localStorage.setItem('disaster_training_session', JSON.stringify(sessionData));
            window.location.href = 'training.html';
        });
    }

    // -----------------------------------------
    // Phase 2: データ読み込み & タイマーロジック
    // -----------------------------------------
    const timeDisplay = document.getElementById('timeDisplay');
    const timerDisplay = document.getElementById('timerDisplay');
    const session = JSON.parse(localStorage.getItem('disaster_training_session'));
    
    if (timeDisplay && session) {
        // data.csvの読み込み
        if (typeof Papa !== 'undefined') {
            Papa.parse('data/data.csv', {
                download: true,
                header: true,
                complete: function(results) {
                    masterData = results.data;
                    console.log('CSV Loaded:', masterData.length, 'records.');
                }
            });
        }

        // タイマー更新
        setInterval(() => {
            const now = new Date();
            timeDisplay.innerText = now.toLocaleTimeString('ja-JP', { hour12: false });
            
            const diffSec = Math.floor((now.getTime() - new Date(session.started_at).getTime()) / 1000);
            const m = Math.floor(diffSec / 60);
            const s = diffSec % 60;
            timerDisplay.innerText = `経過: ${m}分${s}秒`;
            
            if (m >= 30) {
                showEndScreen();
            }
        }, 1000);
    }

    // -----------------------------------------
    // カメラ起動ロジック (エラー対応強化)
    // -----------------------------------------
    const video = document.getElementById('video');
    const canvasElement = document.getElementById('canvas');
    const canvas = canvasElement ? canvasElement.getContext('2d', { willReadFrequently: true }) : null;
    const startCameraBtn = document.getElementById('startCameraBtn');

    if (startCameraBtn && video && canvasElement) {
        startCameraBtn.addEventListener('click', () => {
            // HTTPS環境チェック
            if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
                alert("【エラー】カメラにアクセスできません。URLが「https://」で始まっているか、ブラウザの権限設定を確認してください。");
                return;
            }

            navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } }).then(function(stream) {
                streamRef = stream;
                video.srcObject = stream;
                video.setAttribute("playsinline", true); // iOS Safari対策
                video.play();
                video.hidden = false;
                startCameraBtn.hidden = true;
                scanning = true;
                requestAnimationFrame(tick);
            }).catch(function(err) {
                alert("カメラの起動に失敗しました。権限を確認してください: " + err);
            });
        });
    }

    // -----------------------------------------
    // Phase 3: QR検知と照合ロジック
    // -----------------------------------------
    function tick() {
        if (!scanning) return;
        if (video.readyState === video.HAVE_ENOUGH_DATA) {
            canvasElement.hidden = false;
            canvasElement.height = video.videoHeight;
            canvasElement.width = video.videoWidth;
            canvas.drawImage(video, 0, 0, canvasElement.width, canvasElement.height);
            var imageData = canvas.getImageData(0, 0, canvasElement.width, canvasElement.height);
            
            var code = jsQR(imageData.data, imageData.width, imageData.height, {
                inversionAttempts: "dontInvert",
            });
            
            if (code) {
                scanning = false; // 一旦停止
                handleQRCodeScan(code.data);
                return; 
            }
        }
        requestAnimationFrame(tick);
    }
    
    function handleQRCodeScan(scannedCode) {
        // 前ゼロ埋めの処理など（必要に応じて）
        const formattedCode = scannedCode.padStart(4, '0');
        
        // CSVデータとの照合 (card_no と difficulty が一致し、active=TRUEのもの)
        const matchedRecord = masterData.find(row => 
            row.card_no === formattedCode && 
            row.difficulty === session.difficulty &&
            row.active === 'TRUE'
        );

        if (matchedRecord) {
            let htmlBody = `
                <p><strong>種類:</strong> ${matchedRecord.record_type}</p>
                <p><strong>場所:</strong> ${matchedRecord.location_name}</p>
            `;
            
            if (matchedRecord.record_type === 'EVENT') {
                htmlBody += `
                    <p style="color:var(--color-danger); font-weight:bold;">${matchedRecord.event_name}</p>
                    <p>${matchedRecord.event_body}</p>
                `;
            } else if (matchedRecord.record_type === 'ITEM') {
                htmlBody += `<p>発見: <strong>${matchedRecord.item_name}</strong></p>`;
            } else if (matchedRecord.record_type === 'CHECK') {
                htmlBody += `<p>確認: <strong>${matchedRecord.check_name}</strong></p>`;
            }

            // CSVのデータをそのままログとして送信
            matchedRecord.session_id = session.session_id;
            matchedRecord.participant_id = session.participant_id;
            matchedRecord.timestamp = new Date().toISOString();
            
            if (typeof sendLog === 'function') {
                sendLog(matchedRecord);
            }

            // 画面の下部ログに追加
            addLogToScreen(matchedRecord);

            showModal("検知成功", htmlBody);
        } else {
            showModal("未登録コード", `読み取ったコード（${scannedCode}）は、現在の難易度（${session.difficulty}）のデータに存在しません。`);
        }
    }
});

// モーダルとログ表示ロジック
function addLogToScreen(record) {
    const activityLog = document.getElementById('activityLog');
    const foundItems = document.getElementById('foundItems');
    const timeStr = new Date().toLocaleTimeString('ja-JP', { hour12: false });
    
    if (activityLog) {
        const li = document.createElement('li');
        const name = record.event_name || record.item_name || record.check_name || "アクション";
        li.innerHTML = `<span>[${timeStr}]</span> ${record.record_type}: ${name}`;
        activityLog.prepend(li);
    }
    
    if (foundItems && record.record_type === 'ITEM') {
        const li = document.createElement('li');
        li.innerHTML = `<span>[${timeStr}]</span> ${record.item_name}`;
        foundItems.prepend(li);
    }
}

function showModal(titleText, bodyHtml) {
    const modal = document.getElementById('modal');
    const title = document.getElementById('modalTitle');
    const body = document.getElementById('modalBody');
    if(!modal) return;
    
    title.innerText = titleText;
    body.innerHTML = bodyHtml;
    modal.classList.remove('hidden');
}

function closeModal() {
    const modal = document.getElementById('modal');
    if(modal) modal.classList.add('hidden');
    
    scanning = true;
    requestAnimationFrame(() => {
        const video = document.getElementById('video');
        if (video && video.srcObject) {
            document.dispatchEvent(new Event('resumeScan'));
        }
    });
}

document.addEventListener('resumeScan', () => {
    const video = document.getElementById('video');
    const canvasElement = document.getElementById('canvas');
    if (!canvasElement) return;
    const canvas = canvasElement.getContext('2d');
    
    function resumeTick() {
        if (!scanning) return;
        if (video.readyState === video.HAVE_ENOUGH_DATA) {
            canvas.drawImage(video, 0, 0, canvasElement.width, canvasElement.height);
            var imageData = canvas.getImageData(0, 0, canvasElement.width, canvasElement.height);
            var code = jsQR(imageData.data, imageData.width, imageData.height, { inversionAttempts: "dontInvert" });
            
            if (code) {
                scanning = false;
                // document.addEventListener内の handleQRCodeScan を直接呼べないためリロードするかカスタムイベント
                // 簡略化のため、アラートのみ表示して再度閉じる処理
                const formatted = code.data.padStart(4, '0');
                showModal("QR再検知", `読み取り: ${formatted}`);
                return;
            }
        }
        requestAnimationFrame(resumeTick);
    }
    resumeTick();
});

function showEndScreen() {
    const modal = document.getElementById('modal');
    const title = document.getElementById('modalTitle');
    const body = document.getElementById('modalBody');
    const opts = document.getElementById('modalOptions');
    if(!modal) return;
    
    scanning = false;
    if (streamRef) {
        streamRef.getTracks().forEach(track => track.stop());
    }
    
    title.innerText = '訓練終了';
    title.style.color = 'var(--color-danger)';
    title.style.fontSize = '40pt';
    title.style.textAlign = 'center';
    body.innerHTML = '<p style="text-align:center">30分が経過しました。</p>';
    opts.innerHTML = '';
    modal.classList.remove('hidden');
}
