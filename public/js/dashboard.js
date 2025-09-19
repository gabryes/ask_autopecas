// public/js/dashboard.js
// Certifique-se de que a biblioteca Chart.js está carregada antes deste script no HTML.
// Por exemplo, adicionando <script src="https://cdn.jsdelivr.net/npm/chart.js"></script> no <head> ou antes de </body>.

// Estado global do dashboard
let dashboardData = {
    stats: {},
    conversations: [],
    activity: [],
    categories: []
};

// Instâncias dos gráficos (para poder destruí-los e recriá-los ao atualizar)
let activityChartInstance = null;
let categoriesChartInstance = null;

// Inicialização
document.addEventListener('DOMContentLoaded', function() {
    initializeDashboard();
    loadDashboardData();
    // Reativação do auto-refresh para buscar dados atualizados a cada 30 segundos
    startAutoRefresh(); 
    // Detectar mudanças de conexão (melhoria anterior)
    window.addEventListener('online', () => {
        console.log('🌐 Conexão restaurada');
        loadDashboardData();
    });
    window.addEventListener('offline', () => {
        console.log('📴 Conexão perdida');
        updateSystemStatus('Offline', 'error');
    });
});

function initializeDashboard() {
    console.log('🎯 Dashboard inicializado');
    updateSystemStatus('Carregando...', 'connecting');
}

// Carregar todos os dados do dashboard
async function loadDashboardData() {
    try {
        // Obtenha a referência ao ServiceManager injetado no app.locals pelo Server.js
        // const serviceManager = window.serviceManager; // Se ServiceManager fosse global no navegador

        // Para obter o status real (uptime, memória, etc) diretamente via API.
        // O ServiceManager no backend já agrupa essas informações em /api/control/status
        const statusResponse = await fetch('/api/control/status');
        const statusData = await statusResponse.json();

        // Carregar estatísticas
        const statsResponse = await fetch('/api/stats');
        const statsData = await statsResponse.json();
        
        // Carregar conversas recentes
        const conversationsResponse = await fetch('/api/conversations/recent');
        const conversationsData = await conversationsResponse.json();
        
        // Carregar dados de atividade
        const activityResponse = await fetch('/api/analytics/activity');
        const activityData = await activityResponse.json();
        
        // Carregar categorias
        const categoriesResponse = await fetch('/api/analytics/categories');
        const categoriesData = await categoriesResponse.json();
        
        // Atualizar dados globais do dashboard
        dashboardData = {
            stats: statsData,
            conversations: conversationsData.conversations || [],
            activity: activityData.data || [],
            categories: categoriesData.categories || []
        };

        // Adicionar informações de sistema do ServiceManager ao dashboardData.stats
        if (statusData && statusData.system) {
            dashboardData.stats.system = statusData.system;
            // Atualiza o status do sistema na header com o status dos serviços.
            const mainServiceStatus = statusData.services && statusData.services.api ? statusData.services.api.status : 'unknown';
            updateSystemStatus(mainServiceStatus, mainServiceStatus);
        }
        
        // Atualizar interface do dashboard
        updateDashboard();
        
    } catch (error) {
        console.error('❌ Erro ao carregar dados do dashboard:', error);
        updateSystemStatus('Erro', 'error');
        showErrorMessage('Erro ao carregar dados do dashboard. Verifique a conexão com o servidor.');
    }
}

// Atualiza todas as seções do dashboard
function updateDashboard() {
    updateStats();
    updateSystemInfo();
    updateConversations();
    updateActivityChart(); // Chama a função que usa Chart.js
    updateCategoriesChart(); // Chama a função que usa Chart.js
    updateSystemStatus('Online', 'running');
}

// Atualizar estatísticas principais (cards)
function updateStats() {
    const { stats } = dashboardData;
    
    // Total de Conversas
    const totalConversationsElement = document.getElementById('totalConversations');
    if (totalConversationsElement) {
        totalConversationsElement.textContent = stats.conversations?.total?.toLocaleString() || '0';
    }

    // Total de Leads
    const totalLeadsElement = document.getElementById('totalLeads');
    if (totalLeadsElement) {
        totalLeadsElement.textContent = stats.leads?.total?.toLocaleString() || '0';
    }
    
    // Conversas Ativas
    const activeConversationsElement = document.getElementById('activeConversations');
    if (activeConversationsElement) {
        activeConversationsElement.textContent = stats.conversations?.active?.toLocaleString() || '0';
        const activeIndicator = document.getElementById('activeIndicator');
        if (activeIndicator) {
            activeIndicator.className = `stat-indicator ${stats.conversations?.active > 0 ? 'running' : 'stopped'}`;
        }
    }

    // Escaladas Hoje
    const escalationsTodayElement = document.getElementById('escalationsToday');
    if (escalationsTodayElement) {
        escalationsTodayElement.textContent = stats.escalations?.today?.toLocaleString() || '0';
        const escalationIndicator = document.getElementById('escalationIndicator');
        if (escalationIndicator) {
            escalationIndicator.className = `stat-indicator ${stats.escalations?.today > 0 ? 'stopped' : 'running'}`; // 'stopped' para indicar algo a ser resolvido
        }
    }
}

// Atualizar informações do sistema (no header e na seção 'Informações do Sistema')
function updateSystemInfo() {
    const { stats } = dashboardData;
    
    if (stats.system) {
        // Uptime no header
        const systemUptimeElement = document.getElementById('systemUptime');
        if (systemUptimeElement) {
            systemUptimeElement.textContent = stats.system.uptime || '--';
        }
        
        // Informações detalhadas do sistema na seção
        const systemInfoElement = document.getElementById('systemInfo');
        if (systemInfoElement) {
            const formatMemory = (bytes) => {
                return bytes ? (bytes / 1024 / 1024).toFixed(2) + ' MB' : 'N/A';
            };
            
            systemInfoElement.innerHTML = `
                <div class="info-item">
                    <div class="info-label">Produtos no Catálogo</div>
                    <div class="info-value">${stats.catalog?.total_products?.toLocaleString() || '0'}</div>
                </div>
                <div class="info-item">
                    <div class="info-label">Categorias de Produtos</div>
                    <div class="info-value">${stats.catalog?.categories?.toLocaleString() || '0'}</div>
                </div>
                <div class="info-item">
                    <div class="info-label">Memória Usada (RSS)</div>
                    <div class="info-value">${formatMemory(stats.system.memory?.rss)}</div>
                </div>
                <div class="info-item">
                    <div class="info-label">Node.js Versão</div>
                    <div class="info-value">${stats.system.node_version || 'N/A'}</div>
                </div>
                <div class="info-item">
                    <div class="info-label">Plataforma</div>
                    <div class="info-value">${stats.system.platform || 'N/A'}</div>
                </div>
                 <div class="info-item">
                    <div class="info-label">PID</div>
                    <div class="info-value">${stats.system.pid || 'N/A'}</div>
                </div>
            `;
        }
    }
}

// Atualizar conversas recentes
function updateConversations() {
    const conversationsElement = document.getElementById('recentConversations');
    if (!conversationsElement) return;

    const getStatusIcon = (status) => {
        switch(status) {
            case 'active': return '🟢';
            case 'waiting': return '🟡'; // Você pode definir este status para Leads que esperam uma resposta
            case 'completed': return '✅';
            case 'escalated': return '🔴';
            case 'new': return '🔵'; // Para novos leads/conversas
            case 'qualified': return '🟣'; // Para leads qualificados
            case 'quoted': return '🟠'; // Para leads com orçamento enviado
            case 'converted': return '⭐'; // Para leads convertidos
            case 'lost': return '⚫'; // Para leads perdidos
            default: return '⚪';
        }
    };
    
    const formatTime = (isoString) => {
        const date = new Date(isoString);
        const now = new Date();
        const diffMinutes = Math.floor((now - date) / (1000 * 60));
        
        if (diffMinutes < 1) return 'Agora';
        if (diffMinutes < 60) return `Há ${diffMinutes}m`;
        const diffHours = Math.floor(diffMinutes / 60);
        if (diffHours < 24) return `Há ${diffHours}h`;
        return date.toLocaleDateString('pt-BR'); // Formato da data para o Brasil
    };
    
    if (dashboardData.conversations.length > 0) {
        conversationsElement.innerHTML = dashboardData.conversations.map(conv => `
            <div class="activity-item">
                <div class="activity-icon">${getStatusIcon(conv.status)}</div>
                <div class="activity-content">
                    <div class="activity-title">${conv.name || conv.contact}</div>
                    <div class="activity-subtitle">${conv.lastMessage}</div>
                    <div class="activity-time">${formatTime(conv.timestamp)}</div>
                </div>
            </div>
        `).join('');
    } else {
        conversationsElement.innerHTML = '<div class="activity-item"><div class="activity-content">Nenhuma conversa recente encontrada.</div></div>';
    }
}

// Atualizar gráfico de atividade com Chart.js
function updateActivityChart() {
    const ctx = document.getElementById('activityChartCanvas');
    if (!ctx) return;

    // Destroi a instância anterior do gráfico se existir
    if (activityChartInstance) {
        activityChartInstance.destroy();
    }

    const labels = dashboardData.activity.map(d => d.day);
    const data = dashboardData.activity.map(d => d.conversations);

    activityChartInstance = new Chart(ctx, {
        type: 'bar', // Tipo de gráfico: barras
        data: {
            labels: labels,
            datasets: [{
                label: 'Total de Conversas',
                data: data,
                backgroundColor: 'rgba(102, 126, 234, 0.7)', // Cor das barras
                borderColor: 'rgba(102, 126, 234, 1)',
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false, // Permite que o gráfico se adapte ao tamanho do contêiner
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        callback: function(value) { if (value % 1 === 0) return value; } // Apenas números inteiros
                    }
                }
            },
            plugins: {
                legend: {
                    display: false // Não exibir a legenda do dataset
                },
                title: {
                    display: true,
                    text: 'Atividade do Chatbot nos Últimos 7 Dias',
                    font: { size: 16 }
                }
            }
        }
    });
}

// Atualizar gráfico de categorias com Chart.js
function updateCategoriesChart() {
    const ctx = document.getElementById('categoriesChartCanvas');
    if (!ctx) return;

    // Destroi a instância anterior do gráfico se existir
    if (categoriesChartInstance) {
        categoriesChartInstance.destroy();
    }

    const labels = dashboardData.categories.map(c => c.name);
    const data = dashboardData.categories.map(c => c.count);

    categoriesChartInstance = new Chart(ctx, {
        type: 'pie', // Tipo de gráfico: pizza
        data: {
            labels: labels,
            datasets: [{
                label: 'Número de Produtos',
                data: data,
                backgroundColor: [
                    '#667eea', // Roxo claro
                    '#764ba2', // Roxo escuro
                    '#a266ea', // Roxo vibrante
                    '#ea667e', // Rosa
                    '#ea764b', // Laranja
                    '#4b76ea', // Azul vibrante
                    '#66ea7e'  // Verde claro
                ],
                hoverOffset: 4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'right', // Posiciona a legenda à direita
                },
                title: {
                    display: true,
                    text: 'Distribuição de Produtos por Categoria',
                    font: { size: 16 }
                }
            }
        }
    });
}

// Atualizar status geral do sistema (no header)
function updateSystemStatus(status, type) {
    const statusElement = document.getElementById('systemStatus');
    if (statusElement) {
        statusElement.textContent = status === 'running' ? 'Online' : (status === 'stopped' ? 'Offline' : 'Verificando...');
        statusElement.className = `stat-value ${type}`;
    }
}

// Mostrar mensagem de erro temporária
function showErrorMessage(message) {
    const dashboardMain = document.querySelector('.dashboard-main');
    if (!dashboardMain) return;

    let errorDiv = document.getElementById('dashboard-error-message');
    if (!errorDiv) {
        errorDiv = document.createElement('div');
        errorDiv.id = 'dashboard-error-message';
        errorDiv.className = 'alert error';
        dashboardMain.prepend(errorDiv);
    }
    errorDiv.textContent = message;
    errorDiv.style.display = 'block';

    setTimeout(() => {
        errorDiv.style.display = 'none';
    }, 5000);
}

// Refresh manual do dashboard
async function refreshDashboard() {
    const refreshBtn = document.getElementById('refreshBtn');
    if (refreshBtn) {
        refreshBtn.textContent = '🔄 Atualizando...';
        refreshBtn.disabled = true;
    }
    
    // Chama o recarregamento de dados
    await loadDashboardData();
    
    if (refreshBtn) {
        refreshBtn.textContent = '🔄 Atualizar';
        refreshBtn.disabled = false;
    }
}

// Inicia o auto-refresh a cada 30 segundos
function startAutoRefresh() {
    setInterval(loadDashboardData, 30000);
    console.log('🔄 Auto-refresh do dashboard iniciado (a cada 30 segundos)');
}
