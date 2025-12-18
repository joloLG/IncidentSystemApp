declare module '@capacitor/network' {
  export interface ConnectionStatus {
    connected: boolean
    connectionType?: string
  }
  export interface NetworkPlugin {
    getStatus: () => Promise<ConnectionStatus>
    addListener: (eventName: 'networkStatusChange', listenerFunc: (status: ConnectionStatus) => void) => Promise<{ remove: () => Promise<void> }>
  }
  export const Network: NetworkPlugin
}

export {}
