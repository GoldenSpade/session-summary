<template>
  <div class="session-summary-generator">
    <div class="container mt-5">
      <h1 class="text-center mb-4">
        <i class="bi bi-journal-medical"></i>
        Генератор Конспектів Психологічних Сесій
      </h1>

      <!-- Повідомлення про помилку -->
      <div v-if="error" class="alert alert-danger mt-4" role="alert">
        <i class="bi bi-exclamation-triangle me-2"></i>
        {{ error }}
      </div>

      <!-- Список згенерованих конспектів -->
      <div class="card mt-4 shadow">
        <div class="card-header bg-info text-white d-flex justify-content-between align-items-center">
          <div>
            <i class="bi bi-folder me-2"></i>
            Згенеровані Конспекти ({{ pdfFiles.length }})
          </div>
          <div class="d-flex gap-2">
            <button
              class="btn btn-warning btn-sm"
              @click="testGeneration"
              :disabled="loading || loadingPdf"
              title="Тестувати генерацію"
            >
              <span v-if="loading || loadingPdf" class="spinner-border spinner-border-sm me-1"></span>
              <i v-else class="bi bi-play-circle me-1"></i>
              Тест
            </button>
            <button
              class="btn btn-light btn-sm"
              @click="refreshFileList"
              :disabled="loadingFiles"
            >
              <span v-if="loadingFiles" class="spinner-border spinner-border-sm me-1"></span>
              <i v-else class="bi bi-arrow-repeat me-1"></i>
              Оновити
            </button>
          </div>
        </div>
        <div class="card-body">
          <div v-if="loadingFiles" class="text-center py-4">
            <div class="spinner-border text-info me-2"></div>
            Завантаження списку файлів...
          </div>

          <div v-else-if="pdfFiles.length === 0" class="text-center py-4 text-muted">
            <i class="bi bi-inbox fs-1 mb-3 d-block"></i>
            Ще немає згенерованих конспектів
          </div>

          <div v-else class="table-responsive">
            <table class="table table-hover mb-0">
              <thead class="table-light">
                <tr>
                  <th><i class="bi bi-file-earmark-pdf me-1"></i>Файл</th>
                  <th><i class="bi bi-calendar me-1"></i>Дата створення</th>
                  <th><i class="bi bi-hdd me-1"></i>Розмір</th>
                  <th width="120"><i class="bi bi-download me-1"></i>Дії</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="file in pdfFiles" :key="file.name">
                  <td>
                    <div class="d-flex align-items-center">
                      <i class="bi bi-file-earmark-pdf text-danger me-2 fs-5"></i>
                      <div>
                        <div class="fw-semibold">{{ getDisplayName(file.name) }}</div>
                        <small class="text-muted">{{ file.name }}</small>
                      </div>
                    </div>
                  </td>
                  <td>
                    <small>{{ formatDate(file.createdAt) }}</small>
                  </td>
                  <td>
                    <span class="badge bg-secondary">{{ file.sizeFormatted }}</span>
                  </td>
                  <td>
                    <button
                      class="btn btn-primary btn-sm"
                      @click="downloadFile(file)"
                      title="Скачати файл"
                    >
                      <i class="bi bi-download"></i>
                    </button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import axios from 'axios'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api'

const formData = reactive({
  client: '',
  date: new Date().toISOString().split('T')[0],
  session: ''
})

const loading = ref(false)
const loadingPdf = ref(false)
const error = ref('')

// Файлы PDF
const pdfFiles = ref([])
const loadingFiles = ref(false)

// Тестові дані
const testData = {
  client: 'Іван Петренко',
  date: new Date().toISOString().split('T')[0],
  session: `Клієнт розповідав про постійний стрес на роботі через конфлікти з керівництвом. Відчуває тривогу, має проблеми зі сном - прокидається о 3-4 ранку і не може заснути. Говорив про бажання змінити роботу, але боїться невизначеності. Також згадував про напружені стосунки з дружиною через його постійну дратівливість.`
}

onMounted(() => {
  // Загружаем список файлов
  refreshFileList()
})

// Функція тестування - генерує конспект та PDF
const testGeneration = async () => {
  loading.value = true
  error.value = ''

  try {
    // Генеруємо конспект
    const summaryResponse = await axios.post(`${API_URL}/generate-summary`, {
      session: testData.session,
      client: testData.client,
      date: testData.date
    })

    if (!summaryResponse.data.success) {
      error.value = summaryResponse.data.error || 'Помилка при генерації конспекту'
      return
    }

    const generatedSummary = summaryResponse.data.summary

    // Створюємо PDF
    loadingPdf.value = true

    const pdfResponse = await axios.post(
      `${API_URL}/generate-pdf`,
      {
        summary: generatedSummary,
        client: testData.client,
        date: testData.date
      },
      {
        responseType: 'blob'
      }
    )

    // Автоматично завантажуємо PDF
    const blob = new Blob([pdfResponse.data], { type: 'application/pdf' })
    const url = window.URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `konspekt_${testData.client}_${testData.date}.pdf`
    link.click()
    window.URL.revokeObjectURL(url)

    // Оновлюємо список файлів
    setTimeout(() => {
      refreshFileList()
    }, 1000)

  } catch (err) {
    console.error('Test Error:', err)
    error.value = err.response?.data?.details || err.message || 'Помилка тестування'
  } finally {
    loading.value = false
    loadingPdf.value = false
  }
}

// Функции для работы с файлами
const refreshFileList = async () => {
  loadingFiles.value = true
  try {
    const response = await axios.get(`${API_URL}/pdf/list`)
    if (response.data.success) {
      pdfFiles.value = response.data.files
    } else {
      console.error('Failed to load files:', response.data.error)
    }
  } catch (err) {
    console.error('Error loading files:', err)
  } finally {
    loadingFiles.value = false
  }
}

const downloadFile = async (file) => {
  try {
    // Используем прямую ссылку на файл вместо axios
    const link = document.createElement('a')
    link.href = `${API_URL}/pdf/download/${encodeURIComponent(file.name)}`
    link.download = file.name
    link.target = '_blank'

    // Добавляем в DOM, кликаем и удаляем
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  } catch (err) {
    console.error('Download error:', err)
    error.value = 'Помилка при завантаженні файлу'
  }
}

const getDisplayName = (filename) => {
  // Преобразуем имя файла в более читаемый формат
  return filename
    .replace(/^konspekt_/, '')
    .replace(/_\d+\.pdf$/, '.pdf')
    .replace(/_/g, ' ')
}

const formatDate = (dateString) => {
  return new Date(dateString).toLocaleString('uk-UA', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  })
}
</script>

<style scoped>
.session-summary-generator {
  font-family: 'Montserrat', Avenir, Helvetica, Arial, sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  min-height: 100vh;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  padding: 2rem 0;
}

.container {
  max-width: 900px;
}

h1 {
  color: white;
  text-shadow: 2px 2px 4px rgba(0,0,0,0.2);
  font-weight: 600;
}

.card {
  border: none;
  border-radius: 15px;
}

.card-header {
  border-radius: 15px 15px 0 0 !important;
  font-weight: 500;
}

.btn {
  border-radius: 10px;
  padding: 10px 30px;
  font-weight: 500;
  transition: all 0.3s;
}

.btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 5px 15px rgba(0,0,0,0.3);
}

.form-control, .form-select {
  border-radius: 10px;
  border: 1px solid #dee2e6;
}

.form-control:focus {
  border-color: #667eea;
  box-shadow: 0 0 0 0.2rem rgba(102, 126, 234, 0.25);
}

.summary-text {
  white-space: pre-wrap;
  font-family: 'Courier New', monospace;
  background: #f8f9fa;
  padding: 20px;
  border-radius: 10px;
  font-size: 14px;
  line-height: 1.6;
}

.spinner-border-sm {
  width: 1rem;
  height: 1rem;
}

.alert {
  border-radius: 10px;
}
</style>