@echo off
echo Testing OpenAI Summary Generation...
curl -X POST http://localhost:3001/api/generate-summary ^
-H "Content-Type: application/json" ^
-d "{\"session\": \"Клієнт розповідав про стрес на роботі\", \"client\": \"Тест\", \"date\": \"16.09.2024\"}"
pause