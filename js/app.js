// Main application logic
let scanning = false;
let streamRef = null;

document.addEventListener('DOMContentLoaded', () => {
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

    // Timer logic for training.html
    const timeDisplay = document.getElementById('timeDisplay');
    const timerDisplay = document.getElementById('timerDisplay');
    
    if (timeDisplay) {
        setInterval(() => {
            const now = new Date();
            timeDisplay.innerText = now.toLocaleTimeString('ja-JP', { hour12: false });
            
            const session = JSON.parse(localStorage.getItem('disaster_training_session'));
            if (session) {
                const diffSec = Math.floor((now.getTime() - new Date(session.started_at).getTime()) / 1000);
                const m = Math.floor(diffSec / 60);
                const s = diffSec % 60;
                timerDisplay.innerText = `経過: ${m}分${s}秒`;
                
                if (m >= 30) {
                    showEndScreen();
                }
            }
        }, 1000);
    }

    // Camera and QR Logic
    const video = document.getElementById('video');
    const canvasElement = document.getElementById('canvas');
    const canvas = canvasElement ? canvasElement.getContext('2d', { willReadFrequently: true }) : null;
    const startCameraBtn = document.getElementById('startCameraBtn');

    if (startCameraBtn && video && canvasElement) {
        startCameraBtn.addEventListener('click', () => {
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

    function tick() {
        if (!scanning) return;
        if (video.readyState === video.HAVE_ENOUGH_DATA) {
            canvasElement.hidden = false;
            canvasElement.height = video.videoHeight;
            canvasElement.width = video.videoWidth;
            canvas.drawImage(video, 0, 0, canvasElement.width, canvasElement.height);
            var imageData = canvas.getImageData(0, 0, canvasElement.width, canvasElement.height);
            
            // jsQRを使用してQRコードをデコード
            var code = jsQR(imageData.data, imageData.width, imageData.height, {
                inversionAttempts: "dontInvert",
            });
            
            if (code) {
                scanning = false; // 読み取ったら一旦スキャン停止
                console.log("QRコード検知:", code.data);
                showModal("QRコード検知", "読み取ったコード: " + code.data + "<br>※後続フェーズでdata.csvと照合します。");
                
                // 次のフェーズ(Phase 2)でここにイベント判定処理を入れます
                
                return; // モーダルを閉じるまで再開しない
            }
        }
        requestAnimationFrame(tick);
    }
});

// モーダル表示用関数
function showModal(titleText, bodyHtml) {
    const modal = document.getElementById('modal');
    const title = document.getElementById('modalTitle');
    const body = document.getElementById('modalBody');
    
    title.innerText = titleText;
    body.innerHTML = bodyHtml;
    modal.classList.remove('hidden');
}

// モーダルを閉じてカメラを再開する関数
function closeModal() {
    const modal = document.getElementById('modal');
    modal.classList.add('hidden');
    
    // スキャン再開
    scanning = true;
    requestAnimationFrame(() => {
        // tick関数を再度呼び出すためのハック（スコープ外のためイベント発火で対応）
        const video = document.getElementById('video');
        if (video && video.srcObject) {
            document.dispatchEvent(new Event('resumeScan'));
        }
    });
}

// 再開イベントのリスナー
document.addEventListener('resumeScan', () => {
    const video = document.getElementById('video');
    const canvasElement = document.getElementById('canvas');
    const canvas = canvasElement.getContext('2d');
    
    function resumeTick() {
        if (!scanning) return;
        if (video.readyState === video.HAVE_ENOUGH_DATA) {
            canvas.drawImage(video, 0, 0, canvasElement.width, canvasElement.height);
            var imageData = canvas.getImageData(0, 0, canvasElement.width, canvasElement.height);
            var code = jsQR(imageData.data, imageData.width, imageData.height, { inversionAttempts: "dontInvert" });
            
            if (code) {
                scanning = false;
                showModal("QRコード検知", "読み取ったコード: " + code.data);
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
        streamRef.getTracks().forEach(track => track.stop()); // カメラ停止
    }
    
    title.innerText = '訓練終了';
    title.style.color = 'var(--color-danger)';
    title.style.fontSize = '40pt';
    title.style.textAlign = 'center';
    body.innerHTML = '<p style="text-align:center">30分が経過しました。</p>';
    opts.innerHTML = '';
    modal.classList.remove('hidden');
}
