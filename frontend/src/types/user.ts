export enum Role {
  ADMIN = 'ADMIN',
  AGENT = 'AGENT',
}

export type UserStatus = 'ONLINE' | 'BUSY' | 'OFFLINE';

export interface User {
  id: string;
  email: string;
  name: string;
  role: Role;
  companyId: string;
  departmentId?: string | null;
  onlineStatus?: UserStatus;
  isActive: boolean;
}

export interface AuthResponse {
  user: User;
  token: string;
}
