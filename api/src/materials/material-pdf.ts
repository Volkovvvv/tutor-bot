import { join } from 'node:path'
import PDFDocument from 'pdfkit'
import type { MaterialContent } from './material-content'

// dist/materials → api/assets/fonts; из ts-jest — src/materials, путь тот же
const FONTS = join(__dirname, '..', '..', 'assets', 'fonts')

// Палитра мини-аппа (src/shared/ui/styles/tokens.css)
const C = {
  ground1: '#b3a8e6',
  ground2: '#a396db',
  ground3: '#8f81cf',
  accent: '#d8ee7e',
  accentInk: '#2b2b1a',
  ink: '#26223a',
  text: '#3a3552',
  muted: '#5b5578',
  soft: '#efecfb',
}

export interface PdfInput {
  subject: string
  topic: string
  studentName: string
  /** «10 класс · ЕГЭ» */
  level: string | null
  /** «29 сентября 2026» */
  date: string
  /** «Анна Сергеевна · репетитор по физике» */
  tutorLine: string
  content: MaterialContent
  /** Версия для репетитора: в конце страница с ответами. */
  withAnswers?: boolean
}

const PAGE = { left: 64, right: 56, top: 48, bottom: 56 }
const STRIPE = 8

export function renderMaterialPdf(input: PdfInput): Promise<Buffer> {
  const doc = new PDFDocument({
    size: 'A4',
    margins: PAGE,
    bufferPages: true,
    info: { Title: input.content.title ?? input.topic, Author: input.tutorLine, Subject: input.subject },
  })
  doc.registerFont('display', join(FONTS, 'Oswald-Bold.ttf'))
  doc.registerFont('display-semi', join(FONTS, 'Oswald-SemiBold.ttf'))
  doc.registerFont('body', join(FONTS, 'Inter-Regular.ttf'))
  doc.registerFont('body-semi', join(FONTS, 'Inter-SemiBold.ttf'))

  const done = new Promise<Buffer>((resolve, reject) => {
    const chunks: Buffer[] = []
    doc.on('data', (c: Buffer) => chunks.push(c))
    doc.on('end', () => resolve(Buffer.concat(chunks)))
    doc.on('error', reject)
  })

  const W = doc.page.width
  const x = PAGE.left
  const width = W - PAGE.left - PAGE.right
  const bottom = () => doc.page.height - PAGE.bottom
  const ensure = (h: number) => {
    if (doc.y + h > bottom()) doc.addPage()
  }

  drawHeader(doc, input, x, width)

  // ─── 01 · Теория ───
  sectionTitle(doc, '01 · Теория', x)
  const exIndent = 12
  for (const t of input.content.theory) {
    doc.font('body-semi').fontSize(11.5)
    ensure(doc.heightOfString(t.h, { width }) + 30)
    doc.fillColor(C.ink).text(t.h, x, doc.y, { width })
    doc.moveDown(0.15)
    doc.font('body').fontSize(11).fillColor(C.text).text(t.p, x, doc.y, { width, lineGap: 2 })
    if (t.ex) {
      // Мини-пример — с лаймовой чертой слева, чтобы глаз находил его сразу
      doc.font('body').fontSize(10.5)
      const exH = doc.heightOfString(t.ex, { width: width - exIndent, lineGap: 2 })
      ensure(exH + 6)
      const exY = doc.y + 5
      doc.rect(x, exY, 3, exH - 1).fill(C.accent)
      doc.fillColor(C.muted).text(t.ex, x + exIndent, exY, { width: width - exIndent, lineGap: 2 })
    }
    doc.moveDown(0.8)
  }

  if (input.content.mistakes.length > 0) {
    doc.font('body-semi').fontSize(11.5)
    ensure(50)
    doc.fillColor(C.ink).text('Типичные ошибки', x, doc.y, { width })
    doc.moveDown(0.25)
    for (const m of input.content.mistakes) {
      doc.font('body').fontSize(11)
      ensure(doc.heightOfString(m, { width: width - exIndent, lineGap: 2 }) + 4)
      const y = doc.y
      doc.circle(x + 3, y + 7, 2).fill(C.ground3)
      doc.fillColor(C.text).text(m, x + exIndent, y, { width: width - exIndent, lineGap: 2 })
      doc.moveDown(0.3)
    }
    doc.moveDown(0.5)
  }

  // ─── 02 · Разбор примера ───
  doc.moveDown(0.4)
  sectionTitle(doc, '02 · Разбор примера', x)
  const pad = 14
  const inner = width - pad * 2
  const { task, solution } = input.content.example
  doc.font('body-semi').fontSize(11)
  const taskH = doc.heightOfString(task, { width: inner, lineGap: 2 })
  doc.font('body').fontSize(11)
  const solH = doc.heightOfString(solution, { width: inner, lineGap: 2 })
  const boxH = pad + taskH + 6 + solH + pad
  ensure(boxH)
  const boxY = doc.y
  doc.roundedRect(x, boxY, width, boxH, 10).fill(C.soft)
  doc.font('body-semi').fontSize(11).fillColor(C.ink).text(task, x + pad, boxY + pad, { width: inner, lineGap: 2 })
  doc.font('body').fontSize(11).fillColor(C.text).text(solution, x + pad, doc.y + 6, { width: inner, lineGap: 2 })
  doc.y = boxY + boxH + 18

  // ─── 03 · Домашнее задание ───
  sectionTitle(doc, '03 · Домашнее задание', x)
  const numW = 30
  const numbered = (items: { text: string; tag: string | null }[]) => {
    items.forEach((item, i) => {
      doc.font('body').fontSize(11)
      const h = doc.heightOfString(item.text, { width: width - numW, lineGap: 2 }) + (item.tag ? 13 : 0)
      ensure(h + 8)
      const y = doc.y
      doc.circle(x + 9, y + 7.5, 9).fill(C.accent)
      doc
        .font('display')
        .fontSize(9.5)
        .fillColor(C.accentInk)
        .text(String(i + 1), x, y + 1.5, { width: 18, align: 'center', lineBreak: false })
      doc.y = y
      if (item.tag) {
        doc.font('display-semi').fontSize(8).fillColor(C.ground3)
        doc.text(item.tag.toUpperCase(), x + numW, y + 1, { characterSpacing: 1, lineBreak: false })
        doc.y = y + 13
      }
      doc.font('body').fontSize(11).fillColor(C.ink).text(item.text, x + numW, doc.y, { width: width - numW, lineGap: 2 })
      doc.y = Math.max(doc.y, y + 18) + 8
    })
  }
  numbered(input.content.homework.map((h) => ({ text: h.task, tag: h.tag })))

  // ─── Подпись ───
  ensure(40)
  doc.y += 12
  const lineY = doc.y
  doc.moveTo(x, lineY).lineTo(x + width, lineY).lineWidth(1).strokeColor(C.soft).stroke()
  doc.font('body-semi').fontSize(9.5).fillColor(C.muted)
  doc.text(input.tutorLine, x, lineY + 10, { width: width * 0.65, lineBreak: false, ellipsis: true })
  doc.text('Вопросы — в Telegram', x, lineY + 10, { width, align: 'right', lineBreak: false })

  // ─── Ответы: отдельной страницей, чтобы её было легко не отдавать ───
  if (input.withAnswers) {
    doc.addPage()
    doc.y = PAGE.top
    sectionTitle(doc, 'Ответы · только для репетитора', x)
    numbered(input.content.homework.map((h) => ({ text: h.answer ?? '—', tag: null })))
  }

  // Лаймовая полоса слева — на каждой странице, как у карточки в макете
  const range = doc.bufferedPageRange()
  for (let i = range.start; i < range.start + range.count; i++) {
    doc.switchToPage(i)
    const H = doc.page.height
    const grad = doc.linearGradient(0, 0, 0, H)
    grad.stop(0, C.accent).stop(1, C.ground3)
    doc.rect(0, 0, STRIPE, H).fill(grad)
  }

  doc.end()
  return done
}

function drawHeader(doc: PDFKit.PDFDocument, input: PdfInput, x: number, width: number): void {
  const W = doc.page.width
  const topic = (input.content.title ?? input.topic).toUpperCase()
  const padTop = 40
  const padBottom = 30

  doc.font('display').fontSize(30)
  const topicH = doc.heightOfString(topic, { width: width - 60, lineGap: -4 })
  const headerH = padTop + 18 + 12 + topicH + 10 + 14 + padBottom

  const grad = doc.linearGradient(0, 0, W * 0.6, headerH * 1.6)
  grad.stop(0, C.ground1).stop(0.55, C.ground2).stop(1, C.ground3)
  doc.rect(0, 0, W, headerH).fill(grad)

  // Сетка тетрадного листа
  doc.save()
  doc.lineWidth(0.5).strokeColor('#ffffff').strokeOpacity(0.14)
  for (let gx = 0; gx <= W; gx += 18) doc.moveTo(gx, 0).lineTo(gx, headerH)
  for (let gy = 0; gy <= headerH; gy += 18) doc.moveTo(0, gy).lineTo(W, gy)
  doc.stroke()
  doc.restore()

  // Декоративный знак, как в макете
  doc.save()
  doc.rotate(-12, { origin: [W - 70, 50] })
  doc.font('display-semi').fontSize(84).fillColor('#ffffff').fillOpacity(0.28)
  doc.text('÷', W - 110, 6, { lineBreak: false })
  doc.restore()

  // Плашка «Физика · 9 класс»
  const pill = [input.subject, input.level].filter(Boolean).join(' · ').toUpperCase()
  doc.font('display-semi').fontSize(8.5)
  // widthOfString не учитывает characterSpacing — добавляем вручную
  const pillW = Math.min(doc.widthOfString(pill) + pill.length * 1 + 18, width)
  const pillY = padTop
  doc.roundedRect(x, pillY, pillW, 18, 9).fill(C.accent)
  doc.fillColor(C.accentInk).text(pill, x + 9, pillY + 4, { characterSpacing: 1, lineBreak: false })

  doc.font('display').fontSize(30).fillColor('#ffffff')
  doc.text(topic, x, pillY + 18 + 12, { width: width - 60, lineGap: -4 })

  doc.font('body-semi').fontSize(10.5).fillColor(C.ink)
  doc.text(`${input.studentName} · ${input.date}`, x, doc.y + 8, { width })

  doc.x = x
  doc.y = headerH + 28
}

function sectionTitle(doc: PDFKit.PDFDocument, title: string, x: number): void {
  if (doc.y + 70 > doc.page.height - PAGE.bottom) doc.addPage()
  doc.font('display-semi').fontSize(10.5).fillColor(C.ground3)
  doc.text(title.toUpperCase(), x, doc.y, { characterSpacing: 1.6 })
  doc.moveDown(0.6)
}
