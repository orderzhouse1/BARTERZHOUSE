import { APP_SERVICE_NAME, type HealthData } from '@barterzhouse/shared';

export function getHealthData(): HealthData {
  return {
    status: 'ok',
    service: APP_SERVICE_NAME,
    timestamp: new Date().toISOString(),
  };
}
