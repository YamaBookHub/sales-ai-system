import { HealthController } from '../health/health.controller';
import { TrackingController } from '../tracking/tracking.controller';
import { AuthController } from './auth.controller';
import { IS_PUBLIC_ROUTE } from './public.decorator';

describe('public route contract', () => {
  it('keeps only login, health, OAuth/local entry points, and open/click tracking public', () => {
    const publicHandlers = [
      AuthController.prototype.login,
      AuthController.prototype.googleStart,
      AuthController.prototype.googleCallback,
      AuthController.prototype.localLogin,
      HealthController.prototype.health,
      HealthController.prototype.ready,
      TrackingController.prototype.trackOpen,
      TrackingController.prototype.trackClick,
      TrackingController.prototype.publicUnsubscribePage,
      TrackingController.prototype.publicUnsubscribe
    ];
    const protectedHandlers = [
      AuthController.prototype.me,
      AuthController.prototype.logout,
      TrackingController.prototype.createTrackedLink,
      TrackingController.prototype.getMailEngagement,
      TrackingController.prototype.unsubscribe
    ];

    for (const handler of publicHandlers) {
      expect(Reflect.getMetadata(IS_PUBLIC_ROUTE, handler)).toBe(true);
    }
    for (const handler of protectedHandlers) {
      expect(Reflect.getMetadata(IS_PUBLIC_ROUTE, handler)).not.toBe(true);
    }
  });
});
