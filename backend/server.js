import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'

// Загрузка переменных окружения
dotenv.config()

const app = express()
const PORT = process.env.PORT || 3001

// CORS конфигурация - разрешаем всё для разработки
app.use(cors())

// Middleware для обробки JSON
app.use(express.json({ limit: '50mb' }))
app.use(express.urlencoded({ limit: '50mb', extended: true }))

// Базовый маршрут для проверки
app.get('/api', (req, res) => {
  res.json({
    message: 'Session Summary API is running',
    endpoints: {
      generateSummary: 'POST /api/generate-summary',
      generatePdf: 'POST /api/generate-pdf',
      webhookFireflies: 'POST /api/webhook/fireflies'
    }
  })
})

// Імпорт роутів
import webhookRoutes from './routes/webhook.js'
import openaiRoutes from './routes/openai.js'
import pdfRoutes from './routes/pdf.js'

// Підключення роутів
app.use('/api', webhookRoutes)
app.use('/api', openaiRoutes)
app.use('/api', pdfRoutes)

app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`)
})
