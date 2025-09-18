import express from 'express'
import axios from 'axios'
import crypto from 'crypto'
import dotenv from 'dotenv'

dotenv.config()

const router = express.Router()

// Функція для верифікації Fireflies webhook signature
function verifyFirefliesSignature(payload, signature, secret) {
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(JSON.stringify(payload))
    .digest('hex')
  return signature === expectedSignature
}

// Endpoint для отримання даних від Fireflies
router.post('/webhook/fireflies', async (req, res) => {
  try {
    const signature = req.headers['x-fireflies-signature']
    const webhookKey = process.env.FIREFLIES_WEBHOOK_KEY

    // Верифікація підпису (якщо потрібно)
    if (webhookKey && signature) {
      const isValid = verifyFirefliesSignature(req.body, signature, webhookKey)
      if (!isValid) {
        return res.status(401).json({ error: 'Invalid webhook signature' })
      }
    }

    // Отримання даних транскрипції
    const { transcript, meeting_attendees, title, date, duration } = req.body

    console.log('Received Fireflies webhook:', {
      title,
      date,
      duration,
      hasTranscript: !!transcript
    })

    // Підготовка даних для обробки
    const sessionData = {
      session: transcript?.sentences?.map(s => s.text).join(' ') || transcript || '',
      client: meeting_attendees?.[0]?.name || 'Клієнт',
      date: date || new Date().toLocaleDateString('uk-UA'),
      title: title || 'Психологічна сесія',
      duration: duration,
      timestamp: new Date().toISOString()
    }

    console.log('Prepared session data:', {
      sessionLength: sessionData.session.length,
      client: sessionData.client,
      date: sessionData.date
    })

    // Генерація конспекту через OpenAI
    try {
      console.log('Calling OpenAI API...')
      const summaryResponse = await axios.post(
        'http://localhost:3001/api/generate-summary',
        sessionData
      )
      console.log('OpenAI response received:', summaryResponse.data.success)

      let pdfInfo = null

      // Автоматично генеруємо та зберігаємо PDF
      if (summaryResponse.data.success && summaryResponse.data.summary) {
        try {
          console.log('Generating PDF...')
          const pdfResponse = await axios.post(
            'http://localhost:3001/api/generate-pdf-save',
            {
              summary: summaryResponse.data.summary,
              client: sessionData.client,
              date: sessionData.date
            }
          )

          if (pdfResponse.data.success) {
            pdfInfo = {
              fileName: pdfResponse.data.fileName,
              downloadUrl: `http://localhost:3001${pdfResponse.data.filePath}`,
              fileSize: pdfResponse.data.fileSize
            }
            console.log('PDF saved:', pdfInfo.fileName)
          }
        } catch (pdfError) {
          console.error('PDF generation error:', pdfError.message)
        }
      }

      // Відправка результату на n8n
      if (summaryResponse.data.success) {
        const n8nWebhookUrl = process.env.N8N_WEBHOOK_PROD_URL
        if (n8nWebhookUrl) {
          await axios.post(n8nWebhookUrl, {
            ...sessionData,
            summary: summaryResponse.data.summary,
            pdf: pdfInfo
          })
        }
      }

      res.json({
        success: true,
        message: 'Fireflies webhook processed successfully',
        summary: summaryResponse.data.summary,
        pdf: pdfInfo
      })
    } catch (apiError) {
      console.error('Error calling OpenAI:', apiError.response?.data || apiError.message)

      // Повертаємо успішну відповідь для Fireflies, але без конспекту
      res.json({
        success: true,
        message: 'Fireflies webhook received but summary generation failed',
        error: apiError.response?.data?.details || apiError.message
      })
    }

  } catch (error) {
    console.error('Fireflies webhook error:', error)
    res.status(500).json({
      error: 'Failed to process Fireflies webhook',
      details: error.message
    })
  }
})

// Endpoint для отримання даних від n8n та генерації конспекту
router.post('/n8n-webhook', async (req, res) => {
  try {
    const { session, client, date, autoSavePdf = true } = req.body

    if (!session) {
      return res.status(400).json({ error: 'Session text is required' })
    }

    // Генерація конспекту
    const summaryResponse = await axios.post(
      'http://localhost:3001/api/generate-summary',
      { session, client, date }
    )

    let result = {
      success: true,
      summary: summaryResponse.data.summary,
      metadata: summaryResponse.data.metadata
    }

    // Автоматично зберігаємо PDF (за замовчуванням включено)
    if (autoSavePdf && summaryResponse.data.success) {
      try {
        const pdfResponse = await axios.post(
          'http://localhost:3001/api/generate-pdf-save',
          {
            summary: summaryResponse.data.summary,
            client,
            date
          }
        )

        if (pdfResponse.data.success) {
          result.pdf = {
            fileName: pdfResponse.data.fileName,
            downloadUrl: `http://localhost:3001${pdfResponse.data.filePath}`,
            fileSize: pdfResponse.data.fileSize
          }
        }
      } catch (pdfError) {
        console.error('PDF generation error:', pdfError.message)
        result.pdfError = pdfError.message
      }
    }

    res.json(result)

  } catch (error) {
    console.error('n8n webhook error:', error)
    res.status(500).json({
      error: 'Failed to process n8n webhook',
      details: error.message
    })
  }
})

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

// Тестовий endpoint для перевірки n8n webhook
router.get('/test-n8n', async (req, res) => {
  try {
    const testData = {
      session: "Це тестова психологічна сесія. Клієнт розповідав про стрес на роботі та проблеми зі сном. Обговорювали техніки релаксації та важливість режиму дня.",
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

// Тестовий endpoint для симуляції Fireflies webhook
router.post('/test-fireflies', async (req, res) => {
  try {
    // Симуляція даних від Fireflies
    const mockFirefliesData = {
      transcript: {
        sentences: [
          { text: "Клієнт: Я відчуваю постійну тривогу через роботу." },
          { text: "Психолог: Давайте обговоримо, що саме викликає цю тривогу." },
          { text: "Клієнт: Великий обсяг задач та дедлайни." },
          { text: "Психолог: Спробуємо розробити план управління часом." }
        ]
      },
      meeting_attendees: [
        { name: "Іван Петренко" }
      ],
      title: "Сесія з управління стресом",
      date: new Date().toLocaleDateString('uk-UA'),
      duration: 3600
    }

    // Відправка на наш fireflies-webhook endpoint
    const response = await axios.post(
      'http://localhost:3001/api/fireflies-webhook',
      mockFirefliesData,
      {
        headers: {
          'Content-Type': 'application/json'
        }
      }
    )

    res.json({
      success: true,
      message: 'Test Fireflies webhook sent',
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