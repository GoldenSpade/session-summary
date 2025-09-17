import express from 'express'
import PDFDocument from 'pdfkit'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const router = express.Router()

// Функція для парсінгу структури конспекту
function parseSessionSummary(summary) {
  const sections = {
    topics: [],
    insights: [],
    actions: []
  }

  const lines = summary.split('\n').map(line => line.trim()).filter(line => line)
  let currentSection = null

  for (const line of lines) {
    // Пропускаємо заголовок та дату
    if (line.includes('Конспект психологічної сесії') ||
        (line.includes('Дата:') && line.includes('Клієнт:'))) {
      continue
    }

    // Визначаємо секцію
    if (line.toLowerCase().includes('основні теми')) {
      currentSection = 'topics'
      continue
    } else if (line.toLowerCase().includes('ключові інсайти')) {
      currentSection = 'insights'
      continue
    } else if (line.toLowerCase().includes('план дій')) {
      currentSection = 'actions'
      continue
    }

    // Додаємо контент до відповідної секції
    if (currentSection && line.startsWith('•')) {
      const content = line.substring(1).trim()
      sections[currentSection].push(content)
    }
  }

  return sections
}

// Endpoint для генерації PDF з конспекту
router.post('/generate-pdf', async (req, res) => {
  try {
    const { summary, client, date } = req.body

    if (!summary) {
      return res.status(400).json({ error: 'Summary text is required' })
    }

    // Створюємо PDF документ
    const doc = new PDFDocument({
      size: 'A4',
      margin: 40,
      bufferPages: true
    })

    // Підготовка для стрімінгу PDF
    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader('Content-Disposition', `attachment; filename="konspiekt_${date || 'session'}.pdf"`)
    doc.pipe(res)

    // Додаємо фон
    const backgroundPath = path.join(__dirname, '../../public/background.jpg')
    if (fs.existsSync(backgroundPath)) {
      doc.image(backgroundPath, 0, 0, {
        width: 595.28,
        height: 841.89
      })
    }

    // Регістрація кастомних шрифтів Montserrat
    const fontRegularPath = path.join(__dirname, '../assets/fonts/Montserrat-Regular.ttf')
    const fontBoldPath = path.join(__dirname, '../assets/fonts/Montserrat-Bold.ttf')

    if (fs.existsSync(fontRegularPath)) {
      doc.registerFont('Montserrat', fontRegularPath)
    }
    if (fs.existsSync(fontBoldPath)) {
      doc.registerFont('Montserrat-Bold', fontBoldPath)
    }

    // Починаємо з контенту - заголовок
    doc.font('Montserrat-Bold')
       .fontSize(22)
       .fillColor('#3b155e')
       .text('Конспект психологічної сесії', 80, 80, { align: 'center', width: 435 })

    // Підзаголовок з датою та клієнтом
    doc.font('Montserrat')
       .fontSize(11)
       .fillColor('#666')
       .text(`Дата: ${date || new Date().toLocaleDateString('uk-UA')} | Клієнт: ${client || 'Не вказано'}`,
             80, 110, { align: 'center', width: 435 })

    // Парсінг структури конспекту
    let currentY = 150
    const sections = parseSessionSummary(summary)

    // Основні теми
    if (sections.topics && sections.topics.length > 0) {
      doc.font('Montserrat-Bold')
         .fontSize(14)
         .fillColor('#4b2384')
         .text('Основні теми', 120, currentY)
      currentY += 20

      sections.topics.forEach(topic => {
        // Видаляємо подвійні зірочки
        const cleanTopic = topic.replace(/\*\*(.*?)\*\*/g, '$1')
        doc.font('Montserrat')
           .fontSize(10)
           .fillColor('#333')
           .text('• ' + cleanTopic, 130, currentY, { width: 345, lineGap: 2 })
        currentY = doc.y + 6
      })
      currentY += 8
    }

    // Ключові інсайти
    if (sections.insights && sections.insights.length > 0) {
      doc.font('Montserrat-Bold')
         .fontSize(14)
         .fillColor('#4b2384')
         .text('Ключові інсайти', 120, currentY)
      currentY += 20

      sections.insights.forEach(insight => {
        // Видаляємо подвійні зірочки
        const cleanInsight = insight.replace(/\*\*(.*?)\*\*/g, '$1')
        doc.font('Montserrat')
           .fontSize(10)
           .fillColor('#333')
           .text('• ' + cleanInsight, 130, currentY, { width: 345, lineGap: 2 })
        currentY = doc.y + 6
      })
      currentY += 8
    }

    // План дій
    if (sections.actions && sections.actions.length > 0) {
      doc.font('Montserrat-Bold')
         .fontSize(14)
         .fillColor('#4b2384')
         .text('План дій', 120, currentY)
      currentY += 20

      sections.actions.forEach(action => {
        // Видаляємо подвійні зірочки з усього тексту
        const cleanAction = action.replace(/\*\*(.*?)\*\*/g, '$1')

        // Розбиваємо дію на жирну частину та звичайну
        const colonIndex = cleanAction.indexOf(':')
        if (colonIndex > 0) {
          const boldPart = cleanAction.substring(0, colonIndex)
          const regularPart = cleanAction.substring(colonIndex)

          doc.text('• ', 130, currentY, { continued: true })
          doc.font('Montserrat-Bold').fontSize(10).text(boldPart, { continued: true })
          doc.font('Montserrat').fontSize(10).text(regularPart, { width: 335, lineGap: 2 })
        } else {
          doc.font('Montserrat').fontSize(10).text('• ' + cleanAction, 130, currentY, { width: 345, lineGap: 2 })
        }
        currentY = doc.y + 6
      })
    }

    // Підпис вже є на фоновому зображенні, тому не додаємо

    // Завершуємо документ
    doc.end()

  } catch (error) {
    console.error('PDF Generation Error:', error)
    res.status(500).json({
      error: 'Failed to generate PDF',
      details: error.message
    })
  }
})

export default router