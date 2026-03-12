import { HubUser } from '../../types/types';

export function getPublicHubUser(user: HubUser) {
  return {
    id: user.id,
    email: user.email,
    photo: user.photo ?? null,
    name: user.name,
    role: user.role ?? null,
  };
}
