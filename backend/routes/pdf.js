import express from 'express'
import PDFDocument from 'pdfkit'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const router = express.Router()

// Директорія для збереження PDF файлів
const PDF_STORAGE_DIR = path.join(__dirname, '../../pdf')

// Створюємо директорію якщо не існує
if (!fs.existsSync(PDF_STORAGE_DIR)) {
  fs.mkdirSync(PDF_STORAGE_DIR, { recursive: true })
}

// Функція транслітерації кирилиці в латиницю
function transliterate(text) {
  const cyrillic = {
    'а': 'a', 'б': 'b', 'в': 'v', 'г': 'g', 'д': 'd', 'е': 'e', 'є': 'ye', 'ж': 'zh',
    'з': 'z', 'и': 'y', 'і': 'i', 'ї': 'yi', 'й': 'y', 'к': 'k', 'л': 'l', 'м': 'm',
    'н': 'n', 'о': 'o', 'п': 'p', 'р': 'r', 'с': 's', 'т': 't', 'у': 'u', 'ф': 'f',
    'х': 'kh', 'ц': 'ts', 'ч': 'ch', 'ш': 'sh', 'щ': 'shch', 'ь': '', 'ю': 'yu', 'я': 'ya',
    'А': 'A', 'Б': 'B', 'В': 'V', 'Г': 'G', 'Д': 'D', 'Е': 'E', 'Є': 'Ye', 'Ж': 'Zh',
    'З': 'Z', 'И': 'Y', 'І': 'I', 'Ї': 'Yi', 'Й': 'Y', 'К': 'K', 'Л': 'L', 'М': 'M',
    'Н': 'N', 'О': 'O', 'П': 'P', 'Р': 'R', 'С': 'S', 'Т': 'T', 'У': 'U', 'Ф': 'F',
    'Х': 'Kh', 'Ц': 'Ts', 'Ч': 'Ch', 'Ш': 'Sh', 'Щ': 'Shch', 'Ь': '', 'Ю': 'Yu', 'Я': 'Ya',
    'ґ': 'g', 'Ґ': 'G', 'ё': 'yo', 'Ё': 'Yo', 'ъ': '', 'Ъ': '', 'ы': 'y', 'Ы': 'Y',
    'э': 'e', 'Э': 'E'
  }

  return text.split('').map(char => cyrillic[char] || char).join('')
}

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

// Функція для генерації унікального імені файлу
function generateFileName(client, date) {
  // Транслітеруємо кирилицю в латиницю
  const transliteratedClient = client ? transliterate(client) : 'client'
  // Видаляємо всі спеціальні символи, залишаємо тільки літери, цифри та підкреслення
  const sanitizedClient = transliteratedClient.replace(/[^a-zA-Z0-9]/g, '_').replace(/_+/g, '_')
  const timestamp = new Date().getTime()
  const formattedDate = date ? String(date).replace(/\//g, '-').replace(/\./g, '-') : 'no-date'
  return `konspekt_${sanitizedClient}_${formattedDate}_${timestamp}.pdf`
}

// Endpoint для генерації та збереження PDF на диск
router.post('/generate-pdf-save', async (req, res) => {
  try {
    const { summary, client, date } = req.body

    if (!summary) {
      return res.status(400).json({ error: 'Summary text is required' })
    }

    const fileName = generateFileName(client, date)
    const filePath = path.join(PDF_STORAGE_DIR, fileName)

    // Створюємо PDF документ
    const doc = new PDFDocument({
      size: 'A4',
      margin: 40,
      bufferPages: true
    })

    // Створюємо файловий потік для збереження
    const writeStream = fs.createWriteStream(filePath)
    doc.pipe(writeStream)

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
         .text('Основні теми', 100, currentY)
      currentY += 20

      sections.topics.forEach(topic => {
        const cleanTopic = topic.replace(/\*\*(.*?)\*\*/g, '$1')
        doc.font('Montserrat')
           .fontSize(10)
           .fillColor('#333')
           .text('• ' + cleanTopic, 110, currentY, { width: 365, lineGap: 2 })
        currentY = doc.y + 6
      })
      currentY += 8
    }

    // Ключові інсайти
    if (sections.insights && sections.insights.length > 0) {
      doc.font('Montserrat-Bold')
         .fontSize(14)
         .fillColor('#4b2384')
         .text('Ключові інсайти', 100, currentY)
      currentY += 20

      sections.insights.forEach(insight => {
        const cleanInsight = insight.replace(/\*\*(.*?)\*\*/g, '$1')
        doc.font('Montserrat')
           .fontSize(10)
           .fillColor('#333')
           .text('• ' + cleanInsight, 110, currentY, { width: 365, lineGap: 2 })
        currentY = doc.y + 6
      })
      currentY += 8
    }

    // План дій
    if (sections.actions && sections.actions.length > 0) {
      doc.font('Montserrat-Bold')
         .fontSize(14)
         .fillColor('#4b2384')
         .text('План дій', 100, currentY)
      currentY += 20

      sections.actions.forEach(action => {
        const cleanAction = action.replace(/\*\*(.*?)\*\*/g, '$1')
        const colonIndex = cleanAction.indexOf(':')
        if (colonIndex > 0) {
          const boldPart = cleanAction.substring(0, colonIndex)
          const regularPart = cleanAction.substring(colonIndex)

          // Рисуем буллет отдельно
          doc.font('Montserrat').fontSize(10).fillColor('#333')
             .text('• ', 110, currentY, { continued: true })
          doc.font('Montserrat-Bold').fontSize(10).text(boldPart, { continued: true })
          doc.font('Montserrat').fontSize(10).text(regularPart, { width: 355, lineGap: 2 })
        } else {
          doc.font('Montserrat').fontSize(10).fillColor('#333')
             .text('• ' + cleanAction, 110, currentY, { width: 365, lineGap: 2 })
        }
        currentY = doc.y + 6
      })
    }

    // Завершуємо документ
    doc.end()

    // Чекаємо завершення запису файлу
    writeStream.on('finish', () => {
      res.json({
        success: true,
        message: 'PDF generated and saved successfully',
        fileName: fileName,
        filePath: `/api/download-pdf/${fileName}`,
        fileSize: fs.statSync(filePath).size
      })
    })

    writeStream.on('error', (error) => {
      console.error('Error saving PDF:', error)
      res.status(500).json({
        error: 'Failed to save PDF',
        details: error.message
      })
    })

  } catch (error) {
    console.error('PDF Generation Error:', error)
    res.status(500).json({
      error: 'Failed to generate PDF',
      details: error.message
    })
  }
})

// Endpoint для генерації PDF з конспекту (стрімінг)
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
         .text('Основні теми', 100, currentY)
      currentY += 20

      sections.topics.forEach(topic => {
        // Видаляємо подвійні зірочки
        const cleanTopic = topic.replace(/\*\*(.*?)\*\*/g, '$1')
        doc.font('Montserrat')
           .fontSize(10)
           .fillColor('#333')
           .text('• ' + cleanTopic, 110, currentY, { width: 365, lineGap: 2 })
        currentY = doc.y + 6
      })
      currentY += 8
    }

    // Ключові інсайти
    if (sections.insights && sections.insights.length > 0) {
      doc.font('Montserrat-Bold')
         .fontSize(14)
         .fillColor('#4b2384')
         .text('Ключові інсайти', 100, currentY)
      currentY += 20

      sections.insights.forEach(insight => {
        // Видаляємо подвійні зірочки
        const cleanInsight = insight.replace(/\*\*(.*?)\*\*/g, '$1')
        doc.font('Montserrat')
           .fontSize(10)
           .fillColor('#333')
           .text('• ' + cleanInsight, 110, currentY, { width: 365, lineGap: 2 })
        currentY = doc.y + 6
      })
      currentY += 8
    }

    // План дій
    if (sections.actions && sections.actions.length > 0) {
      doc.font('Montserrat-Bold')
         .fontSize(14)
         .fillColor('#4b2384')
         .text('План дій', 100, currentY)
      currentY += 20

      sections.actions.forEach(action => {
        // Видаляємо подвійні зірочки з усього тексту
        const cleanAction = action.replace(/\*\*(.*?)\*\*/g, '$1')

        // Розбиваємо дію на жирну частину та звичайну
        const colonIndex = cleanAction.indexOf(':')
        if (colonIndex > 0) {
          const boldPart = cleanAction.substring(0, colonIndex)
          const regularPart = cleanAction.substring(colonIndex)

          // Рисуем буллет отдельно
          doc.font('Montserrat').fontSize(10).fillColor('#333')
             .text('• ', 110, currentY, { continued: true })
          doc.font('Montserrat-Bold').fontSize(10).text(boldPart, { continued: true })
          doc.font('Montserrat').fontSize(10).text(regularPart, { width: 355, lineGap: 2 })
        } else {
          doc.font('Montserrat').fontSize(10).fillColor('#333')
             .text('• ' + cleanAction, 110, currentY, { width: 365, lineGap: 2 })
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

// Endpoint для отримання списку згенерованих PDF файлів
router.get('/list-pdfs', (req, res) => {
  try {
    const files = fs.readdirSync(PDF_STORAGE_DIR)
      .filter(file => file.endsWith('.pdf'))
      .map(file => {
        const filePath = path.join(PDF_STORAGE_DIR, file)
        const stats = fs.statSync(filePath)
        return {
          fileName: file,
          downloadUrl: `/api/download-pdf/${file}`,
          size: stats.size,
          created: stats.birthtime,
          modified: stats.mtime
        }
      })
      .sort((a, b) => b.modified - a.modified) // Сортуємо за датою модифікації

    res.json({
      success: true,
      files: files,
      total: files.length
    })
  } catch (error) {
    console.error('Error listing PDFs:', error)
    res.status(500).json({
      error: 'Failed to list PDF files',
      details: error.message
    })
  }
})

// Endpoint для скачування PDF файлу
router.get('/download-pdf/:fileName', (req, res) => {
  try {
    const { fileName } = req.params

    // Безпека: перевіряємо, що ім'я файлу не містить небезпечних символів
    if (fileName.includes('..') || fileName.includes('/') || fileName.includes('\\')) {
      return res.status(400).json({ error: 'Invalid file name' })
    }

    const filePath = path.join(PDF_STORAGE_DIR, fileName)

    // Перевіряємо існування файлу
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'File not found' })
    }

    // Встановлюємо заголовки для скачування
    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`)

    // Стрімимо файл
    const fileStream = fs.createReadStream(filePath)
    fileStream.pipe(res)

  } catch (error) {
    console.error('Error downloading PDF:', error)
    res.status(500).json({
      error: 'Failed to download PDF',
      details: error.message
    })
  }
})

// Endpoint для видалення PDF файлу
router.delete('/delete-pdf/:fileName', (req, res) => {
  try {
    const { fileName } = req.params

    // Безпека: перевіряємо, що ім'я файлу не містить небезпечних символів
    if (fileName.includes('..') || fileName.includes('/') || fileName.includes('\\')) {
      return res.status(400).json({ error: 'Invalid file name' })
    }

    const filePath = path.join(PDF_STORAGE_DIR, fileName)

    // Перевіряємо існування файлу
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'File not found' })
    }

    // Видаляємо файл
    fs.unlinkSync(filePath)

    res.json({
      success: true,
      message: 'File deleted successfully',
      fileName: fileName
    })

  } catch (error) {
    console.error('Error deleting PDF:', error)
    res.status(500).json({
      error: 'Failed to delete PDF',
      details: error.message
    })
  }
})

// API для получения списка PDF файлов
router.get('/pdf/list', async (req, res) => {
  try {
    // Проверяем существование директории
    if (!fs.existsSync(PDF_STORAGE_DIR)) {
      return res.json({ success: true, files: [] })
    }

    // Читаем файлы из директории
    const files = fs.readdirSync(PDF_STORAGE_DIR)
      .filter(file => file.endsWith('.pdf'))
      .map(file => {
        const filePath = path.join(PDF_STORAGE_DIR, file)
        const stats = fs.statSync(filePath)

        return {
          name: file,
          size: stats.size,
          sizeFormatted: formatFileSize(stats.size),
          createdAt: stats.birthtime,
          modifiedAt: stats.mtime,
          downloadUrl: `/api/pdf/download/${encodeURIComponent(file)}`
        }
      })
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)) // Сортировка по дате создания (новые сверху)

    res.json({
      success: true,
      files,
      totalFiles: files.length
    })

  } catch (error) {
    console.error('Error reading PDF directory:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to read PDF files',
      details: error.message
    })
  }
})

// API для скачивания PDF файла
router.get('/pdf/download/:filename', (req, res) => {
  try {
    const filename = req.params.filename

    // Проверка на безопасность - запрещаем выход за пределы директории
    if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
      return res.status(400).json({ error: 'Invalid filename' })
    }

    // Проверяем, что это PDF файл
    if (!filename.endsWith('.pdf')) {
      return res.status(400).json({ error: 'Only PDF files are allowed' })
    }

    const filePath = path.join(PDF_STORAGE_DIR, filename)

    // Проверяем существование файла
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'File not found' })
    }

    // Устанавливаем заголовки для скачивания
    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(filename)}"`)

    // Отправляем файл
    res.sendFile(filePath)

  } catch (error) {
    console.error('Error downloading PDF:', error)
    res.status(500).json({
      error: 'Failed to download file',
      details: error.message
    })
  }
})

// Endpoint для удаления PDF файла
router.delete('/pdf/delete/:filename', async (req, res) => {
  try {
    const { filename } = req.params

    if (!filename) {
      return res.status(400).json({ error: 'Filename is required' })
    }

    // Проверяем что это PDF файл
    if (!filename.endsWith('.pdf')) {
      return res.status(400).json({ error: 'Only PDF files can be deleted' })
    }

    const filePath = path.join(PDF_STORAGE_DIR, filename)

    // Проверяем существование файла
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'File not found' })
    }

    // Удаляем файл
    fs.unlinkSync(filePath)

    res.json({
      success: true,
      message: 'File deleted successfully',
      filename: filename
    })

  } catch (error) {
    console.error('Error deleting PDF:', error)
    res.status(500).json({
      error: 'Failed to delete file',
      details: error.message
    })
  }
})

// Функция для форматирования размера файла
function formatFileSize(bytes) {
  if (bytes === 0) return '0 B'

  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))

  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
}

export default router