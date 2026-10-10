// Main application logic
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
});

function showEndScreen() {
    const modal = document.getElementById('modal');
    const title = document.getElementById('modalTitle');
    const body = document.getElementById('modalBody');
    const opts = document.getElementById('modalOptions');
    
    if(!modal) return;
    
    title.innerText = '訓練終了';
    title.style.color = 'var(--color-danger)';
    title.style.fontSize = '40pt';
    title.style.textAlign = 'center';
    body.innerHTML = '<p style="text-align:center">30分が経過しました。</p>';
    opts.innerHTML = '';
    modal.classList.remove('hidden');
}
