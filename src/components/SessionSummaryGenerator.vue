<template>
  <div class="session-summary-generator">
    <div class="container mt-5">
      <h1 class="text-center mb-4">
        <i class="bi bi-journal-medical"></i>
        Генератор Конспектів Психологічних Сесій
      </h1>

      <div class="card shadow">
        <div class="card-body">
          <!-- Форма вводу даних -->
          <div class="row mb-3">
            <div class="col-md-6">
              <label for="client" class="form-label">Ім'я клієнта:</label>
              <input
                type="text"
                class="form-control"
                id="client"
                v-model="formData.client"
                placeholder="Введіть ім'я клієнта"
              />
            </div>
            <div class="col-md-6">
              <label for="date" class="form-label">Дата сесії:</label>
              <input
                type="date"
                class="form-control"
                id="date"
                v-model="formData.date"
              />
            </div>
          </div>

          <div class="mb-3">
            <label for="session" class="form-label">Опис сесії:</label>
            <textarea
              class="form-control"
              id="session"
              rows="6"
              v-model="formData.session"
              placeholder="Опишіть деталі психологічної сесії..."
            ></textarea>
          </div>

          <!-- Кнопки дій -->
          <div class="d-grid gap-2 d-md-flex justify-content-md-center">
            <button
              class="btn btn-primary btn-lg"
              @click="generateSummary"
              :disabled="loading || !formData.session"
            >
              <span v-if="loading" class="spinner-border spinner-border-sm me-2"></span>
              <i v-else class="bi bi-file-text me-2"></i>
              {{ loading ? 'Генерую...' : 'Згенерувати Конспект' }}
            </button>

            <button
              v-if="summary"
              class="btn btn-success btn-lg"
              @click="downloadPDF"
              :disabled="loadingPdf"
            >
              <span v-if="loadingPdf" class="spinner-border spinner-border-sm me-2"></span>
              <i v-else class="bi bi-file-pdf me-2"></i>
              {{ loadingPdf ? 'Створюю PDF...' : 'Завантажити PDF' }}
            </button>
          </div>
        </div>
      </div>

      <!-- Результат -->
      <div v-if="summary" class="card mt-4 shadow">
        <div class="card-header bg-success text-white">
          <i class="bi bi-check-circle me-2"></i>
          Конспект успішно згенеровано
        </div>
        <div class="card-body">
          <pre class="summary-text">{{ summary }}</pre>
          <div class="text-muted small mt-3">
            <i class="bi bi-clock me-1"></i>
            Згенеровано: {{ generatedAt }}
          </div>
        </div>
      </div>

      <!-- Повідомлення про помилку -->
      <div v-if="error" class="alert alert-danger mt-4" role="alert">
        <i class="bi bi-exclamation-triangle me-2"></i>
        {{ error }}
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import axios from 'axios'

const API_URL = 'http://localhost:3001/api'

const formData = reactive({
  client: '',
  date: new Date().toISOString().split('T')[0],
  session: ''
})

const summary = ref('')
const loading = ref(false)
const loadingPdf = ref(false)
const error = ref('')
const generatedAt = ref('')

// Приклад тексту для демо
const sampleText = `Клієнт розповідав про постійний стрес на роботі через конфлікти з керівництвом. Відчуває тривогу, має проблеми зі сном - прокидається о 3-4 ранку і не може заснути. Говорив про бажання змінити роботу, але боїться невизначеності. Також згадував про напружені стосунки з дружиною через його постійну дратівливість.`

onMounted(() => {
  // Встановлюємо приклад для демо
  formData.session = sampleText
  formData.client = 'Іван Петренко'
})

const generateSummary = async () => {
  if (!formData.session.trim()) {
    error.value = 'Будь ласка, введіть опис сесії'
    return
  }

  loading.value = true
  error.value = ''
  summary.value = ''

  try {
    const response = await axios.post(`${API_URL}/generate-summary`, {
      session: formData.session,
      client: formData.client,
      date: formData.date
    })

    if (response.data.success) {
      summary.value = response.data.summary
      generatedAt.value = new Date(response.data.metadata.generatedAt).toLocaleString('uk-UA')
    } else {
      error.value = response.data.error || 'Помилка при генерації конспекту'
    }
  } catch (err) {
    console.error('Error:', err)
    error.value = err.response?.data?.details || err.message || 'Помилка з\'єднання з сервером'
  } finally {
    loading.value = false
  }
}

const downloadPDF = async () => {
  if (!summary.value) {
    error.value = 'Спочатку згенеруйте конспект'
    return
  }

  loadingPdf.value = true
  error.value = ''

  try {
    const response = await axios.post(
      `${API_URL}/generate-pdf`,
      {
        summary: summary.value,
        client: formData.client,
        date: formData.date
      },
      {
        responseType: 'blob'
      }
    )

    // Створюємо посилання для завантаження
    const blob = new Blob([response.data], { type: 'application/pdf' })
    const url = window.URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `konspekt_${formData.date || 'session'}.pdf`
    link.click()
    window.URL.revokeObjectURL(url)
  } catch (err) {
    console.error('PDF Error:', err)
    error.value = 'Помилка при створенні PDF'
  } finally {
    loadingPdf.value = false
  }
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