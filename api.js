// Handle GAS communication and offline logs
// URLをシングルクォーテーションで囲んでいます。
const GAS_URL = 'https://script.google.com/macros/s/AKfycbzJhXccZRAY0Z5hSH5Dgrd8a_eEXBW1NmXYVdqM2o0_yt1RC7nbKVNpZR1HUclZdVvM/exec';

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
            await fetch(GAS_URL, {
                method: 'POST',
                mode: 'no-cors',
                headers: { 'Content-Type': 'application/json' },
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
