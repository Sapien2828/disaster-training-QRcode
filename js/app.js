// Main application logic
let scanning = false;
let streamRef = null;
let masterData = []; // CSVから読み込んだデータを保持
let currentEventRecord = null; // 現在表示中のEVENTレコード

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
    // カメラ起動ロジック
    // -----------------------------------------
    const video = document.getElementById('video');
    const canvasElement = document.getElementById('canvas');
    const canvas = canvasElement ? canvasElement.getContext('2d', { willReadFrequently: true }) : null;
    const startCameraBtn = document.getElementById('startCameraBtn');

    if (startCameraBtn && video && canvasElement) {
        startCameraBtn.addEventListener('click', () => {
            if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
                alert("【エラー】カメラにアクセスできません。URLが「https://」で始まっているか確認してください。");
                return;
            }

            navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } }).then(function(stream) {
                streamRef = stream;
                video.srcObject = stream;
                video.setAttribute("playsinline", true);
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
    // 手動入力ロジックの追加
    // -----------------------------------------
    const manualCodeInput = document.getElementById('manualCodeInput');
    const manualCodeSubmitBtn = document.getElementById('manualCodeSubmitBtn');

    if (manualCodeSubmitBtn && manualCodeInput) {
        manualCodeSubmitBtn.addEventListener('click', () => {
            const code = manualCodeInput.value.trim();
            if (code === "") {
                alert("番号を入力してください。");
                return;
            }
            
            scanning = false; // カメラ走査を一時停止
            handleQRCodeScan(code);
            manualCodeInput.value = ""; // 入力欄をクリア
            manualCodeInput.blur(); // キーボードを閉じる
        });
        
        manualCodeInput.addEventListener('keypress', function (e) {
            if (e.key === 'Enter') {
                manualCodeSubmitBtn.click();
            }
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
        const formattedCode = scannedCode.trim().padStart(4, '0');
        
        const matchedRecord = masterData.find(row => 
            row.card_no === formattedCode && 
            row.difficulty === session.difficulty &&
            row.active === 'TRUE'
        );

        if (matchedRecord) {
            if (matchedRecord.record_type === 'EVENT') {
                showEventModal(matchedRecord);
            } else if (matchedRecord.record_type === 'ITEM') {
                showItemCheckModal(matchedRecord, 'ITEM');
            } else if (matchedRecord.record_type === 'CHECK') {
                showItemCheckModal(matchedRecord, 'CHECK');
            } else {
                showModal("エラー", "不正なレコードタイプです。");
            }
        } else {
            showModal("未登録コード", `コード（${formattedCode}）は現在の難易度（${session.difficulty}）に存在しません。`);
        }
    }

    // -----------------------------------------
    // EVENT表示と回答処理
    // -----------------------------------------
    function showEventModal(record) {
        currentEventRecord = record;
        
        const titleText = `【EVENT】${record.location_name}`;
        const bodyHtml = `
            <div style="text-align: center; margin-bottom: 10px;">
                <p style="color:var(--color-danger); font-weight:bold; font-size: 1.2em;">${record.event_name}</p>
            </div>
            <p>${record.event_body}</p>
            <p style="font-size: 0.8em; color: var(--color-text-muted);">※選択肢を選んでください。</p>
        `;
        
        const optsContainer = document.getElementById('modalOptions');
        optsContainer.innerHTML = ''; 
        
        const options = [
            { text: record.option_a_name, score: record.option_a_score, outcome: record.option_a_outcome },
            { text: record.option_b_name, score: record.option_b_score, outcome: record.option_b_outcome },
            { text: record.option_c_name, score: record.option_c_score, outcome: record.option_c_outcome }
        ];

        options.forEach((opt, index) => {
            if (opt.text && opt.text.trim() !== '') {
                const btn = document.createElement('button');
                btn.className = 'btn-primary';
                btn.innerText = opt.text;
                btn.onclick = () => handleEventAnswer(index + 1, opt);
                optsContainer.appendChild(btn);
            }
        });

        if (record.option_d_name && record.option_d_name.trim() !== '') {
            const btnD = document.createElement('button');
            btnD.className = 'btn-primary';
            btnD.style.backgroundColor = 'var(--color-surface-raised)'; 
            btnD.innerText = record.option_d_name;
            btnD.onclick = () => handleEventAnswer(4, { text: record.option_d_name, score: record.option_d_score, outcome: record.option_d_outcome });
            optsContainer.appendChild(btnD);
        }

        // 間違えたとき用のキャンセル
        const cancelBtn = document.createElement('button');
        cancelBtn.className = 'btn-primary';
        cancelBtn.style.backgroundColor = 'transparent';
        cancelBtn.style.border = '1px solid var(--color-border)';
        cancelBtn.style.color = 'var(--color-text-muted)';
        cancelBtn.innerText = 'キャンセル (カメラへ戻る)';
        cancelBtn.onclick = closeModal;
        optsContainer.appendChild(cancelBtn);

        showModal(titleText, bodyHtml);
    }

    window.handleEventAnswer = function(optionIndex, optionData) {
        const record = currentEventRecord;
        const session = JSON.parse(localStorage.getItem('disaster_training_session'));
        
        const resultBody = `
            <p style="font-weight:bold; color:var(--color-primary);">選択: ${optionData.text}</p>
            <div style="background:var(--color-surface-raised); padding:10px; margin-top:10px; border-radius:5px;">
                <p><strong>【結果】</strong><br>${optionData.outcome}</p>
            </div>
        `;
        
        const logData = {
            ...record,
            session_id: session.session_id,
            participant_id: session.participant_id,
            timestamp: new Date().toISOString(),
            selected_option: optionData.text,
            option_score: optionData.score
        };
        
        if (typeof sendLog === 'function') sendLog(logData);
        addLogToScreen(logData);

        const optsContainer = document.getElementById('modalOptions');
        optsContainer.innerHTML = '';
        const closeBtn = document.createElement('button');
        closeBtn.className = 'btn-primary';
        closeBtn.innerText = 'OK (カメラへ戻る)';
        closeBtn.onclick = closeModal;
        optsContainer.appendChild(closeBtn);

        document.getElementById('modalTitle').innerText = 'アクション結果';
        document.getElementById('modalBody').innerHTML = resultBody;
    };

    // -----------------------------------------
    // ITEM / CHECK 表示処理
    // -----------------------------------------
    function showItemCheckModal(record, type) {
        const session = JSON.parse(localStorage.getItem('disaster_training_session'));
        const isItem = type === 'ITEM';
        const titleText = isItem ? `【ITEM発見】` : `【CHECK完了】`;
        const itemName = isItem ? record.item_name : record.check_name;
        
        const bodyHtml = `
            <div style="text-align: center; margin: 20px 0;">
                <p style="font-size: 1.5em; font-weight: bold; color: var(--color-success);">${itemName}</p>
                <p>場所: ${record.location_name}</p>
            </div>
        `;

        const logData = {
            ...record,
            session_id: session.session_id,
            participant_id: session.participant_id,
            timestamp: new Date().toISOString()
        };

        if (typeof sendLog === 'function') sendLog(logData);
        addLogToScreen(logData);

        const optsContainer = document.getElementById('modalOptions');
        optsContainer.innerHTML = '';
        const closeBtn = document.createElement('button');
        closeBtn.className = 'btn-primary';
        closeBtn.innerText = 'OK (カメラへ戻る)';
        closeBtn.onclick = closeModal;
        optsContainer.appendChild(closeBtn);

        showModal(titleText, bodyHtml);
    }
});

function addLogToScreen(record) {
    const activityLog = document.getElementById('activityLog');
    const foundItems = document.getElementById('foundItems');
    const timeStr = new Date().toLocaleTimeString('ja-JP', { hour12: false });
    
    if (activityLog) {
        const li = document.createElement('li');
        let name = "";
        if(record.record_type === 'EVENT') name = `${record.event_name} (${record.selected_option})`;
        else if(record.record_type === 'ITEM') name = record.item_name;
        else if(record.record_type === 'CHECK') name = record.check_name;
        
        li.innerHTML = `<span>[${timeStr}]</span> <span style="color:var(--color-primary)">${record.record_type}</span>: ${name}`;
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

window.closeModal = function() {
    const modal = document.getElementById('modal');
    if(modal) modal.classList.add('hidden');
    
    scanning = true;
    requestAnimationFrame(() => {
        const video = document.getElementById('video');
        if (video && video.srcObject) {
            document.dispatchEvent(new Event('resumeScan'));
        }
    });
};

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
                const formatted = code.data.trim().padStart(4, '0');
                const session = JSON.parse(localStorage.getItem('disaster_training_session'));
                const matchedRecord = masterData.find(row => row.card_no === formatted && row.difficulty === session.difficulty);
                
                if (matchedRecord) {
                    if (matchedRecord.record_type === 'EVENT') window.showEventModal(matchedRecord);
                    else window.showItemCheckModal(matchedRecord, matchedRecord.record_type);
                } else {
                    const optsContainer = document.getElementById('modalOptions');
                    optsContainer.innerHTML = '';
                    const closeBtn = document.createElement('button');
                    closeBtn.className = 'btn-primary';
                    closeBtn.innerText = '閉じる';
                    closeBtn.onclick = window.closeModal;
                    optsContainer.appendChild(closeBtn);

                    window.showModal("未登録コード", `コード（${formatted}）は見つかりません。`);
                }
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
    if (streamRef) streamRef.getTracks().forEach(track => track.stop());
    
    title.innerText = '訓練終了';
    title.style.color = 'var(--color-danger)';
    title.style.fontSize = '40pt';
    title.style.textAlign = 'center';
    body.innerHTML = '<p style="text-align:center">30分が経過しました。</p>';
    opts.innerHTML = '';
    modal.classList.remove('hidden');
}
