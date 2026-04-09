export type UserRole = "ernaehrungsberater" | "admin" | "assistent";

export interface UserProfile {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: UserRole;
}
