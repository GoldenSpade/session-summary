import express from 'express'
import cors from 'cors'

const app = express()
const PORT = 3001

// CORS для локального тестування
app.use(cors())

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
