import { requestPos } from '../../core/api/posApi';
import type { CounterSession } from '../sales/salesOutbox';

export type OrganizationDetails = {
  id: string;
  name: string;
  settings: Record<string, unknown>;
  activeSession: CounterSession | null;
};

/** Loads the shared business settings and current counter session in one request. */
export async function loadOrganizationDetails(token: string, tenantId: string): Promise<OrganizationDetails> {
  const data = await requestPos<{
    organization: {
      id: string;
      name: string;
      config?: Record<string, unknown>;
      activeSession: CounterSession | null;
    };
  }>(
    token,
    tenantId,
    `query OrganizationBootstrap($id: String!) {
    organization(id: $id) {
      id name
      activeSession { id counterId status }
      config { businessType logoUrl primaryColor timezone language currency taxId features }
    }
  }`,
    { id: tenantId },
  );
  const organization = data.organization;
  if (!organization?.id) throw new Error('Organization details were not returned.');
  const activeSession = organization.activeSession;
  return {
    id: String(organization.id),
    name: organization.name || 'Business',
    settings: organization.config ?? {},
    activeSession:
      activeSession?.status?.toUpperCase() === 'OPEN'
        ? {
            id: String(activeSession.id),
            counterId: String(activeSession.counterId),
            status: activeSession.status,
          }
        : null,
  };
}
