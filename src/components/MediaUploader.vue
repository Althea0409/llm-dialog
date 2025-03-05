<template>
  <div class="media-uploader">
    <a-upload
      :multiple="true"
      :show-upload-list="true"
      :before-upload="beforeUpload"
      @change="handleChange"
      :accept="acceptTypes"
    >
      <a-button type="text" class="upload-button">
        <template #icon><upload-outlined /></template>
        上传文件
      </a-button>
    </a-upload>
    
    <!-- 预览区域 -->
    <div v-if="fileList.length > 0" class="preview-list">
      <div v-for="file in fileList" :key="file.uid" class="preview-item">
        <!-- 图片预览 -->
        <img
          v-if="isImage(file)"
          :src="file.url || (file.originFileObj ? URL.createObjectURL(file.originFileObj) : '')"
          class="preview-image"
          alt="preview"
        />
        <!-- 音频预览 -->
        <audio
          v-else-if="isAudio(file)"
          controls
          class="preview-audio"
        >
          <source :src="file.url || (file.originFileObj ? URL.createObjectURL(file.originFileObj) : '')" :type="file.type">
        </audio>
        <!-- 其他文件类型 -->
        <div v-else class="preview-file">
          <file-outlined />
          <span>{{ file.name }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { UploadOutlined, FileOutlined } from '@ant-design/icons-vue'
import type { UploadChangeParam, UploadFile } from 'ant-design-vue'

// 声明全局URL对象
declare const URL: typeof window.URL

interface Props {
  maxSize?: number // 文件大小限制，单位MB
  acceptTypes?: string // 接受的文件类型
}

const props = withDefaults(defineProps<Props>(), {
  maxSize: 10,
  acceptTypes: 'image/*,audio/*,.pdf,.doc,.docx'
})

const emit = defineEmits<{
  (e: 'update:fileList', files: UploadFile[]): void
  (e: 'error', message: string): void
}>()

const fileList = ref<UploadFile[]>([])

// 文件上传前的校验
const beforeUpload = (file: File) => {
  const isLtMaxSize = file.size / 1024 / 1024 < props.maxSize
  
  if (!isLtMaxSize) {
    emit('error', `文件必须小于 ${props.maxSize}MB!`)
    return false
  }
  
  return true
}

// 处理文件变化
const handleChange = ({ fileList: newFileList }: UploadChangeParam) => {
  fileList.value = newFileList
  emit('update:fileList', newFileList)
}

// 判断文件类型
const isImage = (file: UploadFile) => {
  return file.type?.startsWith('image/') || false
}

const isAudio = (file: UploadFile) => {
  return file.type?.startsWith('audio/') || false
}
</script>

<style scoped>
.media-uploader {
  margin-bottom: 16px;
}

.upload-button {
  color: #666;
  border-radius: 4px;
  padding: 4px 8px;
}

.upload-button:hover {
  background: #2C2C2C;
  color: #fff;
}

.preview-list {
  margin-top: 8px;
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.preview-item {
  width: 100px;
  height: 100px;
  border-radius: 4px;
  overflow: hidden;
  border: 1px solid #3A3A3A;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #2C2C2C;
}

.preview-image {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.preview-audio {
  width: 100%;
  padding: 8px;
}

.preview-file {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  color: #999;
  font-size: 12px;
}

.preview-file :deep(svg) {
  font-size: 24px;
}
</style>