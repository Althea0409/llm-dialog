<template>
  <a-layout class="chat-layout">
    <!-- 侧边栏 -->
    <a-layout-sider 
      class="chat-sider" 
      width="260"
    >
      <div class="sider-header">
        <div class="logo">
          <span>新 竹 Edubanboo</span>
        </div>
        <a-button type="text" block class="new-chat-btn" @click="newChat">
          <template #icon><plus-outlined /></template>
          开始新对话
        </a-button>
      </div>
      
      <!-- 历史记录 -->
      <div class="chat-history-list">
        <div class="history-section">
          <div class="section-title">已加星标</div>
          <a-menu mode="inline" theme="dark">
            <a-menu-item v-for="(chat, index) in starredChats" :key="`starred-${index}`">
              <star-filled class="star-icon" />
              <span>{{ chat.title }}</span>
            </a-menu-item>
          </a-menu>
        </div>

        <div class="history-section">
          <div class="section-title">最近对话</div>
          <a-menu mode="inline" theme="dark">
            <a-menu-item v-for="(chat, index) in recentChats" :key="`recent-${index}`">
              <message-outlined />
              <span>{{ chat.title }}</span>
            </a-menu-item>
          </a-menu>
        </div>
      </div>

    </a-layout-sider>

    <!-- 主聊天区域 -->
    <a-layout class="chat-main">
      <!-- 顶部搜索栏 -->
      <a-layout-header class="chat-header">
        <div class="header-left">
          <div class="search-wrapper">
            <search-outlined class="search-icon" />
            <input
              v-model="searchQuery"
              class="search-input"
              placeholder="搜索对话..."
              @input="handleSearch"
            />
          </div>
        </div>
        <div class="header-right">
          <a-button type="text" class="header-btn">
            <template #icon><star-outlined /></template>
          </a-button>
          <a-button type="text" class="header-btn">
            <template #icon><setting-outlined /></template>
          </a-button>
        </div>
      </a-layout-header>

      <a-layout-content class="chat-content">
        <!-- 消息列表 -->
        <div class="messages-container" ref="messagesContainer">
          <div v-for="(message, index) in filteredMessages" :key="index" 
               :class="['message-wrapper', message.role]">
            <div class="message-content">
              <div class="message-header">
                <span class="role-name">{{ message.role === 'assistant' ? '新竹' : '你' }}</span>
                <a-tag v-if="message.error" color="error">发送失败</a-tag>
              </div>
              
              <div class="markdown-container">
                <VueMarkdown 
                  :source="message.content"
                  :options="{
                    highlight: (code: string, lang: string) => highlightCode(code, lang)
                  }"
                  class="markdown-body"
                  @html-update="addCopyButtons"
                />
              </div>

              <div class="message-footer">
                <div v-if="message.error" class="message-actions">
                  <a-space>
                    <a-button type="text" size="small" @click="retryMessage(index)">
                      <template #icon><redo-outlined /></template>
                      重试
                    </a-button>
                    <a-button type="text" danger size="small" @click="deleteMessage(index)">
                      <template #icon><delete-outlined /></template>
                      删除
                    </a-button>
                  </a-space>
                </div>
                <div v-else class="message-actions">
                  <a-space>
                    <a-button type="text" size="small">
                      <template #icon><copy-outlined /></template>
                      复制
                    </a-button>
                    <a-button type="text" size="small">
                      <template #icon><redo-outlined /></template>
                      重新生成
                    </a-button>
                  </a-space>
                </div>
              </div>
            </div>
          </div>

          <!-- 加载指示器 -->
          <div v-if="isLoading" class="loading-wrapper">
            <a-spin>
              <template #indicator>
                <loading-outlined style="font-size: 24px" spin />
              </template>
              <div class="loading-text">新竹正在思考...</div>
            </a-spin>
          </div>
        </div>

        <!-- 输入区域 -->
        <div class="input-container">
          <div class="input-wrapper">
            <a-textarea
              v-model:value="userInput"
              :rows="1"
              :disabled="isLoading"
              placeholder="请发送消息... (Enter 发送，Shift + Enter 换行)"
              @keydown="handleKeyDown"
              :auto-size="{ minRows: 1, maxRows: 6 }"
              class="chat-input"
            />
            <div class="input-right">
              <MediaUploader
                class="media-uploader"
                @update:fileList="handleMediaUpload"
                @error="handleUploadError"
              />
              <a-button 
                type="text"
                class="send-button"
                :disabled="isLoading || (!userInput.trim() && !mediaFiles.length)"
                @click="sendMessage"
              >
                <template #icon><send-outlined /></template>
              </a-button>
            </div>
          </div>
        </div>
      </a-layout-content>
    </a-layout>
  </a-layout>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch, nextTick } from 'vue'
import VueMarkdown from 'vue-markdown-render'
import hljs from 'highlight.js'
import 'highlight.js/styles/github-dark.css'
import { copyToClipboard } from '../utils/copyToClipboard'
import { message } from 'ant-design-vue'
import type { UploadFile } from 'ant-design-vue'
import MediaUploader from './MediaUploader.vue'
import {
  PlusOutlined,
  MessageOutlined,
  LoadingOutlined,
  SendOutlined,
  RedoOutlined,
  DeleteOutlined,
  StarOutlined,
  StarFilled,
  SettingOutlined,
  SearchOutlined,
  UserOutlined,
  QuestionCircleOutlined,
  CopyOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
} from '@ant-design/icons-vue'
import cozeClient from '../utils/cozeClient'
import { RoleType, ChatStatus } from '@coze/api'

// 添加媒体文件状态
const mediaFiles = ref<UploadFile[]>([])

// 处理媒体文件上传
const handleMediaUpload = (files: UploadFile[]) => {
  mediaFiles.value = files
}

// 处理上传错误
const handleUploadError = (errorMessage: string) => {
  // 使用 ant-design-vue 的消息提示组件
  message.error(errorMessage)
}

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
  error?: boolean
  mediaFiles?: UploadFile[]
}

interface ChatHistory {
  title: string
  messages: ChatMessage[]
}

const messages = ref<ChatMessage[]>([])
const userInput = ref('')
const searchQuery = ref('')
const chatHistory = ref<ChatHistory[]>([
  { title: '关于Vue3的讨论', messages: [] },
  { title: 'TypeScript学习笔记', messages: [] },
])
const isLoading = ref(false)

// 修改类型定义
const starredChats = ref<ChatHistory[]>([])
const recentChats = ref<ChatHistory[]>([])

// 代码高亮函数
const highlightCode = (code: string, lang: string) => {
  if (lang && hljs.getLanguage(lang)) {
    return hljs.highlight(code, { language: lang }).value
  }
  return hljs.highlightAuto(code).value
}

// 搜索过滤
const filteredMessages = computed(() => {
  if (!searchQuery.value) return messages.value
  return messages.value.filter(msg => 
    msg.content.toLowerCase().includes(searchQuery.value.toLowerCase())
  )
})

// 添加流式输出相关的状态
const streamingMessage = ref('')
const isStreaming = ref(false)

// 模拟流式输出
const streamResponse = async (response: string) => {
  isStreaming.value = true
  streamingMessage.value = ''
  
  const chars = response.split('')
  for (const char of chars) {
    streamingMessage.value += char
    await new Promise(resolve => setTimeout(resolve, 50))
  }
  
  isStreaming.value = false
  return streamingMessage.value
}

// 修改发送消息函数
const sendMessage = async () => {
  if (!userInput.value.trim() || isLoading.value) return;

  const messageContent = userInput.value;
  userInput.value = '';

  messages.value.push({
    role: 'user',
    content: messageContent,
  });

  scrollToBottom();
  isLoading.value = true;

  try {
    const response = await cozeClient.chat.createAndPoll({
      bot_id: 'your_bot_id',
      additional_messages: [{
        role: RoleType.User,
        content: messageContent,
        content_type: 'text',
      }],
    });

    if (response.chat.status === ChatStatus.COMPLETED && response.messages) {
      response.messages.forEach(item => {
        messages.value.push({
          role: item.role === RoleType.User ? 'user' : 'assistant',
          content: item.content,
        });
      });
    }
  } catch (error) {
    console.error('发送消息失败:', error);
    messages.value[messages.value.length - 1].error = true;
  } finally {
    isLoading.value = false;
    scrollToBottom();
  }
};

// 重试发送消息
const retryMessage = async (index: number) => {
  const message = messages.value[index]
  if (!message || message.role !== 'user') return

  message.error = false
  isLoading.value = true

  try {
    // 这里添加实际的API调用
    await new Promise(resolve => setTimeout(resolve, 1000)) // 模拟API延迟
    
    messages.value.push({
      role: 'assistant',
      content: '这是重试后的AI回复示例。\n```python\nprint("Retry successful!")\n```'
    })
  } catch (error) {
    message.error = true
    console.error('重试发送消息失败:', error)
  } finally {
    isLoading.value = false
    scrollToBottom()
  }
}

// 删除消息
const deleteMessage = (index: number) => {
  messages.value.splice(index, 1)
}

// 滚动到底部
const scrollToBottom = () => {
  const messagesContainer = ref<HTMLElement | null>(null)
  setTimeout(() => {
    if (messagesContainer.value) {
      messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight
    }
  }, 100)
}

const handleSearch = () => {
  // 实时搜索，不需要额外处理，因为使用了计算属性
}

// 添加复制按钮到代码块
const addCopyButtons = () => {
  setTimeout(() => {
    const preElements = document.querySelectorAll('.markdown-body pre')
    preElements.forEach(pre => {
      // 检查是否已经添加了复制按钮
      if (pre.querySelector('.copy-button')) return

      const copyButton = document.createElement('button')
      copyButton.className = 'copy-button'
      copyButton.innerHTML = '复制'
      
      copyButton.addEventListener('click', async () => {
        const code = pre.querySelector('code')?.textContent || ''
        const success = await copyToClipboard(code)
        
        if (success) {
          copyButton.innerHTML = '已复制!'
          setTimeout(() => {
            copyButton.innerHTML = '复制'
          }, 2000)
        }
      })
      
      pre.appendChild(copyButton)
    })
  }, 100)
}

// 处理键盘事件
const handleKeyDown = (e: KeyboardEvent) => {
  if (e.key === 'Enter') {
    if (e.shiftKey) {
      // Shift + Enter 换行
      return
    }
    // Enter 发送消息
    e.preventDefault()
    sendMessage()
  }
}

// 监听消息变化，重新添加复制按钮
watch(() => messages.value, () => {
  nextTick(() => {
    addCopyButtons()
  })
}, { deep: true
})

const newChat = () => {
  const newChatHistory: ChatHistory = {
    title: `新对话 ${recentChats.value.length + 1}`,
    messages: []
  }
  
  // 现在这里不会报错了
  recentChats.value.unshift(newChatHistory)
  messages.value = []
  userInput.value = ''
}
</script>

<style scoped>
.chat-layout {
  height: 100vh;
  background: #000000;
}

.chat-sider {
  background: #2C2C2C;
  border-right: 1px solid #1f1f1f;
  position: relative;
  z-index: 1;
}

.trigger {
  color: #888;
  font-size: 18px;
  cursor: pointer;
  transition: color 0.3s;
}

.trigger:hover {
  color: #fff;
}

.sider-header {
  padding: 20px;
  border-bottom: 1px solid #303030;
}

.logo {
  display: flex;
  align-items: center;
  justify-content: space-between;
  color: #fff;
  font-size: 18px;
  font-weight: 600;
  margin-bottom: 20px;
  letter-spacing: 1px;
}

.new-chat-btn {
  color: #fff;
  border: 1px solid #303030;
  border-radius: 8px;
  height: 44px;
  font-size: 15px;
  transition: all 0.3s ease;
}

.new-chat-btn:hover {
  background: #303030;
  border-color: #404040;
}

.chat-history-list {
  padding: 20px;
}

.history-section {
  margin-bottom: 28px;
}

.section-title {
  color: #888;
  font-size: 13px;
  margin-bottom: 12px;
  padding-left: 8px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.sider-footer {
  position: absolute;
  bottom: 0;
  width: 100%;
  padding: 20px;
  border-top: 1px solid #303030;
  background: #1f1f1f;
}

.user-btn {
  color: #fff;
  height: 44px;
  font-size: 15px;
  transition: all 0.3s ease;
}

.user-btn:hover {
  background: #303030;
}

.chat-main {
  flex: 1;
  display: flex;
  flex-direction: column;
  transition: all 0.3s ease;
  background: #000000;
}

.chat-layout :deep(.ant-layout-sider-collapsed) {
  min-width: 80px !important;
  width: 80px !important;
}

.chat-layout :deep(.ant-layout-sider-collapsed) .logo span {
  display: none;
}

.chat-layout :deep(.ant-layout-sider-collapsed) .new-chat-btn span {
  display: none;
}

.chat-header {
  background: #141414;
  padding: 0 28px;
  height: 72px;
  line-height: 72px;
  border-bottom: 1px solid #1f1f1f;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 20px;
}

.search-wrapper {
  position: relative;
  width: 320px;
}

.search-icon {
  position: absolute;
  left: 14px;
  top: 50%;
  transform: translateY(-50%);
  color: #888;
}

.search-input {
  width: 100%;
  height: 40px;
  background: #303030;
  border: 1px solid transparent;
  border-radius: 8px;
  padding: 0 14px 0 40px;
  color: #fff;
  font-size: 15px;
  transition: all 0.3s ease;
}

.search-input:focus {
  border-color: #404040;
  background: #262626;
}

.header-btn {
  color: #888;
  transition: all 0.3s ease;
}

.header-btn:hover {
  color: #fff;
}

.chat-content {
  height: calc(100vh - 72px);
  position: relative;
  display: flex;
  flex-direction: column;
}

.messages-container {
  flex: 1;
  overflow-y: auto;
  padding: 28px;
  scroll-behavior: smooth;
}

.message-wrapper {
  margin-bottom: 28px;
  opacity: 0;
  transform: translateY(20px);
  animation: messageAppear 0.3s ease forwards;
}

@keyframes messageAppear {
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.message-wrapper.assistant {
  padding-right: 64px;
}

.message-wrapper.user {
  padding-left: 64px;
}

.message-content {
  background: #141414;
  border: 1px solid #1f1f1f;
  border-radius: 12px;
  padding: 20px;
  transition: all 0.3s ease;
}

.message-content:hover {
  border-color: #303030;
}

.message-header {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 12px;
}

.role-name {
  color: #fff;
  font-weight: 600;
  font-size: 15px;
}

.markdown-container {
  color: #fff;
  line-height: 1.6;
}

.markdown-body {
  background: transparent !important;
}

.markdown-body pre {
  background: #1E1E1E;
  padding: 16px;
  border-radius: 8px;
  margin: 12px 0;
  border: 1px solid #2C2C2C;
  position: relative;
}

.markdown-body pre:hover {
  border-color: #404040;
}

.copy-button {
  position: absolute;
  top: 8px;
  right: 8px;
  padding: 4px 8px;
  background: #2C2C2C;
  border: 1px solid #404040;
  border-radius: 4px;
  color: #888;
  font-size: 12px;
  cursor: pointer;
  opacity: 0;
  transition: all 0.2s ease;
  display: flex;
  align-items: center;
  gap: 4px;
  user-select: none;
}

.markdown-body pre:hover .copy-button {
  opacity: 1;
}

.copy-button:hover {
  background: #363636;
  border-color: #505050;
  color: #fff;
}

.copy-button:active {
  transform: translateY(1px);
}

.copy-button.copied {
  background: #2B5320;
  border-color: #3B6330;
  color: #fff;
  pointer-events: none;
}

.copy-button::before {
  content: '';
  display: inline-block;
  width: 14px;
  height: 14px;
  background-image: url('data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" fill="%23888" viewBox="0 0 24 24"><path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/></svg>');
  background-repeat: no-repeat;
  background-position: center;
  background-size: contain;
  margin-right: 4px;
}

.copy-button::after {
  content: '复制';
}

.copy-button.copied::before {
  background-image: url('data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" fill="%23fff" viewBox="0 0 24 24"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z"/></svg>');
}

.copy-button.copied::after {
  content: '已复制';
}

.message-footer {
  margin-top: 16px;
  display: flex;
  justify-content: flex-end;
}

.loading-wrapper {
  display: flex;
  justify-content: center;
  margin: 28px 0;
}

.loading-text {
  color: #fff;
  margin-top: 10px;
  font-size: 15px;
}

.input-container {
  padding: 16px 28px;
  background: #141414;
  border-top: 1px solid #1f1f1f;
  transition: all 0.3s ease;
}

.input-container.collapsed {
  padding: 8px 28px;
}

.collapse-btn {
  position: absolute;
  top: -24px;
  left: 50%;
  transform: translateX(-50%);
  width: 32px;
  height: 32px;
  border-radius: 16px;
  background: #1f1f1f;
  border: 1px solid #303030;
  color: #888;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.3s ease;
}

.collapse-btn:hover {
  color: #fff;
  border-color: #404040;
  background: #262626;
}

.input-wrapper {
  position: relative;
  display: flex;
  align-items: center;
  gap: 12px;
  background: #141414;
  border: 2px solid #464545;
  border-radius: 8px;
  padding: 8px 12px;
}

.chat-input {
  flex: 1;
  background: transparent;
  border: none;
  color: #fff;
  font-size: 15px;
  resize: none;
  padding: 6px 0;
  line-height: 1.5;
}

.chat-input:focus {
  outline: none;
  box-shadow: none;
}

.chat-input::placeholder {
  color: rgba(255, 255, 255, 0.4);
  opacity: 0.7;
}

.input-right {
  display: flex;
  align-items: center;
  gap: 8px;
}

.media-uploader {
  margin: 0;
}

.send-button {
  color: #1668dc;
  font-size: 20px;
  padding: 4px;
  height: auto;
}

.send-button:hover {
  color: #1890ff;
  background: transparent;
}

.send-button:disabled {
  color: #303030;
}

.message-actions .ant-btn {
  color: #fff;
}

:deep(.ant-menu) {
  background: transparent;
  border: none;
}

:deep(.ant-menu-item) {
  border-radius: 8px;
  margin: 4px 0;
  transition: all 0.3s ease;
}

:deep(.ant-menu-item:hover) {
  background: #262626 !important;
}

:deep(.ant-menu-item-selected) {
  background: #303030 !important;
}

:deep(.ant-tag) {
  margin: 0;
  border-radius: 4px;
}

:deep(.ant-spin-dot-item) {
  background-color: #888;
}
</style>