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
      // ...dodaj polja po potrebi
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