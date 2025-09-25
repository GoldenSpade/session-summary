import express from 'express'
import dotenv from 'dotenv'

dotenv.config()

const router = express.Router()

// Эндпоинт для тестирования данных от Vapi
router.post('/vapi/test', async (req, res) => {
  try {
    // Получаем текущее время для логов
    const timestamp = new Date().toISOString()

    console.log('='.repeat(80))
    console.log(`[VAPI TEST] ${timestamp}`)
    console.log('='.repeat(80))

    // Логируем заголовки запроса
    console.log('📋 HEADERS:')
    console.log(JSON.stringify(req.headers, null, 2))

    console.log('\n📦 BODY:')
    console.log(JSON.stringify(req.body, null, 2))

    // Логируем параметры запроса если есть
    if (Object.keys(req.query).length > 0) {
      console.log('\n🔍 QUERY PARAMS:')
      console.log(JSON.stringify(req.query, null, 2))
    }

    // Логируем метод и URL
    console.log(`\n🌐 REQUEST INFO:`)
    console.log(`Method: ${req.method}`)
    console.log(`URL: ${req.originalUrl}`)
    console.log(`IP: ${req.ip}`)
    console.log(`User-Agent: ${req.get('user-agent') || 'N/A'}`)

    console.log('='.repeat(80))
    console.log('✅ VAPI test data received and logged successfully')
    console.log('='.repeat(80))

    // Отправляем успешный ответ
    res.status(200).json({
      success: true,
      message: 'Data received and logged successfully',
      timestamp: timestamp,
      receivedData: {
        headers: req.headers,
        body: req.body,
        query: req.query,
        method: req.method,
        url: req.originalUrl
      }
    })

  } catch (error) {
    console.error('❌ [VAPI TEST] Error processing request:', error)

    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: error.message,
      timestamp: new Date().toISOString()
    })
  }
})

// GET эндпоинт для быстрой проверки
router.get('/vapi/test', (req, res) => {
  const timestamp = new Date().toISOString()

  console.log(`[VAPI TEST GET] ${timestamp} - Test endpoint accessed`)

  res.status(200).json({
    success: true,
    message: 'Vapi test endpoint is working',
    timestamp: timestamp,
    endpoints: {
      POST: '/api/vapi/test - для получения данных от Vapi',
      GET: '/api/vapi/test - для проверки работоспособности'
    }
  })
})

export default router