/**
 * coze-generic-client.js
 * 通用 Coze 操作：session / conversation / workflow / dialogflow / agent 调用
 *
 * 注意：实际字段/路径以 Coze 官方 Open API 为准。此处为通用模板，能覆盖常见调用场景和错误处理。
 */

const API_BASE = process.env.COZE_API_BASE || "https://api.coze.com"; // 或你所在域名 coze.cn / coze.com 的 open API 地址
const API_TOKEN = process.env.COZE_API_TOKEN || "<YOUR_API_TOKEN>";
const APP_ID = process.env.COZE_APP_ID || "<YOUR_APP_ID>"; // 可选，在某些接口需要
const BOT_ID = process.env.COZE_BOT_ID || null; // 可选，直接调用 bot 时用

// 简单的 fetch 封装
async function cozeFetch(path, opts = {}) {
  const url = `${API_BASE}${path}`;
  const headers = Object.assign({
    "Content-Type": "application/json",
    "Authorization": `Bearer ${API_TOKEN}`,
  }, opts.headers || {});
  const res = await fetch(url, Object.assign({}, opts, { headers }));
  if (!res.ok) {
    const text = await res.text().catch(()=>"");
    const error = new Error(`Coze API ${res.status} ${res.statusText}: ${text}`);
    error.status = res.status;
    throw error;
  }
  return res.json();
}

/**
 * 创建 / 获取会话（session）
 * - 根据 Coze 文档，会话（conversation/session）可绑定 app_id、渠道等。
 * - 如果你希望让对话流的结果存储到某个 conversation 中，可传 conversation_id。
 */
async function createSession({ conversationName = null, conversationId = null, channel = "web" } = {}) {
  const payload = {
    app_id: APP_ID,
    channel,
  };
  if (conversationName) payload.CONVERSATION_NAME = conversationName;
  if (conversationId) payload.conversation_id = conversationId;

  // 伪路径：/v1/sessions ；请以官方 API 路径替换
  return cozeFetch("/open/v1/sessions", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

/**
 * 发送一条用户消息到会话（文本消息）
 * - messageObj 可以包含更多类型（卡片、图片、meta）
 */
async function sendMessageToConversation({ conversationId, content, role = "user", extra = {} }) {
  if (!conversationId) throw new Error("conversationId required");
  const payload = {
    conversation_id: conversationId,
    role,
    content,
    ...extra
  };
  // 伪路径：/v1/conversations/{id}/messages
  return cozeFetch(`/open/v1/conversations/${conversationId}/messages`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

/**
 * 调用工作流 / 对话流（workflow / dialog flow）
 * - 可通过指定 bot_id 或 workflow_id 来触发
 * - 如果需要结果写入特定 conversation，传入 conversation_id
 * - 注意：调用工作流时"会话的创建者必须和执行对话流的用户一致"（token 创建者一致），否则可能无法执行。参考官方 API 约束。
 */
async function runWorkflow({ workflowId = null, botId = null, conversationId = null, input = {}, workflowVersion = null }) {
  if (!workflowId && !botId) throw new Error("workflowId or botId required");
  const payload = {
    // workflow 相关参数
    workflow_id: workflowId,
    bot_id: botId,
    input,
  };
  if (conversationId) payload.conversation_id = conversationId;
  if (workflowVersion) payload.workflow_version = workflowVersion;

  // 伪路径：/open/v1/workflows/run
  return cozeFetch("/open/v1/workflows/run", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

/**
 * 获取会话 / 对话详情（用于轮询结果）
 */
async function getConversation(conversationId) {
  if (!conversationId) throw new Error("conversationId required");
  // 伪路径：/open/v1/conversations/{id}
  return cozeFetch(`/open/v1/conversations/${conversationId}`, { method: "GET" });
}

/**
 * 轮询直到会话/工作流完成（简易实现）
 * - 建议：轮询间隔 >= 1s（社区/文档建议），直到状态为 completed 或 required_action（或其他终态）。
 */
async function pollConversationUntilTerminal(conversationId, { intervalMs = 1200, timeoutMs = 60_000 } = {}) {
  const start = Date.now();
  while (true) {
    const conv = await getConversation(conversationId);
    const status = conv.status || conv.state || "unknown";
    // 根据你实际返回字段调整状态判断
    if (status === "completed" || status === "finished") return conv;
    if (status === "required_action" || status === "requires_input") {
      // 返回等待动作的状态，调用方可以自行处理（例如向外部发起用户输入）
      return conv;
    }
    if (Date.now() - start > timeoutMs) {
      throw new Error("pollConversationUntilTerminal timeout");
    }
    await new Promise(r => setTimeout(r, intervalMs));
  }
}

/**
 * 示例：调用已发布的 agent（Chat SDK / Publish）
 * - 有时 Coze 会提供发布后的 Chat SDK token 或 直接的 REST 调用接口
 * - 这里用通用 POST 方法演示：/open/v1/agents/{agent_id}/invoke
 */
async function invokePublishedAgent({ agentId, input }) {
  if (!agentId) throw new Error("agentId required");
  return cozeFetch(`/open/v1/agents/${agentId}/invoke`, {
    method: "POST",
    body: JSON.stringify({ input }),
  });
}

/* ------------- 使用示例（一段流程） ----------------
  1) 创建会话
  2) 在会话中发送用户消息
  3) 调用工作流/对话流（并把 conversation_id 传入，让工作流消息写回该会话）
  4) 轮询直到完成，获取最终 model 输出
*/
async function demoFlow() {
  // 1. 创建会话
  const s = await createSession({ conversationName: "DEFAULT" });
  const convId = s.conversation_id || s.id;
  console.log("session created:", convId);

  // 2. 发送用户消息
  await sendMessageToConversation({ conversationId: convId, content: { type: "text", text: "你好，帮我写一份周报" } });

  // 3. 触发工作流（将结果写回当前 conversation）
  const run = await runWorkflow({
    workflowId: "<YOUR_WORKFLOW_ID>",
    conversationId: convId,
    input: { prompt: "请基于我的项目说明生成周报" }
  });
  console.log("workflow run started:", run);

  // 4. 轮询结果
  const final = await pollConversationUntilTerminal(convId, { intervalMs: 1500, timeoutMs: 120000 });
  console.log("final conversation state:", final);
}

/* 导出函数以供其他模块使用 */
module.exports = {
  cozeFetch,
  createSession,
  sendMessageToConversation,
  runWorkflow,
  getConversation,
  pollConversationUntilTerminal,
  invokePublishedAgent,
  demoFlow
};
