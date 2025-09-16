import express from 'express'
import OpenAI from 'openai'
import dotenv from 'dotenv'

dotenv.config()

const router = express.Router()
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

    res.json({
      success: true,
      summary: summary,
      metadata: {
        client,
        date,
        generatedAt: new Date().toISOString()
      }
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