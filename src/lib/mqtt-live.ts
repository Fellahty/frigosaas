// src/lib/mqtt-live.ts
import mqtt, { MqttClient } from 'mqtt';

const TOKEN = 'HhV7gaTAbCMRSdwh3WID7WZx7XXdaEXoaQB8PjWuH2gsbRRdihgGRcCjKZ6lOa4o';
const DEVICE_ID = 6925665;

export interface MQTTMessage {
  topic: string;
  data: any;
  timestamp: number;
}

export interface SensorData {
  timestamp: number;
  temperature: number;
  humidity: number;
  battery: number;
  magnet: number;
}

class MQTTLiveService {
  private client: MqttClient | null = null;
  private isConnected = false;
  private messageCallbacks: ((message: MQTTMessage) => void)[] = [];
  private sensorDataCallbacks: ((data: SensorData) => void)[] = [];
  private telemetryBuffer: { [key: string]: any } = {};

  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.client = mqtt.connect('wss://mqtt.flespi.io:443', {
          username: `FlespiToken ${TOKEN}`,
          password: '', // Password vide selon la config qui fonctionne
          protocolVersion: 5, // MQTT 5.0
          clean: true,
          reconnectPeriod: 10000, // 10 seconds
          connectTimeout: 15000, // 15 seconds
          keepalive: 60,
          clientId: `frigo-saas-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          wsOptions: {
            objectMode: false,
            perMessageDeflate: true
          },
          properties: {
            requestResponseInformation: false,
            requestProblemInformation: false
          }
        });

        this.client.on('connect', () => {
          console.log('🔌 [MQTT] Connected to Flespi broker');
          this.isConnected = true;
          
          // Subscribe to device messages
          this.client!.subscribe(`flespi/message/gw/devices/${DEVICE_ID}`, (err) => {
            if (err) {
              console.error('❌ [MQTT] Failed to subscribe to messages:', err);
            } else {
              console.log('📡 [MQTT] Subscribed to device messages');
            }
          });

          // Subscribe to telemetry updates
          this.client!.subscribe(`flespi/state/gw/devices/${DEVICE_ID}/telemetry/+`, (err) => {
            if (err) {
              console.error('❌ [MQTT] Failed to subscribe to telemetry:', err);
            } else {
              console.log('📊 [MQTT] Subscribed to telemetry updates');
            }
          });

          resolve();
        });

        this.client.on('message', (topic, payload) => {
          try {
            const data = JSON.parse(payload.toString());
            const message: MQTTMessage = {
              topic,
              data,
              timestamp: Date.now()
            };

            console.log('📨 [MQTT] Received message:', { topic, data });

            // Notify all message callbacks
            this.messageCallbacks.forEach(callback => {
              try {
                callback(message);
              } catch (err) {
                console.error('❌ [MQTT] Error in message callback:', err);
              }
            });

            // Process sensor data if it's a complete message
            if (topic.includes('flespi/message/gw/devices/')) {
              this.processSensorMessage(data);
            }

            // Process telemetry updates
            if (topic.includes('flespi/state/gw/devices/') && topic.includes('/telemetry/')) {
              this.processTelemetryUpdate(topic, data);
            }

          } catch (err) {
            console.error('❌ [MQTT] Error parsing message:', err);
          }
        });

        this.client.on('error', (err) => {
          console.error('❌ [MQTT] Connection error:', err);
          this.isConnected = false;
          
          // Don't reject immediately, try to handle gracefully
          console.log('🔄 [MQTT] Will attempt reconnection...');
        });

        this.client.on('close', () => {
          console.log('🔌 [MQTT] Connection closed');
          this.isConnected = false;
        });

        this.client.on('reconnect', () => {
          console.log('🔄 [MQTT] Reconnecting...');
        });

      } catch (err) {
        console.error('❌ [MQTT] Failed to create connection:', err);
        reject(err);
      }
    });
  }

  private processSensorMessage(data: any) {
    try {
      // Check if message has both temperature and humidity
      if (data['ble.sensor.temperature.1'] !== undefined && 
          data['ble.sensor.humidity.1'] !== undefined) {
        
        const temp = parseFloat(data['ble.sensor.temperature.1']);
        const humidity = parseFloat(data['ble.sensor.humidity.1']);
        const battery = parseFloat(data['battery.voltage']) || 0;
        
        // Handle magnet sensor
        let magnet = 0;
        const magnetData = data['ble.sensor.magnet.status.1'];
        if (magnetData !== undefined && magnetData !== null) {
          if (typeof magnetData === 'boolean') {
            magnet = magnetData ? 1 : 0;
          } else {
            magnet = parseFloat(magnetData) || 0;
          }
        }

        const sensorData: SensorData = {
          timestamp: data.timestamp ? new Date(data.timestamp * 1000).getTime() : Date.now(),
          temperature: temp,
          humidity: humidity,
          battery: battery,
          magnet: magnet
        };

        console.log('📊 [MQTT] Processed sensor data:', sensorData);

        // Notify all sensor data callbacks
        this.sensorDataCallbacks.forEach(callback => {
          try {
            callback(sensorData);
          } catch (err) {
            console.error('❌ [MQTT] Error in sensor data callback:', err);
          }
        });
      }
    } catch (err) {
      console.error('❌ [MQTT] Error processing sensor message:', err);
    }
  }

  private processTelemetryUpdate(topic: string, data: any) {
    try {
      // Extract sensor type from topic
      const sensorType = topic.split('/').pop();
      console.log('📈 [MQTT] Telemetry update:', { sensorType, data });

      // Process sensor data from telemetry
      if (sensorType === 'ble.sensor.temperature.1' || 
          sensorType === 'ble.sensor.humidity.1' || 
          sensorType === 'battery.voltage' || 
          sensorType === 'ble.sensor.magnet.status.1') {
        
        console.log('🔍 [MQTT] Processing sensor telemetry:', { sensorType, data });
        
        // Store telemetry data temporarily
        if (!this.telemetryBuffer) {
          this.telemetryBuffer = {};
        }
        
        this.telemetryBuffer[sensorType] = data;
        
        // Check if we have temperature data (minimum requirement)
        if (this.telemetryBuffer['ble.sensor.temperature.1'] !== undefined) {
          
          const sensorData: SensorData = {
            timestamp: Date.now(),
            temperature: parseFloat(this.telemetryBuffer['ble.sensor.temperature.1']) || 0,
            humidity: parseFloat(this.telemetryBuffer['ble.sensor.humidity.1']) || 0,
            battery: parseFloat(this.telemetryBuffer['battery.voltage']) || 0,
            magnet: this.telemetryBuffer['ble.sensor.magnet.status.1'] ? 1 : 0
          };

          console.log('📊 [MQTT] Processed telemetry sensor data:', sensorData);

          // Notify all sensor data callbacks
          this.sensorDataCallbacks.forEach(callback => {
            try {
              callback(sensorData);
            } catch (err) {
              console.error('❌ [MQTT] Error in sensor data callback:', err);
            }
          });

          // Clear buffer after processing
          this.telemetryBuffer = {};
        }
      }
    } catch (err) {
      console.error('❌ [MQTT] Error processing telemetry update:', err);
    }
  }

  onMessage(callback: (message: MQTTMessage) => void): () => void {
    this.messageCallbacks.push(callback);
    
    // Return unsubscribe function
    return () => {
      const index = this.messageCallbacks.indexOf(callback);
      if (index > -1) {
        this.messageCallbacks.splice(index, 1);
      }
    };
  }

  onSensorData(callback: (data: SensorData) => void): () => void {
    this.sensorDataCallbacks.push(callback);
    
    // Return unsubscribe function
    return () => {
      const index = this.sensorDataCallbacks.indexOf(callback);
      if (index > -1) {
        this.sensorDataCallbacks.splice(index, 1);
      }
    };
  }

  disconnect(): void {
    if (this.client) {
      console.log('🔌 [MQTT] Disconnecting...');
      this.client.end(true);
      this.client = null;
      this.isConnected = false;
    }
  }

  getConnectionStatus(): boolean {
    return this.isConnected;
  }
}

// Singleton instance
export const mqttLiveService = new MQTTLiveService();

// Export convenience functions
export const startLive = (onMessage: (message: MQTTMessage) => void) => {
  return mqttLiveService.onMessage(onMessage);
};

export const startSensorData = (onSensorData: (data: SensorData) => void) => {
  return mqttLiveService.onSensorData(onSensorData);
};

export const connectMQTT = () => mqttLiveService.connect();
export const disconnectMQTT = () => mqttLiveService.disconnect();
export const isMQTTConnected = () => mqttLiveService.getConnectionStatus();
