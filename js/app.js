// Main application logic - v21 with 4M+E Radar Chart
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
            Papa.parse('data/data.csv', {
                download: true,
                header: true,
                complete: function(results) {
                    masterData = results.data;
                    console.log('CSV Loaded:', masterData.length, 'records from data.csv.');
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
        const formattedCode = scannedCode.trim().padStart(4, '0');
        const session = JSON.parse(localStorage.getItem('disaster_training_session'));
        
        const matchedRecord = masterData.find(row => 
            row.card_no === formattedCode && 
            row.difficulty === session.difficulty
        );

        if (matchedRecord) {
            const rType = (matchedRecord.record_type || '').trim().toUpperCase();
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

            showModal("未登録コード", `入力されたコード（${formattedCode}）は未登録です。`);
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
            option_score: optionData.score
        };
        
        if (typeof sendLog === 'function') sendLog(logData);
        addLogToScreen(logData);

        if (record.x_px && record.y_px) {
            visitedPoints.push({ 
                x: parseFloat(record.x_px), 
                y: parseFloat(record.y_px), 
                type: 'EVENT',
                m4e: record['4M+E'] || 'Unknown'
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
            option_score: record.Item_score || record.CHECK_score || ''
        };

        if (typeof sendLog === 'function') sendLog(logData);
        addLogToScreen(logData);

        if (record.x_px && record.y_px) {
            visitedPoints.push({ x: parseFloat(record.x_px), y: parseFloat(record.y_px), type: type });
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
    const session = JSON.parse(localStorage.getItem('disaster_training_session'));
    const totalM4E = { 'Man':0, 'Machine':0, 'Material':0, 'Method':0, 'Environment':0 };
    masterData.filter(r => (r.record_type||'').toUpperCase() === 'EVENT' && r.difficulty === session.difficulty && r.active === 'TRUE').forEach(r => {
        const cat = r['4M+E'] || 'Environment';
        if(totalM4E[cat] !== undefined) totalM4E[cat]++;
    });

    const userM4E = { 'Man':0, 'Machine':0, 'Material':0, 'Method':0, 'Environment':0 };
    visitedPoints.filter(p => p.type === 'EVENT').forEach(p => {
        const cat = p.m4e || 'Environment';
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
                <h4 style="text-align:center; margin:0 0 10px 0; color:var(--color-text);">イベント対応分析 (4M+E)</h4>
                <div style="width: 100%; max-width: 300px; margin: 0 auto;">
                    <canvas id="m4eChart"></canvas>
                </div>
                <p style="font-size:10px; color:var(--color-text-muted); text-align:center; margin-top:5px;">青破線: 発生した全イベント / 緑実線: あなたの対応数<br>どの要素が足りていないか確認しましょう</p>
            </div>

            <div id="mapContainer" style="width:100%; border:1px solid var(--color-border); background:#000; overflow:hidden; position:relative;">
                <canvas id="resultMapCanvas" style="display:block; width:100%; height:auto;"></canvas>
            </div>
        </div>
        
        <div style="margin-top: 15px; display:flex; gap:10px; justify-content:center; flex-wrap:wrap;">
            <button onclick="saveResultAsImage()" class="btn-primary" style="background:#4b78a8; min-height:40px; width:auto; padding:0 20px;">画像を保存</button>
            <button onclick="shareResultImage()" class="btn-primary" style="background:#64a887; min-height:40px; width:auto; padding:0 20px;">共有する</button>
        </div>
    `;
    
    opts.innerHTML = '';
    modal.classList.remove('hidden');

    setTimeout(() => {
        // Draw Chart
        const ctxChart = document.getElementById('m4eChart');
        if (ctxChart && typeof Chart !== 'undefined') {
            new Chart(ctxChart, {
                type: 'radar',
                data: {
                    labels: ['Man(人)', 'Machine(機器)', 'Material(物資)', 'Method(手順)', 'Environment(環境)'],
                    datasets: [
                        {
                            label: 'あなたの対応数',
                            data: [userM4E['Man'], userM4E['Machine'], userM4E['Material'], userM4E['Method'], userM4E['Environment']],
                            backgroundColor: 'rgba(100, 168, 135, 0.4)',
                            borderColor: 'rgba(100, 168, 135, 1)',
                            pointBackgroundColor: 'rgba(100, 168, 135, 1)',
                            borderWidth: 2
                        },
                        {
                            label: '全体イベント数',
                            data: [totalM4E['Man'], totalM4E['Machine'], totalM4E['Material'], totalM4E['Method'], totalM4E['Environment']],
                            backgroundColor: 'rgba(75, 120, 168, 0.1)',
                            borderColor: 'rgba(75, 120, 168, 0.5)',
                            borderWidth: 1,
                            borderDash: [5, 5]
                        }
                    ]
                },
                options: {
                    animation: false, // Ensure it's fully rendered for html2canvas
                    responsive: true,
                    scales: {
                        r: {
                            beginAtZero: true,
                            ticks: { stepSize: 1, color: '#b8c5d6', backdropColor: 'transparent' },
                            grid: { color: 'rgba(255, 255, 255, 0.1)' },
                            pointLabels: { color: '#e8eef7', font: { size: 10 } }
                        }
                    },
                    plugins: {
                        legend: { labels: { color: '#e8eef7', font: { size: 10 } } }
                    }
                }
            });
        }

        // Draw Map
        const canvas = document.getElementById('resultMapCanvas');
        if(!canvas) return;
        const ctx = canvas.getContext('2d');
        const img = new Image();
        
        img.onload = () => {
            canvas.width = img.width;
            canvas.height = img.height;
            
            ctx.drawImage(img, 0, 0);
            
            if(hullPoints.length > 0) {
                ctx.beginPath();
                ctx.moveTo(hullPoints[0].x, hullPoints[0].y);
                for(let i=1; i<hullPoints.length; i++) {
                    ctx.lineTo(hullPoints[i].x, hullPoints[i].y);
                }
                ctx.closePath();
                ctx.fillStyle = 'rgba(255, 255, 0, 0.2)'; 
                ctx.fill();
                ctx.strokeStyle = 'rgba(255, 255, 0, 0.6)';
                ctx.lineWidth = 2;
                ctx.stroke();
            }
            
            visitedPoints.forEach(pt => {
                ctx.beginPath();
                ctx.arc(pt.x, pt.y, 15, 0, 2 * Math.PI);
                
                if(pt.type === 'EVENT') ctx.fillStyle = 'rgba(226, 99, 99, 0.9)'; 
                else if(pt.type === 'ITEM') ctx.fillStyle = 'rgba(100, 168, 135, 0.9)'; 
                else ctx.fillStyle = 'rgba(75, 120, 168, 0.9)'; 
                
                ctx.fill();
                ctx.lineWidth = 4;
                ctx.strokeStyle = '#fff';
                ctx.stroke();
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
