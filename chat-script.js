// 聊天页面全局变量
let currentCharacter = null;
let currentEvent = null;
let chatHistory = [];
let conversationId = null;
let lastUserMessage = null;
const COZE_TOKEN = 'pat_qw1hBkUDiL1ZWVuppGENlJ1psL015j7sxBm9AmJVeQZWEVkQu25UIMQkp20mjST5';

// Coze智能体配置
const COZE_CHAT_CONFIG = {
    url: 'https://api.coze.cn/v3/chat',
    conversation_url: 'https://api.coze.cn/v1/conversation/create',
    token: COZE_TOKEN, // 使用用户提供的token
    bot_id: '7552142955872845870' // 需要替换为实际的机器人ID
};

// DOM元素
const chatMessages = document.getElementById('chatMessages');
const messageInput = document.getElementById('messageInput');
const sendBtn = document.getElementById('sendBtn');
const characterName = document.getElementById('characterName');
const eventContext = document.getElementById('eventContext');
const chatAvatar = document.getElementById('chatAvatar');
const avatarText = document.getElementById('avatarText');
const welcomeCharacter = document.getElementById('welcomeCharacter');
const welcomeEvent = document.getElementById('welcomeEvent');
const typingIndicator = document.getElementById('typingIndicator');
const typingAvatarText = document.getElementById('typingAvatarText');
const charCount = document.querySelector('.char-count');
const errorModal = document.getElementById('errorModal');
const errorMessage = document.getElementById('errorMessage');

// 历史人物头像颜色映射
const characterColors = {
    '孔子': '#8B4513',
    '李白': '#4169E1',
    '诸葛亮': '#228B22',
    '武则天': '#DC143C',
    '苏轼': '#8A2BE2',
    '朱元璋': '#FF8C00'
};

// 页面初始化
async function initChatPage() {
    // 从localStorage获取选择的人物和事件
    currentCharacter = localStorage.getItem('selectedCharacter');
    currentEvent = localStorage.getItem('selectedEvent');

    // 添加调试日志
    console.log('初始化聊天页面，读取到的数据:', { currentCharacter, currentEvent });

    if (!currentCharacter || !currentEvent) {
        // 如果没有选择，返回主页
        console.log('没有找到人物或事件数据，返回主页');
        window.location.href = 'index.html';
        return;
    }

    // 更新页面信息
    updatePageInfo();

    // 初始化事件监听器
    initEventListeners();

    // 加载历史对话（如果有），这会自动处理会话ID的创建或加载
    await loadChatHistory();
}

// 更新页面信息
function updatePageInfo() {
    console.log('更新页面信息:', { currentCharacter, currentEvent });
    
    characterName.textContent = currentCharacter;
    eventContext.textContent = `${currentEvent}时期`;
    welcomeCharacter.textContent = currentCharacter;
    welcomeEvent.textContent = currentEvent;

    // 更新头像
    const firstChar = currentCharacter.charAt(0);
    avatarText.textContent = firstChar;
    typingAvatarText.textContent = firstChar;

    // 设置头像颜色
    const color = characterColors[currentCharacter] || '#667eea';
    chatAvatar.style.background = color;
    document.querySelector('.typing-avatar').style.background = color;

    // 更新页面标题
    document.title = `与${currentCharacter}对话 - 历史穿越`;
}

// 初始化事件监听器
function initEventListeners() {
    // 发送按钮点击
    sendBtn.addEventListener('click', sendMessage);

    // 输入框事件
    messageInput.addEventListener('input', handleInputChange);
    messageInput.addEventListener('keydown', handleKeyDown);

    // 自动调整输入框高度
    messageInput.addEventListener('input', autoResizeTextarea);
}

// 处理输入变化
function handleInputChange() {
    const text = messageInput.value.trim();
    const length = messageInput.value.length;

    // 更新字符计数
    charCount.textContent = `${length}/500`;

    // 更新发送按钮状态
    sendBtn.disabled = !text || length > 500;

    // 字符数超限时的样式
    if (length > 500) {
        charCount.style.color = '#dc3545';
    } else {
        charCount.style.color = '#6c757d';
    }
}

// 处理键盘事件
function handleKeyDown(event) {
    if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        if (!sendBtn.disabled) {
            sendMessage();
        }
    }
}

// 自动调整输入框高度
function autoResizeTextarea() {
    messageInput.style.height = 'auto';
    messageInput.style.height = Math.min(messageInput.scrollHeight, 120) + 'px';
}

// 发送消息
async function sendMessage() {
    const text = messageInput.value.trim();
    if (!text || sendBtn.disabled) return;

    // 保存用户消息
    lastUserMessage = text;

    // 添加用户消息到界面
    addMessage('user', text, '我');

    // 清空输入框
    messageInput.value = '';
    handleInputChange();
    autoResizeTextarea();

    // 显示打字指示器
    showTypingIndicator();

    try {
        // 调用Coze智能体
        const response = await callCozeBot(text);

        // 隐藏打字指示器
        hideTypingIndicator();

        if (response) {
            // 添加机器人回复
            addMessage('bot', response, currentCharacter);
        } else {
            // 显示默认回复
            addMessage('bot', getDefaultResponse(), currentCharacter);
        }
    } catch (error) {
        console.error('发送消息失败:', error);
        hideTypingIndicator();
        showErrorModal('发送消息失败，请检查网络连接或稍后重试。');
    }
}

// 调用Coze智能体
async function callCozeBot(message) {
    try {
        console.log('发送消息到Coze:', message);
        console.log('当前角色:', currentCharacter, '当前事件:', currentEvent);

        // 构建URL，将conversation_id作为查询参数
        const apiUrl = `${COZE_CHAT_CONFIG.url}?conversation_id=${conversationId}`;

        // 构建请求参数（不包含conversation_id）
        const requestBody = {
            bot_id: COZE_CHAT_CONFIG.bot_id,
            user_id: '邵小糖',
            stream: true,
            additional_messages: [
                {
                    content: message,
                    content_type: "text",
                    role: "user",
                    type: "question"
                }
            ],
            custom_variables: {
                role: currentCharacter,
                event: currentEvent
            }
        };

        // 打印完整的请求参数
        console.log('=== Coze API 调用参数 ===');
        console.log('URL:', apiUrl);
        console.log('Headers:', {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${COZE_CHAT_CONFIG.token.substring(0, 10)}...` // 只显示token前10位
        });
        console.log('Request Body:', JSON.stringify(requestBody, null, 2));
        console.log('========================');

        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${COZE_CHAT_CONFIG.token}`
            },
            body: JSON.stringify(requestBody)
        });

        console.log('API响应状态:', response);

        if (!response.ok) {
            const errorText = await response.text();
            console.error('API错误响应:', errorText);
            throw new Error(`HTTP error! status: ${response.status}, message: ${errorText}`);
        }

        let finalContent = '';
        let hasContent = false;

        console.log('✅ 智能体 API 响应成功，开始处理流式数据');

        // 处理流式响应 - 正确处理二进制数据
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        
        try {
            while (true) {
                const { done, value } = await reader.read();
                
                if (done) {
                    console.log('流式响应读取完成');
                    break;
                }
                
                
                // 将Uint8Array转换为文本
                const text = decoder.decode(value, { stream: true });
                
                buffer += text;
                
                const lines = buffer.split('\n');
                buffer = lines.pop() || ''; // 保留不完整的行
                
                for (const line of lines) {
                    if (line.trim() === '') continue; // 跳过空行
                    
                    console.log('处理行:', line);
                    
                    // 处理事件行
                    if (line.startsWith('event:')) {
                        const eventType = line.substring(6).trim();
                        console.log('事件类型:', eventType);
                        continue;
                    }
                    
                    // 处理数据行
                    if (line.startsWith('data:')) {
                        try {
                            const jsonStr = line.substring(5).trim();
                            if (jsonStr === '[DONE]') {
                                console.log('流式响应结束');
                                break;
                            }
                            
                            const jsonData = JSON.parse(jsonStr);
                            console.log('解析的JSON数据:', jsonData);
                            
                            // 根据消息类型和角色处理响应
                            if (jsonData.role === 'assistant' && jsonData.type === 'answer' && jsonData.content) {
                                finalContent = jsonData.content;
                                hasContent = true;
                                console.log('✅ 获取到AI回复:', finalContent);
                            }
                        } catch (parseError) {
                            console.error('解析JSON失败:', parseError, '原始数据:', line);
                        }
                    }
                }
            }
        } finally {
            reader.releaseLock();
        }

        console.log('🔍 最终内容:', finalContent);




        console.log('最终响应:', finalContent, '是否有效:', hasContent);

        if (hasContent && finalContent.trim()) {
            return finalContent.trim();
        } else {
            return '抱歉，我现在无法回应您的问题。请稍后再试。';
        }
    } catch (error) {
        console.error('调用Coze智能体失败:', error);
        return null;
    }
}

// 获取默认回复（当API调用失败时）
function getDefaultResponse() {
    const responses = [
        `作为${currentCharacter}，我很高兴能与你在${currentEvent}时期相遇。请告诉我你想了解什么？`,
        `在${currentEvent}的背景下，我${currentCharacter}愿意与你分享我的见解和经历。`,
        `你好，我是${currentCharacter}。在这${currentEvent}的时代，有什么我可以为你解答的吗？`,
        `欢迎来到${currentEvent}时期，我${currentCharacter}很乐意与你交流。`,
        `作为${currentCharacter}，我对你的问题很感兴趣。在${currentEvent}这个时代，让我们深入探讨吧。`
    ];

    return responses[Math.floor(Math.random() * responses.length)];
}

// 添加消息到界面
function addMessage(type, content, sender) {
    // 使用addMessageToUI函数来确保markdown解析
    addMessageToUI(type, content, sender, new Date().toISOString());
    
    // 保存到聊天历史
    chatHistory.push({
        type: type,
        content: content,
        sender: sender,
        timestamp: new Date().toISOString()
    });

    // 保存到localStorage
    saveChatHistory();
}

// 显示打字指示器
function showTypingIndicator() {
    typingIndicator.style.display = 'block';
    scrollToBottom();
}

// 隐藏打字指示器
function hideTypingIndicator() {
    typingIndicator.style.display = 'none';
}

// 滚动到底部
function scrollToBottom() {
    setTimeout(() => {
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }, 100);
}

// 格式化时间
function formatTime(date) {
    // 确保date是Date对象
    const dateObj = date instanceof Date ? date : new Date(date);
    return dateObj.toLocaleTimeString('zh-CN', {
        hour: '2-digit',
        minute: '2-digit'
    });
}

// 创建新会话
async function createNewConversation() {
    try {
        const response = await fetch(COZE_CHAT_CONFIG.conversation_url, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${COZE_CHAT_CONFIG.token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                bot_id: COZE_CHAT_CONFIG.bot_id
            })
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        
        if (data.code === 0 && data.data && data.data.id) {
            return data.data.id;
        } else {
            throw new Error(`API error: ${data.msg || 'Unknown error'}`);
        }
    } catch (error) {
        console.error('创建会话失败:', error);
        // 如果API调用失败，回退到本地生成的ID
        return generateConversationId();
    }
}

// 生成对话ID（作为备用方案）
function generateConversationId() {
    return `chat_${currentCharacter}_${currentEvent}_${Date.now()}`;
}

// 保存聊天历史
function saveChatHistory() {
    const key = `chat_history_${currentCharacter}_${currentEvent}`;
    localStorage.setItem(key, JSON.stringify(chatHistory));
}

// 加载聊天历史
async function loadChatHistory() {
    const key = `chat_history_${currentCharacter}_${currentEvent}`;
    const saved = localStorage.getItem(key);

    // 同时加载保存的conversationId
    const conversationKey = `conversation_id_${currentCharacter}_${currentEvent}`;
    const savedConversationId = localStorage.getItem(conversationKey);
    
    if (savedConversationId) {
        conversationId = savedConversationId;
        console.log('加载已存在的会话ID:', conversationId);
    } else {
        // 如果没有保存的会话ID，通过API创建新会话
        console.log('创建新的会话...');
        conversationId = await createNewConversation();
        console.log('新会话ID:', conversationId);
        // 保存新创建的conversationId
        localStorage.setItem(conversationKey, conversationId);
    }

    if (saved) {
        try {
            chatHistory = JSON.parse(saved);

            // 重新显示历史消息
            if (chatHistory.length > 0) {
                // 移除欢迎消息
                const welcomeMessage = chatMessages.querySelector('.welcome-message');
                if (welcomeMessage) {
                    welcomeMessage.remove();
                }

                // 显示历史消息
                chatHistory.forEach(msg => {
                    addMessageToUI(msg.type, msg.content, msg.sender, new Date(msg.timestamp));
                });
            }
        } catch (error) {
            console.error('加载聊天历史失败:', error);
            chatHistory = [];
        }
    }
}

// 基于mkd属性的markdown转换系统（参考知乎方案）
function processMkdElements(container) {
    if (typeof marked === 'undefined') {
        console.warn('Marked库未加载，跳过mkd元素处理');
        return;
    }
    
    // 查找所有带有mkd属性的code和pre元素
    const mkdElements = container.querySelectorAll('code[mkd=""], pre[mkd=""], code[mkd], pre[mkd]');
    
    for (let i = 0; i < mkdElements.length; i++) {
        const element = mkdElements[i];
        
        // 检查是否已经处理过，避免重复处理
        if (element.getAttribute('mkd') === '1') {
            continue;
        }
        
        try {
            // 创建新的div元素来显示转换后的markdown
            const div = document.createElement('div');
            div.className = 'mkd';
            
            // 获取元素内容并去除首尾空白
            const content = element.innerHTML.trim();
            
            // 使用marked转换markdown内容
            div.innerHTML = marked.parse(content);
            
            // 在原元素前插入转换后的内容
            element.parentNode.insertBefore(div, element);
            
            // 标记元素已处理，防止重复解析
            element.setAttribute('mkd', '1');
            
            // 隐藏原始的code/pre元素
            element.style.display = 'none';
            
        } catch (error) {
            console.error('处理mkd元素时出错:', error);
            // 如果处理失败，保持原样显示
        }
    }
}

// 添加CSS样式来隐藏已处理的mkd元素
function addMkdStyles() {
    const style = document.createElement('style');
    style.textContent = `
        div.mkd + code[mkd="1"], 
        div.mkd + pre[mkd="1"] {
            display: none !important;
        }
        
        div.mkd {
            margin: 10px 0;
            padding: 0;
        }
        
        div.mkd h1, div.mkd h2, div.mkd h3, 
        div.mkd h4, div.mkd h5, div.mkd h6 {
            margin: 0.5em 0;
            color: inherit;
        }
        
        div.mkd p {
            margin: 0.5em 0;
        }
        
        div.mkd img {
            max-width: 100%;
            height: auto;
        }
        
        div.mkd code {
            background-color: rgba(0,0,0,0.1);
            padding: 2px 4px;
            border-radius: 3px;
            font-family: monospace;
        }
        
        div.mkd pre {
            background-color: rgba(0,0,0,0.1);
            padding: 10px;
            border-radius: 5px;
            overflow-x: auto;
        }
        
        div.mkd blockquote {
            border-left: 4px solid #ddd;
            margin: 0;
            padding-left: 16px;
            color: #666;
        }
    `;
    
    // 检查是否已经添加过样式
    if (!document.querySelector('#mkd-styles')) {
        style.id = 'mkd-styles';
        document.head.appendChild(style);
    }
}

// 添加消息到UI（不保存到历史）
function addMessageToUI(type, content, sender, timestamp) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${type}`;

    const messageContent = document.createElement('div');
    messageContent.className = 'message-content';

    const avatar = document.createElement('div');
    avatar.className = 'message-avatar';
    avatar.textContent = type === 'user' ? '我' : currentCharacter.charAt(0);

    const bubble = document.createElement('div');
    bubble.className = 'message-bubble';
    
    // 确保mkd样式已添加
    addMkdStyles();
    
    // 对历史聊天内容进行markdown解析
    if (type === 'bot' && content && typeof marked !== 'undefined') {
        try {
            // 使用最新版本的marked库调用方式
            // 配置marked选项
            marked.use({
                breaks: true,        // 支持换行
                gfm: true,          // 支持GitHub风格的Markdown
                pedantic: false,    // 不使用严格模式
                silent: false       // 不静默错误
            });
            
            // 使用marked.use()配置自定义渲染器
            marked.use({
                renderer: {
                    image(token) {
                        // 新版本marked.js中，image渲染器接收token对象
                        const href = token.href || '';
                        const title = token.title || '';
                        const text = token.text || '';
                        
                        // 确保href是字符串类型
                        if (typeof href !== 'string') {
                            console.warn('图片href不是字符串类型:', href);
                            return `<span style="color:#999; font-style:italic;">[图片链接无效]</span>`;
                        }
                        
                        let cleanHref = href.replace(/[\[\]`]/g, ''); // 清理URL中的无效字符
                        
                        // 进一步清理URL末尾可能的特殊字符
                        cleanHref = cleanHref.replace(/[)\]}]+$/, '');
                        
                        // 不要对图片URL进行解码，保持原始URL
                        // 移除了 decodeURIComponent 处理，因为这会导致正常的URL被错误解码
                        
                        if (cleanHref.startsWith('http')) {
                            return `<img src="${cleanHref}" alt="${text || ''}" title="${title || ''}" referrerpolicy="no-referrer" crossorigin="anonymous" onerror="this.style.display='none'; this.nextElementSibling.style.display='inline';" style="max-width: 100%; height: auto;" /><span style="display:none; color:#999; font-style:italic;">[图片加载失败: ${text || '链接无效'}]</span>`;
                        }
                        return `<img src="${cleanHref}" alt="${text || ''}" title="${title || ''}" style="max-width: 100%; height: auto;">`;
                    }
                }
            });

            // 识别并转换文本中独立的图片URL - 处理各种格式
            let processedContent = content;
            
            // 处理 ! `URL` 格式的图片链接
            processedContent = processedContent.replace(/!\s*`([^`]+)`/g, (match, url) => {
                return `![图片](${url.trim()})`;
            });
            
            // 处理括号内的图片URL格式：!图片(URL)
            processedContent = processedContent.replace(/!图片\(([^)]+)\)/g, (match, url) => {
                return `![图片](${url})`;
            });
            
            // 处理标准图片扩展名的URL
            processedContent = processedContent.replace(/\b(https?:\/\/[^\s<>"'\[\]`]+\.(jpg|jpeg|png|gif|webp|bmp|svg)([^\s<>"'\[\]`]*)?)\b/gi, (match, url) => {
                // 检查是否已经是markdown格式，避免重复转换
                if (processedContent.includes(`![图片](${url})`) || content.includes(`![`) && content.includes(`](${url}`)) {
                    return match; // 已经是markdown格式，不再转换
                }
                return `![图片](${url})`;
            });
            
            // 额外处理：识别可能的图片URL（即使没有明确的图片扩展名）
            processedContent = processedContent.replace(/\b(https?:\/\/[^\s<>"'\[\]`]*(?:pic|img|image|photo|feed)[^\s<>"'\[\]`]*)\b/gi, (match, url) => {
                // 检查是否已经被处理过或已经是markdown格式
                if (processedContent.includes(`![图片](${url})`) || match.includes('![')) {
                    return match; // 避免重复转换
                }
                return `![图片](${url})`;
            });

            // 使用marked.parse解析Markdown
            bubble.innerHTML = marked.parse(processedContent, {
                breaks: true,
                gfm: true
            });
            
            // 应用基于mkd属性的markdown转换系统（参考知乎方案）
            processMkdElements(bubble);
        } catch (error) {
            console.error('Markdown解析错误:', error);
            bubble.textContent = content; // 如果解析失败，显示原始文本
        }
    } else {
        // 如果不是bot类型或没有内容，或marked未定义，直接显示文本
        if (typeof marked === 'undefined') {
            console.warn('Marked库未加载，使用纯文本显示');
        }
        bubble.textContent = content;
        
        // 即使是纯文本，也尝试处理可能的mkd元素
        if (content && content.includes('mkd')) {
            bubble.innerHTML = content;
            processMkdElements(bubble);
        }
    }

    const time = document.createElement('div');
    time.className = 'message-time';
    time.textContent = formatTime(timestamp);

    messageContent.appendChild(avatar);
    messageContent.appendChild(bubble);
    messageDiv.appendChild(messageContent);
    messageDiv.appendChild(time);

    chatMessages.appendChild(messageDiv);
    
    // 移除欢迎消息（如果存在）
    const welcomeMessage = chatMessages.querySelector('.welcome-message');
    if (welcomeMessage) {
        welcomeMessage.remove();
    }
    
    // 滚动到底部
    scrollToBottom();
}

// 清空对话
function clearChat() {
    if (confirm('确定要清空所有对话记录吗？')) {
        chatHistory = [];

        // 清空界面
        chatMessages.innerHTML = `
            <div class="welcome-message">
                <div class="welcome-content">
                    <h3>欢迎来到历史时空</h3>
                    <p>您已成功穿越到<span id="welcomeEvent">${currentEvent}</span>时期</p>
                    <p>现在可以与<span id="welcomeCharacter">${currentCharacter}</span>开始对话了</p>
                </div>
            </div>
        `;

        // 清空localStorage
        const key = `chat_history_${currentCharacter}_${currentEvent}`;
        localStorage.removeItem(key);
    }
}

// 返回主页
function goBack() {
    if (confirm('确定要返回主页吗？当前对话将被保存。')) {
        window.location.href = 'index.html';
    }
}

// 显示错误模态框
function showErrorModal(message) {
    errorMessage.textContent = message;
    errorModal.style.display = 'flex';
}

// 关闭错误模态框
function closeErrorModal() {
    errorModal.style.display = 'none';
}

// 重试最后一条消息
function retryLastMessage() {
    closeErrorModal();
    if (lastUserMessage) {
        // 移除最后一条用户消息和可能的错误回复
        const messages = chatMessages.querySelectorAll('.message');
        if (messages.length > 0) {
            messages[messages.length - 1].remove();
            if (messages.length > 1) {
                messages[messages.length - 2].remove();
            }
        }

        // 重新发送
        messageInput.value = lastUserMessage;
        sendMessage();
    }
}

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', async () => {
    await initChatPage();

    // 检查API配置
    if (COZE_CHAT_CONFIG.token === 'YOUR_COZE_BOT_TOKEN') {
        console.warn('请配置Coze智能体API密钥');

        // 显示配置提醒
        setTimeout(() => {
            showErrorModal('请在chat-script.js中配置Coze智能体API密钥以启用完整的对话功能。当前将使用模拟回复。');
        }, 1000);
    }
});

// 页面卸载时保存聊天历史
window.addEventListener('beforeunload', () => {
    saveChatHistory();
});

// 导出函数供全局使用
window.ChatApp = {
    clearChat,
    goBack,
    closeErrorModal,
    retryLastMessage
};