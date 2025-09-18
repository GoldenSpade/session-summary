import express from 'express'
import OpenAI from 'openai'
import axios from 'axios'
import dotenv from 'dotenv'

dotenv.config()

const router = express.Router()

console.log('OpenAI API Key loaded:', process.env.OPENAI_API_KEY ? 'Yes' : 'No')
console.log('API Key first 10 chars:', process.env.OPENAI_API_KEY?.substring(0, 10) + '...')

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
})

// Endpoint для генерації конспекту через OpenAI
router.post('/generate-summary', async (req, res) => {
  try {
    const { session, client, date } = req.body

    if (!session) {
      return res.status(400).json({ error: 'Session text is required' })
    }

    // Промпт з MASTER_PROMPT.txt (точна відповідність)
    const systemPrompt = `ЗАВДАННЯ
Зроби односторінковий PDF‑конспект психологічної сесії українською БЕЗ емодзі.
Усе має вміститись на одну сторінку A4 (портрет).

СТРУКТУРА ТЕКСТУ
1) Заголовок по центру (Bold): Конспект психологічної сесії
2) Рядок дрібним кеглем: Дата: ${date || new Date().toLocaleDateString('uk-UA')} | Клієнт: ${client || 'Анонім'}
3) Підзаголовок (Bold): Основні теми → 3–5 пунктів (Regular), без додаткових виділень
4) Підзаголовок (Bold): Ключові інсайти → 4–6 пунктів (Regular), без додаткових виділень
5) Підзаголовок (Bold): План дій → 4–6 пунктів у форматі
   • **лише головна дія жирним (1–4 слова)**: решта пояснення Regular

ПРАВИЛА ТЕКСТУ
• Мова: українська; маркер пункту — "•"; без емодзі.
• Жодної "води"; коротко, по суті.
• Якщо матеріалу забагато — стискай, не змінюючи сенсу.

ФОРМАТ ВІДПОВІДІ:
Верни тільки текст конспекту без додаткових коментарів.`

    // Виклик OpenAI API через офіційну бібліотеку
    const completion = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `Текст сесії: ${session}` }
      ],
      temperature: 0.7,
      max_tokens: 1500
    })

    const summary = completion.choices[0].message.content

    // Автоматически генерируем PDF
    let pdfInfo = null
    try {
      const pdfResponse = await axios.post(
        `http://localhost:${process.env.PORT || 3001}/api/generate-pdf-save`,
        {
          summary: summary,
          client,
          date
        }
      )

      if (pdfResponse.data.success) {
        pdfInfo = {
          fileName: pdfResponse.data.fileName,
          filePath: pdfResponse.data.filePath
        }
        console.log('PDF automatically generated:', pdfInfo.fileName)
      }
    } catch (pdfError) {
      console.error('Error generating PDF:', pdfError.message)
    }

    res.json({
      success: true,
      summary: summary,
      metadata: {
        client,
        date,
        generatedAt: new Date().toISOString()
      },
      pdf: pdfInfo
    })

  } catch (error) {
    console.error('OpenAI API Error:', error.response?.data || error.message)
    res.status(500).json({
      error: 'Failed to generate summary',
      details: error.response?.data?.error?.message || error.message
    })
  }
})

export default router