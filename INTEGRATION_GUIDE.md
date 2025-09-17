# Руководство по интеграции Fireflies → n8n → Backend

## Архитектура системы

```
[Fireflies] → [n8n Webhook] → [Backend API] → [OpenAI] → [PDF Generator]
```

## Доступные Endpoints

### 1. Webhook от Fireflies
**URL:** `POST http://localhost:3001/api/fireflies-webhook`

Принимает транскрипции от Fireflies и автоматически:
- Верифицирует подпись webhook
- Генерирует конспект через OpenAI
- Отправляет результат в n8n

### 2. Webhook от n8n
**URL:** `POST http://localhost:3001/api/n8n-webhook`

Принимает запросы от n8n для генерации конспектов:
```json
{
  "session": "текст сессии",
  "client": "имя клиента",
  "date": "дата",
  "generatePdf": true
}
```

### 3. Тестовые endpoints
- `POST /api/test-fireflies` - симулирует webhook от Fireflies
- `GET /api/test-n8n` - отправляет тестовые данные в n8n

## Настройка n8n Workflow

### Вариант 1: Прямая интеграция Fireflies → n8n → Backend

1. **Webhook Node (начальный)**
   - URL: `https://dgtlunion.app.n8n.cloud/webhook/session-summary`
   - HTTP Method: POST
   - Path: `/session-summary`

2. **HTTP Request Node**
   - Method: POST
   - URL: `http://ваш-сервер:3001/api/n8n-webhook`
   - Body (JSON):
   ```json
   {
     "session": "{{ $json.transcript }}",
     "client": "{{ $json.meeting_attendees[0].name }}",
     "date": "{{ $json.date }}",
     "generatePdf": false
   }
   ```

3. **Результат**
   - Получите сгенерированный конспект в `{{ $json.summary }}`

### Вариант 2: Fireflies → Backend → n8n

1. В Fireflies настройте webhook на:
   - URL: `http://ваш-сервер:3001/api/fireflies-webhook`

2. Backend автоматически отправит результат на n8n webhook

## Переменные окружения (.env)

```bash
# n8n Webhook URLs
N8N_WEBHOOK_PROD_URL=https://dgtlunion.app.n8n.cloud/webhook/session-summary

# Fireflies API
FIREFLIES_API_KEY=f91b2102-2609-46b5-ba1d-630fe107f827
FIREFLIES_WEBHOOK_KEY=24102f8a062f4015afd09113e362df8

# OpenAI API
OPENAI_API_KEY=ваш-ключ
```

## Тестирование

### 1. Запустите сервер
```bash
npm run server
```

### 2. Протестируйте Fireflies webhook
```bash
curl -X POST http://localhost:3001/api/test-fireflies
```

### 3. Протестируйте n8n webhook
```bash
curl -X POST http://localhost:3001/api/n8n-webhook \
  -H "Content-Type: application/json" \
  -d '{
    "session": "Тестовая психологическая сессия",
    "client": "Тестовый клиент",
    "date": "17.09.2025"
  }'
```

## Формат ответа

```json
{
  "success": true,
  "summary": "структурированный конспект",
  "metadata": {
    "client": "имя клиента",
    "date": "дата",
    "generatedAt": "timestamp"
  }
}
```

## Отладка

При возникновении проблем проверьте:
1. Логи сервера - там выводится детальная информация
2. Правильность API ключей в .env
3. Доступность сервера для внешних запросов
4. Настройки CORS если запросы идут из браузера