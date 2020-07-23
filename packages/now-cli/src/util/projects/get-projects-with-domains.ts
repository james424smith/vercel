import Client from '../client';
import wait from '../output/wait';
import { Project } from '../../types';
import { URLSearchParams } from 'url';

export async function getProjectsWithDomains(
  client: Client
): Promise<Project[] | Error> {
  const cancelWait = wait(`Fetching projects with domains`);
  try {
    const limit = 50;
    let result: Project[] = [];

    const query = new URLSearchParams({
      hasProductionDomains: '1',
      limit: limit.toString(),
    });

    for (let i = 0; i < 1000; i++) {
      const response = await client.fetch<Project[]>(`/v2/projects/?${query}`);
      result.push(...response);

      const [latest] = response.sort((a, b) => b.updatedAt - a.updatedAt);
      query.append('from', latest.updatedAt.toString());

      if (response.length !== limit) break;
    }

    return result;
  } catch (err) {
    if (err.status < 500) {
      return err;
    }

    throw err;
  } finally {
    cancelWait();
  }
}
