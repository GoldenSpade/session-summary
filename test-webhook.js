import axios from 'axios'

const testWebhook = async () => {
  try {
    const response = await axios.post('https://digitalunion.app.n8n.cloud/webhook-test/session-summary', {
      session: "Тестова сесія психолога",
      client: "Тестовий клієнт",
      date: new Date().toLocaleDateString('uk-UA')
    })
    console.log('Response:', response.data)
  } catch (error) {
    console.error('Error:', error.message)
  }
}

testWebhook()