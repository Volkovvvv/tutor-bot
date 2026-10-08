-- Напоминание о долге — только по явному выбору репетитора.
-- Меняется лишь значение по умолчанию: уже сохранённые настройки не трогаем.
ALTER TABLE "tutors" ALTER COLUMN "notifyDebtReminder" SET DEFAULT false;
ALTER TABLE "notify_settings" ALTER COLUMN "debtReminder" SET DEFAULT false;
