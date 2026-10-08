import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Query, Res } from '@nestjs/common'
import { Throttle } from '@nestjs/throttler'
import type { Response } from 'express'
import type { AuthUser } from '../auth/auth.types'
import { CurrentUser } from '../auth/decorators/current-user.decorator'
import { Public } from '../auth/decorators/public.decorator'
import { GenerateMaterialDto, PdfLinkDto, UpdateMaterialDto } from './dto/generate-material.dto'
import { MaterialsService, type MaterialView } from './materials.service'

@Controller()
export class MaterialsController {
  constructor(private readonly materials: MaterialsService) {}

  // ?lessonId — материал одного урока (список из 0 или 1 элемента): экран урока
  // не должен скачивать тексты всех материалов репетитора и опрашивать их целиком
  @Get('materials')
  list(
    @CurrentUser() user: AuthUser,
    @Query('lessonId', new ParseUUIDPipe({ optional: true })) lessonId?: string,
  ): Promise<MaterialView[]> {
    return this.materials.list(user.tutorId, lessonId)
  }

  // Каждая генерация — запрос к ИИ: у бесплатных моделей жёсткий
  // лимит на весь ключ, один активный пользователь не должен его выбрать.
  @Throttle({ default: { limit: 20, ttl: 60 * 60_000 } })
  @Post('lessons/:id/material')
  generate(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) lessonId: string,
    @Body() dto: GenerateMaterialDto,
  ): Promise<MaterialView> {
    return this.materials.generate(user.tutorId, lessonId, dto)
  }

  @Patch('lessons/:id/material')
  update(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) lessonId: string,
    @Body() dto: UpdateMaterialDto,
  ): Promise<MaterialView> {
    return this.materials.update(user.tutorId, lessonId, dto.content)
  }

  @Delete('lessons/:id/material')
  remove(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) lessonId: string,
  ): Promise<{ deleted: true }> {
    return this.materials.remove(user.tutorId, lessonId)
  }

  @Throttle({ default: { limit: 30, ttl: 60 * 60_000 } })
  @Post('lessons/:id/material/send')
  send(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) lessonId: string,
  ): Promise<{ sent: true }> {
    return this.materials.sendToTutor(user.tutorId, lessonId)
  }

  @Post('lessons/:id/material/pdf-link')
  pdfLink(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) lessonId: string,
    @Body() dto: PdfLinkDto,
  ): Promise<{ token: string; filename: string }> {
    return this.materials.pdfLink(user.tutorId, lessonId, dto.answers === true)
  }

  // Открыт без JWT: файл качает Telegram или браузер, а не приложение.
  // Доступ даёт короткоживущий токен из pdf-link.
  @Public()
  @Get('materials/pdf')
  async pdf(@Query('token') token: string, @Res() res: Response): Promise<void> {
    const { pdf, filename } = await this.materials.pdfByToken(token ?? '')
    res.attachment(filename).type('application/pdf').send(pdf)
  }
}
