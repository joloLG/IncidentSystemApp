export interface ConnectionStatus {
  connected: boolean
  connectionType?: string
}

export interface NetworkListenerHandle {
  remove: () => Promise<void>
}

export interface NetworkPlugin {
  getStatus: () => Promise<ConnectionStatus>
  addListener: (eventName: 'networkStatusChange', listenerFunc: (status: ConnectionStatus) => void) => Promise<NetworkListenerHandle>
}

declare const Network: NetworkPlugin

declare module '@capacitor/network' {
  export interface ConnectionStatus {
    connected: boolean
    connectionType?: string
  }
  export interface NetworkListenerHandle {
    remove: () => Promise<void>
  }
  export interface NetworkPlugin {
    getStatus: () => Promise<ConnectionStatus>
    addListener: (eventName: 'networkStatusChange', listenerFunc: (status: ConnectionStatus) => void) => Promise<NetworkListenerHandle>
  }
  export const Network: NetworkPlugin
}
