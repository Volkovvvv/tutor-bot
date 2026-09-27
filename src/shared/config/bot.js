// Имя бота подставляется при сборке: VITE_BOT_USERNAME=my_tutor_bot npm run build
// Пока бота нет — используется заглушка, ссылки всё равно формируются корректно.
export const BOT_USERNAME = import.meta.env?.VITE_BOT_USERNAME || 'your_tutor_bot'

export const BOT_CONFIGURED = Boolean(import.meta.env?.VITE_BOT_USERNAME)
