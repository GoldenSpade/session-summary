import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'

// Загрузка переменных окружения
dotenv.config()

const app = express()
const PORT = process.env.PORT || 3001

// CORS конфигурация
const corsOptions = {
  origin: process.env.CORS_ORIGIN || '*',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Fireflies-Signature']
}

app.use(cors(corsOptions))

// Middleware для обробки JSON
app.use(express.json({ limit: '50mb' }))
app.use(express.urlencoded({ limit: '50mb', extended: true }))

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
