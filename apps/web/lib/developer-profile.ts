export interface DeveloperLink {
  readonly href: string;
  readonly label: string;
  readonly value: string;
}

export interface DeveloperProfile {
  readonly fullName: string;
  readonly location: string;
  readonly role: string;
  readonly links: readonly DeveloperLink[];
}

export const developerProfile: DeveloperProfile = {
  fullName: 'Leonardo Alcides Leguizamón Alegre',
  location: 'San Juan Bautista, Misiones, Paraguay',
  role: 'Desarrollador y responsable del sistema OES',
  links: [
    {
      href: 'https://github.com/leoleguizamonpy',
      label: 'GitHub',
      value: '@leoleguizamonpy',
    },
  ],
};
