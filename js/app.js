// Main application logic
let scanning = false;
let streamRef = null;
let masterData = []; 
let currentEventRecord = null; 
let visitedPoints = []; 

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
            
            if (m >= 30 && document.getElementById('modalTitle') && document.getElementById('modalTitle').innerText !== '訓練終了') {
                window.showEndScreen();
            }
        }, 1000);
    }

    const video = document.getElementById('video');
    const canvasElement = document.getElementById('canvas');
    const canvas = canvasElement ? canvasElement.getContext('2d', { willReadFrequently: true }) : null;
    const startCameraBtn = document.getElementById('startCameraBtn');
    const restartCameraBtn = document.getElementById('restartCameraBtn');

    function startCamera() {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            alert("【エラー】カメラにアクセスできません。URLが「https://」で始まっているか確認してください。");
            return;
        }

        if (streamRef) {
            streamRef.getTracks().forEach(track => track.stop());
        }

        navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } }).then(function(stream) {
            streamRef = stream;
            video.srcObject = stream;
            video.setAttribute("playsinline", true);
            video.play();
            video.hidden = false;
            
            if(startCameraBtn) startCameraBtn.style.display = 'none';
            if(restartCameraBtn) restartCameraBtn.style.display = 'block';
            
            scanning = true;
            requestAnimationFrame(window.tick);
        }).catch(function(err) {
            alert("カメラの起動に失敗しました。ブラウザのタブを一度閉じて開き直すか、権限設定を確認してください。\nエラー詳細: " + err);
        });
    }

    if (startCameraBtn) startCameraBtn.addEventListener('click', startCamera);
    if (restartCameraBtn) restartCameraBtn.addEventListener('click', startCamera);

    window.addEventListener('beforeunload', () => {
        if (streamRef) {
            streamRef.getTracks().forEach(track => track.stop());
        }
    });

    const manualCodeInput = document.getElementById('manualCodeInput');
    const manualCodeSubmitBtn = document.getElementById('manualCodeSubmitBtn');

    if (manualCodeSubmitBtn && manualCodeInput) {
        manualCodeSubmitBtn.addEventListener('click', () => {
            const code = manualCodeInput.value.trim();
            if (code === "") {
                alert("番号を入力してください。");
                return;
            }
            
            scanning = false; 
            handleQRCodeScan(code);
            manualCodeInput.value = ""; 
            manualCodeInput.blur(); 
        });
        
        manualCodeInput.addEventListener('keypress', function (e) {
            if (e.key === 'Enter') {
                manualCodeSubmitBtn.click();
            }
        });
    }

    window.tick = function() {
        if (!scanning) return;
        if (video && video.readyState === video.HAVE_ENOUGH_DATA) {
            canvasElement.hidden = false;
            canvasElement.height = video.videoHeight;
            canvasElement.width = video.videoWidth;
            canvas.drawImage(video, 0, 0, canvasElement.width, canvasElement.height);
            var imageData = canvas.getImageData(0, 0, canvasElement.width, canvasElement.height);
            
            var code = jsQR(imageData.data, imageData.width, imageData.height, {
                inversionAttempts: "dontInvert",
            });
            
            if (code) {
                scanning = false; 
                handleQRCodeScan(code.data);
                return; 
            }
        }
        requestAnimationFrame(window.tick);
    };
    
    function handleQRCodeScan(scannedCode) {
        const formattedCode = scannedCode.trim().padStart(4, '0');
        const session = JSON.parse(localStorage.getItem('disaster_training_session'));
        
        const matchedRecord = masterData.find(row => 
            row.card_no === formattedCode && 
            row.difficulty === session.difficulty &&
            row.active === 'TRUE'
        );

        if (matchedRecord) {
            if (matchedRecord.record_type === 'EVENT') {
                showEventModal(matchedRecord);
            } else if (matchedRecord.record_type === 'ITEM' || matchedRecord.record_type === 'CHECK') {
                showItemCheckModal(matchedRecord, matchedRecord.record_type);
            } else {
                showModal("エラー", "不正なレコードタイプです。");
            }
        } else {
            const optsContainer = document.getElementById('modalOptions');
            optsContainer.innerHTML = '';
            const closeBtn = document.createElement('button');
            closeBtn.className = 'btn-primary';
            closeBtn.innerText = '閉じる (再スキャン)';
            closeBtn.onclick = window.closeModal;
            optsContainer.appendChild(closeBtn);

            showModal("未登録コード", `入力されたコード（${formattedCode}）は未登録です。`);
        }
    }

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

        // ここで意図的にキャンセルボタンの描画処理を完全に除外しました

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

        if (record.x_px && record.y_px) {
            visitedPoints.push({ x: parseFloat(record.x_px), y: parseFloat(record.y_px), type: record.record_type });
        }

        const optsContainer = document.getElementById('modalOptions');
        optsContainer.innerHTML = '';
        const closeBtn = document.createElement('button');
        closeBtn.className = 'btn-primary';
        closeBtn.innerText = 'OK (カメラへ戻る)';
        closeBtn.onclick = window.closeModal;
        optsContainer.appendChild(closeBtn);

        document.getElementById('modalTitle').innerText = 'アクション結果';
        document.getElementById('modalBody').innerHTML = resultBody;
    };

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

        if (record.x_px && record.y_px) {
            visitedPoints.push({ x: parseFloat(record.x_px), y: parseFloat(record.y_px), type: record.record_type });
        }

        const optsContainer = document.getElementById('modalOptions');
        optsContainer.innerHTML = '';
        const closeBtn = document.createElement('button');
        closeBtn.className = 'btn-primary';
        closeBtn.innerText = 'OK (カメラへ戻る)';
        closeBtn.onclick = window.closeModal;
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
    requestAnimationFrame(window.tick);
};

window.showEndScreen = function() {
    const modal = document.getElementById('modal');
    const title = document.getElementById('modalTitle');
    const body = document.getElementById('modalBody');
    const opts = document.getElementById('modalOptions');
    const contentBox = document.getElementById('modalContentBox');
    
    if(!modal || !contentBox) return;
    
    scanning = false;
    if (streamRef) streamRef.getTracks().forEach(track => track.stop());
    
    // マップが画面に収まるようにモーダル自体の幅や高さを拡張
    contentBox.style.width = '95%';
    contentBox.style.maxWidth = '600px';
    contentBox.style.maxHeight = '95vh';
    contentBox.style.padding = '10px';
    
    title.innerText = '訓練終了';
    title.style.color = 'var(--color-danger)';
    title.style.fontSize = '24pt';
    title.style.textAlign = 'center';
    
    body.innerHTML = `
        <p style="text-align:center; font-size:14px; margin-bottom:10px;">30分経過または終了しました。</p>
        <div id="mapContainer" style="width:100%; border:1px solid var(--color-border); background:#000; overflow:hidden;">
            <canvas id="resultMapCanvas" style="display:block; width:100%; height:auto;"></canvas>
        </div>
        <p style="font-size:10px; color:#888; text-align:center; margin-top:5px;">※訪問履歴 (赤:EVENT, 緑:ITEM, 青:CHECK)</p>
    `;
    
    opts.innerHTML = '';
    modal.classList.remove('hidden');

    setTimeout(() => {
        const canvas = document.getElementById('resultMapCanvas');
        if(!canvas) return;
        const ctx = canvas.getContext('2d');
        const img = new Image();
        
        img.onload = () => {
            canvas.width = img.width;
            canvas.height = img.height;
            
            ctx.drawImage(img, 0, 0);
            
            // 訪問座標へピン（円）を描画する
            visitedPoints.forEach(pt => {
                ctx.beginPath();
                ctx.arc(pt.x, pt.y, 15, 0, 2 * Math.PI);
                
                if(pt.type === 'EVENT') ctx.fillStyle = 'rgba(226, 99, 99, 0.9)'; // 赤
                else if(pt.type === 'ITEM') ctx.fillStyle = 'rgba(100, 168, 135, 0.9)'; // 緑
                else ctx.fillStyle = 'rgba(75, 120, 168, 0.9)'; // 青
                
                ctx.fill();
                ctx.lineWidth = 4;
                ctx.strokeStyle = '#fff';
                ctx.stroke();
            });
        };
        
        img.onerror = () => {
            document.getElementById('mapContainer').innerHTML = '<p style="color:var(--color-danger); text-align:center; padding:10px; background:#fff;">マップ画像 (map.bmp) が読み込めませんでした。<br>同じフォルダに map.bmp があるか確認してください。</p>';
        };
        
        // ファイル名を明示的に指定
        img.src = 'map.bmp';
    }, 100);
};
