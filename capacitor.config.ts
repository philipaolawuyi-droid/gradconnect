import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.gradconnect.app',
  appName: 'GradConnect',
  // Vite writes the browser bundle to dist/public; Capacitor must copy the
  // directory that actually contains index.html into each native project.
  webDir: 'dist/public',
  server: {
    androidScheme: 'https'
  },
  plugins: {
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert'],
    },
  },
};

export default config;
