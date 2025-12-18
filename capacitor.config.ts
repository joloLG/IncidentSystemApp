import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.incidentSystem.mdrrmo',
  appName: 'MDRRMO App Bulan',
  webDir: 'public',
  server: { url: 'https://mdrrmo-system.vercel.app/', cleartext: false }
};

export default config;
