// 全局变量
let selectedCharacter = null;
let selectedEvent = null;

// Coze API 配置 (需要用户配置实际的API密钥和端点)
const COZE_TOKEN = 'pat_qw1hBkUDiL1ZWVuppGENlJ1psL015j7sxBm9AmJVeQZWEVkQu25UIMQkp20mjST5';
const COZE_CONFIG = {
    // 工作流API配置 - 用于生成图片
    WORKFLOW_API: {
        url: 'https://api.coze.cn/v1/workflow/stream_run',
        token: COZE_TOKEN, // 需要替换为实际的token
        workflow_id: '7552138060063080482' // 需要替换为实际的工作流ID
    },
    // 智能体API配置 - 用于对话
    BOT_API: {
        url: 'https://api.coze.cn/v1/chat',
        token: COZE_TOKEN, // 需要替换为实际的token
        bot_id: '7552142955872845870' // 需要替换为实际的机器人ID
    }
};

// DOM元素
const characterCards = document.querySelectorAll('.character-card');
const eventCards = document.querySelectorAll('.event-card');
const selectedCharacterSpan = document.getElementById('selectedCharacter');
const selectedEventSpan = document.getElementById('selectedEvent');
const travelBtn = document.getElementById('travelBtn');
const travelBtnText = document.getElementById('travelBtnText');
const imageSection = document.getElementById('imageSection');
const generatedImage = document.getElementById('generatedImage');
const startChatBtn = document.getElementById('startChatBtn');
const loadingOverlay = document.getElementById('loadingOverlay');

// 自由输入表单元素
const customCharacterInput = document.getElementById('customCharacter');
const customEventInput = document.getElementById('customEvent');
const startCustomChatBtn = document.getElementById('startCustomChatBtn');

// 初始化事件监听器
function initEventListeners() {
    // 历史人物选择
    characterCards.forEach(card => {
        card.addEventListener('click', () => selectCharacter(card));
    });

    // 历史事件选择
    eventCards.forEach(card => {
        card.addEventListener('click', () => selectEvent(card));
    });

    // 穿越按钮
    travelBtn.addEventListener('click', handleTravel);

    // 开始对话按钮
    startChatBtn.addEventListener('click', handleCustomChat);

    // 自定义对话按钮
    startCustomChatBtn.addEventListener('click', handleCustomChat);

    // 快捷对话按钮
    const quickChatBtns = document.querySelectorAll('.quick-chat-btn');
    quickChatBtns.forEach(btn => {
        btn.addEventListener('click', () => handleQuickChat(btn));
    });

    // 监听自定义输入变化，实时更新穿越按钮状态
    customCharacterInput.addEventListener('input', checkTravelButtonState);
    customEventInput.addEventListener('input', checkTravelButtonState);
}

// 选择历史人物
function selectCharacter(card) {
    // 移除其他卡片的选中状态
    characterCards.forEach(c => c.classList.remove('selected'));
    
    // 添加选中状态
    card.classList.add('selected');
    
    // 更新选中的人物
    selectedCharacter = card.dataset.character;
    selectedCharacterSpan.textContent = selectedCharacter;
    
    // 清空自定义输入框
    customCharacterInput.value = '';
    customEventInput.value = '';
    
    // 检查是否可以启用穿越按钮
    checkTravelButtonState();
}

// 选择历史事件
function selectEvent(card) {
    // 移除其他卡片的选中状态
    eventCards.forEach(c => c.classList.remove('selected'));
    
    // 添加选中状态
    card.classList.add('selected');
    
    // 更新选中的事件
    selectedEvent = card.dataset.event;
    selectedEventSpan.textContent = selectedEvent;
    
    // 清空自定义输入框
    customCharacterInput.value = '';
    customEventInput.value = '';
    
    // 检查是否可以启用穿越按钮
    checkTravelButtonState();
}

// 检查穿越按钮状态
function checkTravelButtonState() {
    // 检查自定义输入是否有内容
    const customCharacter = customCharacterInput.value.trim();
    const customEvent = customEventInput.value.trim();
    
    if (customCharacter && customEvent) {
        travelBtn.disabled = false;
        travelBtn.style.opacity = '1';
        // 更新按钮文本显示自定义输入的角色和事件
        travelBtnText.textContent = `穿越到${customEvent}与${customCharacter}对话`;
    } else {
        travelBtn.disabled = true;
        travelBtn.style.opacity = '0.6';
        travelBtnText.textContent = '穿越';
    }
}

// 处理穿越操作
async function handleTravel() {
    // 获取自定义输入的内容
    const customCharacter = customCharacterInput.value.trim();
    const customEvent = customEventInput.value.trim();
    
    if (!customCharacter || !customEvent) {
        alert('请先输入历史人物和事件！');
        return;
    }

    // 显示加载状态
    showLoading();

    try {
        // 调用Coze工作流生成图片
        const imageUrl = await generateImage(customCharacter, customEvent);
        
        if (imageUrl) {
            // 显示生成的图片
            displayGeneratedImage(imageUrl);
        } else {
            // 如果API调用失败，显示示例图片
            displayPlaceholderImage();
        }
    } catch (error) {
        console.error('穿越失败:', error);
        // 显示示例图片作为fallback
        displayPlaceholderImage();
    } finally {
        // 隐藏加载状态
        hideLoading();
    }
}

// 调用Coze工作流生成图片
async function generateImage(character, event) {
    try {
        const response = await fetch(COZE_CONFIG.WORKFLOW_API.url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${COZE_CONFIG.WORKFLOW_API.token}`,
                'Accept': 'text/event-stream'
            },
            body: JSON.stringify({
                workflow_id: COZE_CONFIG.WORKFLOW_API.workflow_id,
                parameters: {
                    role: character,
                    event: event
                }
            })
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        // 处理流式响应
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let result = '';
        let imageUrl = null;

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const chunk = decoder.decode(value, { stream: true });
            const lines = chunk.split('\n');

            for (const line of lines) {
                if (line.startsWith('data: ')) {
                    const data = line.slice(6);
                    if (data === '[DONE]') {
                        break;
                    }
                    
                    try {
                         const jsonData = JSON.parse(data);
                         console.log('Coze流式响应:', jsonData);
                         
                         // 根据实际的Coze API响应格式调整
                         if (jsonData.node_type === 'End' && jsonData.node_is_finish && jsonData.content) {
                             try {
                                 // 解析content字段中的JSON字符串
                                 const contentData = JSON.parse(jsonData.content);
                                 if (contentData.image) {
                                     // 清理图片URL，移除可能的反引号
                                     imageUrl = contentData.image.replace(/`/g, '').trim();
                                 }
                             } catch (contentParseError) {
                                 console.log('解析content字段失败:', contentParseError);
                             }
                         }
                     } catch (parseError) {
                         console.log('解析JSON失败，跳过此行:', data);
                     }
                }
            }
        }

        return imageUrl;
    } catch (error) {
        console.error('调用Coze工作流失败:', error);
        return null;
    }
}

// 显示生成的图片
function displayGeneratedImage(imageUrl) {
    generatedImage.src = imageUrl;
    generatedImage.alt = `${selectedCharacter}在${selectedEvent}时期的场景`;
    imageSection.style.display = 'block';
    
    // 滚动到图片区域
    imageSection.scrollIntoView({ behavior: 'smooth' });
}

// 显示占位图片（当API调用失败时）
function displayPlaceholderImage() {
    // 创建一个SVG占位图
    const svgPlaceholder = createPlaceholderSVG(selectedCharacter, selectedEvent);
    generatedImage.src = `data:image/svg+xml;base64,${btoa(svgPlaceholder)}`;
    generatedImage.alt = `${selectedCharacter}在${selectedEvent}时期的场景（示例图片）`;
    imageSection.style.display = 'block';
    
    // 滚动到图片区域
    imageSection.scrollIntoView({ behavior: 'smooth' });
}

// 创建SVG占位图
function createPlaceholderSVG(character, event) {
    return `
        <svg width="600" height="400" xmlns="http://www.w3.org/2000/svg">
            <defs>
                <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" style="stop-color:#667eea;stop-opacity:1" />
                    <stop offset="100%" style="stop-color:#764ba2;stop-opacity:1" />
                </linearGradient>
            </defs>
            <rect width="600" height="400" fill="url(#bg)"/>
            <text x="300" y="180" text-anchor="middle" fill="white" font-size="24" font-family="serif">
                ${character}
            </text>
            <text x="300" y="220" text-anchor="middle" fill="white" font-size="18" font-family="serif" opacity="0.8">
                ${event}
            </text>
            <text x="300" y="260" text-anchor="middle" fill="white" font-size="14" font-family="serif" opacity="0.6">
                穿越成功！准备开始对话
            </text>
        </svg>
    `;
}

// 开始对话
function startChat() {
    console.log('开始对话', currentCharacter, cu);
    handleCustomChat();
    // 跳转到聊天页面
    // window.location.href = 'chat.html';
}

// 处理自定义对话表单提交
function handleCustomChat() {
    const character = customCharacterInput.value.trim();
    const event = customEventInput.value.trim();
    
    // 验证输入
    if (!character) {
        alert('请输入历史人物姓名');
        customCharacterInput.focus();
        return;
    }
    
    if (!event) {
        alert('请输入历史事件或时期');
        customEventInput.focus();
        return;
    }
    
    // 添加调试日志
    console.log('自定义对话提交:', { character, event });
    
    // 更新全局变量
    selectedCharacter = character;
    selectedEvent = event;
    
    // 更新穿越按钮状态和文本
    checkTravelButtonState();
    
    // 清除之前的localStorage数据
    localStorage.removeItem('selectedCharacter');
    localStorage.removeItem('selectedEvent');
    
    // 清除之前的聊天记录和会话ID
    const oldHistoryKey = `chat_history_${character}_${event}`;
    const oldConversationKey = `conversation_id_${character}_${event}`;
    localStorage.removeItem(oldHistoryKey);
    localStorage.removeItem(oldConversationKey);
    console.log('清除旧的聊天记录:', { oldHistoryKey, oldConversationKey });
    
    // 保存选择到localStorage
    localStorage.setItem('selectedCharacter', character);
    localStorage.setItem('selectedEvent', event);
    
    // 验证保存是否成功
    const savedCharacter = localStorage.getItem('selectedCharacter');
    const savedEvent = localStorage.getItem('selectedEvent');
    console.log('保存验证:', { savedCharacter, savedEvent });
    
    // 清空输入框
    customCharacterInput.value = '';
    customEventInput.value = '';
    
    // 跳转到聊天页面
    window.location.href = 'chat.html';
}

// 处理快捷对话按钮点击
function handleQuickChat(btn) {
    const character = btn.dataset.character;
    const event = btn.dataset.event;
    
    // 添加调试日志
    console.log('快捷对话按钮点击:', { character, event });
    
    // 清除之前的localStorage数据
    localStorage.removeItem('selectedCharacter');
    localStorage.removeItem('selectedEvent');
    
    // 清除之前的聊天记录和会话ID
    const oldHistoryKey = `chat_history_${character}_${event}`;
    const oldConversationKey = `conversation_id_${character}_${event}`;
    localStorage.removeItem(oldHistoryKey);
    localStorage.removeItem(oldConversationKey);
    console.log('清除旧的聊天记录:', { oldHistoryKey, oldConversationKey });
    
    // 保存选择到localStorage
    localStorage.setItem('selectedCharacter', character);
    localStorage.setItem('selectedEvent', event);
    
    // 验证保存是否成功
    const savedCharacter = localStorage.getItem('selectedCharacter');
    const savedEvent = localStorage.getItem('selectedEvent');
    console.log('保存到localStorage:', { savedCharacter, savedEvent });
    
    // 直接跳转到聊天页面
    window.location.href = 'chat.html';
}

// 显示加载状态
function showLoading() {
    loadingOverlay.style.display = 'flex';
    document.body.style.overflow = 'hidden';
}

// 隐藏加载状态
function hideLoading() {
    loadingOverlay.style.display = 'none';
    document.body.style.overflow = 'auto';
}

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', () => {
    initEventListeners();
    
    // 检查是否有API配置提醒
    if (COZE_CONFIG.WORKFLOW_API.token === 'YOUR_COZE_WORKFLOW_TOKEN') {
        console.warn('请配置Coze API密钥和端点信息');
        
        // 在页面上显示配置提醒
        const configNotice = document.createElement('div');
        configNotice.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: #ff6b6b;
            color: white;
            padding: 15px;
            border-radius: 8px;
            font-size: 14px;
            z-index: 1000;
            max-width: 300px;
            box-shadow: 0 5px 15px rgba(0,0,0,0.2);
        `;
        configNotice.innerHTML = `
            <strong>配置提醒</strong><br>
            请在script.js中配置Coze API密钥和端点信息以启用完整功能
        `;
        document.body.appendChild(configNotice);
        
        // 5秒后自动隐藏
        setTimeout(() => {
            configNotice.remove();
        }, 5000);
    }
});

// 工具函数：格式化日期
function formatDate(date) {
    return new Intl.DateTimeFormat('zh-CN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
    }).format(date);
}

// 工具函数：生成唯一ID
function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

// 导出函数供其他模块使用
window.HistoryChat = {
    selectedCharacter,
    selectedEvent,
    COZE_CONFIG,
    formatDate,
    generateId
};