export interface ResetPasswordResponse {
    message: string;
  }
  
  export interface RequestResetPasswordResponse {
    message: string;
  }
  
  export interface LoginResponse {
    token: string;
    user: {
      email: string;
      nickname?: string;
      name?: string;
      avatarUrl?: string;
      isAdmin: boolean;
  // Extend only when the backend authentication contract adds stable fields.
    };
  }
  
  export interface RegisterResponse {
    message: string;
    user: {
      email: string;
      name: string;
      // ...
    };
  }
  
  export interface MeResponse {
    user: {
      email: string;
      nickname?: string;
      name?: string;
      avatarUrl?: string;
      isAdmin: boolean;
      // ...
    };
  }

  export interface ResetPasswordResponse {
    message: string;
  }
