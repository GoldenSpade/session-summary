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

    // Логируем весь запрос для отладки
    console.log('Received Fireflies webhook body:', JSON.stringify(req.body, null, 2))

    const { meetingId, eventType, transcript, meeting_attendees, title, date, duration } = req.body

    // Если пришел только meetingId, нужно получить данные через API
    if (meetingId && eventType === 'Transcription completed') {
      console.log(`Transcription completed for meeting: ${meetingId}`)

      // Для получения полных данных нужно использовать Fireflies API
      // GraphQL запрос к Fireflies API
      try {
        const firefliesApiKey = process.env.FIREFLIES_API_KEY

        const query = `
          query GetTranscript($meetingId: String!) {
            transcript(id: $meetingId) {
              id
              title
              date
              duration
              sentences {
                text
                speaker_name
              }
              summary {
                overview
                action_items
              }
              participants
              organizer_email
            }
          }
        `

        const firefliesResponse = await axios.post(
          'https://api.fireflies.ai/graphql',
          {
            query,
            variables: { meetingId }
          },
          {
            headers: {
              'Authorization': `Bearer ${firefliesApiKey}`,
              'Content-Type': 'application/json'
            }
          }
        )

        const transcriptData = firefliesResponse.data?.data?.transcript

        if (!transcriptData) {
          return res.status(200).json({
            message: 'No transcript found',
            meetingId,
            info: 'Meeting may still be processing or transcription limit reached'
          })
        }

        // Обработка полученных данных
        // Очищаем текст от проблемных символов
        const cleanText = (text) => {
          if (!text) return ''
          return text.replace(/[\x00-\x1F\x7F-\x9F]/g, ' ').trim()
        }

        const sessionText = transcriptData.sentences?.map(s => {
          const speaker = cleanText(s.speaker_name || 'Speaker')
          const text = cleanText(s.text || '')
          return `${speaker}: ${text}`
        }).join('\n') || ''

        const sessionData = {
          session: sessionText,
          client: transcriptData.participants?.[0] || 'Клієнт',
          date: transcriptData.date ? new Date(transcriptData.date).toLocaleDateString('uk-UA') : new Date().toLocaleDateString('uk-UA'),
          title: transcriptData.title || 'Психологічна сесія',
          duration: transcriptData.duration,
          meetingId,
          timestamp: new Date().toISOString()
        }

        console.log('Fetched transcript from Fireflies API:', {
          title: sessionData.title,
          sessionLength: sessionData.session.length,
          meetingId,
          participants: transcriptData.participants
        })

        console.log('Session text first 200 chars:', sessionData.session.substring(0, 200))

        // Если есть транскрипция, обрабатываем
        if (sessionData.session && sessionData.session.length > 0) {
          // Вызываем OpenAI для генерации резюме
          console.log('Calling OpenAI API with session data...')
          const requestData = {
            session: sessionData.session,
            client: sessionData.client,
            date: sessionData.date
          }
          console.log('Request data:', {
            sessionLength: requestData.session?.length || 0,
            client: requestData.client,
            date: requestData.date
          })

          try {
            const summaryResponse = await axios.post(
              `http://localhost:${process.env.PORT || 3001}/api/generate-summary`,
              requestData
            )

            return res.json({
              success: true,
              message: 'Transcript processed successfully',
              meetingId,
              summary: summaryResponse.data.summary,
              pdf: summaryResponse.data.pdf,
              metadata: {
                title: sessionData.title,
                duration: sessionData.duration,
                client: sessionData.client,
                date: sessionData.date
              }
            })
          } catch (apiError) {
            console.error('Error calling OpenAI:', apiError.response?.data || apiError.message)
            return res.status(200).json({
              success: false,
              message: 'Failed to generate summary',
              error: apiError.message,
              meetingId
            })
          }
        } else {
          return res.status(200).json({
            success: false,
            message: 'No transcript content found',
            meetingId
          })
        }
      } catch (apiError) {
        console.error('Error fetching from Fireflies API:', apiError.response?.data || apiError.message)
        return res.status(200).json({
          message: 'Failed to fetch transcript from Fireflies API',
          error: apiError.message,
          meetingId
        })
      }
    }

    // Если данные пришли напрямую (старый формат)
    if (!transcript && !meetingId) {
      return res.status(200).json({
        message: 'No transcript or meetingId in webhook',
        info: 'Invalid webhook data format',
        receivedData: req.body
      })
    }

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
      const apiUrl = process.env.API_URL || 'http://localhost:3001/api'
      const summaryResponse = await axios.post(
        `${apiUrl}/generate-summary`,
        sessionData
      )
      console.log('OpenAI response received:', summaryResponse.data.success)

      let pdfInfo = null

      // Автоматично генеруємо та зберігаємо PDF
      if (summaryResponse.data.success && summaryResponse.data.summary) {
        try {
          console.log('Generating PDF...')
          const apiUrl = process.env.API_URL || 'http://localhost:3001/api'
          const pdfResponse = await axios.post(
            `${apiUrl}/generate-pdf-save`,
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