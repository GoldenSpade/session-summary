import express from 'express'
import axios from 'axios'
import dotenv from 'dotenv'

dotenv.config()

const router = express.Router()

// Endpoint для отримання даних та відправки на n8n webhook
router.post('/process-session', async (req, res) => {
  try {
    const { session, client, date } = req.body

    // Валідація вхідних даних
    if (!session) {
      return res.status(400).json({ error: 'Session text is required' })
    }

    // Підготовка даних для n8n
    const webhookData = {
      session: session,
      client: client || 'Анонім',
      date: date || new Date().toLocaleDateString('uk-UA'),
      timestamp: new Date().toISOString()
    }

    // Відправка на n8n webhook (використовуйте production URL для продакшену)
    const n8nWebhookUrl = process.env.N8N_WEBHOOK_PROD_URL ||
      'https://dgtlunion.app.n8n.cloud/webhook/session-summary'

    const n8nResponse = await axios.post(n8nWebhookUrl, webhookData, {
      headers: {
        'Content-Type': 'application/json'
      }
    })

    // Повертаємо результат
    res.json({
      success: true,
      message: 'Session sent to n8n for processing',
      data: n8nResponse.data
    })

  } catch (error) {
    console.error('Error processing session:', error.message)
    res.status(500).json({
      error: 'Failed to process session',
      details: error.message
    })
  }
})

// Тестовий endpoint для перевірки webhook
router.get('/test-n8n', async (req, res) => {
  try {
    const testData = {
      session: "Це тестова психологічна сесія. Клієнт розповідав про стрес на роботі та проблеми зі сном.",
      client: "Тестовий Клієнт",
      date: new Date().toLocaleDateString('uk-UA')
    }

    const n8nWebhookUrl = process.env.N8N_WEBHOOK_PROD_URL ||
      'https://dgtlunion.app.n8n.cloud/webhook/session-summary'

    const response = await axios.post(n8nWebhookUrl, testData)

    res.json({
      success: true,
      message: 'Test data sent to n8n',
      response: response.data
    })
  } catch (error) {
    res.status(500).json({
      error: 'Test failed',
      details: error.message
    })
  }
})

export default router