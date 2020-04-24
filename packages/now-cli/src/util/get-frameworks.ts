import { Framework } from '@now/frameworks';
import Client from './client';

export async function getFrameworks(client: Client) {
  return await client.fetch<Framework[]>('/v1/frameworks', {
    useCurrentTeam: false,
  });
}
