#!/usr/bin/env node
/**
 * Script de test pour diagnostiquer la connexion MQTT Flespi
 * Usage: node scripts/test-mqtt-connection.js
 */

import mqtt from 'mqtt';

const TOKEN = 'HLjLOPX7XObF3D6itPYgFmMP0Danfjg49eUofKdSwjyGY3hAKeBYkp7LC45Pznyj';
const DEVICE_ID = 6925665;

console.log('🔍 [MQTT Test] Starting Flespi MQTT connection test...');
console.log('📋 [MQTT Test] Device ID:', DEVICE_ID);
console.log('🔑 [MQTT Test] Token:', TOKEN.substring(0, 20) + '...');

// Test 1: Connexion basique
console.log('\n1️⃣ Testing basic MQTT connection...');
const client = mqtt.connect('wss://mqtt.flespi.io:9443', {
  username: 'FlespiToken',
  password: TOKEN,
  protocolVersion: 4,
  clean: true,
  connectTimeout: 10000,
  keepalive: 60,
  clientId: `test-${Date.now()}`,
  reconnectPeriod: 0 // Disable auto-reconnect for testing
});

client.on('connect', () => {
  console.log('✅ [MQTT Test] Connected successfully!');
  
  // Test 2: Subscription
  console.log('\n2️⃣ Testing subscription...');
  const topics = [
    `flespi/message/gw/devices/${DEVICE_ID}`,
    `flespi/state/gw/devices/${DEVICE_ID}/telemetry/+`
  ];
  
  topics.forEach(topic => {
    client.subscribe(topic, (err) => {
      if (err) {
        console.error(`❌ [MQTT Test] Failed to subscribe to ${topic}:`, err.message);
      } else {
        console.log(`✅ [MQTT Test] Subscribed to ${topic}`);
      }
    });
  });
  
  // Test 3: Wait for messages
  console.log('\n3️⃣ Waiting for messages (10 seconds)...');
  setTimeout(() => {
    console.log('⏰ [MQTT Test] Timeout reached, closing connection');
    client.end();
    process.exit(0);
  }, 10000);
});

client.on('message', (topic, payload) => {
  console.log(`📨 [MQTT Test] Received message on ${topic}:`, payload.toString().substring(0, 100) + '...');
});

client.on('error', (err) => {
  console.error('❌ [MQTT Test] Connection error:', err.message);
  console.error('🔍 [MQTT Test] Error details:', err);
});

client.on('close', () => {
  console.log('🔌 [MQTT Test] Connection closed');
});

client.on('offline', () => {
  console.log('📴 [MQTT Test] Client offline');
});

// Test 4: Alternative endpoints
console.log('\n4️⃣ Testing alternative MQTT endpoints...');
const alternatives = [
  'wss://mqtt.flespi.io:8883',  // Port alternatif
  'wss://mqtt.flespi.io:443',   // Port HTTPS
  'mqtts://mqtt.flespi.io:8883' // MQTTS au lieu de WSS
];

let testIndex = 0;
const testAlternative = () => {
  if (testIndex >= alternatives.length) {
    console.log('🏁 [MQTT Test] All tests completed');
    return;
  }
  
  const endpoint = alternatives[testIndex];
  console.log(`\n🔄 [MQTT Test] Testing ${endpoint}...`);
  
  const altClient = mqtt.connect(endpoint, {
    username: 'FlespiToken',
    password: TOKEN,
    protocolVersion: 4,
    clean: true,
    connectTimeout: 5000,
    clientId: `test-alt-${Date.now()}`
  });
  
  altClient.on('connect', () => {
    console.log(`✅ [MQTT Test] ${endpoint} - Connected!`);
    altClient.end();
    testIndex++;
    setTimeout(testAlternative, 1000);
  });
  
  altClient.on('error', (err) => {
    console.error(`❌ [MQTT Test] ${endpoint} - Error:`, err.message);
    altClient.end();
    testIndex++;
    setTimeout(testAlternative, 1000);
  });
};

// Start alternative tests after 15 seconds
setTimeout(testAlternative, 15000);
