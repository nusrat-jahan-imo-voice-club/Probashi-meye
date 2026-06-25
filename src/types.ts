export interface CardData {
  name: string;
  subtitle: string;
  countryCode: string;
  phoneNumber: string;
  message: string;
  avatarUrl: string;
  qrColor: string;
  cardTheme: 'classic' | 'whatsapp' | 'slate' | 'emerald' | 'dark';
  showLogo: boolean;
}

export interface CountryOption {
  code: string;
  name: string;
  flag: string;
  placeholder: string;
}

export const COUNTRIES: CountryOption[] = [
  { code: '+880', name: 'Bangladesh', flag: '🇧🇩', placeholder: '1712-345678' },
  { code: '+1', name: 'USA / Canada', flag: '🇺🇸', placeholder: '202-555-0143' },
  { code: '+91', name: 'India', flag: '🇮🇳', placeholder: '98765-43210' },
  { code: '+44', name: 'United Kingdom', flag: '🇬🇧', placeholder: '7911-123456' },
  { code: '+92', name: 'Pakistan', flag: '🇵🇰', placeholder: '300-1234567' },
  { code: '+966', name: 'Saudi Arabia', flag: '🇸🇦', placeholder: '50-123-4567' },
  { code: '+971', name: 'UAE', flag: '🇦🇪', placeholder: '50-123-4567' },
  { code: '+60', name: 'Malaysia', flag: '🇲🇾', placeholder: '12-345-6789' },
  { code: '+65', name: 'Singapore', flag: '🇸🇬', placeholder: '8123-4567' },
];

export const PRESET_AVATARS = [
  {
    id: 'default',
    name: 'Serene Profile',
    url: '/src/assets/images/default_avatar_1782370919940.jpg',
  },
  {
    id: 'avatar1',
    name: 'Minimalist Portrait (Male)',
    url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=400&h=400',
  },
  {
    id: 'avatar2',
    name: 'Professional Headshot',
    url: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&q=80&w=400&h=400',
  },
  {
    id: 'avatar3',
    name: 'Creative Portrait (Female)',
    url: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&q=80&w=400&h=400',
  },
  {
    id: 'avatar4',
    name: 'Aesthetic Landscape Avatar',
    url: 'https://images.unsplash.com/photo-1518020382113-a7e8fc38eac9?auto=format&fit=crop&q=80&w=400&h=400',
  },
  {
    id: 'avatar5',
    name: 'Retro Illustration',
    url: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&q=80&w=400&h=400',
  },
];
