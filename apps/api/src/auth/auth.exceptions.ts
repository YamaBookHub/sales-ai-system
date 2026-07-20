import { ForbiddenException, UnauthorizedException } from '@nestjs/common';

export class AuthenticationRequiredException extends UnauthorizedException {
  constructor() {
    super({ code: 'AUTHENTICATION_REQUIRED', message: 'ログインしてください。' });
  }
}

export class InactiveUserException extends ForbiddenException {
  constructor() {
    super({ code: 'USER_INACTIVE', message: 'このアカウントは利用できません。' });
  }
}

export class CsrfValidationException extends ForbiddenException {
  constructor() {
    super({ code: 'CSRF_VALIDATION_FAILED', message: 'リクエストを確認できませんでした。' });
  }
}

export class AuthorizationDeniedException extends ForbiddenException {
  constructor() {
    super({ code: 'AUTHORIZATION_DENIED', message: 'ログインを完了できませんでした。' });
  }
}
