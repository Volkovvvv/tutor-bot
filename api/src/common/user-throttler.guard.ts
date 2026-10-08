import { Injectable } from '@nestjs/common'
import { ThrottlerGuard } from '@nestjs/throttler'

/**
 * Лимит запросов считается на репетитора, а не на IP.
 *
 * За прокси хостинга и за общим адресом мобильного оператора у разных
 * людей один IP: лимит на адрес делил бы 60 запросов в минуту на всех.
 * Открытые роуты (вход, webhook) по-прежнему считаются по IP.
 */
@Injectable()
export class UserThrottlerGuard extends ThrottlerGuard {
  protected async getTracker(req: Record<string, any>): Promise<string> {
    return req.user?.tutorId ?? req.ip
  }
}
