// Estado global
let systemRunning = false;
let whatsappConnected = false;
let autoScroll = true;
let statusInterval;
let ws = null;

// Inicialização
document.addEventListener('DOMContentLoaded', function() {
    initializeControlPanel();
    startStatusMonitoring();
    loadSystemInfo();
    setupWebSocket();
});

function initializeControlPanel() {
    // Definir status inicial para todos os serviços
    initializeServiceStatuses();
    
    addLog('🎮 Painel de controle inicializado', 'info');
    addLog('💡 Clique em "Sistema Principal" para iniciar todos os serviços', 'info');
    loadCurrentStatus();
}

// Função para inicializar status padrão dos serviços
function initializeServiceStatuses() {
    // Definir status inicial para todos os serviços
    updateServiceStatus('database', 'unknown', 'Verificando conexão...');
    updateServiceStatus('whatsapp', 'stopped', 'WhatsApp desconectado');
    updateServiceStatus('chatbot', 'stopped', 'Chatbot parado');
    updateServiceStatus('api', 'running', 'API funcionando');
}

// Função para atualizar status de serviço individual
function updateServiceStatus(serviceName, status, details = '') {
    // Mapear nomes de serviços para IDs dos elementos
    const serviceMap = {
        'database': 'db',
        'chatbot': 'bot',
        'whatsapp': 'whatsapp',
        'api': 'api',
        'products': 'products'
    };
    
    const elementId = serviceMap[serviceName] || serviceName;
    const statusCard = document.querySelector(`.status-card:has(#${elementId}Indicator)`);
    const indicator = document.getElementById(`${elementId}Indicator`);
    const statusText = document.getElementById(`${elementId}Status`);
    
    if (statusCard) {
        // Remover classes de status anteriores
        statusCard.classList.remove('running', 'stopped', 'connecting', 'unknown', 'error');
        // Adicionar nova classe de status
        statusCard.classList.add(status);
    }
    
    if (indicator) {
        // Remover classes anteriores
        indicator.classList.remove('running', 'stopped', 'connecting', 'unknown', 'error');
        // Adicionar nova classe
        indicator.classList.add(status);
    }
    
    if (statusText) {
        const statusTexts = {
            'running': 'Rodando',
            'stopped': 'Parado',
            'connecting': 'Conectando...',
            'unknown': 'Verificando...',
            'error': 'Erro'
        };
        statusText.textContent = statusTexts[status] || status;
    }
}

// Configurar WebSocket para logs em tempo real
function setupWebSocket() {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}`;
    
    try {
        ws = new WebSocket(wsUrl);
        
        ws.onopen = function() {
            addLog('🔗 Conexão WebSocket estabelecida', 'success');
        };
        
        ws.onmessage = function(event) {
            try {
                const data = JSON.parse(event.data);
                handleWebSocketMessage(data);
            } catch (error) {
                console.error('Erro ao processar mensagem WebSocket:', error);
            }
        };
        
        ws.onclose = function() {
            addLog('📴 Conexão WebSocket perdida', 'warning');
            // Tentar reconectar após 5 segundos
            setTimeout(setupWebSocket, 5000);
        };
        
        ws.onerror = function(error) {
            addLog('❌ Erro na conexão WebSocket', 'error');
        };
    } catch (error) {
        addLog('⚠️ WebSocket não disponível, usando polling', 'warning');
    }
}

// Processar mensagens específicas do WebSocket
function handleWebSocketMessage(data) {
    switch(data.type) {
        case 'new-log':
            addLogFromServer(data.data);
            break;
        case 'services-status':
            updateServicesFromServer(data.data);
            break;
        case 'whatsapp-status':
            updateWhatsAppStatus(data.data);
            break;
        case 'qr-code':
            updateQRCode(data.data);
            break;
        case 'logs-cleared':
            clearLogsDisplay();
            break;
        case 'products-count':
            updateProductsCount(data.data.count);
            break;
    }
}

// Atualizar contagem de produtos
function updateProductsCount(count) {
    const productsCount = document.getElementById('productsCount');
    if (productsCount) {
        productsCount.textContent = `${count} produtos`;
        updateServiceStatus('products', count > 0 ? 'running' : 'stopped');
    }
}

// Carregar status atual
async function loadCurrentStatus() {
    try {
        const response = await fetch('/api/control/status');
        const status = await response.json();
        
        updateServicesFromServer(status);
        
        // Verificar se sistema está rodando
        const servicesRunning = Object.values(status.services || {})
            .filter(service => service.status === 'running').length;
        
        systemRunning = servicesRunning > 2; // API + pelo menos 2 outros
        updateMainButton();
        
    } catch (error) {
        addLog('❌ Erro ao carregar status inicial', 'error');
    }
}

// Atualizar serviços do servidor
function updateServicesFromServer(data) {
    if (!data || !data.services) return;

    const services = data.services;
    
    // Database
    if (services.database) {
        const dbStatus = services.database.status === 'running' ? 'running' : 
                        services.database.status === 'connecting' ? 'connecting' : 
                        services.database.status === 'unknown' ? 'unknown' : 'stopped';
        updateServiceStatus('database', dbStatus);
    }

    // WhatsApp
    if (services.whatsapp) {
        const waStatus = services.whatsapp.status === 'running' ? 'running' : 
                        services.whatsapp.status === 'connecting' ? 'connecting' : 'stopped';
        updateServiceStatus('whatsapp', waStatus);
    }

    // Chatbot
    if (services.chatbot) {
        const botStatus = services.chatbot.status === 'running' ? 'running' : 
                         services.chatbot.status === 'unknown' ? 'unknown' : 'stopped';
        updateServiceStatus('chatbot', botStatus);
    }

    // API
    if (services.api) {
        const apiStatus = services.api.status === 'running' ? 'running' : 'stopped';
        updateServiceStatus('api', apiStatus);
    }
    
    // Atualizar informações do sistema
    if (data.system) {
        updateSystemInfo(data.system);
    }
}

// Atualizar status do WhatsApp com progresso
function updateWhatsAppStatus(data) {
    const btn = document.getElementById('whatsappBtn');
    const status = document.getElementById('whatsappStatus');
    
    switch(data.status) {
        case 'connected':
            whatsappConnected = true;
            btn.className = 'power-button stop';
            btn.innerHTML = '📱';
            status.textContent = `Conectado${data.number ? ` (${data.number})` : ''}`;
            updateServiceStatus('whatsapp', 'running');
            break;
        case 'connecting':
            btn.className = 'power-button loading';
            btn.innerHTML = '⏳';
            const progress = data.progress || 0;
            status.textContent = `Conectando... ${progress}%`;
            updateServiceStatus('whatsapp', 'connecting');
            break;
        case 'disconnected':
            whatsappConnected = false;
            btn.className = 'power-button start';
            btn.innerHTML = '📱';
            status.textContent = 'Desconectado';
            updateServiceStatus('whatsapp', 'stopped');
            break;
    }
}

// Controle do sistema principal - FUNCIONAL
async function toggleSystem() {
    const btn = document.getElementById('mainPowerBtn');
    const status = document.getElementById('mainStatus');
    
    if (!systemRunning) {
        // Iniciar sistema
        btn.className = 'power-button loading';
        btn.innerHTML = '⏳';
        status.textContent = 'Iniciando...';
        
        addLog('🚀 Iniciando sistema completo...', 'info');
        
        try {
            const response = await fetch('/api/control/start', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' }
            });
            
            const result = await response.json();
            
            if (result.success) {
                systemRunning = true;
                btn.className = 'power-button stop';
                btn.innerHTML = '⏹️';
                status.textContent = 'Sistema Rodando';
                addLog('✅ Sistema iniciado com sucesso!', 'success');
            } else {
                throw new Error(result.error || 'Erro desconhecido');
            }
            
        } catch (error) {
            btn.className = 'power-button start';
            btn.innerHTML = '▶️';
            status.textContent = 'Erro na Inicialização';
            addLog(`❌ Erro: ${error.message}`, 'error');
        }
    } else {
        // Parar sistema
        btn.className = 'power-button loading';
        btn.innerHTML = '⏳';
        status.textContent = 'Parando...';
        
        addLog('🛑 Parando sistema...', 'warning');
        
        try {
            const response = await fetch('/api/control/stop', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' }
            });
            
            const result = await response.json();
            
            if (result.success) {
                systemRunning = false;
                btn.className = 'power-button start';
                btn.innerHTML = '▶️';
                status.textContent = 'Sistema Parado';
                addLog('✅ Sistema parado com sucesso!', 'success');
            } else {
                throw new Error(result.error || 'Erro desconhecido');
            }
            
        } catch (error) {
            addLog(`❌ Erro ao parar: ${error.message}`, 'error');
        }
    }
}

// Controle do WhatsApp - FUNCIONAL
async function toggleWhatsApp() {
    const btn = document.getElementById('whatsappBtn');
    const status = document.getElementById('whatsappStatus');
    
    if (!whatsappConnected) {
        btn.className = 'power-button loading';
        btn.innerHTML = '⏳';
        status.textContent = 'Conectando...';
        
        addLog('📱 Iniciando WhatsApp Web...', 'info');
        
        // Gerar QR Code
        try {
            const qrResponse = await fetch('/api/control/qr', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' }
            });
            
            if (qrResponse.ok) {
                showQRCode(); // Mostrar modal
            }
        } catch (error) {
            addLog('⚠️ Erro ao gerar QR Code', 'warning');
        }
        
    } else {
        // Desconectar
        whatsappConnected = false;
        btn.className = 'power-button start';
        btn.innerHTML = '📱';
        status.textContent = 'Desconectado';
        
        updateServiceStatus('whatsapp', 'stopped');
        addLog('📱 WhatsApp desconectado', 'warning');
    }
}

// Reiniciar sistema - FUNCIONAL
async function restartSystem() {
    if (confirm('🔄 Tem certeza que deseja reiniciar o sistema?')) {
        addLog('🔄 Reiniciando sistema completo...', 'warning');
        
        try {
            const response = await fetch('/api/control/restart', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' }
            });
            
            const result = await response.json();
            
            if (result.success) {
                addLog('✅ Sistema reiniciado com sucesso!', 'success');
            } else {
                addLog(`❌ Erro ao reiniciar: ${result.error}`, 'error');
            }
        } catch (error) {
            addLog(`❌ Erro ao reiniciar: ${error.message}`, 'error');
        }
    }
}

// Parada de emergência - FUNCIONAL
async function emergencyStop() {
    if (confirm('🚨 Tem certeza que deseja fazer uma parada de emergência?')) {
        addLog('🚨 PARADA DE EMERGÊNCIA ACIONADA!', 'error');
        
        try {
            const response = await fetch('/api/control/stop', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' }
            });
            
            systemRunning = false;
            updateMainButton();
            addLog('🛑 Parada de emergência concluída', 'error');
        } catch (error) {
            addLog(`❌ Erro na parada de emergência: ${error.message}`, 'error');
        }
    }
}

// Mostrar QR Code - FUNCIONAL
function showQRCode() {
    document.getElementById('qrModal').style.display = 'block';
    
    const qrContainer = document.getElementById('qrCode');
    qrContainer.innerHTML = '⏳ Gerando QR Code...';
    
    // QR Code será atualizado via WebSocket
}

// Atualizar QR Code via WebSocket
function updateQRCode(data) {
    const qrContainer = document.getElementById('qrCode');
    if (qrContainer && data.qr) {
        qrContainer.innerHTML = `<pre style="font-family: monospace; font-size: 8px; line-height: 8px; background: white; padding: 10px; border-radius: 5px; color: black;">${data.qr}</pre>`;
    }
}

// Testar bot - FUNCIONAL
async function testBot() {
    if (!systemRunning) {
        addLog('⚠️ Sistema precisa estar rodando para testar', 'warning');
        return;
    }
    
    addLog('🧪 Executando teste do sistema...', 'info');
    
    try {
        const response = await fetch('/api/control/test', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        });
        
        const result = await response.json();
        
        if (result.success) {
            addLog('✅ Teste do sistema concluído!', 'success');
            
            // Mostrar resultados
            result.results.forEach(test => {
                const emoji = test.status === 'PASS' ? '✅' : '❌';
                addLog(`${emoji} ${test.name}: ${test.status}`, test.status === 'PASS' ? 'success' : 'error');
            });
        } else {
            addLog(`❌ Erro no teste: ${result.error}`, 'error');
        }
    } catch (error) {
        addLog(`❌ Erro ao executar teste: ${error.message}`, 'error');
    }
}

// Atualizar botão principal
function updateMainButton() {
    const btn = document.getElementById('mainPowerBtn');
    const status = document.getElementById('mainStatus');
    
    if (systemRunning) {
        btn.className = 'power-button stop';
        btn.innerHTML = '⏹️';
        status.textContent = 'Sistema Rodando';
    } else {
        btn.className = 'power-button start';
        btn.innerHTML = '▶️';
        status.textContent = 'Sistema Parado';
    }
}

// Logs
function addLog(message, type = 'info') {
    const container = document.getElementById('logsContainer');
    if (!container) return;
    
    const timestamp = new Date().toLocaleTimeString();
    
    const logEntry = document.createElement('div');
    logEntry.className = `log-entry ${type}`;
    logEntry.innerHTML = `
        <span class="log-timestamp">[${timestamp}]</span>
        <span>${message}</span>
    `;
    
    container.insertBefore(logEntry, container.firstChild);
    
    // Limitar logs
    const logs = container.querySelectorAll('.log-entry');
    if (logs.length > 100) {
        logs[logs.length - 1].remove();
    }
    
    // Auto scroll
    if (autoScroll) {
        container.scrollTop = 0;
    }
}

// Adicionar log do servidor
function addLogFromServer(logData) {
    const container = document.getElementById('logsContainer');
    if (!container) return;
    
    const timestamp = new Date(logData.timestamp).toLocaleTimeString();
    
    const logEntry = document.createElement('div');
    logEntry.className = `log-entry ${logData.type}`;
    logEntry.innerHTML = `
        <span class="log-timestamp">[${timestamp}]</span>
        <span>${logData.message}</span>
    `;
    
    container.insertBefore(logEntry, container.firstChild);
    
    // Limitar logs
    const logs = container.querySelectorAll('.log-entry');
    if (logs.length > 100) {
        logs[logs.length - 1].remove();
    }
    
    // Auto scroll
    if (autoScroll) {
        container.scrollTop = 0;
    }
}

// Limpar logs - FUNCIONAL
async function clearLogs() {
    try {
        const response = await fetch('/api/control/logs', {
            method: 'DELETE'
        });
        
        if (response.ok) {
            clearLogsDisplay();
            addLog('🧹 Logs limpos', 'info');
        }
    } catch (error) {
        addLog('❌ Erro ao limpar logs', 'error');
    }
}

function clearLogsDisplay() {
    const container = document.getElementById('logsContainer');
    if (container) {
        container.innerHTML = '';
    }
}

function toggleAutoScroll() {
    autoScroll = !autoScroll;
    addLog(`📜 Auto-scroll ${autoScroll ? 'ativado' : 'desativado'}`, 'info');
}

function viewLogs() {
    document.getElementById('logsModal').style.display = 'block';
    
    // Copiar logs para modal
    const mainLogs = document.getElementById('logsContainer').innerHTML;
    document.getElementById('detailedLogs').innerHTML = mainLogs;
}

// Monitoramento de status
function startStatusMonitoring() {
    statusInterval = setInterval(async () => {
        try {
            const response = await fetch('/api/control/status');
            const status = await response.json();
            
            updateServicesFromServer(status);
            
        } catch (error) {
            // Servidor pode estar parado, não mostrar erro constante
            console.log('Status monitoring error:', error);
        }
    }, 10000); // Verificar a cada 10 segundos
}

// Carregar informações do sistema
async function loadSystemInfo() {
    try {
        const response = await fetch('/api/control/status');
        const data = await response.json();
        
        updateSystemInfo(data.system || {});
    } catch (error) {
        console.error('Erro ao carregar info do sistema:', error);
    }
}

function updateSystemInfo(systemData) {
    const systemInfo = document.getElementById('systemInfo');
    if (!systemInfo) return;
    
    const formatMemory = (bytes) => {
        return (bytes / 1024 / 1024).toFixed(2) + ' MB';
    };
    
    const formatUptime = (seconds) => {
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        return `${hours}h ${minutes}m`;
    };
    
    systemInfo.innerHTML = `
        <div class="info-item">
            <div class="info-label">Plataforma</div>
            <div class="info-value">${systemData.platform || navigator.platform}</div>
        </div>
        <div class="info-item">
            <div class="info-label">Node.js</div>
            <div class="info-value">${systemData.node_version || 'N/A'}</div>
        </div>
        <div class="info-item">
            <div class="info-label">Uptime</div>
            <div class="info-value">${systemData.uptime ? formatUptime(systemData.uptime) : 'N/A'}</div>
        </div>
        <div class="info-item">
            <div class="info-label">Memória (RSS)</div>
            <div class="info-value">${systemData.memory ? formatMemory(systemData.memory.rss) : 'N/A'}</div>
        </div>
        <div class="info-item">
            <div class="info-label">PID</div>
            <div class="info-value">${systemData.pid || 'N/A'}</div>
        </div>
        <div class="info-item">
            <div class="info-label">Última Atualização</div>
            <div class="info-value">${new Date().toLocaleTimeString()}</div>
        </div>
    `;
}

// Navegação
function openAdmin() {
    window.open('/admin', '_blank');
    addLog('🔗 Abrindo painel administrativo...', 'info');
}

function openDashboard() {
    window.open('/', '_blank');
    addLog('🔗 Abrindo dashboard...', 'info');
}

// Modais
function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.style.display = 'none';
    }
}

// Utility
function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// Atualizar info do sistema periodicamente
setInterval(loadSystemInfo, 30000);

// Detectar mudanças de conexão
window.addEventListener('online', () => addLog('🌐 Conexão restaurada', 'success'));
window.addEventListener('offline', () => addLog('📴 Conexão perdida', 'warning'));

// Fechar modais clicando fora
window.onclick = function(event) {
    const modals = document.querySelectorAll('.modal');
    modals.forEach(modal => {
        if (event.target === modal) {
            modal.style.display = 'none';
        }
    });
}

// Cleanup ao sair da página
window.addEventListener('beforeunload', function() {
    if (statusInterval) {
        clearInterval(statusInterval);
    }
    if (ws) {
        ws.close();
    }
});

// Forçar atualização de status a cada 5 segundos
setInterval(async () => {
    try {
        const response = await fetch('/api/control/status');
        const status = await response.json();
        updateServicesFromServer(status);
    } catch (error) {
        console.log('Erro na atualização automática:', error);
    }
}, 5000);