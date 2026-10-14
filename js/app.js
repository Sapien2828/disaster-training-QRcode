// Main application logic - v25
let scanning = false;
let streamRef = null;
let masterData = []; 
let currentEventRecord = null; 
let visitedPoints = []; 
let currentScannedAt = null; 

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
            Papa.parse('data/data.csv?v=' + new Date().getTime(), {
                download: true,
                header: true,
                transformHeader: function(h) { return h.trim(); }, // Ensure headers are clean
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
            currentScannedAt = new Date(); 
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
                currentScannedAt = new Date(); 
                handleQRCodeScan(code.data);
                return; 
            }
        }
        requestAnimationFrame(window.tick);
    };

    function handleQRCodeScan(scannedCode) {
        const rawCode = scannedCode.trim();
        const formattedCode = rawCode.padStart(4, '0');
        const numCode = parseInt(rawCode, 10);
        const session = JSON.parse(localStorage.getItem('disaster_training_session'));
        
        if (!session) {
            alert("セッション情報がありません。トップページに戻ります。");
            window.location.href = "index.html";
            return;
        }

        const matchedRecord = masterData.find(row => {
            const rowCardNoStr = row.card_no ? String(row.card_no).trim() : "";
            const rowCardNoInt = parseInt(rowCardNoStr, 10);
            const isCardMatch = (rowCardNoStr === formattedCode || rowCardNoStr === rawCode || rowCardNoInt === numCode);
            const isDiffMatch = (row.difficulty || "").trim() === (session.difficulty || "").trim();
            return isCardMatch && isDiffMatch;
        });

        if (matchedRecord) {
            const rType = (matchedRecord.record_type || '').trim().toUpperCase();
            
            // --- 既に読み込み済みかどうかのチェック (ITEMとCHECK) ---
            if (rType === 'ITEM' || rType === 'CHECK') {
                const alreadyScanned = visitedPoints.some(p => p.card_no === matchedRecord.card_no && p.type === rType);
                if (alreadyScanned) {
                    const optsContainer = document.getElementById('modalOptions');
                    optsContainer.innerHTML = '';
                    const closeBtn = document.createElement('button');
                    closeBtn.className = 'btn-primary';
                    closeBtn.innerText = '閉じる (再スキャン)';
                    closeBtn.onclick = window.closeModal;
                    optsContainer.appendChild(closeBtn);
                    
                    showModal("取得済み", `<div style="text-align:center;"><p style="font-weight:bold; color:var(--color-danger); font-size:1.2em;">この ${rType} は既に獲得・確認済みです。</p></div>`);
                    return; // 処理終了
                }
            }

            const stage = (matchedRecord.event_stage || '').trim();
            if (rType === 'EVENT' || stage !== '') {
                showEventModal(matchedRecord);
            } else if (rType === 'ITEM' || (matchedRecord.item_name && matchedRecord.item_name.trim() !== '')) {
                showItemCheckModal(matchedRecord, 'ITEM');
            } else if (rType === 'CHECK' || (matchedRecord.check_name && matchedRecord.check_name.trim() !== '')) {
                showItemCheckModal(matchedRecord, 'CHECK');
            } else {
                showModal("エラー", "有効なイベントまたはアイテム情報が見つかりません。");
            }
        } else {
            const optsContainer = document.getElementById('modalOptions');
            optsContainer.innerHTML = '';
            const closeBtn = document.createElement('button');
            closeBtn.className = 'btn-primary';
            closeBtn.innerText = '閉じる (再スキャン)';
            closeBtn.onclick = window.closeModal;
            optsContainer.appendChild(closeBtn);

            showModal("未登録コード", `入力されたコード（${rawCode}）は未登録です。<br>現在の難易度: ${session.difficulty} に対応するデータが見つかりません。`);
        }
    }

    function showEventModal(record) {
        currentEventRecord = record;
        
        const titleText = `【EVENT】${record.location_name || ''}`;
        const bodyHtml = `
            <div style="text-align: center; margin-bottom: 10px;">
                <p style="color:var(--color-danger); font-weight:bold; font-size: 1.2em;">${record.event_name || ''}</p>
            </div>
            <p>${record.event_body || ''}</p>
            <p style="font-size: 0.8em; color: var(--color-text-muted);">※選択肢を選んでください。</p>
        `;
        
        const optsContainer = document.getElementById('modalOptions');
        optsContainer.innerHTML = ''; 
        
        const options = [
            { text: record.option_a_name, score: record.option_a_score || record.option_a_total_score, outcome: record.option_a_outcome },
            { text: record.option_b_name, score: record.option_b_score || record.option_b_total_score, outcome: record.option_b_outcome },
            { text: record.option_c_name, score: record.option_c_score || record.option_c_total_score, outcome: record.option_c_outcome }
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
            btnD.onclick = () => handleEventAnswer(4, { text: record.option_d_name, score: record.option_d_score || record.option_d_total_score, outcome: record.option_d_outcome });
            optsContainer.appendChild(btnD);
        }

        showModal(titleText, bodyHtml);
    }

    window.handleEventAnswer = function(optionIndex, optionData) {
        const record = currentEventRecord;
        const session = JSON.parse(localStorage.getItem('disaster_training_session'));
        
        const resultBody = `
            <p style="font-weight:bold; color:var(--color-primary);">選択: ${optionData.text}</p>
            <div style="background:var(--color-surface-raised); padding:10px; margin-top:10px; border-radius:5px;">
                <p><strong>【結果】</strong><br>${optionData.outcome || '記録しました。'}</p>
                <p style="margin-top:5px; font-size:0.9em; color:var(--color-success);">獲得スコア: ${optionData.score !== undefined ? optionData.score : 0}</p>
            </div>
        `;
        
        const now = new Date();
        const thinkingTimeSec = currentScannedAt ? Math.round((now.getTime() - currentScannedAt.getTime()) / 1000) : 0;

        // 確実に列を取得
        const m4eVal = record['4M+E'] || record['4M'] || record['m4e'] || 'Environment';
        const sabcVal = record['S/A/B/C評価'] || record['評価'] || record['eval'] || '';

        const logData = {
            ...record,
            session_id: session.session_id,
            participant_id: session.participant_id,
            difficulty: session.difficulty,
            started_at: session.started_at,
            timestamp: now.toISOString(),
            scanned_at: currentScannedAt ? currentScannedAt.toISOString() : now.toISOString(),
            thinking_time_sec: thinkingTimeSec,
            selected_option: optionData.text,
            option_score: optionData.score,
            m4e_category: m4eVal, // GASへ送信
            sabc_eval: sabcVal    // GASへ送信
        };
        
        if (typeof sendLog === 'function') sendLog(logData);
        addLogToScreen(logData);

        if (record.x_px && record.y_px) {
            visitedPoints.push({ 
                card_no: record.card_no,
                x: parseFloat(record.x_px), 
                y: parseFloat(record.y_px), 
                type: 'EVENT',
                m4e: m4eVal
            });
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
        
        let displayName = '';
        if (isItem) {
            displayName = record.item_name || record.check_name || record.tool_code || '不明なアイテム';
        } else {
            displayName = record.check_name || record.item_name || record.tool_code || '不明なチェック項目';
        }
        
        const bodyHtml = `
            <div style="text-align: center; margin: 20px 0;">
                <p style="font-size: 1.5em; font-weight: bold; color: var(--color-success);">${displayName}</p>
                <p>場所: ${record.location_name || ''}</p>
            </div>
        `;

        const now = new Date();
        const thinkingTimeSec = currentScannedAt ? Math.round((now.getTime() - currentScannedAt.getTime()) / 1000) : 0;
        
        const m4eVal = record['4M+E'] || record['4M'] || record['m4e'] || 'Environment';
        const sabcVal = record['S/A/B/C評価'] || record['評価'] || record['eval'] || '';

        const logData = {
            ...record,
            record_type: type,
            session_id: session.session_id,
            participant_id: session.participant_id,
            difficulty: session.difficulty,
            started_at: session.started_at,
            timestamp: now.toISOString(),
            scanned_at: currentScannedAt ? currentScannedAt.toISOString() : now.toISOString(),
            thinking_time_sec: thinkingTimeSec,
            selected_option: displayName,
            option_score: record.Item_score || record.CHECK_score || '',
            m4e_category: m4eVal, // GASへ送信
            sabc_eval: sabcVal    // GASへ送信
        };

        if (typeof sendLog === 'function') sendLog(logData);
        addLogToScreen(logData);

        if (record.x_px && record.y_px) {
            visitedPoints.push({ 
                card_no: record.card_no,
                x: parseFloat(record.x_px), 
                y: parseFloat(record.y_px), 
                type: type 
            });
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
        else if(record.record_type === 'ITEM') name = record.item_name || record.check_name;
        else if(record.record_type === 'CHECK') name = record.check_name || record.item_name;
        
        li.innerHTML = `<span>[${timeStr}]</span> <span style="color:var(--color-primary)">${record.record_type}</span>: ${name}`;
        activityLog.prepend(li);
    }
    
    if (foundItems && record.record_type === 'ITEM') {
        const li = document.createElement('li');
        li.innerHTML = `<span>[${timeStr}]</span> ${record.item_name || record.check_name}`;
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
    
    const eventCount = visitedPoints.filter(p => p.type === 'EVENT').length;
    const itemCount = visitedPoints.filter(p => p.type === 'ITEM').length;
    const checkCount = visitedPoints.filter(p => p.type === 'CHECK').length;

    // 4M+E Analysis
    const userM4E = { 'Man':0, 'Machine':0, 'Material':0, 'Method':0, 'Environment':0 };
    visitedPoints.filter(p => p.type === 'EVENT').forEach(p => {
        let cat = (p.m4e || '').trim();
        // Fallback for exact matching
        if(cat.includes('Man')) cat = 'Man';
        else if(cat.includes('Machine')) cat = 'Machine';
        else if(cat.includes('Material')) cat = 'Material';
        else if(cat.includes('Method')) cat = 'Method';
        else cat = 'Environment';
        if(userM4E[cat] !== undefined) userM4E[cat]++;
    });

    function convexHull(points) {
        const unique = [];
        const seen = new Set();
        for(let p of points) {
            const key = p.x + "," + p.y;
            if(!seen.has(key)){
                seen.add(key);
                unique.push(p);
            }
        }
        if (unique.length <= 3) return unique;
        unique.sort((a, b) => a.x === b.x ? a.y - b.y : a.x - b.x);
        const cross = (o, a, b) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
        const lower = [];
        for (let p of unique) {
            while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) lower.pop();
            lower.push(p);
        }
        const upper = [];
        for (let i = unique.length - 1; i >= 0; i--) {
            let p = unique[i];
            while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) upper.pop();
            upper.push(p);
        }
        upper.pop(); lower.pop();
        return lower.concat(upper);
    }

    function polygonArea(points) {
        if(points.length < 3) return 0;
        let area = 0;
        for (let i = 0; i < points.length; i++) {
            let j = (i + 1) % points.length;
            area += points[i].x * points[j].y;
            area -= points[j].x * points[i].y;
        }
        return Math.abs(area) / 2;
    }

    const hullPoints = convexHull(visitedPoints);
    const hullArea = polygonArea(hullPoints);
    const MAX_AREA = 544170; 
    const coverRate = ((hullArea / MAX_AREA) * 100).toFixed(1);

    contentBox.style.width = '95%';
    contentBox.style.maxWidth = '600px';
    contentBox.style.maxHeight = '95vh';
    contentBox.style.padding = '10px';
    
    title.innerText = '訓練終了';
    title.style.color = 'var(--color-danger)';
    title.style.fontSize = '24pt';
    title.style.textAlign = 'center';
    
    body.innerHTML = `
        <div id="captureArea" style="background:var(--color-bg); padding:10px; border-radius:5px;">
            <p style="text-align:center; font-size:14px; margin-bottom:10px;">30分経過または終了しました。</p>
            <div style="background:var(--color-surface-raised); padding:10px; border-radius:5px; margin-bottom:10px; font-size:14px; line-height:1.6;">
                <strong>【訓練実績】</strong><br>
                ・回答 EVENT : <span style="color:var(--color-danger); font-weight:bold;">${eventCount}</span> 件<br>
                ・発見 ITEM : <span style="color:var(--color-success); font-weight:bold;">${itemCount}</span> 件<br>
                ・確認 CHECK : <span style="color:var(--color-primary); font-weight:bold;">${checkCount}</span> 件<br>
                <hr style="border-color:var(--color-border); margin:5px 0;">
                ・空間カバー率 : <strong>${coverRate} %</strong><br>
            </div>
            
            <div style="background:var(--color-surface-raised); padding:10px; border-radius:5px; margin-bottom:10px;">
                <h4 style="text-align:center; margin:0 0 10px 0; color:var(--color-text);">あなたが対応したイベント (4M+E割合)</h4>
                <canvas id="m4ePieChart" width="300" height="200" style="margin: 0 auto; display: block;"></canvas>
                <p style="font-size:10px; color:var(--color-text-muted); text-align:center; margin-top:5px;">あなたの行動に偏りがないか確認しましょう。<br>(割合が少ない要素は見落としている可能性があります)</p>
            </div>

            <div id="mapContainer" style="width:100%; border:1px solid var(--color-border); background:#000; overflow:hidden; position:relative;">
                <canvas id="resultMapCanvas" style="display:block; width:100%; height:auto;"></canvas>
            </div>
            <p style="font-size:10px; color:#888; text-align:center; margin-top:5px;">※訪問履歴 (赤:EVENT, 緑:ITEM, 青:CHECK)<br>黄色のエリアが靴紐公式で算出した探索範囲（凸包）です。</p>
        </div>
        
        <div style="margin-top: 15px; display:flex; gap:10px; justify-content:center; flex-wrap:wrap;">
            <button onclick="saveResultAsImage()" class="btn-primary" style="background:#4b78a8; min-height:40px; width:auto; padding:0 20px;">画像を保存</button>
            <button onclick="shareResultImage()" class="btn-primary" style="background:#64a887; min-height:40px; width:auto; padding:0 20px;">共有する</button>
        </div>
    `;
    
    opts.innerHTML = '';
    modal.classList.remove('hidden');

    setTimeout(() => {
        // Native Canvas Pie Chart (No external libraries required)
        function drawPieChart(canvasId, dataObj) {
            const canvas = document.getElementById(canvasId);
            if (!canvas) return;
            const ctx = canvas.getContext('2d');
            const width = canvas.width;
            const height = canvas.height;
            const centerX = width / 2 + 30; // Shift right for legend
            const centerY = height / 2;
            const radius = Math.min(centerX, centerY) - 20;

            const colors = {
                'Man': '#ff6384',
                'Machine': '#36a2eb',
                'Material': '#ffce56',
                'Method': '#4bc0c0',
                'Environment': '#9966ff'
            };
            const labels = {
                'Man': '人(Man)',
                'Machine': '機器(Machine)',
                'Material': '物資(Material)',
                'Method': '手順(Method)',
                'Environment': '環境(Env)'
            };

            let total = 0;
            for (let key in dataObj) total += dataObj[key];

            ctx.clearRect(0, 0, width, height);

            if (total === 0) {
                ctx.fillStyle = '#b8c5d6';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.font = '12px sans-serif';
                ctx.fillText('イベント対応データがありません', centerX, centerY);
                return;
            }

            let currentAngle = -Math.PI / 2;
            
            // Draw Pie
            for (let key in dataObj) {
                const count = dataObj[key];
                if (count === 0) continue;
                
                const sliceAngle = (count / total) * 2 * Math.PI;
                ctx.beginPath();
                ctx.moveTo(centerX, centerY);
                ctx.arc(centerX, centerY, radius, currentAngle, currentAngle + sliceAngle);
                ctx.closePath();
                ctx.fillStyle = colors[key] || '#999';
                ctx.fill();
                ctx.strokeStyle = '#183250';
                ctx.lineWidth = 2;
                ctx.stroke();

                // Draw percentage label
                const labelAngle = currentAngle + sliceAngle / 2;
                const labelX = centerX + (radius * 0.65) * Math.cos(labelAngle);
                const labelY = centerY + (radius * 0.65) * Math.sin(labelAngle);
                ctx.fillStyle = '#fff';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.font = 'bold 12px sans-serif';
                const percent = Math.round((count / total) * 100);
                
                // Text shadow for readability
                ctx.shadowColor = 'rgba(0,0,0,0.8)';
                ctx.shadowBlur = 4;
                ctx.fillText(percent + '%', labelX, labelY);
                ctx.shadowBlur = 0; // reset

                currentAngle += sliceAngle;
            }
            
            // Draw Legend on the left
            let startX = 10;
            let startY = 20;
            for(let key in dataObj) {
                ctx.fillStyle = colors[key] || '#999';
                ctx.fillRect(startX, startY, 12, 12);
                ctx.fillStyle = '#e8eef7';
                ctx.textAlign = 'left';
                ctx.textBaseline = 'middle';
                ctx.font = '11px sans-serif';
                ctx.fillText(`${labels[key]} : ${dataObj[key]}件`, startX + 18, startY + 6);
                startY += 20;
            }
        }
        
        drawPieChart('m4ePieChart', userM4E);

        // Draw Map
        const canvasMap = document.getElementById('resultMapCanvas');
        if(!canvasMap) return;
        const ctxMap = canvasMap.getContext('2d');
        const img = new Image();
        
        img.onload = () => {
            canvasMap.width = img.width;
            canvasMap.height = img.height;
            
            ctxMap.drawImage(img, 0, 0);
            
            if(hullPoints.length > 0) {
                ctxMap.beginPath();
                ctxMap.moveTo(hullPoints[0].x, hullPoints[0].y);
                for(let i=1; i<hullPoints.length; i++) {
                    ctxMap.lineTo(hullPoints[i].x, hullPoints[i].y);
                }
                ctxMap.closePath();
                ctxMap.fillStyle = 'rgba(255, 255, 0, 0.2)'; 
                ctxMap.fill();
                ctxMap.strokeStyle = 'rgba(255, 255, 0, 0.6)';
                ctxMap.lineWidth = 2;
                ctxMap.stroke();
            }
            
            visitedPoints.forEach(pt => {
                ctxMap.beginPath();
                ctxMap.arc(pt.x, pt.y, 15, 0, 2 * Math.PI);
                
                if(pt.type === 'EVENT') ctxMap.fillStyle = 'rgba(226, 99, 99, 0.9)'; 
                else if(pt.type === 'ITEM') ctxMap.fillStyle = 'rgba(100, 168, 135, 0.9)'; 
                else ctxMap.fillStyle = 'rgba(75, 120, 168, 0.9)'; 
                
                ctxMap.fill();
                ctxMap.lineWidth = 4;
                ctxMap.strokeStyle = '#fff';
                ctxMap.stroke();
            });
        };
        
        img.onerror = () => {
            document.getElementById('mapContainer').innerHTML = '<p style="color:var(--color-danger); text-align:center; padding:10px; background:#fff;">マップ画像 (map.bmp) が読み込めませんでした。<br>同じフォルダに配置しているか確認してください。</p>';
        };
        
        img.src = 'map.bmp';
    }, 100);
};

window.saveResultAsImage = function() {
    const content = document.getElementById('captureArea');
    const session = JSON.parse(localStorage.getItem('disaster_training_session')) || {};
    const pid = session.participant_id || 'Unknown';
    
    html2canvas(content, { useCORS: true, backgroundColor: '#071426' }).then(canvas => {
        const link = document.createElement('a');
        link.download = `Result_${pid}.png`;
        link.href = canvas.toDataURL('image/png');
        link.click();
    });
};

window.shareResultImage = async function() {
    const content = document.getElementById('captureArea');
    const session = JSON.parse(localStorage.getItem('disaster_training_session')) || {};
    const pid = session.participant_id || 'Unknown';

    html2canvas(content, { useCORS: true, backgroundColor: '#071426' }).then(async canvas => {
        canvas.toBlob(async (blob) => {
            const file = new File([blob], `Result_${pid}.png`, { type: 'image/png' });
            if (navigator.canShare && navigator.canShare({ files: [file] })) {
                try {
                    await navigator.share({
                        files: [file],
                        title: '災害訓練結果',
                        text: `災害訓練アプリの実行結果です。(ID: ${pid})`
                    });
                } catch (error) {
                    console.log('共有キャンセルまたはエラー', error);
                }
            } else {
                alert('お使いのブラウザは画像の直接共有に対応していません。「画像を保存」してからメール等に添付してください。');
            }
        });
    });
};
