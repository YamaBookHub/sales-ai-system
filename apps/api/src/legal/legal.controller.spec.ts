import { IS_PUBLIC_ROUTE } from '../auth/public.decorator';
import { LegalController } from './legal.controller';

describe('LegalController', () => {
  it('publishes privacy and terms pages without authentication', () => {
    expect(Reflect.getMetadata(IS_PUBLIC_ROUTE, LegalController.prototype.privacy)).toBe(true);
    expect(Reflect.getMetadata(IS_PUBLIC_ROUTE, LegalController.prototype.terms)).toBe(true);
    const controller = new LegalController();
    expect(controller.privacy()).toContain('プライバシーポリシー');
    expect(controller.privacy()).toContain('配信停止');
    expect(controller.terms()).toContain('利用規約');
  });
});
