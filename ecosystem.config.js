module.exports = {
  apps: [{
    name: 'session-summary',
    script: './backend/server.js',
    cwd: '/root/session-summary',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '500M'
  }]
}