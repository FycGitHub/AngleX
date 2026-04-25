// 游戏状态
const gameState = {
    currentAngle: 0,        // 当前角度（不受360°限制）
    currentLoop: 0,         // 当前圈数
    currentTask: 1,         // 当前任务编号
    isDragging: false,      // 是否正在拖动
    lastAngle: 0,           // 上次的角度（用于计算圈数）
    history: [],            // 旋转历史记录
    normalizedAngleShown: false,  // 是否显示等效主角度
    completedTasks: [],     // 已完成的任务ID列表
    firstTaskSpoken: false // 第一个任务是否已播报
};

// 任务配置
const tasks = [
    {
        id: 1,
        name: "任务1：零的起点",
        description: "欢迎，船长！请调整飞船航向至初始位置（0°）。",
        target: "旋转到 0°",
        validate: (angle) => {
            const normalized = normalizeAngle(angle);
            return Math.abs(normalized) < 10; // 允许10°误差
        },
        feedback: "完美！我们已经校准完毕。"
    },
    {
        id: 2,
        name: "任务2：正向探索",
        description: "发现右前方有颗小行星！请将飞船向左（逆时针）旋转90°进行观察。",
        target: "旋转到 90°",
        validate: (angle) => {
            const normalized = normalizeAngle(angle);
            return Math.abs(normalized - 90) < 10; // 允许10°误差
        },
        feedback: "很好！这种逆时针旋转形成的角，我们称之为正角。"
    },
    {
        id: 3,
        name: "任务3：负向规避",
        description: "左翼有太空碎片！紧急向右（顺时针）旋转120°进行规避！",
        target: "旋转到 -120°",
        validate: (angle) => {
            const normalized = normalizeAngle(angle);
            // 接受-120°或240°（终边相同），允许10°误差
            return Math.abs(normalized - (-120)) < 10 || (Math.abs(normalized - 240) < 10 && angle < 0);
        },
        feedback: "成功规避！这种顺时针旋转形成的角，我们称之为负角。"
    },
    {
        id: 4,
        name: "任务4：连续追踪",
        description: "目标正在绕圈飞行。请连续逆时针跟踪它一圈多，最终停在450°的位置。",
        target: "旋转到 450°",
        validate: (angle) => {
            const normalized = normalizeAngle(angle);
            return Math.abs(normalized - 90) < 10 && angle >= 360; // 终边相同且超过360°，允许10°误差
        },
        feedback: "太棒了！角的度数可以远远超过360°，这描述了物体连续旋转的运动。"
    },
    {
        id: 5,
        name: "任务5：反向盘旋",
        description: "执行一个反向盘旋降落动作，顺时针旋转两圈后，停在-750°的位置。",
        target: "旋转到 -750°",
        validate: (angle) => {
            const normalized = normalizeAngle(angle);
            // -750° = -30° (终边相同)，允许10°误差
            return Math.abs(normalized - (-30)) < 10 && angle <= -360;
        },
        feedback: "降落成功！负角同样可以描述多圈旋转。"
    }
];

// DOM元素
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const currentAngleDisplay = document.getElementById('currentAngle');
const normalizedAngleDisplay = document.getElementById('normalizedAngle');
const currentLoopDisplay = document.getElementById('currentLoop');
const historyList = document.getElementById('historyList');
const taskName = document.getElementById('taskName');
const taskDescription = document.getElementById('taskDescription');
const taskTarget = document.getElementById('taskTarget');
const taskFeedback = document.getElementById('taskFeedback');
const btnSubmit = document.getElementById('btnSubmit');
const btnReset = document.getElementById('btnReset');
const btnCounterClockwise = document.getElementById('btnCounterClockwise');
const btnClockwise = document.getElementById('btnClockwise');
const progressFill = document.getElementById('progressFill');
const progressText = document.getElementById('progressText');
const taskList = document.getElementById('taskList');

// Canvas中心点（会在绘制时动态计算）
let centerX, centerY;

// 配置游戏主播风格的语音参数
function configureGameHostVoice(utterance) {
    // 优化后的语音参数：更自然、更好听
    utterance.lang = 'zh-CN';
    utterance.rate = 1.0;   // 正常语速（不要太快，保持清晰）
    utterance.pitch = 1.0;   // 正常音调（不要太尖锐）
    utterance.volume = 0.9;  // 稍低音量（避免刺耳）
    
    // 优先选择更自然的中文语音
    const voices = window.speechSynthesis.getVoices();
    
    // 优先选择列表（按优先级排序，选择最自然的声音）
    const preferredVoices = [
        'Microsoft Yaoyao',           // Windows 10+ 自然中文语音（女声，很自然）
        'Microsoft Kangkang',         // Windows 10+ 自然中文语音（男声，很自然）
        'Google 普通话（中国大陆）',    // Chrome 中文语音
        'Ting-Ting',                  // macOS 中文语音（女声）
        'Sinji',                      // macOS 中文语音（男声）
        'Ting-Ting (Enhanced)',       // macOS 增强语音
        'Microsoft Huihui',           // Windows 中文语音
        'Microsoft Yaoyao - Chinese (Simplified)', // Windows 完整名称
    ];
    
    // 尝试找到优先语音
    let selectedVoice = null;
    for (const preferredName of preferredVoices) {
        selectedVoice = voices.find(voice => 
            voice.name === preferredName || 
            voice.name.includes(preferredName) ||
            (preferredName.includes('Yaoyao') && voice.name.toLowerCase().includes('yaoyao')) ||
            (preferredName.includes('Kangkang') && voice.name.toLowerCase().includes('kangkang'))
        );
        if (selectedVoice) {
            console.log('选择语音:', selectedVoice.name);
            break;
        }
    }
    
    // 如果没找到优先语音，选择任意中文语音
    if (!selectedVoice) {
        // 优先选择女声（通常更柔和好听）
        selectedVoice = voices.find(voice => 
            (voice.lang.includes('zh') || voice.lang.includes('CN')) &&
            (voice.name.toLowerCase().includes('female') || 
             voice.name.toLowerCase().includes('女') ||
             voice.name.toLowerCase().includes('yaoyao') ||
             voice.name.toLowerCase().includes('ting'))
        );
        
        // 如果没找到女声，选择任意中文语音
        if (!selectedVoice) {
            selectedVoice = voices.find(voice => 
                voice.lang.includes('zh') || 
                voice.lang.includes('CN') ||
                voice.name.toLowerCase().includes('chinese')
            );
        }
        
        if (selectedVoice) {
            console.log('使用备用语音:', selectedVoice.name);
        }
    }
    
    if (selectedVoice) {
        utterance.voice = selectedVoice;
    }
    
    return utterance;
}

// 播放第一个任务的语音
function playFirstTaskSpeech() {
    if (!gameState.firstTaskSpoken && gameState.currentTask === 1) {
        const task = tasks[0];
        gameState.firstTaskSpoken = true;
        
        // 直接调用 speakTask，不延迟
        if ('speechSynthesis' in window) {
            window.speechSynthesis.cancel();
            
            const textToSpeak = `${task.name}。${task.description}`;
            const utterance = new SpeechSynthesisUtterance(textToSpeak);
            
            // 配置游戏主播风格语音
            configureGameHostVoice(utterance);
            
            const speakWithVoice = () => {
                // 确保语音列表已加载，重新配置语音
                configureGameHostVoice(utterance);
                try {
                    window.speechSynthesis.speak(utterance);
                } catch (e) {
                    console.log('语音播报失败:', e);
                }
            };
            
            const voices = window.speechSynthesis.getVoices();
            if (voices.length > 0) {
                speakWithVoice();
            } else {
                window.speechSynthesis.onvoiceschanged = () => {
                    speakWithVoice();
                    window.speechSynthesis.onvoiceschanged = null;
                };
            }
        }
    }
}

// 初始化
function init() {
    // 停止背景音乐
    audioManager.stopBackgroundMusic();
    
    createTaskList();
    drawSpaceship();
    updateDisplay();
    setupEventListeners();
    
    // 更新任务显示（不包含语音播报）
    const task = tasks[gameState.currentTask - 1];
    taskName.textContent = task.name;
    taskDescription.textContent = task.description;
    taskTarget.textContent = `目标：${task.target}`;
    taskFeedback.textContent = '';
    taskFeedback.classList.remove('show', 'error');
    createTaskList();
    
    
    // 预加载语音列表并设置播放逻辑
    if ('speechSynthesis' in window) {
        // 触发语音列表加载
        window.speechSynthesis.getVoices();
        
        // 添加用户交互监听器（点击、触摸、按键）
        const handleFirstInteraction = () => {
            playFirstTaskSpeech();
        };
        
        document.addEventListener('click', handleFirstInteraction, { once: true });
        document.addEventListener('touchstart', handleFirstInteraction, { once: true });
        document.addEventListener('keydown', handleFirstInteraction, { once: true });
        
        // 尝试自动播放
        const tryAutoPlay = () => {
            if (!gameState.firstTaskSpoken) {
                // 尝试播放
                const task = tasks[0];
                if ('speechSynthesis' in window) {
                    window.speechSynthesis.cancel();
                    const textToSpeak = `${task.name}。${task.description}`;
                    const utterance = new SpeechSynthesisUtterance(textToSpeak);
                    // 配置游戏主播风格语音
                    configureGameHostVoice(utterance);
                    
                    const voices = window.speechSynthesis.getVoices();
                    if (voices.length > 0) {
                        // 确保语音列表已加载，重新配置语音
                        configureGameHostVoice(utterance);
                        try {
                            window.speechSynthesis.speak(utterance);
                            gameState.firstTaskSpoken = true;
                        } catch (e) {
                            // 自动播放失败，等待用户交互
                        }
                    }
                }
            }
        };
        
        // 页面加载完成后尝试自动播放
        window.addEventListener('load', () => {
            setTimeout(tryAutoPlay, 500);
        });
        
        // 如果页面已经加载完成，立即尝试
        if (document.readyState === 'complete') {
            setTimeout(tryAutoPlay, 500);
        }
        
        // 监听语音列表加载事件
        window.speechSynthesis.onvoiceschanged = () => {
            setTimeout(tryAutoPlay, 200);
        };
    }
}

// 创建任务列表
function createTaskList() {
    taskList.innerHTML = '';
    tasks.forEach((task, index) => {
        const taskId = index + 1;
        const taskItem = document.createElement('div');
        taskItem.className = 'task-item';
        
        // 判断任务状态
        const isCompleted = gameState.completedTasks.includes(taskId);
        const isCurrent = taskId === gameState.currentTask;
        const isUnlocked = taskId === 1 || gameState.completedTasks.includes(taskId - 1) || isCurrent;
        
        if (isCurrent) {
            taskItem.classList.add('active');
        }
        if (isCompleted) {
            taskItem.classList.add('completed');
            taskItem.textContent = '✓ ' + task.name;
        } else if (!isUnlocked) {
            taskItem.classList.add('locked');
            taskItem.textContent = '🔒 ' + task.name;
        } else {
            taskItem.textContent = task.name;
        }
        
        // 只有解锁的任务才能点击
        if (isUnlocked) {
            taskItem.style.cursor = 'pointer';
            taskItem.addEventListener('click', () => {
                switchTask(taskId);
            });
        } else {
            taskItem.style.cursor = 'not-allowed';
        }
        
        taskList.appendChild(taskItem);
    });
}

// 切换任务
function switchTask(taskId) {
    // 只能切换到已完成的任务或当前可做的任务（第一个任务或前一个已完成）
    const isUnlocked = taskId === 1 || 
                       gameState.completedTasks.includes(taskId - 1) || 
                       gameState.completedTasks.includes(taskId);
    
    if (taskId >= 1 && taskId <= tasks.length && isUnlocked) {
        gameState.currentTask = taskId;
        updateTaskDisplay();
        createTaskList(); // 更新任务列表的选中状态
        taskFeedback.classList.remove('show', 'error');
    }
}

// 设置事件监听
function setupEventListeners() {
    // 鼠标事件
    canvas.addEventListener('mousedown', startDrag);
    canvas.addEventListener('mousemove', drag);
    canvas.addEventListener('mouseup', endDrag);
    canvas.addEventListener('mouseleave', endDrag);

    // 触摸事件（直接传递事件对象，不提取touches[0]）
    canvas.addEventListener('touchstart', (e) => {
        e.preventDefault();
        startDrag(e);
    }, { passive: false });
    canvas.addEventListener('touchmove', (e) => {
        e.preventDefault();
        drag(e);
    }, { passive: false });
    canvas.addEventListener('touchend', (e) => {
        e.preventDefault();
        endDrag();
    }, { passive: false });

    // 按钮事件
    btnSubmit.addEventListener('click', submitAnswer);
    btnReset.addEventListener('click', resetGame);
    btnCounterClockwise.addEventListener('click', () => rotateBy(15));
    btnClockwise.addEventListener('click', () => rotateBy(-15));
}

// 获取事件坐标（统一处理鼠标和触摸事件）
function getEventCoordinates(e) {
    // 如果是触摸事件
    if (e.touches && e.touches.length > 0) {
        return {
            clientX: e.touches[0].clientX,
            clientY: e.touches[0].clientY
        };
    }
    // 如果是鼠标事件
    return {
        clientX: e.clientX,
        clientY: e.clientY
    };
}

// 开始拖动
function startDrag(e) {
    // 如果第一个任务还没播放，现在播放
    if (!gameState.firstTaskSpoken && gameState.currentTask === 1) {
        playFirstTaskSpeech();
    }
    
    gameState.isDragging = true;
    const coords = getEventCoordinates(e);
    const rect = canvas.getBoundingClientRect();
    const x = coords.clientX - rect.left;
    const y = coords.clientY - rect.top;
    // 计算canvas实际显示尺寸的中心点
    const canvasCenterX = rect.width / 2;
    const canvasCenterY = rect.height / 2;
    // 取反角度以符合标准数学习惯（逆时针为正，y轴向上）
    gameState.lastDragAngle = -Math.atan2(y - canvasCenterY, x - canvasCenterX);
}

// 拖动中
function drag(e) {
    if (!gameState.isDragging) return;

    const coords = getEventCoordinates(e);
    const rect = canvas.getBoundingClientRect();
    const x = coords.clientX - rect.left;
    const y = coords.clientY - rect.top;

    // 计算canvas实际显示尺寸的中心点
    const canvasCenterX = rect.width / 2;
    const canvasCenterY = rect.height / 2;
    // 取反角度以符合标准数学习惯（逆时针为正，y轴向上）
    const currentAngle = -Math.atan2(y - canvasCenterY, x - canvasCenterX);
    let deltaAngle = currentAngle - gameState.lastDragAngle;

    // 处理角度跨越-π到π的边界
    if (deltaAngle > Math.PI) deltaAngle -= 2 * Math.PI;
    if (deltaAngle < -Math.PI) deltaAngle += 2 * Math.PI;

    // 转换为度数并累加
    const deltaDegrees = deltaAngle * (180 / Math.PI);
    gameState.currentAngle += deltaDegrees;
    
    // 将角度四舍五入到最近的整数，避免小数点
    gameState.currentAngle = Math.round(gameState.currentAngle);

    gameState.lastDragAngle = currentAngle;
    updateLoopCount();
    drawSpaceship();
    updateDisplay();
}

// 结束拖动
function endDrag() {
    if (gameState.isDragging) {
        gameState.isDragging = false;
        addHistory();
    }
}

// 按钮旋转
function rotateBy(degrees) {
    // 如果第一个任务还没播放，现在播放
    if (!gameState.firstTaskSpoken && gameState.currentTask === 1) {
        playFirstTaskSpeech();
    }
    
    gameState.currentAngle += degrees;
    // 确保角度是整数
    gameState.currentAngle = Math.round(gameState.currentAngle);
    updateLoopCount();
    drawSpaceship();
    updateDisplay();
    addHistory();
}

// 更新圈数
function updateLoopCount() {
    const absAngle = Math.abs(gameState.currentAngle);
    const absLastAngle = Math.abs(gameState.lastAngle || 0);
    
    // 计算圈数（每360°为一圈）
    gameState.currentLoop = Math.floor(absAngle / 360);
    if (gameState.currentAngle < 0) {
        gameState.currentLoop = -gameState.currentLoop;
    }
    
    gameState.lastAngle = gameState.currentAngle;
}

// 归一化角度到[-180, 180]或[0, 360]
function normalizeAngle(angle) {
    let normalized = angle % 360;
    if (normalized > 180) normalized -= 360;
    if (normalized < -180) normalized += 360;
    return normalized;
}

// 绘制宇宙飞船
function drawSpaceship() {
    // 动态计算中心点（适应canvas实际尺寸）
    centerX = canvas.width / 2;
    centerY = canvas.height / 2;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // 绘制背景圆环（表示360°）
    ctx.strokeStyle = 'rgba(102, 126, 234, 0.3)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(centerX, centerY, 150, 0, Math.PI * 2);
    ctx.stroke();

    // 绘制角度刻度
    ctx.strokeStyle = 'rgba(102, 126, 234, 0.5)';
    ctx.lineWidth = 1;
    for (let i = 0; i < 12; i++) {
        const angle = (i * 30) * Math.PI / 180;
        const x1 = centerX + Math.cos(angle) * 140;
        const y1 = centerY + Math.sin(angle) * 140;
        const x2 = centerX + Math.cos(angle) * 150;
        const y2 = centerY + Math.sin(angle) * 150;
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();
    }

    // 绘制0°参考线
    ctx.strokeStyle = 'rgba(40, 167, 69, 0.5)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(centerX, centerY);
    ctx.lineTo(centerX + 160, centerY);
    ctx.stroke();

    // 保存上下文
    ctx.save();

    // 移动到中心并旋转
    ctx.translate(centerX, centerY);
    // Canvas的rotate是顺时针为正，需要取反以符合标准数学（逆时针为正）
    ctx.rotate(-gameState.currentAngle * Math.PI / 180);

    // 绘制宇宙飞船
    ctx.fillStyle = '#667eea';
    ctx.strokeStyle = '#764ba2';
    ctx.lineWidth = 3;

    // 飞船主体（三角形）
    ctx.beginPath();
    ctx.moveTo(0, -60);
    ctx.lineTo(-30, 40);
    ctx.lineTo(0, 20);
    ctx.lineTo(30, 40);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // 飞船窗口
    ctx.fillStyle = '#ffd700';
    ctx.beginPath();
    ctx.arc(0, -10, 8, 0, Math.PI * 2);
    ctx.fill();

    // 飞船尾翼
    ctx.fillStyle = '#764ba2';
    ctx.beginPath();
    ctx.moveTo(-20, 30);
    ctx.lineTo(-15, 50);
    ctx.lineTo(-10, 35);
    ctx.closePath();
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(20, 30);
    ctx.lineTo(15, 50);
    ctx.lineTo(10, 35);
    ctx.closePath();
    ctx.fill();

    // 恢复上下文
    ctx.restore();

    // 绘制当前角度指示线
    ctx.strokeStyle = '#dc3545';
    ctx.lineWidth = 3;
    // 取反角度以符合标准数学坐标系（逆时针为正）
    const angleRad = -gameState.currentAngle * Math.PI / 180;
    ctx.beginPath();
    ctx.moveTo(centerX, centerY);
    ctx.lineTo(
        centerX + Math.cos(angleRad) * 160,
        centerY + Math.sin(angleRad) * 160
    );
    ctx.stroke();
}

// 更新显示
function updateDisplay() {
    // 更新角度显示（显示整数）
    currentAngleDisplay.textContent = Math.round(gameState.currentAngle);

    // 更新等效主角度（任务4解锁后显示，因为任务4涉及大于360°的角）
    if (gameState.currentTask >= 4 || gameState.normalizedAngleShown) {
        const normalized = normalizeAngle(gameState.currentAngle);
        normalizedAngleDisplay.textContent = `${Math.round(normalized)}°`;
        normalizedAngleDisplay.parentElement.style.display = 'block';
        gameState.normalizedAngleShown = true;
    } else {
        normalizedAngleDisplay.parentElement.style.display = 'none';
    }

    // 更新圈数显示
    currentLoopDisplay.textContent = gameState.currentLoop;

    // 更新进度
    const completedCount = gameState.completedTasks.length;
    const progress = (completedCount / tasks.length) * 100;
    progressFill.style.width = `${progress}%`;
    progressText.textContent = `${completedCount} / ${tasks.length}`;
}

// 添加历史记录
function addHistory() {
    const normalized = normalizeAngle(gameState.currentAngle);
    const direction = gameState.currentAngle >= 0 ? '逆时针' : '顺时针';
    const record = `${direction}旋转：${Math.round(gameState.currentAngle)}° (主角度：${Math.round(normalized)}°)`;
    
    gameState.history.unshift(record);
    if (gameState.history.length > 5) {
        gameState.history.pop();
    }

    // 更新历史显示
    historyList.innerHTML = gameState.history.map(item => 
        `<div class="history-item">${item}</div>`
    ).join('');
}

// 语音播报任务信息
function speakTask(task, delay = 0) {
    // 检查浏览器是否支持语音合成
    if ('speechSynthesis' in window) {
        const doSpeak = () => {
            // 停止之前的语音播报
            window.speechSynthesis.cancel();
            
            // 组合要播报的文本：任务名称 + 描述
            const textToSpeak = `${task.name}。${task.description}`;
            
            // 创建语音合成对象
            const utterance = new SpeechSynthesisUtterance(textToSpeak);
            
            // 配置游戏主播风格语音
            configureGameHostVoice(utterance);
            
            // 获取语音列表并选择中文语音的函数
            const speakWithVoice = () => {
                // 确保语音列表已加载，重新配置语音
                configureGameHostVoice(utterance);
                // 播报语音
                try {
                    window.speechSynthesis.speak(utterance);
                } catch (e) {
                    console.log('语音播报失败:', e);
                }
            };
            
            // 如果语音列表已加载，直接播报；否则等待加载完成
            const voices = window.speechSynthesis.getVoices();
            if (voices.length > 0) {
                speakWithVoice();
            } else {
                // 等待语音列表加载完成
                const onVoicesChanged = () => {
                    speakWithVoice();
                    window.speechSynthesis.onvoiceschanged = null; // 移除监听器，避免重复触发
                };
                window.speechSynthesis.onvoiceschanged = onVoicesChanged;
            }
        };
        
        if (delay > 0) {
            setTimeout(doSpeak, delay);
        } else {
            doSpeak();
        }
    }
}

// 更新任务显示
function updateTaskDisplay() {
    // 停止背景音乐
    audioManager.stopBackgroundMusic();
    
    const task = tasks[gameState.currentTask - 1];
    taskName.textContent = task.name;
    taskDescription.textContent = task.description;
    taskTarget.textContent = `目标：${task.target}`;
    taskFeedback.textContent = '';
    taskFeedback.classList.remove('show', 'error');
    // 更新任务列表（会更新选中状态和锁定状态）
    createTaskList();
    // 播报任务信息（第一个任务在用户交互时播放，其他任务立即播放）
    if (gameState.currentTask === 1 && !gameState.firstTaskSpoken) {
        // 第一个任务且未播报过，不在这里播放，等待用户交互
        return;
    }
    speakTask(task);
}

// 播放任务反馈语音
function playTaskFeedback(feedbackText, callback) {
    if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
        
        const utterance = new SpeechSynthesisUtterance(feedbackText);
        
        // 配置游戏主播风格语音
        configureGameHostVoice(utterance);
        
        // 语音播放完成后的回调
        utterance.onend = () => {
            if (callback) {
                callback();
            }
        };
        
        // 语音播放错误处理
        utterance.onerror = (e) => {
            console.log('反馈语音播放失败:', e);
            // 即使播放失败，也执行回调
            if (callback) {
                callback();
            }
        };
        
        const speakWithVoice = () => {
            // 确保语音列表已加载，重新配置语音
            configureGameHostVoice(utterance);
            try {
                window.speechSynthesis.speak(utterance);
            } catch (e) {
                console.log('反馈语音播报失败:', e);
                // 播放失败时也执行回调
                if (callback) {
                    callback();
                }
            }
        };
        
        // 如果语音列表已加载，直接播报；否则等待加载完成
        const voices = window.speechSynthesis.getVoices();
        if (voices.length > 0) {
            speakWithVoice();
        } else {
            // 等待语音列表加载完成
            const onVoicesChanged = () => {
                speakWithVoice();
                window.speechSynthesis.onvoiceschanged = null;
            };
            window.speechSynthesis.onvoiceschanged = onVoicesChanged;
        }
    } else {
        // 如果不支持语音合成，直接执行回调
        if (callback) {
            callback();
        }
    }
}

// 提交答案
function submitAnswer() {
    const task = tasks[gameState.currentTask - 1];
    const isValid = task.validate(gameState.currentAngle);

    taskFeedback.textContent = isValid ? task.feedback : '答案不正确，请再试试！';
    taskFeedback.classList.add('show');
    taskFeedback.classList.toggle('error', !isValid);

    if (isValid) {
        // 记录已完成的任务
        if (!gameState.completedTasks.includes(gameState.currentTask)) {
            gameState.completedTasks.push(gameState.currentTask);
        }
        
        // 更新任务列表显示
        createTaskList();
        
        // 显示完成反馈
        taskFeedback.textContent = task.feedback;
        
        // 播放任务反馈语音，播放完成后进入下一关
        playTaskFeedback(task.feedback, () => {
            // 语音播放完成后的回调
            if (gameState.currentTask < tasks.length) {
                // 延迟后自动跳转到下一个任务
                setTimeout(() => {
                    const nextTaskId = gameState.currentTask + 1;
                    gameState.currentTask = nextTaskId;
                    // 重置角度为0度
                    gameState.currentAngle = 0;
                    gameState.currentLoop = 0;
                    gameState.lastAngle = 0;
                    gameState.history = [];
                    historyList.innerHTML = '<div class="history-item">初始位置：0°</div>';
                    // 更新显示和绘制
                    updateTaskDisplay();
                    drawSpaceship();
                    updateDisplay();
                    taskFeedback.textContent = `任务${nextTaskId}已解锁！开始挑战吧！`;
                }, 500); // 短暂延迟，让用户看到反馈
            } else {
                // 所有任务完成
                taskFeedback.textContent = '🎉 恭喜！你已完成所有任务，成为角度大师！';
                taskFeedback.classList.remove('error');
                // 更新进度显示
                updateDisplay();
            }
        });
    }
}

// 重置游戏
function resetGame() {
    // 停止背景音乐
    audioManager.stopBackgroundMusic();
    
    gameState.currentAngle = 0;
    gameState.currentLoop = 0;
    gameState.lastAngle = 0;
    gameState.history = [];
    gameState.currentTask = 1;
    gameState.normalizedAngleShown = false;
    gameState.completedTasks = [];
    
    historyList.innerHTML = '<div class="history-item">初始位置：0°</div>';
    taskFeedback.classList.remove('show', 'error');
    
    createTaskList();
    updateTaskDisplay();
    drawSpaceship();
    updateDisplay();
}

// 音频管理
const audioManager = {
    backgroundMusic: null,
    audioContext: null,
    oscillator: null,
    gainNode: null,
    isPlaying: false,
    
    // 检测是否为 Safari 浏览器
    isSafari() {
        return /^((?!chrome|android).)*safari/i.test(navigator.userAgent) || 
               /iPad|iPhone|iPod/.test(navigator.userAgent);
    },
    
    // 初始化音频上下文
    init() {
        try {
            if (!this.audioContext) {
                // Safari 需要明确使用 webkitAudioContext
                const AudioContextClass = window.AudioContext || window.webkitAudioContext;
                this.audioContext = new AudioContextClass();
                this.gainNode = this.audioContext.createGain();
                this.gainNode.connect(this.audioContext.destination);
                // Safari 需要更低的音量以避免失真
                this.gainNode.gain.value = this.isSafari() ? 0.2 : 0.3;
            }
        } catch (e) {
            console.log('音频初始化失败:', e);
        }
    },
    
    // 播放背景音乐（使用 Web Audio API 生成太空风格音乐）
    playBackgroundMusic() {
        if (!this.audioContext) {
            this.init();
        }
        
        if (!this.audioContext) {
            console.log('音频上下文未初始化');
            return;
        }
        
        if (this.isPlaying) {
            console.log('音乐已在播放');
            return;
        }
        
        // 如果音频上下文被暂停，尝试恢复
        if (this.audioContext.state === 'suspended') {
            this.audioContext.resume().then(() => {
                this.playBackgroundMusic();
            }).catch(e => {
                console.log('恢复音频上下文失败:', e);
            });
            return;
        }
        
        try {
            console.log('开始播放背景音乐');
            const isSafari = this.isSafari();
            
            // Safari 使用更简单的音频配置以避免问题
            if (isSafari) {
                // Safari 简化版：只使用一个主音调，避免复杂的调制
                const oscillator1 = this.audioContext.createOscillator();
                const gain1 = this.audioContext.createGain();
                oscillator1.type = 'sine';
                oscillator1.frequency.value = 110; // A2 音符
                gain1.gain.value = 0.12;
                oscillator1.connect(gain1);
                gain1.connect(this.gainNode);
                
                // 添加一个简单的和声
                const oscillator2 = this.audioContext.createOscillator();
                const gain2 = this.audioContext.createGain();
                oscillator2.type = 'sine'; // Safari 使用 sine 而不是 triangle
                oscillator2.frequency.value = 220; // A3 音符
                gain2.gain.value = 0.08;
                oscillator2.connect(gain2);
                gain2.connect(this.gainNode);
                
                oscillator1.start();
                oscillator2.start();
                
                this.isPlaying = true;
                this.oscillator = { osc1: oscillator1, osc2: oscillator2 };
                
                // 音乐淡入（Safari 使用更平滑的淡入）
                this.gainNode.gain.setValueAtTime(0, this.audioContext.currentTime);
                this.gainNode.gain.linearRampToValueAtTime(0.2, this.audioContext.currentTime + 2);
            } else {
                // Chrome 等其他浏览器使用完整配置
                // 创建主音调（低沉的太空氛围音）
                const oscillator1 = this.audioContext.createOscillator();
                const gain1 = this.audioContext.createGain();
                oscillator1.type = 'sine';
                oscillator1.frequency.value = 110; // A2 音符
                gain1.gain.value = 0.15;
                oscillator1.connect(gain1);
                gain1.connect(this.gainNode);
                
                // 创建和声（高音部分）
                const oscillator2 = this.audioContext.createOscillator();
                const gain2 = this.audioContext.createGain();
                oscillator2.type = 'triangle';
                oscillator2.frequency.value = 220; // A3 音符
                gain2.gain.value = 0.1;
                oscillator2.connect(gain2);
                gain2.connect(this.gainNode);
                
                // 创建低频氛围音
                const oscillator3 = this.audioContext.createOscillator();
                const gain3 = this.audioContext.createGain();
                oscillator3.type = 'sawtooth';
                oscillator3.frequency.value = 55; // A1 音符
                gain3.gain.value = 0.08;
                oscillator3.connect(gain3);
                gain3.connect(this.gainNode);
                
                // 添加频率调制（LFO）创造太空感（Safari 不支持或有问题）
                const lfo = this.audioContext.createOscillator();
                const lfoGain = this.audioContext.createGain();
                lfo.type = 'sine';
                lfo.frequency.value = 0.5; // 缓慢变化
                lfoGain.gain.value = 5;
                lfo.connect(lfoGain);
                lfoGain.connect(oscillator1.frequency);
                lfoGain.connect(oscillator2.frequency);
                
                // 开始播放
                oscillator1.start();
                oscillator2.start();
                oscillator3.start();
                lfo.start();
                
                this.isPlaying = true;
                this.oscillator = { osc1: oscillator1, osc2: oscillator2, osc3: oscillator3, lfo: lfo };
                
                // 音乐淡入
                this.gainNode.gain.setValueAtTime(0, this.audioContext.currentTime);
                this.gainNode.gain.linearRampToValueAtTime(0.3, this.audioContext.currentTime + 2);
            }
            
            console.log('背景音乐播放成功');
        } catch (e) {
            console.log('背景音乐播放失败:', e);
            this.isPlaying = false;
        }
    },
    
    // 停止背景音乐
    stopBackgroundMusic() {
        if (this.oscillator) {
            try {
                // 淡出效果
                if (this.audioContext && this.gainNode) {
                    this.gainNode.gain.linearRampToValueAtTime(0, this.audioContext.currentTime + 1);
                }
                setTimeout(() => {
                    try {
                        if (this.oscillator.osc1) this.oscillator.osc1.stop();
                        if (this.oscillator.osc2) this.oscillator.osc2.stop();
                        if (this.oscillator.osc3) this.oscillator.osc3.stop();
                        if (this.oscillator.lfo) this.oscillator.lfo.stop();
                    } catch (e) {
                        console.log('停止振荡器失败:', e);
                    }
                    this.oscillator = null;
                    this.isPlaying = false;
                }, 1000);
            } catch (e) {
                console.log('停止音乐失败:', e);
                this.isPlaying = false;
            }
        }
    },
    
    // 播放音效（按钮点击等）
    playSoundEffect(type = 'click') {
        if (!this.audioContext) {
            this.init();
        }
        
        if (!this.audioContext) return;
        
        // 确保音频上下文处于运行状态
        if (this.audioContext.state === 'suspended') {
            this.audioContext.resume().catch(e => {
                console.log('恢复音频上下文失败:', e);
            });
        }
        
        try {
            const oscillator = this.audioContext.createOscillator();
            const gain = this.audioContext.createGain();
            const isSafari = this.isSafari();
            
            if (type === 'click') {
                oscillator.type = 'sine';
                const startTime = this.audioContext.currentTime;
                // Safari 使用更简单的频率设置
                if (isSafari) {
                    oscillator.frequency.value = 600;
                    gain.gain.setValueAtTime(0.2, startTime);
                    gain.gain.exponentialRampToValueAtTime(0.01, startTime + 0.1);
                } else {
                    oscillator.frequency.setValueAtTime(800, startTime);
                    oscillator.frequency.exponentialRampToValueAtTime(400, startTime + 0.1);
                    gain.gain.setValueAtTime(0.3, startTime);
                    gain.gain.exponentialRampToValueAtTime(0.01, startTime + 0.1);
                }
            } else if (type === 'whoosh') {
                // Safari 使用 sine 而不是 sawtooth（更稳定）
                oscillator.type = isSafari ? 'sine' : 'sawtooth';
                const startTime = this.audioContext.currentTime;
                if (isSafari) {
                    oscillator.frequency.value = 150;
                    gain.gain.setValueAtTime(0.15, startTime);
                    gain.gain.exponentialRampToValueAtTime(0.01, startTime + 0.3);
                } else {
                    oscillator.frequency.setValueAtTime(200, startTime);
                    oscillator.frequency.exponentialRampToValueAtTime(50, startTime + 0.3);
                    gain.gain.setValueAtTime(0.2, startTime);
                    gain.gain.exponentialRampToValueAtTime(0.01, startTime + 0.3);
                }
            }
            
            oscillator.connect(gain);
            gain.connect(this.audioContext.destination);
            oscillator.start();
            oscillator.stop(this.audioContext.currentTime + 0.3);
        } catch (e) {
            console.log('音效播放失败:', e);
        }
    }
};

// 开场场景管理
function initIntroScene() {
    const introScene = document.getElementById('introScene');
    const startBtn = document.getElementById('startGameBtn');
    const gameContainer = document.getElementById('gameContainer');
    
    if (!introScene || !startBtn || !gameContainer) {
        // 如果没有开场场景元素，直接初始化游戏
        init();
        return;
    }
    
    // 初始化音频
    audioManager.init();
    
    // 播放背景音乐的函数
    const startMusic = () => {
        // 确保音频上下文已恢复（处理浏览器自动播放限制）
        if (audioManager.audioContext && audioManager.audioContext.state === 'suspended') {
            audioManager.audioContext.resume().then(() => {
                if (!audioManager.isPlaying) {
                    audioManager.playBackgroundMusic();
                }
            }).catch(e => {
                console.log('恢复音频上下文失败:', e);
            });
        } else {
            if (!audioManager.isPlaying) {
                audioManager.playBackgroundMusic();
            }
        }
    };
    
    // 在开场场景显示时立即尝试播放背景音乐
    const tryStartMusic = () => {
        try {
            startMusic();
        } catch (e) {
            console.log('自动播放音乐失败:', e);
        }
    };
    
    // 延迟尝试播放，确保页面加载完成
    setTimeout(() => {
        tryStartMusic();
    }, 300);
    
    // 监听用户交互来启动音频（解决浏览器自动播放限制）
    const handleUserInteraction = () => {
        startMusic();
    };
    
    // 监听多种用户交互事件
    introScene.addEventListener('click', handleUserInteraction, { once: true });
    introScene.addEventListener('touchstart', handleUserInteraction, { once: true });
    document.addEventListener('keydown', handleUserInteraction, { once: true });
    
    // 按钮点击时也启动音乐
    startBtn.addEventListener('mouseenter', () => {
        if (!audioManager.isPlaying) {
            startMusic();
        }
    }, { once: true });
    
    // 开场语音播报
    const playIntroSpeech = () => {
        if ('speechSynthesis' in window) {
            // 停止之前的语音
            window.speechSynthesis.cancel();
            
            // 等待一小段时间确保之前的语音已停止
            setTimeout(() => {
                // 使用自然的中文文本，不需要特殊标记
                const text = '欢迎来到太空训练基地，船长！你即将驾驶宇宙飞船，在浩瀚的星空中执行一系列导航任务。掌握角度的概念，是成为一名优秀太空飞行员的关键。准备好了吗？让我们开始这段精彩的太空之旅！';
                const utterance = new SpeechSynthesisUtterance(text);
                
                // 配置游戏主播风格语音
                configureGameHostVoice(utterance);
                
                const speakWithVoice = () => {
                    // 确保语音列表已加载，重新配置语音
                    configureGameHostVoice(utterance);
                    try {
                        window.speechSynthesis.speak(utterance);
                        console.log('开场语音开始播放');
                    } catch (e) {
                        console.log('开场语音播报失败:', e);
                    }
                };
                
                const voices = window.speechSynthesis.getVoices();
                if (voices.length > 0) {
                    speakWithVoice();
                } else {
                    // 等待语音列表加载完成
                    const onVoicesChanged = () => {
                        speakWithVoice();
                        window.speechSynthesis.onvoiceschanged = null;
                    };
                    window.speechSynthesis.onvoiceschanged = onVoicesChanged;
                }
            }, 100);
        }
    };
    
    // 播放开场语音的函数（带重试机制）
    const tryPlayIntroSpeech = () => {
        try {
            playIntroSpeech();
        } catch (e) {
            console.log('开场语音自动播放失败，等待用户交互:', e);
            // 如果自动播放失败，等待用户交互
            const handleInteraction = () => {
                playIntroSpeech();
                document.removeEventListener('click', handleInteraction);
                document.removeEventListener('touchstart', handleInteraction);
                document.removeEventListener('keydown', handleInteraction);
            };
            document.addEventListener('click', handleInteraction, { once: true });
            document.addEventListener('touchstart', handleInteraction, { once: true });
            document.addEventListener('keydown', handleInteraction, { once: true });
        }
    };
    
    // 页面加载完成后立即尝试播放开场语音
    const playIntroWhenReady = () => {
        // 确保页面和语音列表都已加载
        if (document.readyState === 'complete') {
            // 等待语音列表加载
            const voices = window.speechSynthesis.getVoices();
            if (voices.length > 0) {
                // 语音列表已加载，立即播放
                tryPlayIntroSpeech();
            } else {
                // 等待语音列表加载完成
                window.speechSynthesis.onvoiceschanged = () => {
                    tryPlayIntroSpeech();
                    window.speechSynthesis.onvoiceschanged = null;
                };
            }
        } else {
            // 如果页面还没加载完成，等待加载完成
            window.addEventListener('load', () => {
                playIntroWhenReady();
            });
        }
    };
    
    // 立即尝试播放
    playIntroWhenReady();
    
    // 也监听用户交互，确保能播放（备用方案）
    const handleInteractionForSpeech = () => {
        if (!window.speechSynthesis.speaking) {
            playIntroSpeech();
        }
    };
    introScene.addEventListener('click', handleInteractionForSpeech, { once: true });
    introScene.addEventListener('touchstart', handleInteractionForSpeech, { once: true });
    
    // 点击按钮进入游戏
    startBtn.addEventListener('click', () => {
        // 播放按钮点击音效
        audioManager.playSoundEffect('click');
        
        // 停止开场语音
        if ('speechSynthesis' in window) {
            window.speechSynthesis.cancel();
        }
        
        // 播放过渡音效
        audioManager.playSoundEffect('whoosh');
        
        // 淡出开场场景
        introScene.classList.add('fade-out');
        
        // 停止背景音乐
        setTimeout(() => {
            audioManager.stopBackgroundMusic();
        }, 500);
        
        // 延迟后显示游戏界面并初始化
        setTimeout(() => {
            introScene.style.display = 'none';
            gameContainer.style.display = 'flex';
            // 确保游戏容器使用 flex 布局
            gameContainer.style.flexDirection = 'column';
            init();
        }, 800);
    });
    
    // 预加载语音列表
    if ('speechSynthesis' in window) {
        window.speechSynthesis.getVoices();
    }
}

// 启动游戏
// 使用 DOMContentLoaded 确保 DOM 准备好后立即初始化
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initIntroScene);
} else {
    // DOM 已经准备好了，立即初始化开场场景
    initIntroScene();
}

