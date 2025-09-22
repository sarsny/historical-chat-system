// 群聊页面全局变量
let currentEvent = null;
let groupParticipants = [];
let groupChatHistory = [];
let conversationId = null;
let lastUserMessage = null;
let mentionSuggestions = [];
let selectedMentionIndex = -1;

const COZE_TOKEN = 'pat_qw1hBkUDiL1ZWVuppGENlJ1psL015j7sxBm9AmJVeQZWEVkQu25UIMQkp20mjST5';

// Coze智能体配置
const COZE_CHAT_CONFIG = {
    url: 'https://api.coze.cn/v3/chat',
    conversation_url: 'https://api.coze.cn/v1/conversation/create',
    token: COZE_TOKEN,
    bot_id: '7552142955872845870'
};

// DOM元素
const groupChatMessages = document.getElementById('groupChatMessages');
const groupMessageInput = document.getElementById('groupMessageInput');
const groupSendBtn = document.getElementById('groupSendBtn');
const groupTitle = document.getElementById('groupTitle');
const eventContext = document.getElementById('eventContext');
const participantsCount = document.getElementById('participantsCount');
const groupAvatarStack = document.getElementById('groupAvatarStack');
const participantsPanel = document.getElementById('participantsPanel');
const participantsList = document.getElementById('participantsList');
const addParticipantModal = document.getElementById('addParticipantModal');
const newCharacterName = document.getElementById('newCharacterName');
const suggestedCharacters = document.getElementById('suggestedCharacters');
const mentionSuggestionsEl = document.getElementById('mentionSuggestions');
const multiTypingIndicator = document.getElementById('multiTypingIndicator');
const typingUsers = document.getElementById('typingUsers');
const charCount = document.querySelector('.char-count');
const errorModal = document.getElementById('errorModal');
const errorMessage = document.getElementById('errorMessage');

// 历史人物颜色映射
const characterColors = {
    '孔子': '#8B4513',
    '李白': '#4169E1',
    '诸葛亮': '#228B22',
    '武则天': '#DC143C',
    '苏轼': '#8A2BE2',
    '朱元璋': '#FF8C00',
    '刘备': '#FF6B35',
    '曹操': '#2E4057',
    '孙权': '#048A81',
    '关羽': '#C73E1D',
    '张飞': '#6A994E',
    '赵云': '#577590'
};

// 推荐的历史人物
const recommendedCharacters = [
    '刘备', '曹操', '孙权', '诸葛亮', '关羽', '张飞',
    '赵云', '周瑜', '司马懿', '吕布', '董卓', '袁绍'
];

// 页面初始化
async function initGroupChatPage() {
    // 从localStorage获取事件信息
    currentEvent = localStorage.getItem('selectedEvent') || '三国鼎立';
    
    // 初始化默认参与者
    const defaultParticipants = ['刘备', '曹操', '孙权'];
    for (const character of defaultParticipants) {
        addParticipantToGroup(character);
    }
    
    updatePageInfo();
    initEventListeners();
    loadGroupChatHistory();
    
    console.log('群聊页面初始化完成', { currentEvent, participants: groupParticipants });
}

// 更新页面信息
function updatePageInfo() {
    if (eventContext) {
        eventContext.textContent = currentEvent;
    }
    
    const welcomeEvent = document.getElementById('welcomeEvent');
    if (welcomeEvent) {
        welcomeEvent.textContent = currentEvent;
    }
    
    updateParticipantsDisplay();
    updateGroupTitle();
}

// 更新群聊标题
function updateGroupTitle() {
    if (groupTitle) {
        if (groupParticipants.length > 0) {
            const names = groupParticipants.slice(0, 3).map(p => p.name).join('、');
            const suffix = groupParticipants.length > 3 ? '等' : '';
            groupTitle.textContent = `${names}${suffix} - ${currentEvent}`;
        } else {
            groupTitle.textContent = `${currentEvent} - 历史群聊`;
        }
    }
}

// 初始化事件监听器
function initEventListeners() {
    // 消息输入框事件
    if (groupMessageInput) {
        groupMessageInput.addEventListener('input', handleGroupInputChange);
        groupMessageInput.addEventListener('keydown', handleGroupKeyDown);
    }
    
    // 发送按钮事件
    if (groupSendBtn) {
        groupSendBtn.addEventListener('click', sendGroupMessage);
    }
    
    // 初始化推荐人物
    initSuggestedCharacters();
}

// 处理输入框变化
function handleGroupInputChange() {
    const text = groupMessageInput.value;
    const charCountEl = document.querySelector('.char-count');
    if (charCountEl) {
        charCountEl.textContent = `${text.length}/500`;
    }
    
    // 启用/禁用发送按钮
    groupSendBtn.disabled = text.trim().length === 0;
    
    // 处理@提及功能
    handleMentionInput(text);
    
    // 自动调整输入框高度
    autoResizeGroupTextarea();
}

// 处理@提及输入
function handleMentionInput(text) {
    const cursorPos = groupMessageInput.selectionStart;
    const textBeforeCursor = text.substring(0, cursorPos);
    const mentionMatch = textBeforeCursor.match(/@([^@\s]*)$/);
    
    if (mentionMatch) {
        const query = mentionMatch[1].toLowerCase();
        const suggestions = groupParticipants.filter(p => 
            p.name.toLowerCase().includes(query)
        );
        
        if (suggestions.length > 0) {
            showMentionSuggestions(suggestions);
        } else {
            hideMentionSuggestions();
        }
    } else {
        hideMentionSuggestions();
    }
}

// 显示@提及建议
function showMentionSuggestions(suggestions) {
    mentionSuggestions = suggestions;
    selectedMentionIndex = -1;
    
    mentionSuggestionsEl.innerHTML = suggestions.map((participant, index) => `
        <div class="mention-item" data-index="${index}" onclick="selectMention(${index})">
            <div class="mention-avatar" style="background: ${getCharacterColor(participant.name)}">
                ${getCharacterInitial(participant.name)}
            </div>
            <span class="mention-name">${participant.name}</span>
        </div>
    `).join('');
    
    mentionSuggestionsEl.style.display = 'block';
}

// 隐藏@提及建议
function hideMentionSuggestions() {
    mentionSuggestionsEl.style.display = 'none';
    mentionSuggestions = [];
    selectedMentionIndex = -1;
}

// 选择@提及
function selectMention(index) {
    if (index >= 0 && index < mentionSuggestions.length) {
        const participant = mentionSuggestions[index];
        const text = groupMessageInput.value;
        const cursorPos = groupMessageInput.selectionStart;
        const textBeforeCursor = text.substring(0, cursorPos);
        const textAfterCursor = text.substring(cursorPos);
        
        const mentionMatch = textBeforeCursor.match(/@([^@\s]*)$/);
        if (mentionMatch) {
            const beforeMention = textBeforeCursor.substring(0, mentionMatch.index);
            const newText = beforeMention + `@${participant.name} ` + textAfterCursor;
            
            groupMessageInput.value = newText;
            const newCursorPos = beforeMention.length + participant.name.length + 2;
            groupMessageInput.setSelectionRange(newCursorPos, newCursorPos);
            
            hideMentionSuggestions();
            groupMessageInput.focus();
        }
    }
}

// 处理键盘事件
function handleGroupKeyDown(event) {
    // 处理@提及导航
    if (mentionSuggestions.length > 0) {
        if (event.key === 'ArrowDown') {
            event.preventDefault();
            selectedMentionIndex = Math.min(selectedMentionIndex + 1, mentionSuggestions.length - 1);
            updateMentionSelection();
        } else if (event.key === 'ArrowUp') {
            event.preventDefault();
            selectedMentionIndex = Math.max(selectedMentionIndex - 1, -1);
            updateMentionSelection();
        } else if (event.key === 'Enter' && selectedMentionIndex >= 0) {
            event.preventDefault();
            selectMention(selectedMentionIndex);
            return;
        } else if (event.key === 'Escape') {
            hideMentionSuggestions();
        }
    }
    
    // 处理发送消息
    if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        sendGroupMessage();
    }
}

// 更新@提及选择状态
function updateMentionSelection() {
    const items = mentionSuggestionsEl.querySelectorAll('.mention-item');
    items.forEach((item, index) => {
        item.classList.toggle('selected', index === selectedMentionIndex);
    });
}

// 自动调整输入框高度
function autoResizeGroupTextarea() {
    groupMessageInput.style.height = 'auto';
    groupMessageInput.style.height = Math.min(groupMessageInput.scrollHeight, 120) + 'px';
}

// 发送群聊消息
async function sendGroupMessage() {
    const message = groupMessageInput.value.trim();
    if (!message) return;
    
    // 保存用户消息
    lastUserMessage = message;
    
    // 添加用户消息到界面
    addGroupMessage('user', message, '用户');
    
    // 清空输入框
    groupMessageInput.value = '';
    groupSendBtn.disabled = true;
    autoResizeGroupTextarea();
    
    // 解析@提及的用户
    const mentionedUsers = parseMentions(message);
    
    // 显示输入状态
    showGroupTypingIndicator(mentionedUsers.length > 0 ? mentionedUsers : groupParticipants);
    
    try {
        // 如果有@提及特定用户，只让被提及的用户回复
        if (mentionedUsers.length > 0) {
            for (const user of mentionedUsers) {
                const response = await callCozeBot(message, user.name);
                hideGroupTypingIndicator();
                addGroupMessage('bot', response, user.name);
                await new Promise(resolve => setTimeout(resolve, 1000)); // 添加延迟模拟真实对话
            }
        } else {
            // 随机选择1-3个参与者回复
            const respondingUsers = getRandomRespondingUsers();
            for (let i = 0; i < respondingUsers.length; i++) {
                const user = respondingUsers[i];
                const response = await callCozeBot(message, user.name);
                hideGroupTypingIndicator();
                addGroupMessage('bot', response, user.name);
                
                if (i < respondingUsers.length - 1) {
                    await new Promise(resolve => setTimeout(resolve, 2000)); // 用户间回复间隔
                    showGroupTypingIndicator([respondingUsers[i + 1]]);
                }
            }
        }
    } catch (error) {
        console.error('发送群聊消息失败:', error);
        hideGroupTypingIndicator();
        showErrorModal('发送消息失败，请稍后重试');
    }
}

// 解析消息中的@提及
function parseMentions(message) {
    const mentions = [];
    const mentionRegex = /@([^\s@]+)/g;
    let match;
    
    while ((match = mentionRegex.exec(message)) !== null) {
        const mentionedName = match[1];
        const participant = groupParticipants.find(p => p.name === mentionedName);
        if (participant && !mentions.includes(participant)) {
            mentions.push(participant);
        }
    }
    
    return mentions;
}

// 获取随机回复用户
function getRandomRespondingUsers() {
    const shuffled = [...groupParticipants].sort(() => 0.5 - Math.random());
    const count = Math.min(Math.floor(Math.random() * 3) + 1, groupParticipants.length);
    return shuffled.slice(0, count);
}

// 调用Coze机器人API
async function callCozeBot(message, characterName) {
    try {
        // 构建角色提示
        const rolePrompt = `你现在扮演${characterName}，正在${currentEvent}的历史背景下与其他历史人物进行群聊对话。请以${characterName}的身份、性格和说话方式回复用户的消息。回复要符合历史人物的特点和当时的历史背景。`;
        
        const response = await fetch(COZE_CHAT_CONFIG.url, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${COZE_CHAT_CONFIG.token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                bot_id: COZE_CHAT_CONFIG.bot_id,
                user_id: 'group_chat_user',
                stream: false,
                auto_save_history: true,
                additional_messages: [
                    {
                        role: 'system',
                        content: rolePrompt,
                        content_type: 'text'
                    },
                    {
                        role: 'user',
                        content: message,
                        content_type: 'text'
                    }
                ]
            })
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        
        if (data.code === 0 && data.data && data.data.messages) {
            const botMessages = data.data.messages.filter(msg => 
                msg.role === 'assistant' && msg.type === 'answer'
            );
            
            if (botMessages.length > 0) {
                return botMessages[0].content || getDefaultResponse(characterName);
            }
        }
        
        return getDefaultResponse(characterName);
        
    } catch (error) {
        console.error('调用Coze API失败:', error);
        return getDefaultResponse(characterName);
    }
}

// 获取默认回复
function getDefaultResponse(characterName) {
    const defaultResponses = {
        '刘备': '仁义为本，此言甚是有理。',
        '曹操': '宁我负人，毋人负我。此事当如何处置？',
        '孙权': '江东基业，岂可轻言放弃。',
        '诸葛亮': '运筹帷幄之中，决胜千里之外。',
        '关羽': '义字当头，生死何惧！',
        '张飞': '俺张翼德在此，谁敢与我一战！'
    };
    
    return defaultResponses[characterName] || `${characterName}正在思考中...`;
}

// 添加群聊消息
function addGroupMessage(type, content, sender, timestamp = new Date()) {
    const messageData = {
        type,
        content,
        sender,
        timestamp: timestamp.toISOString()
    };
    
    // 保存到聊天历史
    groupChatHistory.push(messageData);
    saveGroupChatHistory();
    
    // 添加到UI
    addGroupMessageToUI(type, content, sender, timestamp);
    
    // 滚动到底部
    scrollToBottom();
}

// 添加消息到UI
function addGroupMessageToUI(type, content, sender, timestamp) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `group-message ${type}`;
    
    const timeStr = formatTime(timestamp);
    const isUser = type === 'user';
    
    if (isUser) {
        messageDiv.innerHTML = `
            <div class="message-content">
                <div class="message-header">
                    <span class="message-sender">${sender}</span>
                    <span class="message-time">${timeStr}</span>
                </div>
                <div class="message-bubble">${content}</div>
            </div>
        `;
    } else {
        const characterColor = getCharacterColor(sender);
        const characterInitial = getCharacterInitial(sender);
        
        messageDiv.innerHTML = `
            <div class="message-avatar" style="background: ${characterColor}">
                ${characterInitial}
            </div>
            <div class="message-content">
                <div class="message-header">
                    <span class="message-sender">${sender}</span>
                    <span class="message-time">${timeStr}</span>
                </div>
                <div class="message-bubble">${processMessageContent(content)}</div>
            </div>
        `;
    }
    
    // 移除欢迎消息
    const welcomeMessage = groupChatMessages.querySelector('.welcome-message');
    if (welcomeMessage) {
        welcomeMessage.remove();
    }
    
    groupChatMessages.appendChild(messageDiv);
}

// 处理消息内容（支持Markdown）
function processMessageContent(content) {
    if (typeof marked !== 'undefined') {
        try {
            // 配置marked选项
            marked.use({
                renderer: {
                    image(token) {
                        if (token && typeof token === 'object' && token.href) {
                            const href = token.href;
                            const title = token.title || '';
                            const text = token.text || '';
                            
                            // 清理URL
                            const cleanHref = href.replace(/['"]/g, '');
                            
                            return `<img src="${cleanHref}" alt="${text}" title="${title}" style="max-width: 100%; height: auto; border-radius: 8px; margin: 0.5rem 0;">`;
                        }
                        return '';
                    }
                }
            });
            
            return marked.parse(content, {
                breaks: true,
                gfm: true
            });
        } catch (error) {
            console.error('Markdown解析错误:', error);
            return content;
        }
    }
    
    return content;
}

// 显示群聊输入状态
function showGroupTypingIndicator(users) {
    if (!users || users.length === 0) return;
    
    typingUsers.innerHTML = users.map(user => `
        <div class="typing-user">
            <div class="typing-avatar" style="background: ${getCharacterColor(user.name)}">
                ${getCharacterInitial(user.name)}
            </div>
            <span>${user.name}</span>
            <div class="typing-dots">
                <span></span>
                <span></span>
                <span></span>
            </div>
        </div>
    `).join('');
    
    multiTypingIndicator.style.display = 'block';
    scrollToBottom();
}

// 隐藏群聊输入状态
function hideGroupTypingIndicator() {
    multiTypingIndicator.style.display = 'none';
}

// 滚动到底部
function scrollToBottom() {
    setTimeout(() => {
        groupChatMessages.scrollTop = groupChatMessages.scrollHeight;
    }, 100);
}

// 格式化时间
function formatTime(date) {
    const now = new Date();
    const messageDate = new Date(date);
    const diffMs = now - messageDate;
    const diffMins = Math.floor(diffMs / 60000);
    
    if (diffMins < 1) return '刚刚';
    if (diffMins < 60) return `${diffMins}分钟前`;
    
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}小时前`;
    
    return messageDate.toLocaleDateString('zh-CN', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

// 获取角色颜色
function getCharacterColor(characterName) {
    return characterColors[characterName] || '#718096';
}

// 获取角色首字母
function getCharacterInitial(characterName) {
    return characterName ? characterName.charAt(0) : '?';
}

// 参与者管理功能
function addParticipantToGroup(characterName) {
    if (!characterName || groupParticipants.find(p => p.name === characterName)) {
        return false;
    }
    
    const participant = {
        name: characterName,
        color: getCharacterColor(characterName),
        joinTime: new Date(),
        active: true
    };
    
    groupParticipants.push(participant);
    updateParticipantsDisplay();
    saveGroupChatHistory();
    
    return true;
}

// 更新参与者显示
function updateParticipantsDisplay() {
    // 更新头像堆叠
    if (groupAvatarStack) {
        groupAvatarStack.innerHTML = groupParticipants.slice(0, 3).map((participant, index) => `
            <div class="avatar-item" style="background: ${participant.color}">
                ${getCharacterInitial(participant.name)}
            </div>
        `).join('');
    }
    
    // 更新参与者数量
    if (participantsCount) {
        participantsCount.textContent = groupParticipants.length;
    }
    
    // 更新参与者列表
    if (participantsList) {
        participantsList.innerHTML = groupParticipants.map(participant => `
            <div class="participant-item">
                <div class="participant-avatar" style="background: ${participant.color}">
                    ${getCharacterInitial(participant.name)}
                </div>
                <div class="participant-info">
                    <h4>${participant.name}</h4>
                    <p>加入时间: ${formatTime(participant.joinTime)}</p>
                </div>
                <div class="participant-status active">在线</div>
            </div>
        `).join('');
    }
    
    updateGroupTitle();
}

// 显示参与者面板
function showParticipants() {
    participantsPanel.classList.add('show');
}

// 隐藏参与者面板
function hideParticipants() {
    participantsPanel.classList.remove('show');
}

// 显示添加参与者模态框
function showAddParticipant() {
    addParticipantModal.classList.add('show');
    newCharacterName.focus();
}

// 隐藏添加参与者模态框
function hideAddParticipant() {
    addParticipantModal.classList.remove('show');
    newCharacterName.value = '';
    clearSelectedCharacters();
}

// 初始化推荐人物
function initSuggestedCharacters() {
    if (suggestedCharacters) {
        suggestedCharacters.innerHTML = recommendedCharacters.map(character => `
            <div class="character-chip" onclick="toggleCharacterSelection('${character}')">
                ${character}
            </div>
        `).join('');
    }
}

// 切换人物选择
function toggleCharacterSelection(character) {
    const chip = event.target;
    chip.classList.toggle('selected');
    
    if (chip.classList.contains('selected')) {
        newCharacterName.value = character;
    } else {
        newCharacterName.value = '';
    }
}

// 清除选中的人物
function clearSelectedCharacters() {
    const chips = suggestedCharacters.querySelectorAll('.character-chip');
    chips.forEach(chip => chip.classList.remove('selected'));
}

// 添加参与者
function addParticipant() {
    const characterName = newCharacterName.value.trim();
    
    if (!characterName) {
        alert('请输入历史人物姓名');
        return;
    }
    
    if (groupParticipants.find(p => p.name === characterName)) {
        alert('该人物已在群聊中');
        return;
    }
    
    if (addParticipantToGroup(characterName)) {
        hideAddParticipant();
        
        // 添加系统消息
        addGroupMessage('system', `${characterName} 加入了群聊`, '系统');
    }
}

// 保存群聊历史
function saveGroupChatHistory() {
    const groupChatData = {
        event: currentEvent,
        participants: groupParticipants,
        history: groupChatHistory,
        lastUpdate: new Date().toISOString()
    };
    
    localStorage.setItem('groupChatHistory', JSON.stringify(groupChatData));
}

// 加载群聊历史
function loadGroupChatHistory() {
    try {
        const saved = localStorage.getItem('groupChatHistory');
        if (saved) {
            const data = JSON.parse(saved);
            
            if (data.event === currentEvent && data.history) {
                groupChatHistory = data.history;
                
                // 恢复历史消息到UI
                data.history.forEach(msg => {
                    if (msg.type !== 'system') {
                        addGroupMessageToUI(msg.type, msg.content, msg.sender, new Date(msg.timestamp));
                    }
                });
            }
        }
    } catch (error) {
        console.error('加载群聊历史失败:', error);
    }
}

// 清空群聊
function clearGroupChat() {
    if (confirm('确定要清空所有聊天记录吗？')) {
        groupChatHistory = [];
        groupChatMessages.innerHTML = `
            <div class="welcome-message">
                <div class="welcome-content">
                    <h3>欢迎来到历史群聊</h3>
                    <p>您已进入<span id="welcomeEvent">${currentEvent}</span>的时空</p>
                    <p>多位历史人物将与您一起讨论这个时代的风云变幻</p>
                    <div class="welcome-tip">
                        💡 提示：您可以@特定人物来指定对话对象，或直接发送消息让所有人参与讨论
                    </div>
                </div>
            </div>
        `;
        saveGroupChatHistory();
    }
}

// 返回主页
function goBack() {
    window.location.href = 'index.html';
}

// 错误处理
function showErrorModal(message) {
    errorMessage.textContent = message;
    errorModal.style.display = 'flex';
}

function closeErrorModal() {
    errorModal.style.display = 'none';
}

function retryLastMessage() {
    closeErrorModal();
    if (lastUserMessage) {
        groupMessageInput.value = lastUserMessage;
        sendGroupMessage();
    }
}

// 表情选择器（简单实现）
function toggleEmojiPicker() {
    // 简单的表情插入
    const emojis = ['😊', '😂', '🤔', '👍', '👎', '❤️', '🔥', '💯'];
    const randomEmoji = emojis[Math.floor(Math.random() * emojis.length)];
    
    const cursorPos = groupMessageInput.selectionStart;
    const text = groupMessageInput.value;
    const newText = text.slice(0, cursorPos) + randomEmoji + text.slice(cursorPos);
    
    groupMessageInput.value = newText;
    groupMessageInput.setSelectionRange(cursorPos + randomEmoji.length, cursorPos + randomEmoji.length);
    groupMessageInput.focus();
    
    handleGroupInputChange();
}

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', async () => {
    await initGroupChatPage();
});

// 页面卸载前保存数据
window.addEventListener('beforeunload', () => {
    saveGroupChatHistory();
});

// 导出全局函数
window.GroupChatApp = {
    showParticipants,
    hideParticipants,
    showAddParticipant,
    hideAddParticipant,
    addParticipant,
    toggleCharacterSelection,
    selectMention,
    clearGroupChat,
    goBack,
    closeErrorModal,
    retryLastMessage,
    toggleEmojiPicker
};