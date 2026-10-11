// Handle GAS communication and offline logs
const GAS_URL = 'https://script.google.com/macros/library/d/1T8f-uEudhcDUcDUHdetjRHM3wfMYXFdud36rIUA_gWKHvJPjvv_U2W1L/6';

async function sendLog(logData) {
    let queue = JSON.parse(localStorage.getItem('log_queue') || '[]');
    logData.status = 'PENDING';
    logData.log_id = logData.session_id + '_' + new Date().getTime();
    queue.push(logData);
    localStorage.setItem('log_queue', JSON.stringify(queue));
    
    syncLogs();
}

async function syncLogs() {
    if (!navigator.onLine) return;
    
    let queue = JSON.parse(localStorage.getItem('log_queue') || '[]');
    let pending = queue.filter(l => l.status === 'PENDING');
    
    for (let log of pending) {
        try {
            // CORSエラー回避のため 'Content-Type': 'text/plain' に変更
            await fetch(GAS_URL, {
                method: 'POST',
                mode: 'no-cors',
                headers: { 'Content-Type': 'text/plain' },
                body: JSON.stringify(log)
            });
            log.status = 'SYNCED';
        } catch (e) {
            console.error('Sync failed', e);
        }
    }
    localStorage.setItem('log_queue', JSON.stringify(queue));
}

window.addEventListener('online', syncLogs);
