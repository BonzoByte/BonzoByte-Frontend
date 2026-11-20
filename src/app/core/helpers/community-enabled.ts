import { environment } from '@env/environment';
export const COMMUNITY_ENABLED = 'communityEnabled' in environment && environment.communityEnabled === true;
