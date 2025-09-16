import express from 'express'
import PDFDocument from 'pdfkit'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const router = express.Router()

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
      margin: 50,
      bufferPages: true
    })

    // Підготовка для стрімінгу PDF
    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader('Content-Disposition', `attachment; filename="konspiekt_${date || 'session'}.pdf"`)
    doc.pipe(res)

    // Додаємо фон
    const backgroundPath = path.join(__dirname, '../../Archive/background_maia.png')
    if (fs.existsSync(backgroundPath)) {
      doc.image(backgroundPath, 0, 0, {
        width: 595.28,
        height: 841.89,
        align: 'center',
        valign: 'center'
      })
    }

    // Регістрація кастомних шрифтів Montserrat
    const fontRegularPath = path.join(__dirname, '../../Archive/Montserrat-Regular.ttf')
    const fontBoldPath = path.join(__dirname, '../../Archive/Montserrat-Bold.ttf')

    if (fs.existsSync(fontRegularPath)) {
      doc.registerFont('Montserrat', fontRegularPath)
    }
    if (fs.existsSync(fontBoldPath)) {
      doc.registerFont('Montserrat-Bold', fontBoldPath)
    }

    // Починаємо з контенту
    doc.font('Montserrat-Bold')
       .fontSize(20)
       .text('Конспект психологічної сесії', 50, 50, { align: 'center' })

    // Підзаголовок з датою та клієнтом
    doc.font('Montserrat')
       .fontSize(10)
       .text(`Дата: ${date || new Date().toLocaleDateString('uk-UA')} | Клієнт: ${client || 'Не вказано'}`,
             50, 80, { align: 'center' })

    // Основний текст конспекту
    let currentY = 120
    const lines = summary.split('\n').filter(line => line.trim())

    for (let line of lines) {
      line = line.trim()

      // Пропускаємо заголовок та дату якщо вони вже додані
      if (line.includes('Конспект психологічної сесії') ||
          (line.includes('Дата:') && line.includes('Клієнт:'))) {
        continue
      }

      // Визначаємо тип рядка
      if (line.startsWith('**') && line.endsWith('**')) {
        // Заголовок секції
        doc.font('Montserrat-Bold')
           .fontSize(14)
           .text(line.replace(/\*\*/g, ''), 50, currentY)
        currentY = doc.y + 10
      } else if (line.startsWith('•') || line.startsWith('-') || /^\d+\./.test(line)) {
        // Елемент списку
        let item = line.replace(/^[•\-]\s*/, '• ')
                      .replace(/^\d+\.\s*/, '')

        // Обробляємо жирний текст у форматі **текст**
        const parts = item.split(/\*\*/)
        doc.font('Montserrat').fontSize(11)

        let x = 70
        for (let i = 0; i < parts.length; i++) {
          if (i % 2 === 1) {
            // Жирний текст
            doc.font('Montserrat-Bold')
          } else {
            // Звичайний текст
            doc.font('Montserrat')
          }

          if (i === 0 && parts[i].startsWith('• ')) {
            doc.text('• ', 60, currentY, { continued: true })
            doc.text(parts[i].substring(2), { continued: i < parts.length - 1 })
          } else {
            doc.text(parts[i], { continued: i < parts.length - 1 })
          }
        }

        currentY = doc.y + 5
      }

      // Перевірка чи потрібна нова сторінка
      if (currentY > 700) {
        doc.addPage()
        currentY = 50

        // Додаємо фон на нову сторінку
        if (fs.existsSync(backgroundPath)) {
          doc.image(backgroundPath, 0, 0, {
            width: 595.28,
            height: 841.89,
            align: 'center',
            valign: 'center'
          })
        }
      }
    }

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