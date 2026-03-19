/**
 * wqc的棋盘我做主 - Web版五子棋
 */

// ==================== 游戏常量 ====================
const BOARD_SIZE = 15;
const EMPTY = 0;
const BLACK = 1;
const WHITE = 2;

// AI搜索深度（地狱难度但保持快速）
const DEPTH = {
    easy: 2,
    medium: 3,
    hard: 4  // 地狱难度
};

// AI 随机风格（每局随机选择，增加多样性）
let aiStyle = 'balanced';
const AI_RANDOM_FACTOR = 0.1; // 10%随机性

// 棋型分值（地狱版）
const SCORES = {
    FIVE: 10000000,        // 连五 - 必胜
    LIVE_FOUR: 1000000,    // 活四 - 必胜
    DOUBLE_THREE: 500000,  // 双活三 - 接近必胜
    RUSH_FOUR: 100000,     // 冲四 - 极高威胁
    LIVE_THREE: 50000,     // 活三 - 高威胁
    DOUBLE_TWO: 10000,     // 双活二
    SLEEP_THREE: 5000,     // 眠三
    LIVE_TWO: 5000,        // 活二
    SLEEP_TWO: 500         // 眠二
};

// ==================== 游戏状态 ====================
let gameState = {
    board: [],
    currentPlayer: BLACK,
    gameMode: 'pve',
    difficulty: 'medium',
    playerColor: BLACK,
    isGameStarted: false,
    isGameOver: false,
    isThinking: false,
    moveHistory: [],
    startTime: null,
    timerInterval: null,
    lastMove: null,
    winningLine: null,
    previewPos: null  // 预览落子位置
};

// ==================== DOM 元素 ====================
const canvas = document.getElementById('board');
const ctx = canvas.getContext('2d');
const elements = {
    settingsPanel: document.getElementById('settingsPanel'),
    currentPlayer: document.getElementById('currentPlayer'),
    moveCount: document.getElementById('moveCount'),
    gameTime: document.getElementById('gameTime'),
    statusBar: document.getElementById('statusBar'),
    thinkingOverlay: document.getElementById('thinkingOverlay'),
    historyList: document.getElementById('historyList'),
    startBtn: document.getElementById('startBtn'),
    undoBtn: document.getElementById('undoBtn'),
    restartBtn: document.getElementById('restartBtn'),
    gameOverModal: document.getElementById('gameOverModal'),
    modalIcon: document.getElementById('modalIcon'),
    modalTitle: document.getElementById('modalTitle'),
    modalMessage: document.getElementById('modalMessage'),
    playAgainBtn: document.getElementById('playAgainBtn')
};

// 绘图参数
let drawParams = {
    cellSize: 0,
    margin: 0,
    stoneRadius: 0
};

// ==================== 初始化 ====================
function init() {
    initBoard();
    initCanvas();
    initEventListeners();
    drawBoard();
}

function initBoard() {
    gameState.board = Array(BOARD_SIZE).fill(null).map(() => Array(BOARD_SIZE).fill(EMPTY));
}

function initCanvas() {
    const container = canvas.parentElement;
    const size = Math.min(container.clientWidth - 20, 500);
    const dpr = window.devicePixelRatio || 1;
    
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    canvas.style.width = size + 'px';
    canvas.style.height = size + 'px';
    
    ctx.scale(dpr, dpr);
    
    drawParams.margin = size * 0.06;
    drawParams.cellSize = (size - drawParams.margin * 2) / (BOARD_SIZE - 1);
    drawParams.stoneRadius = drawParams.cellSize * 0.42;
}

function initEventListeners() {
    // 画布点击/触摸
    canvas.addEventListener('click', handleCanvasClick);
    canvas.addEventListener('touchend', handleCanvasTouchEnd);
    
    // 按钮
    elements.startBtn.addEventListener('click', startGame);
    elements.undoBtn.addEventListener('click', undoMove);
    elements.restartBtn.addEventListener('click', restartGame);
    elements.playAgainBtn.addEventListener('click', () => {
        elements.gameOverModal.classList.remove('show');
        restartGame();
    });
    
    // 设置面板 - 单选按钮
    document.querySelectorAll('.radio-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            const group = this.closest('.radio-group');
            group.querySelectorAll('.radio-btn').forEach(b => b.classList.remove('active'));
            this.classList.add('active');
            this.querySelector('input').checked = true;
            
            // 游戏模式切换时显示/隐藏AI设置
            if (this.closest('.setting-group').querySelector('label')?.textContent === '游戏模式') {
                const aiSettings = document.querySelectorAll('.ai-settings');
                const isPvP = this.dataset.value === 'pvp';
                aiSettings.forEach(s => s.classList.toggle('hidden', isPvP));
            }
        });
    });
    
    // 窗口大小变化
    window.addEventListener('resize', () => {
        initCanvas();
        drawBoard();
    });
}

// ==================== 游戏控制 ====================
function startGame() {
    // 读取设置
    gameState.gameMode = document.querySelector('input[name="gameMode"]:checked').value;
    gameState.difficulty = document.querySelector('input[name="difficulty"]:checked').value;
    gameState.playerColor = document.querySelector('input[name="playerColor"]:checked').value === 'black' ? BLACK : WHITE;
    
    // 重置状态
    initBoard();
    gameState.currentPlayer = BLACK;
    gameState.isGameStarted = true;
    gameState.isGameOver = false;
    gameState.moveHistory = [];
    gameState.lastMove = null;
    gameState.winningLine = null;
    gameState.previewPos = null;  // 清除预览
    
    // UI更新
    elements.settingsPanel.style.opacity = '0.6';
    elements.settingsPanel.style.pointerEvents = 'none';
    elements.undoBtn.disabled = false;
    elements.restartBtn.disabled = false;
    elements.startBtn.textContent = '游戏中...';
    elements.startBtn.disabled = true;
    elements.historyList.innerHTML = '';
    
    // 开始计时
    gameState.startTime = Date.now();
    if (gameState.timerInterval) clearInterval(gameState.timerInterval);
    gameState.timerInterval = setInterval(updateTimer, 1000);
    
    updateUI();
    drawBoard();
    setStatus('游戏开始！黑方先行');
    
    // AI先手
    if (gameState.gameMode === 'pve' && gameState.playerColor === WHITE) {
        setTimeout(() => makeAIMove(), 300);
    }
}

function restartGame() {
    if (gameState.timerInterval) {
        clearInterval(gameState.timerInterval);
    }
    elements.gameTime.textContent = '00:00';
    elements.settingsPanel.style.opacity = '1';
    elements.settingsPanel.style.pointerEvents = 'auto';
    elements.startBtn.textContent = '开始游戏';
    elements.startBtn.disabled = false;
    
    gameState.isGameStarted = false;
    gameState.isGameOver = false;
    
    startGame();
}

function undoMove() {
    if (!gameState.isGameStarted || gameState.isGameOver || gameState.isThinking) return;
    if (gameState.moveHistory.length === 0) return;
    
    // 清除预览
    clearPreview();
    
    // 人机模式撤销两步
    const undoCount = (gameState.gameMode === 'pve' && gameState.moveHistory.length >= 2) ? 2 : 1;
    
    for (let i = 0; i < undoCount && gameState.moveHistory.length > 0; i++) {
        const lastMove = gameState.moveHistory.pop();
        gameState.board[lastMove.row][lastMove.col] = EMPTY;
    }
    
    // 更新当前玩家
    gameState.currentPlayer = gameState.moveHistory.length % 2 === 0 ? BLACK : WHITE;
    gameState.lastMove = gameState.moveHistory.length > 0 ? gameState.moveHistory[gameState.moveHistory.length - 1] : null;
    
    updateUI();
    updateHistoryList();
    drawBoard();
    setStatus(`已悔棋，轮到${gameState.currentPlayer === BLACK ? '黑方' : '白方'}落子`);
}

// ==================== 落子处理 ====================
function handleCanvasClick(e) {
    if (!gameState.isGameStarted || gameState.isGameOver || gameState.isThinking) return;
    
    // 人机模式下非玩家回合不能落子
    if (gameState.gameMode === 'pve' && gameState.currentPlayer !== gameState.playerColor) return;
    
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    const pos = getBoardPosition(x, y);
    if (pos) {
        handlePositionClick(pos);
    }
}

function handleCanvasTouchEnd(e) {
    // 只有在游戏进行中且点击有效位置时才阻止默认行为
    if (!gameState.isGameStarted || gameState.isGameOver || gameState.isThinking) return;
    if (gameState.gameMode === 'pve' && gameState.currentPlayer !== gameState.playerColor) return;
    
    const touch = e.changedTouches[0];
    const rect = canvas.getBoundingClientRect();
    const x = touch.clientX - rect.left;
    const y = touch.clientY - rect.top;
    
    const pos = getBoardPosition(x, y);
    if (pos) {
        e.preventDefault();  // 只在有效点击时阻止
        handlePositionClick(pos);
    }
}

// 处理位置点击（预览确认机制）
function handlePositionClick(pos) {
    // 位置已有棋子，忽略
    if (gameState.board[pos.row][pos.col] !== EMPTY) return;
    
    // 检查是否点击了预览位置
    if (gameState.previewPos && 
        gameState.previewPos.row === pos.row && 
        gameState.previewPos.col === pos.col) {
        // 再次点击同一位置，确认落子
        gameState.previewPos = null;
        if (placeStone(pos.row, pos.col)) {
            afterMove();
        }
    } else {
        // 第一次点击或点击了新位置，显示预览
        gameState.previewPos = pos;
        drawBoard();
        setStatus(`点击相同位置确认落子 (${pos.row + 1}, ${pos.col + 1})`);
    }
}

// 清除预览（AI落子后、悔棋后等）
function clearPreview() {
    gameState.previewPos = null;
}

function getBoardPosition(x, y) {
    const col = Math.round((x - drawParams.margin) / drawParams.cellSize);
    const row = Math.round((y - drawParams.margin) / drawParams.cellSize);
    
    if (row < 0 || row >= BOARD_SIZE || col < 0 || col >= BOARD_SIZE) return null;
    
    // 检查是否在交叉点附近
    const centerX = drawParams.margin + col * drawParams.cellSize;
    const centerY = drawParams.margin + row * drawParams.cellSize;
    const distance = Math.sqrt(Math.pow(x - centerX, 2) + Math.pow(y - centerY, 2));
    
    if (distance > drawParams.cellSize * 0.45) return null;
    
    return { row, col };
}

function placeStone(row, col) {
    if (gameState.board[row][col] !== EMPTY) return false;
    
    gameState.board[row][col] = gameState.currentPlayer;
    gameState.lastMove = { row, col, player: gameState.currentPlayer };
    gameState.moveHistory.push({ row, col, player: gameState.currentPlayer });
    
    return true;
}

function afterMove() {
    drawBoard();
    updateUI();
    addMoveToHistory(gameState.lastMove);
    
    // 检查胜负
    const winner = checkWin(gameState.lastMove.row, gameState.lastMove.col);
    if (winner) {
        endGame(winner);
        return;
    }
    
    // 检查平局
    if (gameState.moveHistory.length >= BOARD_SIZE * BOARD_SIZE) {
        endGame('draw');
        return;
    }
    
    // 切换玩家
    gameState.currentPlayer = gameState.currentPlayer === BLACK ? WHITE : BLACK;
    setStatus(`轮到${gameState.currentPlayer === BLACK ? '黑方' : '白方'}落子`);
    
    // AI回合
    if (gameState.gameMode === 'pve' && gameState.currentPlayer !== gameState.playerColor && !gameState.isGameOver) {
        setTimeout(() => makeAIMove(), 200);
    }
}

// ==================== AI ====================
function makeAIMove() {
    if (gameState.isGameOver) return;
    
    gameState.isThinking = true;
    
    // 立即计算，不显示思考中
    const move = findBestMove();
    
    gameState.isThinking = false;
    
    if (move && placeStone(move.row, move.col)) {
        afterMove();
    }
}

function findBestMove() {
    const depth = DEPTH[gameState.difficulty] || 3;
    const aiColor = gameState.currentPlayer;
    const opponent = aiColor === BLACK ? WHITE : BLACK;
    
    // 每局随机选择AI风格
    if (gameState.moveHistory.length <= 1) {
        const styles = ['aggressive', 'defensive', 'balanced', 'center', 'edge'];
        aiStyle = styles[Math.floor(Math.random() * styles.length)];
    }
    
    // 第一步：多样化开局
    if (gameState.moveHistory.length === 0) {
        const openings = [
            { row: 7, col: 7 },   // 天元
            { row: 7, col: 8 },   // 偏右
            { row: 8, col: 7 },   // 偏下
            { row: 6, col: 6 },   // 左上角
            { row: 8, col: 8 },   // 右下角
        ];
        return openings[Math.floor(Math.random() * openings.length)];
    }
    
    // 第二步：多样化跟随
    if (gameState.moveHistory.length === 1) {
        const last = gameState.moveHistory[0];
        const offsets = [[-1, -1], [-1, 1], [1, -1], [1, 1], [-1, 0], [1, 0], [0, -1], [0, 1], [-2, -2], [2, 2]];
        // 随机打乱顺序
        offsets.sort(() => Math.random() - 0.5);
        for (const [dr, dc] of offsets) {
            const r = last.row + dr;
            const c = last.col + dc;
            if (r >= 0 && r < BOARD_SIZE && c >= 0 && c < BOARD_SIZE && gameState.board[r][c] === EMPTY) {
                return { row: r, col: c };
            }
        }
    }
    
    const candidates = getCandidateMoves();
    
    // 快速检测：能赢就直接下
    for (const move of candidates) {
        gameState.board[move.row][move.col] = aiColor;
        if (checkWin(move.row, move.col, false)) {
            gameState.board[move.row][move.col] = EMPTY;
            return move;
        }
        gameState.board[move.row][move.col] = EMPTY;
    }
    
    // 快速检测：对手能赢的点必须堵
    for (const move of candidates) {
        gameState.board[move.row][move.col] = opponent;
        if (checkWin(move.row, move.col, false)) {
            gameState.board[move.row][move.col] = EMPTY;
            return move;  // 必须堵住
        }
        gameState.board[move.row][move.col] = EMPTY;
    }
    
    // 检测对手的活四/冲四威胁
    let urgentDefense = findUrgentDefenseMove(candidates, opponent);
    if (urgentDefense) {
        return urgentDefense;
    }
    
    // 检测自己能否形成活四/双三
    let urgentAttack = findUrgentAttackMove(candidates, aiColor);
    if (urgentAttack) {
        return urgentAttack;
    }
    
    // Alpha-Beta搜索 + 多样性
    let scoredMoves = [];
    
    for (const move of candidates) {
        gameState.board[move.row][move.col] = aiColor;
        let score = minimax(depth - 1, -Infinity, Infinity, false, aiColor);
        gameState.board[move.row][move.col] = EMPTY;
        
        // 根据AI风格调整分数
        score = applyStyleBonus(move, score, aiColor);
        
        // 添加随机因子（让棋路更多样）
        score += (Math.random() - 0.5) * AI_RANDOM_FACTOR * Math.abs(score);
        
        scoredMoves.push({ move, score });
    }
    
    // 按分数排序
    scoredMoves.sort((a, b) => b.score - a.score);
    
    // 困难模式：从前3个最佳中随机选（增加不可预测性）
    // 简单/中等：选最佳
    if (gameState.difficulty === 'hard' && scoredMoves.length >= 3) {
        const topN = Math.min(3, scoredMoves.length);
        const pick = Math.floor(Math.random() * topN);
        return scoredMoves[pick].move;
    }
    
    return scoredMoves.length > 0 ? scoredMoves[0].move : null;
}

// 寻找紧急防守点（对手的活四、冲四、活三）
function findUrgentDefenseMove(candidates, opponent) {
    for (const move of candidates) {
        gameState.board[move.row][move.col] = opponent;
        const threat = evaluatePointThreat(move.row, move.col, opponent);
        gameState.board[move.row][move.col] = EMPTY;
        
        // 活四或冲四必须防守
        if (threat.hasFour) {
            return move;
        }
    }
    
    // 检测活三（稍低优先级但也很重要）
    for (const move of candidates) {
        gameState.board[move.row][move.col] = opponent;
        const threat = evaluatePointThreat(move.row, move.col, opponent);
        gameState.board[move.row][move.col] = EMPTY;
        
        if (threat.liveThreeCount >= 1) {
            return move;
        }
    }
    
    return null;
}

// 寻找紧急进攻点（自己的活四、双三）
function findUrgentAttackMove(candidates, aiColor) {
    for (const move of candidates) {
        gameState.board[move.row][move.col] = aiColor;
        const threat = evaluatePointThreat(move.row, move.col, aiColor);
        gameState.board[move.row][move.col] = EMPTY;
        
        // 活四必下
        if (threat.hasFour) {
            return move;
        }
        
        // 双活三也是好棋
        if (threat.liveThreeCount >= 2) {
            return move;
        }
    }
    return null;
}

// 评估某个位置的威胁程度
function evaluatePointThreat(row, col, color) {
    const directions = [[0, 1], [1, 0], [1, 1], [1, -1]];
    let hasFour = false;
    let liveThreeCount = 0;
    
    for (const [dr, dc] of directions) {
        const { count, openEnds } = countLine(row, col, dr, dc, color);
        
        if (count >= 4 && openEnds >= 1) {
            hasFour = true;
        }
        if (count === 3 && openEnds === 2) {
            liveThreeCount++;
        }
    }
    
    return { hasFour, liveThreeCount };
}

// 根据AI风格给予额外加分
function applyStyleBonus(move, score, aiColor) {
    const centerDist = Math.abs(move.row - 7) + Math.abs(move.col - 7);
    
    switch (aiStyle) {
        case 'aggressive':
            // 进攻型：优先自己的进攻点
            score *= 1.1;
            break;
        case 'defensive':
            // 防守型：更关注对手的威胁
            break;
        case 'center':
            // 中心型：偏好靠近中心
            score += (14 - centerDist) * 100;
            break;
        case 'edge':
            // 边缘型：偏好边缘布局
            score += centerDist * 50;
            break;
        case 'balanced':
        default:
            // 平衡型
            break;
    }
    
    return score;
}

function minimax(depth, alpha, beta, isMaximizing, aiColor) {
    // 检查终止条件
    const winner = checkWinAll();
    if (winner === aiColor) return SCORES.FIVE;
    if (winner === (aiColor === BLACK ? WHITE : BLACK)) return -SCORES.FIVE;
    if (depth === 0) return evaluate(aiColor);
    
    const candidates = getCandidateMoves();
    if (candidates.length === 0) return 0;
    
    if (isMaximizing) {
        let maxScore = -Infinity;
        for (const move of candidates) {
            gameState.board[move.row][move.col] = aiColor;
            const score = minimax(depth - 1, alpha, beta, false, aiColor);
            gameState.board[move.row][move.col] = EMPTY;
            maxScore = Math.max(maxScore, score);
            alpha = Math.max(alpha, score);
            if (beta <= alpha) break;
        }
        return maxScore;
    } else {
        let minScore = Infinity;
        const opponent = aiColor === BLACK ? WHITE : BLACK;
        for (const move of candidates) {
            gameState.board[move.row][move.col] = opponent;
            const score = minimax(depth - 1, alpha, beta, true, aiColor);
            gameState.board[move.row][move.col] = EMPTY;
            minScore = Math.min(minScore, score);
            beta = Math.min(beta, score);
            if (beta <= alpha) break;
        }
        return minScore;
    }
}

function getCandidateMoves() {
    const candidates = [];
    const visited = new Set();
    
    // 获取已有棋子周围的空位
    for (let r = 0; r < BOARD_SIZE; r++) {
        for (let c = 0; c < BOARD_SIZE; c++) {
            if (gameState.board[r][c] !== EMPTY) {
                for (let dr = -2; dr <= 2; dr++) {
                    for (let dc = -2; dc <= 2; dc++) {
                        const nr = r + dr;
                        const nc = c + dc;
                        const key = `${nr},${nc}`;
                        if (nr >= 0 && nr < BOARD_SIZE && nc >= 0 && nc < BOARD_SIZE &&
                            gameState.board[nr][nc] === EMPTY && !visited.has(key)) {
                            visited.add(key);
                            candidates.push({ row: nr, col: nc });
                        }
                    }
                }
            }
        }
    }
    
    // 如果没有候选点，选择中心
    if (candidates.length === 0) {
        candidates.push({ row: 7, col: 7 });
    }
    
    // 按评估分数排序（加速剪枝）
    candidates.sort((a, b) => {
        const scoreA = evaluatePoint(a.row, a.col, gameState.currentPlayer);
        const scoreB = evaluatePoint(b.row, b.col, gameState.currentPlayer);
        return scoreB - scoreA;
    });
    
    // 限制候选数量（地狱难度增加候选）
    const maxCandidates = gameState.difficulty === 'hard' ? 15 : (gameState.difficulty === 'medium' ? 12 : 10);
    return candidates.slice(0, maxCandidates);
}

function evaluate(aiColor) {
    let score = 0;
    const opponent = aiColor === BLACK ? WHITE : BLACK;
    
    // 根据难度调整攻防权重
    const defenseWeight = gameState.difficulty === 'hard' ? 1.2 : 
                          (gameState.difficulty === 'medium' ? 1.15 : 1.1);
    
    // 评估每个位置
    for (let r = 0; r < BOARD_SIZE; r++) {
        for (let c = 0; c < BOARD_SIZE; c++) {
            if (gameState.board[r][c] === aiColor) {
                score += evaluatePoint(r, c, aiColor);
            } else if (gameState.board[r][c] === opponent) {
                // 对手的威胁要加权（防守更重要）
                score -= evaluatePoint(r, c, opponent) * defenseWeight;
            }
        }
    }
    
    return score;
}

// 检查某个位置对特定颜色的紧急威胁
function checkUrgentThreat(row, col, color) {
    const directions = [[0, 1], [1, 0], [1, 1], [1, -1]];
    
    for (const [dr, dc] of directions) {
        const { count, openEnds } = countLine(row, col, dr, dc, color);
        // 活四或冲四是紧急威胁
        if (count >= 4 && openEnds >= 1) return true;
        // 活三也是威胁
        if (count === 3 && openEnds === 2) return true;
    }
    return false;
}

function evaluatePoint(row, col, color) {
    const directions = [[0, 1], [1, 0], [1, 1], [1, -1]];
    let totalScore = 0;
    let liveThreeCount = 0;
    let rushFourCount = 0;
    let liveTwoCount = 0;
    let sleepThreeCount = 0;
    
    for (const [dr, dc] of directions) {
        const { count, openEnds, pattern } = countLine(row, col, dr, dc, color);
        const score = getPatternScore(count, openEnds);
        totalScore += score;
        
        // 统计棋型数量
        if (count === 4 && openEnds >= 1) rushFourCount++;
        if (count === 3 && openEnds === 2) liveThreeCount++;
        if (count === 3 && openEnds === 1) sleepThreeCount++;
        if (count === 2 && openEnds === 2) liveTwoCount++;
    }
    
    // 组合棋型加分（这些是必胜或接近必胜的棋型）
    
    // 双冲四 = 必胜
    if (rushFourCount >= 2) {
        totalScore += SCORES.LIVE_FOUR;
    }
    
    // 冲四+活三 = 必胜
    if (rushFourCount >= 1 && liveThreeCount >= 1) {
        totalScore += SCORES.DOUBLE_THREE * 2;
    }
    
    // 双活三 = 接近必胜
    if (liveThreeCount >= 2) {
        totalScore += SCORES.DOUBLE_THREE;
    }
    
    // 活三+眠三 = 高威胁
    if (liveThreeCount >= 1 && sleepThreeCount >= 1) {
        totalScore += SCORES.LIVE_THREE;
    }
    
    // 双活二 = 发展潜力
    if (liveTwoCount >= 2) {
        totalScore += SCORES.DOUBLE_TWO;
    }
    
    // 活三+活二 = 好形态
    if (liveThreeCount >= 1 && liveTwoCount >= 1) {
        totalScore += SCORES.LIVE_TWO * 2;
    }
    
    return totalScore;
}

function countLine(row, col, dr, dc, color) {
    let count = 1;
    let openEnds = 0;
    let block1 = false, block2 = false;
    
    // 正向
    let r = row + dr, c = col + dc;
    while (r >= 0 && r < BOARD_SIZE && c >= 0 && c < BOARD_SIZE && gameState.board[r][c] === color) {
        count++;
        r += dr;
        c += dc;
    }
    if (r >= 0 && r < BOARD_SIZE && c >= 0 && c < BOARD_SIZE && gameState.board[r][c] === EMPTY) {
        openEnds++;
    } else {
        block1 = true;
    }
    
    // 反向
    r = row - dr;
    c = col - dc;
    while (r >= 0 && r < BOARD_SIZE && c >= 0 && c < BOARD_SIZE && gameState.board[r][c] === color) {
        count++;
        r -= dr;
        c -= dc;
    }
    if (r >= 0 && r < BOARD_SIZE && c >= 0 && c < BOARD_SIZE && gameState.board[r][c] === EMPTY) {
        openEnds++;
    } else {
        block2 = true;
    }
    
    return { count, openEnds, blocked: block1 && block2 };
}

function getPatternScore(count, openEnds) {
    if (count >= 5) return SCORES.FIVE;
    if (openEnds === 0) return 0;  // 两端都被堵，无价值
    if (count === 4) {
        if (openEnds === 2) return SCORES.LIVE_FOUR;
        if (openEnds === 1) return SCORES.RUSH_FOUR;
    }
    if (count === 3) {
        if (openEnds === 2) return SCORES.LIVE_THREE;
        if (openEnds === 1) return SCORES.SLEEP_THREE;
    }
    if (count === 2) {
        if (openEnds === 2) return SCORES.LIVE_TWO;
        if (openEnds === 1) return SCORES.SLEEP_TWO;
    }
    return 0;
}

// ==================== 胜负判定 ====================
function checkWin(row, col, saveWinningLine = true) {
    const color = gameState.board[row][col];
    if (color === EMPTY) return null;
    
    const directions = [[0, 1], [1, 0], [1, 1], [1, -1]];
    
    for (const [dr, dc] of directions) {
        const line = [{ row, col }];
        
        // 正向
        let r = row + dr, c = col + dc;
        while (r >= 0 && r < BOARD_SIZE && c >= 0 && c < BOARD_SIZE && gameState.board[r][c] === color) {
            line.push({ row: r, col: c });
            r += dr;
            c += dc;
        }
        
        // 反向
        r = row - dr;
        c = col - dc;
        while (r >= 0 && r < BOARD_SIZE && c >= 0 && c < BOARD_SIZE && gameState.board[r][c] === color) {
            line.unshift({ row: r, col: c });
            r -= dr;
            c -= dc;
        }
        
        if (line.length >= 5) {
            // 只有在需要保存时才设置 winningLine（避免 AI 评估时设置）
            if (saveWinningLine) {
                gameState.winningLine = line;
            }
            return color;
        }
    }
    
    return null;
}

// AI评估用的检查胜负，不设置 winningLine
function checkWinAll() {
    for (let r = 0; r < BOARD_SIZE; r++) {
        for (let c = 0; c < BOARD_SIZE; c++) {
            if (gameState.board[r][c] !== EMPTY) {
                // 传入 false，不保存 winningLine
                const winner = checkWin(r, c, false);
                if (winner) return winner;
            }
        }
    }
    return null;
}

function endGame(result) {
    gameState.isGameOver = true;
    clearInterval(gameState.timerInterval);
    
    drawBoard();
    
    let icon, title, message;
    
    if (result === 'draw') {
        icon = '🤝';
        title = '平局';
        message = '棋逢对手！';
    } else if (result === BLACK) {
        icon = '🎉';
        title = '黑方获胜';
        message = gameState.gameMode === 'pve' && gameState.playerColor === BLACK ? '恭喜你赢了！' : (gameState.gameMode === 'pve' ? 'AI 获胜' : '黑方获胜！');
    } else {
        icon = '🎉';
        title = '白方获胜';
        message = gameState.gameMode === 'pve' && gameState.playerColor === WHITE ? '恭喜你赢了！' : (gameState.gameMode === 'pve' ? 'AI 获胜' : '白方获胜！');
    }
    
    elements.modalIcon.textContent = icon;
    elements.modalTitle.textContent = title;
    elements.modalMessage.textContent = message;
    
    setTimeout(() => {
        elements.gameOverModal.classList.add('show');
    }, 500);
    
    setStatus(title + '！');
}

// ==================== 绘图 ====================
function drawBoard() {
    const size = parseInt(canvas.style.width);
    
    // 清空画布
    ctx.clearRect(0, 0, size, size);
    
    // 绘制背景
    ctx.fillStyle = '#DCB35C';
    ctx.fillRect(0, 0, size, size);
    
    // 绘制网格线
    ctx.strokeStyle = '#32200A';
    ctx.lineWidth = 1;
    
    for (let i = 0; i < BOARD_SIZE; i++) {
        const pos = drawParams.margin + i * drawParams.cellSize;
        
        // 横线
        ctx.beginPath();
        ctx.moveTo(drawParams.margin, pos);
        ctx.lineTo(size - drawParams.margin, pos);
        ctx.stroke();
        
        // 竖线
        ctx.beginPath();
        ctx.moveTo(pos, drawParams.margin);
        ctx.lineTo(pos, size - drawParams.margin);
        ctx.stroke();
    }
    
    // 绘制星位点
    const starPoints = [[7, 7], [3, 3], [3, 11], [11, 3], [11, 11], [3, 7], [7, 3], [7, 11], [11, 7]];
    ctx.fillStyle = '#32200A';
    for (const [r, c] of starPoints) {
        const x = drawParams.margin + c * drawParams.cellSize;
        const y = drawParams.margin + r * drawParams.cellSize;
        ctx.beginPath();
        ctx.arc(x, y, 4, 0, Math.PI * 2);
        ctx.fill();
    }
    
    // 绘制棋子
    for (let r = 0; r < BOARD_SIZE; r++) {
        for (let c = 0; c < BOARD_SIZE; c++) {
            if (gameState.board[r][c] !== EMPTY) {
                drawStone(r, c, gameState.board[r][c]);
            }
        }
    }
    
    // 绘制预览虚影
    if (gameState.previewPos && !gameState.isGameOver) {
        drawPreviewStone(gameState.previewPos.row, gameState.previewPos.col, gameState.currentPlayer);
    }
    
    // 绘制最后落子标记
    if (gameState.lastMove) {
        const x = drawParams.margin + gameState.lastMove.col * drawParams.cellSize;
        const y = drawParams.margin + gameState.lastMove.row * drawParams.cellSize;
        ctx.fillStyle = '#FF0000';
        ctx.beginPath();
        ctx.arc(x, y, 4, 0, Math.PI * 2);
        ctx.fill();
    }
    
    // 绘制胜利连线
    if (gameState.winningLine && gameState.winningLine.length >= 2) {
        const first = gameState.winningLine[0];
        const last = gameState.winningLine[gameState.winningLine.length - 1];
        
        ctx.strokeStyle = 'rgba(255, 0, 0, 0.7)';
        ctx.lineWidth = 4;
        ctx.lineCap = 'round';
        
        ctx.beginPath();
        ctx.moveTo(drawParams.margin + first.col * drawParams.cellSize, drawParams.margin + first.row * drawParams.cellSize);
        ctx.lineTo(drawParams.margin + last.col * drawParams.cellSize, drawParams.margin + last.row * drawParams.cellSize);
        ctx.stroke();
    }
}

function drawStone(row, col, color) {
    const x = drawParams.margin + col * drawParams.cellSize;
    const y = drawParams.margin + row * drawParams.cellSize;
    const r = drawParams.stoneRadius;
    
    // 渐变填充
    const gradient = ctx.createRadialGradient(x - r * 0.3, y - r * 0.3, 0, x, y, r);
    
    if (color === BLACK) {
        gradient.addColorStop(0, '#505050');
        gradient.addColorStop(1, '#141414');
    } else {
        gradient.addColorStop(0, '#FFFFFF');
        gradient.addColorStop(1, '#DCDCDC');
    }
    
    // 阴影
    ctx.save();
    ctx.shadowColor = 'rgba(0, 0, 0, 0.4)';
    ctx.shadowBlur = 5;
    ctx.shadowOffsetX = 2;
    ctx.shadowOffsetY = 2;
    
    // 绘制棋子
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
    
    ctx.restore();
    
    // 边框
    ctx.strokeStyle = color === BLACK ? '#000' : '#999';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.stroke();
}

// 绘制预览棋子（虚影效果）
function drawPreviewStone(row, col, color) {
    const x = drawParams.margin + col * drawParams.cellSize;
    const y = drawParams.margin + row * drawParams.cellSize;
    const r = drawParams.stoneRadius;
    
    ctx.save();
    ctx.globalAlpha = 0.5;  // 半透明
    
    // 简化的渐变
    const gradient = ctx.createRadialGradient(x - r * 0.3, y - r * 0.3, 0, x, y, r);
    
    if (color === BLACK) {
        gradient.addColorStop(0, '#505050');
        gradient.addColorStop(1, '#141414');
    } else {
        gradient.addColorStop(0, '#FFFFFF');
        gradient.addColorStop(1, '#DCDCDC');
    }
    
    // 绘制半透明棋子
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
    
    // 虚线边框
    ctx.strokeStyle = color === BLACK ? '#000' : '#999';
    ctx.lineWidth = 2;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.stroke();
    
    ctx.restore();
    
    // 绘制提示文字 "点击确认"
    ctx.save();
    ctx.fillStyle = '#FF6600';
    ctx.font = 'bold 10px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('点击确认', x, y + r + 12);
    ctx.restore();
}

// ==================== UI更新 ====================
function updateUI() {
    elements.currentPlayer.textContent = gameState.currentPlayer === BLACK ? '⚫ 黑方' : '⚪ 白方';
    elements.moveCount.textContent = gameState.moveHistory.length;
}

function setStatus(text) {
    elements.statusBar.textContent = text;
}

function updateTimer() {
    if (!gameState.startTime) return;
    const elapsed = Math.floor((Date.now() - gameState.startTime) / 1000);
    const minutes = Math.floor(elapsed / 60).toString().padStart(2, '0');
    const seconds = (elapsed % 60).toString().padStart(2, '0');
    elements.gameTime.textContent = `${minutes}:${seconds}`;
}

function addMoveToHistory(move) {
    const symbol = move.player === BLACK ? '⚫' : '⚪';
    const text = `${gameState.moveHistory.length}. ${symbol} (${move.row + 1}, ${move.col + 1})`;
    elements.historyList.innerHTML += `<div>${text}</div>`;
    elements.historyList.scrollTop = elements.historyList.scrollHeight;
}

function updateHistoryList() {
    elements.historyList.innerHTML = '';
    gameState.moveHistory.forEach((move, index) => {
        const symbol = move.player === BLACK ? '⚫' : '⚪';
        const text = `${index + 1}. ${symbol} (${move.row + 1}, ${move.col + 1})`;
        elements.historyList.innerHTML += `<div>${text}</div>`;
    });
}

// ==================== 启动 ====================
document.addEventListener('DOMContentLoaded', init);
